import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { handleEmailFeedback } from '../supabase/functions/_shared/feedback.ts';
import { SAFETY_MESSAGE } from '../supabase/functions/_shared/messages.ts';
import { signFeedback } from '../supabase/functions/_shared/tokens.ts';
import { runWorker } from '../supabase/functions/_shared/worker.ts';
import type { Config } from '../supabase/functions/_shared/config.ts';
import type { Database } from '../src/lib/database.types.ts';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Only run against disposable local Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, options);
const ids: string[] = [];
const config: Config = { supabaseUrl: status.API_URL, serviceKey: status.SERVICE_ROLE_KEY, anthropicKey: 'test-only', resendKey: 'test-only',
  emailFrom: 'Slow <notes@example.test>', feedbackWebUrl: 'https://slow.example.test', feedbackSecret: randomUUID() + randomUUID(),
  jobSecret: randomUUID() + randomUUID(), budget: 40, adminEmail: 'alerts@example.test' };
const calls: { url: string; body: Record<string, unknown> }[] = [];
let pushMode: 'ok' | 'invalid' | 'timeout' = 'ok';
let generationMode: 'ok' | 'safety' | 'timeout' | 'invalid' = 'ok';
const note = 'Music can make room for a quieter moment. A few minutes with a favorite song can be enough.';
const providerFetch: typeof fetch = async (url, init) => {
  const target = String(url);
  const body = JSON.parse(String(init?.body));
  calls.push({ url: target, body });
  if (target.endsWith('/count_tokens')) return Response.json({ input_tokens: 1000 });
  if (target === 'https://api.anthropic.com/v1/messages') {
    if (generationMode === 'timeout') throw new Error('simulated_timeout');
    return Response.json({ stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 100 },
      content: [{ type: 'text', text: JSON.stringify({ kind: generationMode === 'safety' ? 'safety' : 'weekly', content: generationMode === 'invalid' ? 'Unlock everything. Keep going.' : note }) }] });
  }
  if (target === 'https://api.resend.com/emails') return Response.json({ id: randomUUID() });
  if (target.endsWith('/push/send')) {
    if (pushMode === 'timeout') throw new Error('simulated_timeout');
    return Response.json({ data: pushMode === 'invalid' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: randomUUID() } });
  }
  if (target.endsWith('/push/getReceipts')) return Response.json({ data: Object.fromEntries((body.ids as string[]).map((id) => [id, { status: 'error', details: { error: 'DeviceNotRegistered' } }])) });
  throw new Error('Unexpected provider request');
};
function ok<T extends { data: unknown; error: unknown }>(result: T): T['data'] { if (result.error) throw result.error; return result.data; }
async function user(channels = ['email', 'push'], paused = false, inspirations = 'Music and quiet mornings') {
  const email = `weekly-${randomUUID()}@example.test`;
  const created = ok(await admin.auth.admin.createUser({ email, email_confirm: true })).user!;
  ids.push(created.id);
  const link = ok(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
  const client = createClient<Database>(status.API_URL, status.ANON_KEY, options);
  ok(await client.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: 'magiclink' }));
  ok(await client.from('survey_answers').upsert({ user_id: created.id, priorities: ['hobbies'], goals: ['music'], inspirations, saved_step: 4 }));
  ok(await client.from('notification_settings').upsert({ user_id: created.id, channels, paused, day: 2, time: '09:00', timezone: 'UTC', expo_push_token: channels.includes('push') ? 'ExponentPushToken[test-token]' : null }));
  ok(await client.rpc('complete_onboarding'));
  return { id: created.id, client };
}
const request = (token: string, rating = 1, comment = 'Useful') => new Request('https://api.example.test/email-feedback', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating, comment }),
});
const feedback = (req: Request) => handleEmailFeedback(req, admin, config.feedbackSecret, config.feedbackWebUrl);
const initialAlerts = ok(await admin.from('budget_alerts').select('*'));
try {
  const first = await user();
  await runWorker(config, { action: 'generate', user_id: first.id, deliver_now: true }, providerFetch);
  const message = ok(await admin.from('messages').select('*').eq('user_id', first.id).single())!;
  assert.equal(message.content, note); assert.ok(message.sent_at);
  assert.ok(String(calls.find((c) => c.url.includes('resend.com'))!.body.text).startsWith(note));
  assert.equal(calls.find((c) => c.url.endsWith('/push/send'))!.body.body, note);
  const before = calls.length;
  await runWorker(config, { action: 'generate', user_id: first.id, deliver_now: true }, providerFetch);
  assert.equal(calls.length, before);
  const usage = ok(await admin.from('llm_usage').select('*').eq('user_id', first.id))!;
  assert.equal(usage.length, 1); assert.equal(usage[0].status, 'completed'); assert.ok(usage[0].cost_usd > 0);
  console.log('PASS: real database weekly loop, identical provider payloads, repeat deduplication, token/cost ledger.');
  ok(await first.client.from('feedback').upsert({ user_id: first.id, message_id: message.id, rating: 1, comment: 'Helpful' }, { onConflict: 'message_id,user_id' }));
  const second = await user();
  assert.ok((await second.client.from('feedback').insert({ user_id: second.id, message_id: message.id, rating: -1 })).error);
  assert.ok((await first.client.rpc('reserve_llm', { p_message_id: message.id, p_model: 'x', p_max_cost: 1, p_budget: 40 })).error);
  const token = await signFeedback({ user_id: first.id, message_id: message.id, exp: Math.floor(Date.now() / 1000) + 3600 }, config.feedbackSecret);
  assert.equal((await feedback(new Request('https://api.example.test/email-feedback'))).status, 405);
  assert.equal((await feedback(request(token, -1))).status, 200);
  assert.equal(ok(await first.client.from('feedback').select('*').eq('message_id', message.id).single())?.rating, -1);
  assert.equal((await feedback(request(`${token}tampered`))).status, 401);
  assert.equal((await feedback(request(token, 1, 'x'.repeat(281)))).status, 400);
  console.log('PASS: authenticated and signed-email feedback save; GET, forged tokens and cross-user writes cannot vote.');
  for (const skipped of [await user(['email'], true), await user([])]) {
    const count = calls.length;
    await runWorker(config, { action: 'generate', user_id: skipped.id, deliver_now: true }, providerFetch);
    assert.equal(calls.length, count);
  }
  await runWorker(config, { action: 'generate', user_id: second.id }, providerFetch);
  const future = ok(await admin.from('messages').select('*').eq('user_id', second.id).single())!;
  assert.equal(future.sent_at, null); assert.ok(new Date(future.scheduled_for).getTime() > Date.now());
  ok(await second.client.from('survey_answers').update({ inspirations: 'A new hobby' }).eq('user_id', second.id));
  await runWorker(config, { action: 'generate', user_id: second.id, deliver_now: true }, providerFetch);
  assert.equal(ok(await admin.from('messages').select('state').eq('id', future.id).single())?.state, 'cancelled');
  console.log('PASS: pause/no-channels skip, local schedule remains in future, changed survey cancels stale notes.');
  for (const [text, classified] of [['I want to hurt myself', false], ['Everyone would be better off without me', true]] as const) {
    const held = await user(['email', 'push'], false, text);
    generationMode = classified ? 'safety' : 'ok';
    await runWorker(config, { action: 'generate', user_id: held.id, deliver_now: true }, providerFetch);
    generationMode = 'ok';
    assert.equal(ok(await admin.from('users').select('messaging_hold').eq('id', held.id).single())?.messaging_hold, true);
    const safety = ok(await admin.from('messages').select('*').eq('user_id', held.id).eq('type', 'safety'))!;
    assert.equal(safety.length, 1); assert.equal(safety[0].content, SAFETY_MESSAGE); assert.ok(safety[0].sent_at);
  }
  console.log('PASS: keyword and model-classified holds send one fixed crisis-resource note.');
  for (const mode of ['invalid', 'timeout'] as const) {
    pushMode = mode;
    const recipient = await user();
    await runWorker(config, { action: 'generate', user_id: recipient.id, deliver_now: true }, providerFetch);
    const sent = ok(await admin.from('messages').select('id').eq('user_id', recipient.id).single())!;
    assert.equal(ok(await admin.from('message_deliveries').select('status').eq('message_id', sent.id).eq('channel', 'push').single())?.status, mode === 'invalid' ? 'failed' : 'uncertain');
    if (mode === 'invalid') assert.equal(ok(await admin.from('notification_settings').select('expo_push_token').eq('user_id', recipient.id).single())?.expo_push_token, null);
    const count = calls.length;
    await runWorker(config, { action: 'work', user_id: recipient.id }, providerFetch);
    assert.equal(calls.length, count);
  }
  pushMode = 'ok';
  const receipt = ok(await admin.from('message_deliveries').select('*').eq('message_id', message.id).eq('channel', 'push').single())!;
  ok(await admin.from('notification_settings').update({ expo_push_token: 'ExponentPushToken[new-device]' }).eq('user_id', first.id));
  ok(await admin.from('message_deliveries').update({ attempted_at: new Date(Date.now() - 16 * 60000).toISOString() }).eq('id', receipt.id));
  await runWorker(config, { action: 'work', user_id: first.id }, providerFetch);
  assert.equal(ok(await admin.from('message_deliveries').select('status').eq('id', receipt.id).single())?.status, 'failed');
  assert.equal(ok(await admin.from('notification_settings').select('expo_push_token').eq('user_id', first.id).single())?.expo_push_token, 'ExponentPushToken[new-device]');
  console.log('PASS: invalid-token cleanup, unknown push no-retry, receipt cleanup preserves a newer device token.');
  for (const mode of ['timeout', 'invalid'] as const) {
    generationMode = mode;
    const recipient = await user(['email']);
    await runWorker(config, { action: 'generate', user_id: recipient.id, deliver_now: true }, providerFetch);
    const ledger = ok(await admin.from('llm_usage').select('*').eq('user_id', recipient.id))!;
    assert.equal(ledger[0].status, mode === 'timeout' ? 'uncertain' : 'completed'); assert.ok(ledger[0].cost_usd > 0);
    assert.equal(ok(await admin.from('messages').select('state').eq('user_id', recipient.id).single())?.state, 'failed');
  }
  generationMode = 'ok';
  const limited = await user(['email']);
  const count = calls.filter((c) => c.url === 'https://api.anthropic.com/v1/messages').length;
  await runWorker({ ...config, budget: 0.00000001 }, { action: 'generate', user_id: limited.id, deliver_now: true }, providerFetch);
  assert.equal(calls.filter((c) => c.url === 'https://api.anthropic.com/v1/messages').length, count);
  assert.ok(calls.some((c) => c.body.subject === 'Slow: monthly generation budget reached'));
  const total = ok(await admin.from('llm_usage').select('cost_usd'))!.reduce((sum, row) => sum + Number(row.cost_usd), 0);
  const queued = ok(await admin.from('messages').select('id').eq('user_id', limited.id).single())!;
  const reservations = await Promise.all([1, 2].map(async () => ok(await admin.rpc('reserve_llm', {
    p_message_id: queued.id, p_model: 'test-only', p_max_cost: 0.004, p_budget: total + 0.005,
  }))));
  assert.equal(reservations.filter(Boolean).length, 1);
  console.log('PASS: unknown cost reservations persist, invalid output is charged, budget blocks generation, concurrent reservations serialize.');
} finally {
  for (const id of ids) { ok(await admin.from('llm_usage').delete().eq('user_id', id)); ok(await admin.auth.admin.deleteUser(id)); }
  const months = new Set(initialAlerts?.map((row) => row.month));
  for (const row of ok(await admin.from('budget_alerts').select('*')) ?? []) if (!months.has(row.month)) ok(await admin.from('budget_alerts').delete().eq('month', row.month));
  if (initialAlerts?.length) ok(await admin.from('budget_alerts').upsert(initialAlerts));
}
