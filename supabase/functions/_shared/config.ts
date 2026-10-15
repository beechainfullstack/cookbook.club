import type { ProviderConfig } from './providers.ts';
export type Config = ProviderConfig & { supabaseUrl: string; serviceKey: string; jobSecret: string; budget: number; adminEmail: string };

export function configFrom(get: (key: string) => string | undefined): Config {
  const required = (key: string) => { const value = get(key); if (!value) throw new Error(`missing_${key}`); return value; };
  const budget = Number(required('MONTHLY_LLM_BUDGET_USD'));
  if (!Number.isFinite(budget) || budget <= 0 || budget > 40) throw new Error('invalid_MONTHLY_LLM_BUDGET_USD');
  const jobSecret = required('SLOW_JOB_SECRET');
  const feedbackSecret = required('FEEDBACK_SIGNING_SECRET');
  if (jobSecret.length < 32 || feedbackSecret.length < 32 || jobSecret === feedbackSecret) throw new Error('invalid_server_secrets');
  const feedbackWebUrl = required('FEEDBACK_WEB_URL');
  const url = new URL(feedbackWebUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('invalid_FEEDBACK_WEB_URL');
  if (url.username || url.password || url.hash) throw new Error('invalid_FEEDBACK_WEB_URL');
  const emailFrom = required('RESEND_FROM_EMAIL');
  const adminEmail = required('ADMIN_ALERT_EMAIL');
  if (!emailFrom.includes('@') || !adminEmail.includes('@') || /[\r\n]/.test(emailFrom + adminEmail)) throw new Error('invalid_email_config');
  return { supabaseUrl: required('SUPABASE_URL'), serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    anthropicKey: required('ANTHROPIC_API_KEY'), resendKey: required('RESEND_API_KEY'),
    emailFrom, feedbackWebUrl, feedbackSecret, jobSecret, budget, adminEmail, expoAccessToken: get('EXPO_ACCESS_TOKEN') };
}
