import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/lib/database.types.ts';
import { handleEmailFeedback } from '../_shared/feedback.ts';

Deno.serve(async (request: Request) => {
  try {
    const db = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    return await handleEmailFeedback(request, db, Deno.env.get('FEEDBACK_SIGNING_SECRET') ?? '', Deno.env.get('FEEDBACK_WEB_URL') ?? 'http://localhost:8081');
  } catch { return Response.json({ error: 'server_configuration_error' }, { status: 503 }); }
});
