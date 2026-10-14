import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPreferences, validatePreferences } from '../src/lib/settings.ts';

test('defaults enable email only, not push', () => {
  assert.deepEqual(defaultPreferences().channels, ['email']);
  assert.equal(defaultPreferences().paused, false);
  assert.equal(validatePreferences(defaultPreferences()), null);
});
test('settings validate local 24-hour times and IANA timezones', () => {
  const defaults = defaultPreferences();
  for (const time of ['00:00', '09:30', '23:59']) assert.equal(validatePreferences({ ...defaults, time, timezone: 'America/New_York' }), null);
  for (const time of ['24:00', '9:00', '23:60', '9am']) assert.ok(validatePreferences({ ...defaults, time }));
  assert.ok(validatePreferences({ ...defaults, timezone: 'not/a-zone' }));
  assert.ok(validatePreferences({ ...defaults, day: 7 }));
});
test('no active channels is allowed and pause preference is preserved', () => {
  assert.equal(validatePreferences({ ...defaultPreferences(), channels: [], paused: true }), null);
});
