import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_SURVEY, GOALS, prepareSurvey, PRIORITIES, toggleOption, validateSurveyStep } from '../src/lib/survey.ts';

test('survey options match the specification', () => {
  assert.equal(PRIORITIES.length, 7);
  assert.equal(GOALS.length, 9);
  assert.ok(PRIORITIES.includes('universal understanding (astrological)'));
  assert.ok(GOALS.includes('household chores/cleaning'));
});
test('multi-select toggles preserve other selections', () => {
  assert.deepEqual(toggleOption(['hobbies'], 'finance'), ['hobbies', 'finance']);
  assert.deepEqual(toggleOption(['hobbies', 'finance'], 'hobbies'), ['finance']);
});
test('first two answers require a selection and selected other requires text', () => {
  assert.ok(validateSurveyStep(EMPTY_SURVEY, 0));
  assert.ok(validateSurveyStep(EMPTY_SURVEY, 1));
  assert.ok(validateSurveyStep({ ...EMPTY_SURVEY, priorities: ['other'], priorities_other: '  ' }, 0));
  assert.equal(validateSurveyStep({ ...EMPTY_SURVEY, priorities: ['other'], priorities_other: 'painting' }, 0), null);
  assert.equal(validateSurveyStep({ ...EMPTY_SURVEY, goals: ['health'] }, 1), null);
});
test('putting-off answer is optional but inspirations require text', () => {
  assert.equal(validateSurveyStep(EMPTY_SURVEY, 2), null);
  assert.ok(validateSurveyStep(EMPTY_SURVEY, 3));
  assert.equal(validateSurveyStep({ ...EMPTY_SURVEY, inspirations: 'Music' }, 3), null);
});
test('saved draft trims answers, drops deselected other, and preserves resume progress', () => {
  const saved = prepareSurvey({ ...EMPTY_SURVEY, priorities: ['hobbies'], priorities_other: 'stale', inspirations: ' music ', saved_step: 3 }, 0);
  assert.equal(saved.priorities_other, '');
  assert.equal(saved.inspirations, 'music');
  assert.equal(saved.saved_step, 3);
  assert.equal(prepareSurvey(saved, 3).saved_step, 4);
});
test('all free-text answers have bounded lengths', () => {
  assert.ok(validateSurveyStep({ ...EMPTY_SURVEY, putting_off: 'a'.repeat(4001) }, 2));
  assert.ok(validateSurveyStep({ ...EMPTY_SURVEY, inspirations: 'a'.repeat(4001) }, 3));
});
