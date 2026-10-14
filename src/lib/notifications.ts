import { Platform } from 'react-native';

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') throw new Error('Push permission is available in the iOS or Android app. Email works here.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('check-ins', {
      name: 'Slow check-ins',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}
