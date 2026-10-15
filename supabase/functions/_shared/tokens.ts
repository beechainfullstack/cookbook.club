const encoder = new TextEncoder();
export type FeedbackClaims = { message_id: string; user_id: string; exp: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) => character.charCodeAt(0));
}
async function key(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('feedback_secret_too_short');
  return await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signFeedback(claims: FeedbackClaims, secret: string): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifyFeedback(token: string, secret: string, now = Date.now()): Promise<FeedbackClaims> {
  if (token.length > 1000) throw new Error('invalid_token');
  const parts = token.split('.');
  if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) throw new Error('invalid_token');
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if (!uuid.test(claims.message_id) || !uuid.test(claims.user_id) || !Number.isSafeInteger(claims.exp)
    || claims.exp <= now / 1000) throw new Error('invalid_token');
  return claims;
}

export async function matchesSecret(actual: string, expected: string): Promise<boolean> {
  if (expected.length < 32 || !actual || actual.length > 512) return false;
  const comparisonKey = await key(expected);
  const digest = await crypto.subtle.sign('HMAC', comparisonKey, encoder.encode(expected));
  return await crypto.subtle.verify('HMAC', comparisonKey, digest, encoder.encode(actual));
}
