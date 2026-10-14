import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuthCallback } from '../src/lib/auth-url.ts';

test('reads Supabase implicit tokens from native callback', () => {
  assert.deepEqual(parseAuthCallback('slow://auth/callback#access_token=test-access&refresh_token=test-refresh', 'slow://auth/callback'), {
    kind: 'tokens', accessToken: 'test-access', refreshToken: 'test-refresh',
  });
});
test('supports Expo Go and web callbacks', () => {
  for (const base of ['exp://127.0.0.1:8081/--/auth/callback', 'http://localhost:8081/auth/callback']) {
    assert.equal(parseAuthCallback(`${base}#access_token=a&refresh_token=r`, base).kind, 'tokens');
  }
});
test('expired and already-used links show a safe error, not server text', () => {
  const result = parseAuthCallback('slow://auth/callback#error=access_denied&error_description=secret-value', 'slow://auth/callback');
  assert.equal(result.kind, 'error');
  assert.ok(!JSON.stringify(result).includes('secret-value'));
});
test('rejects unrelated URLs and incomplete or malformed callbacks', () => {
  for (const url of ['https://attacker.test/callback#access_token=a&refresh_token=r', 'slow://not-auth/callback#access_token=a&refresh_token=r', 'slow://auth/other#access_token=a&refresh_token=r', 'slow://auth/callback#access_token=a', 'not a url']) {
    assert.equal(parseAuthCallback(url, 'slow://auth/callback').kind, 'none');
  }
});
