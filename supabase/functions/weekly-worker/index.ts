import { configFrom } from '../_shared/config.ts';
import { matchesSecret } from '../_shared/tokens.ts';
import { runWorker, type WorkRequest } from '../_shared/worker.ts';

Deno.serve(async (request: Request) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!await matchesSecret(request.headers.get('x-slow-job-secret') ?? '', Deno.env.get('SLOW_JOB_SECRET') ?? '')) return reply({ error: 'unauthorized' }, 401);
  try {
    const body = await request.text();
    if (body.length > 4096) return reply({ error: 'request_too_large' }, 413);
    let input: WorkRequest;
    try { input = JSON.parse(body); } catch { return reply({ error: 'invalid_request' }, 400); }
    if (!input || !['work', 'generate'].includes(input.action)
      || input.user_id !== undefined && (typeof input.user_id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.user_id))
      || input.deliver_now !== undefined && typeof input.deliver_now !== 'boolean'
      || input.deliver_now && (input.action !== 'generate' || !input.user_id)) return reply({ error: 'invalid_request' }, 400);
    return reply(await runWorker(configFrom((key) => Deno.env.get(key)), input));
  } catch {
    return reply({ error: 'worker_failed_check_server_configuration_and_queue' }, 500);
  }
});
