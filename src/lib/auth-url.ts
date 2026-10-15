export type AuthCallback =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

export function parseAuthCallback(url: string, redirectUrl: string): AuthCallback {
  try {
    const actual = new URL(url);
    const expected = new URL(redirectUrl);
    if (actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname) return { kind: 'none' };
    const params = new URLSearchParams(actual.hash ? actual.hash.slice(1) : actual.search);
    if (params.has('error') || params.has('error_code')) {
      return { kind: 'error', message: 'This sign-in link has expired or has already been used. Request a new one.' };
    }
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
    return { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}
