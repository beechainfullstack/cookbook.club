import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isConfigured = Boolean(url && key && !key.startsWith('replace-'));
export const authRedirectUrl = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || Linking.createURL('auth/callback');

export const supabase = createClient<Database>(url || 'https://unconfigured.supabase.co', key || 'unconfigured', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    storageKey: 'slow-auth-session',
  },
});

export function clearWebAuthUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname);
  }
}
