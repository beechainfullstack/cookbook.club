const userId = process.argv[2];
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SLOW_JOB_SECRET;
if (!userId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId) || !url || !secret) {
  console.error('Usage: node --env-file=.env --env-file=supabase/functions/.env.local scripts/send-checkin.mjs USER_UUID');
  process.exit(1);
}
const target = new URL(url);
if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Use HTTPS for hosted Supabase.');
const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/weekly-worker`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-slow-job-secret': secret },
  body: JSON.stringify({ action: 'generate', user_id: userId, deliver_now: true }), signal: AbortSignal.timeout(130000),
});
console.log(`Worker status: ${response.status}`);
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
