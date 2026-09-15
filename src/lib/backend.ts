import { createClient } from '@supabase/supabase-js';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { copy } from './copy';
import { normalizePhone, phoneCountry, type Flavor } from './domain';
import type { Database } from './database.types';

const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!count) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
    return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') { sessionStorage.setItem(key, value); return; }
    const oldCount = Number(await SecureStore.getItemAsync(`${key}.count`));
    const chunks = value.match(/[\s\S]{1,1800}/g) ?? [];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
    await Promise.all(Array.from({ length: Math.max(0, oldCount - chunks.length) },
      (_, index) => SecureStore.deleteItemAsync(`${key}.${chunks.length + index}`)));
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') { sessionStorage.removeItem(key); return; }
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    await SecureStore.deleteItemAsync(`${key}.count`);
    await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)));
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const demoEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
export const supabase = url && key ? createClient<Database>(url, key, {
  auth: { storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;

if (Platform.OS !== 'web' && supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase?.auth.startAutoRefresh();
    else supabase?.auth.stopAutoRefresh();
  });
}

export function backend() {
  if (!supabase) throw new Error('NOT_AUTHORIZED');
  return supabase;
}

export function errorCopy(error: unknown): string {
  const code = error instanceof Error ? error.message :
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '';
  const messages: Record<string, string> = {
    NOT_AUTHORIZED: copy.errors.notAuthorized, AGE_BLOCKED: copy.onboarding.age_gate_error,
    INVALID_BIRTHDAY: copy.errors.invalidBirthday, INVALID_PHONE: copy.errors.invalidPhone,
    INVALID_NAME: copy.errors.invalidName, INVALID_SCHOOL_CODE: copy.errors.invalidSchoolCode,
    CONTACT_REQUIRED: copy.errors.contactRequired, TOO_MANY_CONTACTS: copy.errors.tooManyContacts,
    RATE_LIMITED: copy.tag.rateLimited, CONTACTS_DENIED: copy.tag.permissionDenied,
    WEB_CONTACTS: copy.tag.webContacts, PUSH_UNAVAILABLE: copy.profile.notificationsUnavailable,
    PUSH_DENIED: copy.profile.notificationsDenied,
  };
  return messages[code] ?? copy.errors.generic;
}

export async function syncDeviceContacts(phone: string) {
  if (Platform.OS === 'web') throw new Error('WEB_CONTACTS');
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('CONTACTS_DENIED');
  const country = phoneCountry(phone);
  const phones = new Set<string>();
  let offset = 0;
  let hasNextPage = true;
  while (hasNextPage) {
    const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 250, pageOffset: offset });
    for (const contact of page.data) for (const number of contact.phoneNumbers ?? []) {
      const normalized = normalizePhone(number.number ?? '', country);
      if (normalized) phones.add(normalized);
    }
    if (phones.size > 5000) throw new Error('TOO_MANY_CONTACTS');
    offset += page.data.length;
    hasNextPage = page.hasNextPage;
    if (page.data.length === 0) break;
  }
  const { data, error } = await backend().rpc('sync_contacts', { p_phones: [...phones] });
  if (error) throw error;
  return data;
}

export async function submitTag(recipientId: string, flavor: Flavor, requestId: string) {
  const { error } = await backend().rpc('create_tag', {
    p_tagged_id: recipientId, p_flavor: flavor, p_request_id: requestId,
  });
  if (error) throw error;
}

export const newRequestId = () => Crypto.randomUUID();

export async function enablePush(): Promise<string> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (Platform.OS === 'web' || !Device.isDevice || typeof projectId !== 'string' || !projectId) {
    throw new Error('PUSH_UNAVAILABLE');
  }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reveals', {
    name: copy.notifications.channel, importance: Notifications.AndroidImportance.HIGH,
  });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('PUSH_DENIED');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await backend().rpc('register_push_token', { p_token: token });
  if (error) throw error;
  await secureStorage.setItem('cookbook.push-token', token);
  return token;
}

export async function signOut() {
  const token = await secureStorage.getItem('cookbook.push-token');
  if (token) {
    const { error } = await backend().rpc('remove_push_token', { p_token: token });
    if (error) throw error;
    await secureStorage.removeItem('cookbook.push-token');
  }
  const { error } = await backend().auth.signOut();
  if (error) throw error;
}
