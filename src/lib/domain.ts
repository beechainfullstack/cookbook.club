import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { copy, format } from './copy';

export const flavorIds = ['art', 'sports', 'ideas', 'style', 'kindness', 'music'] as const;
export type Flavor = (typeof flavorIds)[number];
export type Tab = 'book' | 'tag' | 'myPage';
export type Person = { id: string; display_name: string };
export type School = { id: string; name: string; location: string };
export type Profile = Person & { school_id: string };
export type Entry = {
  id: string;
  school_id: string;
  tagged_user_id: string;
  tagged_name: string;
  flavor: Flavor;
  created_at: string;
  revealed: boolean;
  tagger_names: string[];
};

export function isFlavor(value: string): value is Flavor {
  return flavorIds.some((flavor) => flavor === value);
}

export function validBirthday(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' &&
    value <= localDate(now);
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isOldEnough(birthday: string, now = new Date()): boolean {
  if (!validBirthday(birthday, now)) return false;
  // Match PostgreSQL's Feb 29 + 13 years behavior (February 28).
  const birth = new Date(`${birthday}T12:00:00`);
  const anniversary = new Date(birth.getFullYear() + 13, birth.getMonth(), birth.getDate());
  if (anniversary.getMonth() !== birth.getMonth()) anniversary.setDate(0);
  return localDate(anniversary) <= localDate(now);
}

export function normalizePhone(value: string, country?: CountryCode): string | null {
  const phone = parsePhoneNumberFromString(value, country);
  return phone?.isValid() ? phone.number : null;
}

export function phoneCountry(value: string): CountryCode | undefined {
  return parsePhoneNumberFromString(value)?.country;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || copy.common.initialFallback;
}

export function relativeTime(value: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return copy.book.justNow;
  if (minutes < 60) return format(copy.book.minutesAgo, { count: minutes });
  if (minutes < 1440) return format(copy.book.hoursAgo, { count: Math.floor(minutes / 60) });
  return new Intl.DateTimeFormat(copy._meta.locale, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export type DemoTag = { taggerId: string; recipientId: string; flavor: Flavor; id: string; createdAt: string };

export function revealNames(tags: DemoTag[], recipientId: string, people: Person[]): string[] {
  const ids = [...new Set(tags.filter((tag) => tag.recipientId === recipientId).map((tag) => tag.taggerId))];
  return ids.length < 3 ? [] : ids.slice(0, 3).map((id) => people.find((person) => person.id === id)?.display_name ?? '');
}
