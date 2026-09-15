import { describe, expect, it } from 'vitest';
import dictionary from '../copy.json';
import { copy, entryText, format, revealNotification } from '../src/lib/copy';
import { flavorIds } from '../src/lib/domain';

describe('supplied product copy', () => {
  const entry = { tagged_name: 'Jamie', flavor: 'art' as const, revealed: false, tagger_names: ['Alex', 'Sam', 'Taylor'] };

  it('keeps identities out of anonymous and incomplete reveal messages', () => {
    const anonymous = 'Someone thinks Jamie is cooking at Art & Creativity.';
    expect(entryText(entry)).toBe(anonymous);
    expect(entryText({ ...entry, revealed: true, tagger_names: ['Alex'] })).toBe(anonymous);
    expect(entryText({ ...entry, revealed: true, tagger_names: ['Alex', 'Sam'] })).toBe(anonymous);
  });

  it('interpolates all three revealed names without expanding user-provided tokens', () => {
    expect(entryText({ ...entry, revealed: true })).toBe('Alex, Sam, and Taylor think Jamie is cooking at Art & Creativity.');
    expect(entryText({ ...entry, tagged_name: '{flavor}', revealed: true })).toContain('think {flavor} is cooking');
  });

  it('maps the six database flavors to the supplied labels in picker order', () => {
    expect(flavorIds.map((id) => copy.flavors[id].label)).toEqual(Object.values(dictionary.flavors));
  });

  it('resolves school placeholders in welcome and contacts copy', () => {
    for (const template of [copy.onboarding.welcome_subtitle, copy.permissions.contacts_subtitle]) {
      const rendered = format(template, { school_name: 'Westlake High' });
      expect(rendered).toContain('Westlake High');
      expect(rendered).not.toMatch(/\{\w+\}/);
    }
  });

  it('uses the supplied reveal notification with a resolved flavor', () => {
    for (const flavor of flavorIds) {
      const notification = revealNotification(flavor);
      expect(notification.title).toBe("You're cooking! 🔥");
      expect(notification.body).toBe(`3 people think you're cooking at ${copy.flavors[flavor].label}. Tap to see who.`);
      expect(notification.body).not.toMatch(/\{\w+\}/);
    }
  });
});
