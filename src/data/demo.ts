import { copy } from '../lib/copy';
import { revealNames, type DemoTag, type Entry, type Person, type Profile, type School } from '../lib/domain';

export const demoSchool: School = { id: 'demo-school', name: copy.demo.school, location: copy.demo.schoolLocation };
export const demoProfile: Profile = { id: 'demo-you', display_name: copy.demo.yourName, school_id: demoSchool.id };
export const demoPeople: Person[] = copy.demo.names.map((display_name, index) => ({ id: `demo-${index}`, display_name }));

export function initialTags(now = Date.now()): DemoTag[] {
  return [
    { taggerId: 'demo-4', recipientId: 'demo-0', flavor: 'art', id: 'seed-0', createdAt: new Date(now - 25 * 60000).toISOString() },
    { taggerId: 'demo-5', recipientId: 'demo-1', flavor: 'style', id: 'seed-1', createdAt: new Date(now - 48 * 60000).toISOString() },
    { taggerId: 'demo-6', recipientId: 'demo-2', flavor: 'sports', id: 'seed-2', createdAt: new Date(now - 70 * 60000).toISOString() },
    { taggerId: 'demo-4', recipientId: 'demo-3', flavor: 'music', id: 'seed-3', createdAt: new Date(now - 100 * 60000).toISOString() },
    { taggerId: 'demo-5', recipientId: 'demo-0', flavor: 'art', id: 'seed-4', createdAt: new Date(now - 180 * 60000).toISOString() },
    { taggerId: 'demo-6', recipientId: 'demo-0', flavor: 'art', id: 'seed-5', createdAt: new Date(now - 260 * 60000).toISOString() },
    { taggerId: 'demo-7', recipientId: 'demo-1', flavor: 'kindness', id: 'seed-6', createdAt: new Date(now - 340 * 60000).toISOString() },
    { taggerId: 'demo-4', recipientId: 'demo-you', flavor: 'ideas', id: 'seed-7', createdAt: new Date(now - 1440 * 60000).toISOString() },
  ].map((tag) => ({ ...tag, flavor: tag.flavor as DemoTag['flavor'] }));
}

export function demoEntries(tags: DemoTag[]): Entry[] {
  const people = [...demoPeople, demoProfile];
  return tags.map((tag) => {
    const names = revealNames(tags, tag.recipientId, people);
    return {
      id: tag.id,
      school_id: demoSchool.id,
      tagged_user_id: tag.recipientId,
      tagged_name: people.find((person) => person.id === tag.recipientId)?.display_name ?? '',
      flavor: tag.flavor,
      created_at: tag.createdAt,
      revealed: names.length === 3,
      tagger_names: names,
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
