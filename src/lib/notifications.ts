import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const tokenStorageKey = 'slow-device-push-token';

export async function registerPushToken(askPermission = false): Promise<string | null> {
  if (Platform.OS === 'web') throw new Error('Push permission is available in the iOS or Android app. Email works here.');
  if (Constants.executionEnvironment === 'storeClient') throw new Error('Remote push needs a Slow development build, not Expo Go. Email still works here.');
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !/^[0-9a-f-]{36}$/i.test(projectId)) throw new Error('Push needs the Expo project ID. Configure it before enabling push.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('check-ins', {
      name: 'Slow check-ins',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted || !askPermission ? existing : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await AsyncStorage.setItem(tokenStorageKey, token);
  return token;
}

export async function syncPushToken(userId: string) {
  const token = await registerPushToken();
  const { error } = await supabase.from('notification_settings').update({ expo_push_token: token }).eq('user_id', userId);
  if (error) throw error;
}

export async function detachPushToken(userId: string) {
  const token = await AsyncStorage.getItem(tokenStorageKey);
  if (!token) return;
  const { error } = await supabase.from('notification_settings').update({ expo_push_token: null }).eq('user_id', userId).eq('expo_push_token', token);
  if (error) throw error;
  await AsyncStorage.removeItem(tokenStorageKey);
}

export async function listenForNotes(refresh: () => void): Promise<() => void> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return () => {};
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true,
    shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  const received = Notifications.addNotificationReceivedListener(refresh);
  const opened = Notifications.addNotificationResponseReceivedListener(refresh);
  return () => { received.remove(); opened.remove(); };
}
