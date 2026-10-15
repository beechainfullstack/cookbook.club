import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/lib/database.types.ts';
import type { Config } from './config.ts';
import { maxGenerationCost, parseNote, priceUsage, SAFETY_MESSAGE, WEEKLY_MODEL } from './messages.ts';
import { countInput, generate, ProviderError, pushReceipts, send, sendEmail } from './providers.ts';

type Message = Database['public']['Tables']['messages']['Row'];
type Delivery = Database['public']['Tables']['message_deliveries']['Row'];
type Client = ReturnType<typeof createClient<Database>>;
export type WorkRequest = { action: 'work' | 'generate'; user_id?: string; deliver_now?: boolean };

async function checked<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error('database_operation_failed');
  return data;
}

async function contextFor(db: Client, message: Message) {
  const survey = await checked(db.from('survey_answers').select('*').eq('user_id', message.user_id).single());
  if (!survey) throw new Error('missing_survey');
  const lastMessages = await checked(db.from('messages').select('content').eq('user_id', message.user_id)
    .not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(4));
  const feedback = await checked(db.from('feedback').select('rating,comment').eq('user_id', message.user_id)
    .order('created_at', { ascending: false }).limit(20));
  const sky = await checked(db.from('sky_events').select('type,occurs_at,data,computation_source')
    .gte('occurs_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .lte('occurs_at', new Date(Date.now() + 7 * 86400000).toISOString()).order('occurs_at').limit(8));
  const { priorities, priorities_other, goals, goals_other, putting_off, inspirations } = survey;
  const context = { survey: { priorities, priorities_other, goals, goals_other, putting_off, inspirations },
    last_four_messages: lastMessages, feedback_history: feedback, computed_sky_data: sky };
  if (new TextEncoder().encode(JSON.stringify(context)).length > 64000) throw new Error('context_too_large');
  return { context, updatedAt: survey.updated_at };
}

async function generateOne(db: Client, config: Config, message: Message, request: typeof fetch): Promise<boolean> {
  let reservation: string | null = null;
  let usageRecorded = false;
  try {
    const { context, updatedAt } = await contextFor(db, message);
    const maximum = maxGenerationCost(await countInput(config, context, request));
    reservation = await checked(db.rpc('reserve_llm', { p_message_id: message.id, p_model: WEEKLY_MODEL, p_max_cost: maximum, p_budget: config.budget }));
    if (!reservation) {
      await checked(db.from('messages').update({ state: 'queued', error_code: 'budget_exhausted', generation_attempts: message.generation_attempts - 1 }).eq('id', message.id).eq('state', 'generating'));
      return false;
    }
    const response = await generate(config, context, request);
    const usage = priceUsage(response.usage);
    await checked(db.from('llm_usage').update({ ...usage, status: 'completed' }).eq('id', reservation));
    usageRecorded = true;
    if (response.stop_reason !== 'end_turn') throw new Error('incomplete_generation');
    const raw = response.content?.filter((part: { type: string }) => part.type === 'text').map((part: { text: string }) => part.text).join('');
    if (typeof raw !== 'string') throw new Error('invalid_note');
    const note = parseNote(raw);
    if (note.kind === 'safety') {
      await checked(db.from('users').update({ messaging_hold: true }).eq('id', message.user_id));
      await checked(db.from('messages').update({ state: 'cancelled', error_code: 'safety_hold' }).eq('id', message.id));
      await checked(db.rpc('enqueue_safety', { p_content: SAFETY_MESSAGE }));
    } else {
      await checked(db.from('messages').update({ content: note.content, state: 'ready', model: WEEKLY_MODEL,
        input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: usage.cost_usd,
        survey_updated_at: updatedAt, error_code: null }).eq('id', message.id).eq('state', 'generating'));
    }
  } catch (error) {
    const rejection = error instanceof ProviderError && error.status >= 400 && error.status < 500;
    if (reservation && !usageRecorded) await checked(db.from('llm_usage').update(rejection
      ? { status: 'failed', cost_usd: 0 } : { status: 'uncertain' }).eq('id', reservation));
    const retry = error instanceof ProviderError && error.status === 429 && message.generation_attempts < 3;
    await checked(db.from('messages').update({ state: retry ? 'queued' : 'failed',
      error_code: error instanceof ProviderError ? error.code : usageRecorded ? 'note_rejected' : 'generation_failed' })
      .eq('id', message.id).eq('state', 'generating'));
  }
  return true;
}

async function clearToken(db: Client, userId: string, token: string | null) {
  if (token) await checked(db.from('notification_settings').update({ expo_push_token: null }).eq('user_id', userId).eq('expo_push_token', token));
}

async function deliverOne(db: Client, config: Config, delivery: Delivery, request: typeof fetch) {
  const message = await checked(db.from('messages').select('*').eq('id', delivery.message_id).single());
  if (!message) throw new Error('missing_message');
  const settings = await checked(db.from('notification_settings').select('*').eq('user_id', message.user_id).single());
  const user = await checked(db.from('users').select('messaging_hold').eq('id', message.user_id).single());
  const survey = await checked(db.from('survey_answers').select('updated_at').eq('user_id', message.user_id).single());
  const channel = delivery.channel as 'email' | 'push';
  const recent = message.type === 'weekly' ? await checked(db.from('messages').select('id').eq('user_id', message.user_id)
    .neq('id', message.id).eq('type', 'weekly').gte('sent_at', new Date(Date.now() - 6 * 86400000).toISOString()).limit(1)) : [];
  if (!settings || !user || recent?.length || settings.paused || !settings.channels.includes(channel)
    || channel === 'push' && !settings.expo_push_token || message.state !== 'ready'
    || (message.type !== 'safety' && (user.messaging_hold || survey?.updated_at !== message.survey_updated_at))) {
    await checked(db.from('message_deliveries').update({ status: 'skipped', error_code: 'preferences_or_survey_changed' }).eq('id', delivery.id));
    return;
  }
  try {
    const { data, error } = await db.auth.admin.getUserById(message.user_id);
    if (error || !data.user?.email) throw new ProviderError('missing_email', 400);
    await checked(db.from('message_deliveries').update({ push_token: channel === 'push' ? settings.expo_push_token : null }).eq('id', delivery.id));
    const result = await send({ id: message.user_id, email: data.user.email, pushToken: settings.expo_push_token }, message, channel, config, request);
    await checked(db.from('message_deliveries').update({ status: 'accepted', provider_id: result.providerId, error_code: null }).eq('id', delivery.id));
    await checked(db.from('messages').update({ sent_at: new Date().toISOString() }).eq('id', message.id).is('sent_at', null));
  } catch (error) {
    if (error instanceof ProviderError && error.code === 'DeviceNotRegistered') await clearToken(db, message.user_id, settings.expo_push_token);
    const explicitRejection = error instanceof ProviderError && error.status >= 400 && error.status < 500;
    const retry = delivery.attempts < 3 && (channel === 'email' && !explicitRejection || error instanceof ProviderError && error.status === 429);
    await checked(db.from('message_deliveries').update({ status: retry ? 'pending' : explicitRejection ? 'failed' : 'uncertain',
      next_attempt_at: new Date(Date.now() + 60000 * 2 ** delivery.attempts).toISOString(),
      error_code: error instanceof ProviderError ? error.code : 'delivery_unknown' }).eq('id', delivery.id));
  }
}

async function collectReceipts(db: Client, config: Config, request: typeof fetch) {
  const deliveries = await checked(db.from('message_deliveries').select('*').eq('channel', 'push').eq('status', 'accepted')
    .lt('attempted_at', new Date(Date.now() - 15 * 60000).toISOString()).limit(100));
  if (!deliveries?.length) return;
  const receipts = await pushReceipts(deliveries.flatMap((d) => d.provider_id ? [d.provider_id] : []), config, request);
  for (const delivery of deliveries) {
    const receipt = receipts[delivery.provider_id ?? ''];
    const expired = Date.now() - new Date(delivery.attempted_at!).getTime() > 23 * 3600000;
    if (!receipt && !expired) continue;
    const code = receipt?.details?.error;
    if (code === 'DeviceNotRegistered') {
      const message = await checked(db.from('messages').select('user_id').eq('id', delivery.message_id).single());
      if (message) await clearToken(db, message.user_id, delivery.push_token);
    }
    await checked(db.from('message_deliveries').update({ status: receipt?.status === 'ok' ? 'delivered' : receipt ? 'failed' : 'uncertain',
      error_code: receipt?.status === 'ok' ? null : code === 'DeviceNotRegistered' ? code : receipt ? 'push_receipt_error' : 'receipt_missing' }).eq('id', delivery.id));
  }
}

async function alertBudget(db: Client, config: Config, request: typeof fetch) {
  const alerts = await checked(db.rpc('claim_budget_alert'));
  for (const alert of alerts ?? []) {
    try {
      const text = 'Slow stopped new message generation before exceeding its monthly LLM budget. Review llm_usage in Supabase, including reserved or uncertain calls, before changing the budget. Existing notes can still be delivered.';
      await sendEmail(config, config.adminEmail, 'Slow: monthly generation budget reached', text, `<p>${text}</p>`, `slow-budget/${alert.month}`, request);
      await checked(db.from('budget_alerts').update({ sent_at: new Date().toISOString() }).eq('month', alert.month));
    } catch {
      // Leave the lease to expire before retrying the same idempotency key.
    }
  }
}

export async function runWorker(config: Config, input: WorkRequest, providerFetch: typeof fetch = fetch) {
  const db = createClient<Database>(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const deadline = Date.now() + 100000;
  const result = { enqueued: 0, generated: 0, deliveries_attempted: 0 };
  if (input.action === 'generate') result.enqueued = await checked(db.rpc('enqueue_weekly', {
    p_user_id: input.user_id, p_deliver_now: input.deliver_now ?? false,
  })) ?? 0;
  await checked(db.rpc('enqueue_safety', { p_content: SAFETY_MESSAGE }));
  await checked(db.rpc('prepare_deliveries'));
  try { await collectReceipts(db, config, providerFetch); } catch { /* Receipts are retried on the next scheduled tick. */ }
  await alertBudget(db, config, providerFetch);
  for (let i = 0; i < 10 && Date.now() < deadline - 55000; i++) {
    const [delivery] = await checked(db.rpc('claim_delivery', { p_user_id: input.user_id })) ?? [];
    if (!delivery) break;
    await deliverOne(db, config, delivery, providerFetch);
    result.deliveries_attempted++;
  }
  for (let i = 0; i < 2 && Date.now() < deadline - 55000; i++) {
    const [message] = await checked(db.rpc('claim_generation', { p_user_id: input.user_id })) ?? [];
    if (!message || !await generateOne(db, config, message, providerFetch)) break;
    result.generated++;
  }
  await checked(db.rpc('enqueue_safety', { p_content: SAFETY_MESSAGE }));
  await checked(db.rpc('prepare_deliveries'));
  for (let i = 0; i < 10 && Date.now() < deadline - 10000; i++) {
    const [delivery] = await checked(db.rpc('claim_delivery', { p_user_id: input.user_id })) ?? [];
    if (!delivery) break;
    await deliverOne(db, config, delivery, providerFetch);
    result.deliveries_attempted++;
  }
  await alertBudget(db, config, providerFetch);
  return result;
}
