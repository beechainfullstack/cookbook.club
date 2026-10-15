import { escapeHtml, MAX_OUTPUT_TOKENS, SYSTEM_PROMPT, WEEKLY_MODEL } from './messages.ts';
import { signFeedback } from './tokens.ts';

export type ProviderConfig = {
  anthropicKey: string; resendKey: string; emailFrom: string; feedbackWebUrl: string;
  feedbackSecret: string; expoAccessToken?: string;
};
export class ProviderError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0) { super(code); this.code = code; this.status = status; }
}

export function prompt(context: unknown) {
  return {
    model: WEEKLY_MODEL,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(context) }],
  };
}

async function anthropic(path: string, config: ProviderConfig, body: unknown, request: typeof fetch) {
  const response = await request(`https://api.anthropic.com/v1/${path}`, {
    method: 'POST', headers: { 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new ProviderError('anthropic_rejected', response.status);
  return await response.json();
}

export async function countInput(config: ProviderConfig, context: unknown, request: typeof fetch = fetch): Promise<number> {
  const result = await anthropic('messages/count_tokens', config, prompt(context), request);
  if (!Number.isSafeInteger(result.input_tokens) || result.input_tokens < 0) throw new ProviderError('invalid_token_count');
  return result.input_tokens;
}

export async function generate(config: ProviderConfig, context: unknown, request: typeof fetch = fetch) {
  return await anthropic('messages', config, { ...prompt(context), max_tokens: MAX_OUTPUT_TOKENS }, request);
}

export async function sendEmail(config: ProviderConfig, to: string, subject: string, text: string, html: string,
  idempotencyKey: string, request: typeof fetch = fetch): Promise<string> {
  const response = await request('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text, html }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ProviderError('resend_rejected', response.status);
  const result = await response.json();
  if (typeof result.id !== 'string') throw new ProviderError('invalid_email_response');
  return result.id;
}

export type DeliveryUser = { id: string; email: string; pushToken: string | null };
export type DeliveryMessage = { id: string; content: string; created_at: string };
export type SendResult = { channel: 'email' | 'push'; providerId: string };

export async function send(user: DeliveryUser, message: DeliveryMessage, channel: 'email' | 'push',
  config: ProviderConfig, request: typeof fetch = fetch): Promise<SendResult> {
  if (channel === 'email') {
    const token = await signFeedback({ message_id: message.id, user_id: user.id,
      exp: Math.floor(new Date(message.created_at).getTime() / 1000) + 30 * 86400 }, config.feedbackSecret);
    const link = (rating: number) => { const url = new URL(config.feedbackWebUrl); url.hash = new URLSearchParams({ feedback_token: token, rating: String(rating) }).toString(); return url.toString(); };
    const text = `${message.content}\n\nWas this helpful?\nYes: ${link(1)}\nNo: ${link(-1)}`;
    const html = `<div style="font-family:system-ui;max-width:520px;margin:32px auto;color:#26372e;line-height:1.7"><p style="white-space:pre-wrap">${escapeHtml(message.content)}</p><p style="font-size:14px">Was this helpful? <a href="${escapeHtml(link(1))}">Yes</a> · <a href="${escapeHtml(link(-1))}">No</a></p></div>`;
    return { channel, providerId: await sendEmail(config, user.email, 'A small note from Slow', text, html, `slow-note/${message.id}`, request) };
  }
  if (!user.pushToken) throw new ProviderError('push_not_registered', 400);
  const response = await request('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      ...(config.expoAccessToken ? { Authorization: `Bearer ${config.expoAccessToken}` } : {}) },
    body: JSON.stringify({ to: user.pushToken, title: 'Slow', body: message.content, channelId: 'check-ins', data: { messageId: message.id } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ProviderError('expo_rejected', response.status);
  const { data } = await response.json();
  if (data?.status === 'error') throw new ProviderError(data.details?.error === 'DeviceNotRegistered' ? 'DeviceNotRegistered' : 'expo_ticket_error', 400);
  if (data?.status !== 'ok' || typeof data.id !== 'string') throw new ProviderError('invalid_push_response');
  return { channel, providerId: data.id };
}

export async function pushReceipts(ids: string[], config: ProviderConfig, request: typeof fetch = fetch) {
  const response = await request('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.expoAccessToken ? { Authorization: `Bearer ${config.expoAccessToken}` } : {}) },
    body: JSON.stringify({ ids }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ProviderError('expo_receipts_rejected', response.status);
  return (await response.json()).data as Record<string, { status: string; details?: { error?: string } }>;
}
