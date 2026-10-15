import assert from 'node:assert/strict';
import test from 'node:test';
import { configFrom } from '../supabase/functions/_shared/config.ts';
import { maxGenerationCost, parseNote, priceUsage, SAFETY_MESSAGE, SYSTEM_PROMPT, WEEKLY_MODEL } from '../supabase/functions/_shared/messages.ts';
import { prompt, send } from '../supabase/functions/_shared/providers.ts';
import { matchesSecret, signFeedback, verifyFeedback } from '../supabase/functions/_shared/tokens.ts';

const secret = 'a-test-only-secret-not-a-live-credential';
const claims = { user_id: '11111111-1111-4111-8111-111111111111', message_id: '22222222-2222-4222-8222-222222222222', exp: 2000000000 };

test('signed feedback binds the user, message and expiry; tampering and expired tokens fail', async () => {
  const token = await signFeedback(claims, secret);
  assert.deepEqual(await verifyFeedback(token, secret, 1900000000000), claims);
  await assert.rejects(verifyFeedback(token, 'another-test-secret-that-is-long-enough'));
  await assert.rejects(verifyFeedback(token, secret, 2100000000000));
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...claims, user_id: claims.message_id })).toString('base64url');
  await assert.rejects(verifyFeedback(`${forged}.${signature}`, secret));
  await assert.rejects(verifyFeedback(`${payload}.${signature}.extra`, secret));
  await assert.rejects(signFeedback(claims, 'short'));
});

test('the scheduler secret is mandatory and compared without an early character mismatch', async () => {
  assert.equal(await matchesSecret(secret, secret), true);
  assert.equal(await matchesSecret('wrong', secret), false);
  assert.equal(await matchesSecret('', ''), false);
  assert.equal(await matchesSecret(`${secret}\0`, secret), false);
});

test('token accounting includes cache writes and reads at Haiku prices', () => {
  const usage = priceUsage({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000, cache_creation_input_tokens: 1000 });
  assert.deepEqual(usage, { input_tokens: 4000, output_tokens: 100, cached_input_tokens: 2000,
    cache_creation_tokens: 1000, cost_usd: 0.00295 });
  assert.ok(maxGenerationCost(4000) > usage.cost_usd);
  assert.throws(() => priceUsage({ input_tokens: -1, output_tokens: 0 }));
  assert.throws(() => priceUsage({ input_tokens: 0, output_tokens: NaN }));
});

test('weekly notes reject banned language, excessive length and incomplete output; safety uses a fixed resource', () => {
  const note = 'Music can leave room for a quieter moment. A few minutes with a favorite song can be enough.';
  assert.equal(parseNote(JSON.stringify({ kind: 'weekly', content: note })).content, note);
  for (const content of ['One sentence.', 'You can unlock more. Keep going.', 'Try this—today. It is enough.', 'A'.repeat(1000)]) {
    assert.throws(() => parseNote(JSON.stringify({ kind: 'weekly', content })));
  }
  assert.deepEqual(parseNote('{"kind":"safety","content":"untrusted"}'), { kind: 'safety', content: SAFETY_MESSAGE });
  assert.match(SAFETY_MESSAGE, /988/);
  assert.match(SAFETY_MESSAGE, /findahelpline.com/);
});

test('the cacheable system prompt stays identical across users and never invents sky facts', () => {
  assert.deepEqual(prompt({ survey: 'first' }).system, prompt({ survey: 'second' }).system);
  assert.equal(prompt({}).model, WEEKLY_MODEL);
  assert.match(SYSTEM_PROMPT, /ONLY from the computed_sky_data/);
  assert.match(SYSTEM_PROMPT, /untrusted data/);
});

test('channel adapters send exactly the same note and stable email idempotency payloads', async () => {
  const sent: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const request: typeof fetch = async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(String(options?.body)), headers: new Headers(options?.headers) });
    return Response.json(String(url).includes('resend') ? { id: 'email-id' } : { data: { status: 'ok', id: 'push-ticket' } });
  };
  const config = { anthropicKey: 'test', resendKey: 'test', emailFrom: 'Slow <notes@example.test>', feedbackWebUrl: 'https://slow.example.test', feedbackSecret: secret };
  const user = { id: claims.user_id, email: 'user@example.test', pushToken: 'ExponentPushToken[test-token]' };
  const message = { id: claims.message_id, content: 'A note with <special> characters. It stays the same.', created_at: '2030-01-01T00:00:00Z' };
  await send(user, message, 'email', config, request);
  await send(user, message, 'push', config, request);
  await send(user, message, 'email', config, request);
  assert.ok(String(sent[0].body.text).startsWith(message.content));
  assert.equal(sent[1].body.body, message.content);
  assert.ok(String(sent[0].body.html).includes('&lt;special&gt;'));
  assert.deepEqual(sent[0].body, sent[2].body);
  assert.equal(sent[0].headers.get('Idempotency-Key'), `slow-note/${message.id}`);
  assert.ok(!sent[1].headers.has('Authorization'));
});

test('configuration fails closed on missing, excessive, or invalid budgets and insecure feedback URLs', () => {
  const values: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'test',
    ANTHROPIC_API_KEY: 'test', RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'notes@example.test', ADMIN_ALERT_EMAIL: 'admin@example.test',
    MONTHLY_LLM_BUDGET_USD: '10', SLOW_JOB_SECRET: secret, FEEDBACK_SIGNING_SECRET: `${secret}-different`, FEEDBACK_WEB_URL: 'https://slow.example.test' };
  assert.equal(configFrom((key) => values[key]).budget, 10);
  for (const budget of ['', '0', '-1', '41', 'NaN', 'Infinity']) assert.throws(() => configFrom((key) => key === 'MONTHLY_LLM_BUDGET_USD' ? budget : values[key]));
  assert.throws(() => configFrom((key) => key === 'FEEDBACK_WEB_URL' ? 'http://public.example.test' : values[key]));
});
