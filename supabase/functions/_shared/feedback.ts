import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/lib/database.types.ts';
import { verifyFeedback } from './tokens.ts';

export async function handleEmailFeedback(request: Request, db: SupabaseClient<Database>, secret: string, webUrl: string): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': new URL(webUrl).origin, 'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'request_too_large' }, 413);
    body = JSON.parse(raw);
  } catch { return reply({ error: 'invalid_request' }, 400); }
  if (!body || typeof body.token !== 'string' || ![-1, 1].includes(body.rating)
    || body.comment !== undefined && (typeof body.comment !== 'string' || body.comment.length > 280)) return reply({ error: 'invalid_feedback' }, 400);
  let claims;
  try { claims = await verifyFeedback(body.token, secret); }
  catch { return reply({ error: 'invalid_or_expired_link' }, 401); }
  try {
    const message = await db.from('messages').select('id').eq('id', claims.message_id).eq('user_id', claims.user_id).not('sent_at', 'is', null).maybeSingle();
    if (message.error) return reply({ error: 'could_not_save_feedback' }, 503);
    if (!message.data) return reply({ error: 'invalid_or_expired_link' }, 401);
    const { error } = await db.from('feedback').upsert({ message_id: claims.message_id, user_id: claims.user_id,
      rating: body.rating, comment: body.comment?.trim() || null }, { onConflict: 'message_id,user_id' });
    if (error) return reply({ error: 'could_not_save_feedback' }, 503);
    return reply({ saved: true });
  } catch { return reply({ error: 'could_not_save_feedback' }, 503); }
}
