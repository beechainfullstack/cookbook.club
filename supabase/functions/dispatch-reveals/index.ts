import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import { revealNotification } from '../../../src/lib/copy.ts';
import type { Database } from '../../../src/lib/database.types.ts';

type Ticket = { status: 'ok'; id: string } | { status: 'error'; details?: { error?: string } };

function isTicket(value: unknown): value is Ticket {
  if (typeof value !== 'object' || value === null || !('status' in value)) return false;
  return (value.status === 'ok' && 'id' in value && typeof value.id === 'string') ||
    (value.status === 'error' && (!('details' in value) || (
      typeof value.details === 'object' && value.details !== null &&
      (!('error' in value.details) || typeof value.details.error === 'string')
    )));
}

Deno.serve(async (request: Request) => {
  const workerSecret = Deno.env.get('PUSH_WORKER_SECRET');
  if (!workerSecret || request.headers.get('Authorization') !== `Bearer ${workerSecret}`) {
    return new Response(null, { status: 401 });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const client = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: jobs, error } = await client.rpc('claim_push_deliveries');
  if (error) return new Response(null, { status: 500 });
  if (!jobs.length) return Response.json({ accepted: 0 });
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
      },
      body: JSON.stringify(jobs.map((job) => ({
        to: job.token,
        ...revealNotification(job.flavor),
        sound: 'default',
        channelId: 'reveals',
        data: { screen: 'myPage', userId: job.user_id },
      }))),
      signal: AbortSignal.timeout(15000),
    });
    const payload: unknown = await response.json();
    if (!response.ok || typeof payload !== 'object' || payload === null ||
      !('data' in payload) || !Array.isArray(payload.data) || payload.data.length !== jobs.length ||
      !payload.data.every(isTicket)) throw new Error('PUSH_GATEWAY_ERROR');
    const tickets: Ticket[] = payload.data;
    const results = await Promise.all(jobs.map((job, index) => {
      const ticket = tickets[index]!;
      return client.rpc('finish_push_delivery', {
        p_id: job.id,
        p_lease_id: job.lease_id,
        ...(ticket.status === 'ok' ? { p_ticket_id: ticket.id } : {
          p_error: ticket.details?.error ?? 'PUSH_REJECTED',
          p_remove_token: ticket.details?.error === 'DeviceNotRegistered',
        }),
      });
    }));
    if (results.some((result) => result.error)) return new Response(null, { status: 500 });
    return Response.json({ accepted: tickets.filter((ticket) => ticket.status === 'ok').length });
  } catch {
    await Promise.all(jobs.map((job) => client.rpc('finish_push_delivery', {
      p_id: job.id, p_lease_id: job.lease_id, p_error: 'PUSH_GATEWAY_ERROR',
    })));
    return new Response(null, { status: 502 });
  }
});
