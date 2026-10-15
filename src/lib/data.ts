import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { Database } from './database.types';
import { type Channel, type Preferences } from './settings';
import { supabase } from './supabase';
import { EMPTY_SURVEY, type Season, type Survey } from './survey';

export type Photo = Database['public']['Tables']['photos']['Row'] & { url: string };
export type Message = Database['public']['Tables']['messages']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
export type UserData = {
  onboarded: boolean;
  survey: Survey;
  preferences: Preferences | null;
  lastMessage: Message | null;
  lastFeedback: Feedback | null;
};

export async function loadUserData(userId: string): Promise<UserData> {
  const [profile, survey, settings, message] = await Promise.all([
    supabase.from('users').select('onboarding_completed_at').eq('id', userId).single(),
    supabase.from('survey_answers').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('notification_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('messages').select('*').eq('user_id', userId).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [profile, survey, settings, message]) if (result.error) throw result.error;
  const feedback = message.data ? await supabase.from('feedback').select('*').eq('message_id', message.data.id).eq('user_id', userId).maybeSingle() : null;
  if (feedback?.error) throw feedback.error;
  return {
    onboarded: Boolean(profile.data?.onboarding_completed_at),
    survey: survey.data || EMPTY_SURVEY,
    preferences: settings.data ? { ...settings.data, time: settings.data.time.slice(0, 5), channels: settings.data.channels as Channel[] } : null,
    lastMessage: message.data,
    lastFeedback: feedback?.data ?? null,
  };
}

export async function saveSurvey(userId: string, survey: Survey) {
  const { priorities, priorities_other, goals, goals_other, putting_off, inspirations, saved_step } = survey;
  const { error } = await supabase.from('survey_answers').upsert({
    user_id: userId, priorities, priorities_other, goals, goals_other, putting_off, inspirations, saved_step,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function savePreferences(userId: string, preferences: Preferences, finishOnboarding: boolean) {
  const { day, time, timezone, channels, paused } = preferences;
  const { error } = await supabase.from('notification_settings').upsert({ user_id: userId, day, time, timezone, channels, paused,
    expo_push_token: channels.includes('push') ? preferences.expo_push_token ?? null : null }, { onConflict: 'user_id' });
  if (error) throw error;
  if (finishOnboarding) {
    const { error: onboardingError } = await supabase.rpc('complete_onboarding');
    if (onboardingError) throw onboardingError;
  }
}

export async function saveFeedback(userId: string, messageId: string, rating: -1 | 1, comment: string) {
  const { error } = await supabase.from('feedback').upsert({ user_id: userId, message_id: messageId, rating, comment: comment.trim() || null }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
}

export async function loadPhotos(userId: string): Promise<Photo[]> {
  const { data, error } = await supabase.from('photos').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const { data: urls, error: signingError } = await supabase.storage.from('memories').createSignedUrls(data.map((photo) => photo.storage_path), 3600);
  if (signingError) throw signingError;
  return data.map((photo, index) => ({ ...photo, url: urls[index]?.signedUrl || '' }));
}

export async function chooseAndUploadPhoto(userId: string, season: Season): Promise<boolean> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false });
  if (result.canceled) return false;
  const original = result.assets[0];
  const resize = original.width > original.height ? { width: Math.min(original.width, 1600) } : { height: Math.min(original.height, 1600) };
  const image = await ImageManipulator.manipulateAsync(original.uri, [{ resize }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  const bytes = await (await fetch(image.uri)).arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Please choose a photo smaller than 5 MB.');
  const id = randomUUID();
  const path = `${userId}/${id}.jpg`;
  const { error: uploadError } = await supabase.storage.from('memories').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('photos').insert({ id, user_id: userId, storage_path: path, season_tag: season });
  if (error) {
    await supabase.storage.from('memories').remove([path]);
    throw error;
  }
  return true;
}
