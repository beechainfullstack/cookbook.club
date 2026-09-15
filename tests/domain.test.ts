import { describe, expect, it } from 'vitest';
import { copy, format, joinNames } from '../src/lib/copy';
import { flavorIds, isOldEnough, normalizePhone, revealNames, validBirthday, type DemoTag } from '../src/lib/domain';

describe('age gate', () => {
  it('blocks the day before 13 and allows the birthday', () => {
    expect(isOldEnough('2013-09-16', new Date(2026, 8, 15))).toBe(false);
    expect(isOldEnough('2013-09-15', new Date(2026, 8, 15))).toBe(true);
  });
  it('rejects impossible, future, and malformed dates', () => {
    for (const birthday of ['2012-02-30', '2013-02-29', '2030-01-01', '', '09/15/2010', '1899-01-01']) {
      expect(validBirthday(birthday, new Date(2026, 8, 15))).toBe(false);
      expect(isOldEnough(birthday, new Date(2026, 8, 15))).toBe(false);
    }
  });
  it('matches PostgreSQL at leap-year boundaries', () => {
    expect(isOldEnough('2012-02-29', new Date(2025, 1, 28))).toBe(true);
    expect(isOldEnough('2023-03-01', new Date(2036, 1, 29))).toBe(false);
    expect(isOldEnough('2012-02-29', new Date(2025, 1, 27))).toBe(false);
  });
});

describe('contact normalization', () => {
  it('normalizes international and national numbers into the same matching key', () => {
    expect(normalizePhone('(415) 555-0123', 'US')).toBe('+14155550123');
    expect(normalizePhone('+1 415 555 0123')).toBe('+14155550123');
    expect(normalizePhone('020 7946 0958', 'GB')).toBe('+442079460958');
  });
  it('rejects incomplete numbers and national numbers without country context', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('(415) 555-0123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('draft copy contract', () => {
  it('has a nonempty label and description for every allowed flavor', () => {
    expect(Object.keys(copy.flavors).sort()).toEqual([...flavorIds].sort());
    for (const flavor of flavorIds) {
      expect(copy.flavors[flavor].label.trim()).not.toBe('');
      expect(copy.flavors[flavor].description.trim()).not.toBe('');
    }
  });
  it('uses dictionary values for dynamic names without interpreting their content', () => {
    expect(format(copy.book.recognition, { user_name: '{school_name}' })).toBe('{school_name} is cooking');
    expect(format('{count} / {count}', { count: 0 })).toBe('0 / 0');
    expect(joinNames(['A', 'B', 'C'])).toBe(`A${copy.common.nameSeparator}B ${copy.common.and} C`);
  });
});

describe('demo reveal matches the all-time recipient rule', () => {
  const people = ['a', 'b', 'c', 'd'].map((id) => ({ id, display_name: id.toUpperCase() }));
  const tag = (taggerId: string, recipientId = 'recipient'): DemoTag => ({
    taggerId, recipientId, flavor: 'art', id: taggerId, createdAt: '2026-01-01T00:00:00Z',
  });
  it('keeps identities hidden for repeated tags and tags for another person', () => {
    expect(revealNames([tag('a'), tag('a'), tag('b'), tag('c', 'someone-else')], 'recipient', people)).toEqual([]);
  });
  it('reveals only the first three distinct taggers and keeps those identities stable', () => {
    expect(revealNames([tag('a'), tag('a'), tag('b'), tag('c'), tag('d')], 'recipient', people)).toEqual(['A', 'B', 'C']);
  });
});
