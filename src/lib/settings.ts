export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export type Channel = 'push' | 'email';
export type Preferences = {
  day: number;
  time: string;
  timezone: string;
  channels: Channel[];
  paused: boolean;
  expo_push_token?: string | null;
};

export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function defaultPreferences(): Preferences {
  return { day: 0, time: '09:00', timezone: localTimezone(), channels: ['email'], paused: false };
}

export function validatePreferences(preferences: Preferences): string | null {
  if (!Number.isInteger(preferences.day) || preferences.day < 0 || preferences.day > 6) return 'Choose a day of the week.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferences.time)) return 'Use a time like 09:00 or 18:30 (24-hour time).';
  try {
    new Intl.DateTimeFormat('en', { timeZone: preferences.timezone }).format();
  } catch {
    return 'Use a timezone like America/New_York or Europe/London.';
  }
  if (preferences.channels.some((channel) => channel !== 'push' && channel !== 'email')) return 'Choose push, email, or neither.';
  return null;
}
