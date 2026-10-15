import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Integration checks only run on disposable local Supabase.');
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const userIds = [];

function success(result) { if (result.error) throw new Error(result.error.message); return result.data; }
async function signInWithRealEmailLink() {
  const mailbox = `phase-one-${randomUUID()}`;
  const email = `${mailbox}@example.test`;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  success(await client.auth.signInWithOtp({ email, options: { emailRedirectTo: 'slow://auth/callback' } }));
  const found = success(await admin.auth.admin.listUsers()).users.find((user) => user.email === email);
  assert.ok(found);
  userIds.push(found.id);
  let mail;
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch('http://127.0.0.1:54324/api/v1/messages');
    if (response.ok) {
      const inbox = await response.json();
      const message = inbox.messages.find((item) => item.To.some((recipient) => recipient.Address === email));
      if (message) {
        mail = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
        break;
      }
    }
    await setTimeout(250);
  }
  assert.ok(mail, 'Magic-link email arrived in local mailbox');
  const body = mail.HTML || mail.Text;
  const link = body.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0]?.replaceAll('&amp;', '&');
  assert.ok(link, 'Email contains a verification link');
  const verified = await fetch(link, { redirect: 'manual' });
  const callback = new URL(verified.headers.get('location'));
  assert.equal(`${callback.protocol}//${callback.host}${callback.pathname}`, 'slow://auth/callback');
  const tokens = new URLSearchParams(callback.hash.slice(1));
  success(await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') }));
  return { client, id: found.id };
}

try {
  const first = await signInWithRealEmailLink();
  const second = await signInWithRealEmailLink();
  console.log('PASS: Real magic-link signup and callback create authenticated accounts.');
  assert.ok((await first.client.rpc('complete_onboarding')).error);
  const answers = { user_id: first.id, priorities: ['hobbies', 'other'], priorities_other: 'gardening', goals: ['music', 'health'], goals_other: '', putting_off: '', inspirations: 'Friends and live music', saved_step: 1 };
  success(await first.client.from('survey_answers').upsert(answers, { onConflict: 'user_id' }));
  success(await first.client.from('survey_answers').upsert({ ...answers, saved_step: 4 }, { onConflict: 'user_id' }));
  const settings = { user_id: first.id, day: 3, time: '18:30', timezone: 'America/New_York', channels: ['email'], paused: false };
  success(await first.client.from('notification_settings').upsert(settings, { onConflict: 'user_id' }));
  success(await first.client.from('notification_settings').upsert({ ...settings, channels: [], paused: true }, { onConflict: 'user_id' }));
  success(await first.client.rpc('complete_onboarding'));
  const saved = success(await admin.from('survey_answers').select('*').eq('user_id', first.id).single());
  assert.deepEqual(saved.goals, answers.goals);
  assert.equal(saved.inspirations, answers.inspirations);
  assert.equal(saved.saved_step, 4);
  assert.ok(success(await first.client.from('users').select('*').single()).onboarding_completed_at);
  console.log('PASS: Survey drafts, edits, notification settings, no channels, pause, and completion save in Supabase.');
  assert.deepEqual(success(await second.client.from('survey_answers').select('*').eq('user_id', first.id)), []);
  assert.ok((await second.client.from('survey_answers').insert({ ...answers, user_id: first.id })).error);
  assert.ok((await first.client.from('users').update({ messaging_hold: false }).eq('id', first.id)).error);
  assert.ok((await first.client.from('notification_settings').update({ star_mode: true }).eq('user_id', first.id)).error);
  assert.ok((await first.client.from('llm_usage').select('*')).error);
  console.log('PASS: Ownership isolation and server-owned fields are enforced over the REST API.');
  const photoId = randomUUID();
  const path = `${first.id}/${photoId}.jpg`;
  // A one-pixel JPEG fixture used only by this local verification.
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCAAH//2Q==', 'base64');
  success(await first.client.storage.from('memories').upload(path, jpeg, { contentType: 'image/jpeg' }));
  success(await first.client.from('photos').insert({ id: photoId, user_id: first.id, storage_path: path, season_tag: 'autumn' }));
  const photo = success(await first.client.from('photos').select('*').single());
  assert.ok(photo.uploaded_at);
  assert.equal(photo.season_tag, 'autumn');
  assert.ok(success(await first.client.storage.from('memories').createSignedUrl(path, 60)).signedUrl);
  assert.ok((await second.client.storage.from('memories').download(path)).error);
  assert.equal((await fetch(`${status.API_URL}/storage/v1/object/public/memories/${path}`)).ok, false);
  success(await first.client.storage.from('memories').remove([path]));
  console.log('PASS: Photos store upload date and explicit season; other users and public access cannot read them.');
  await first.client.auth.signOut();
  await second.client.auth.signOut();
  console.log('All Phase 1 local integration checks passed. No message generation or delivery was run.');
} finally {
  for (const id of userIds) {
    success(await admin.auth.admin.deleteUser(id));
  }
}
