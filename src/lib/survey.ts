export const PRIORITIES = [
  'hobbies', 'emotional support', 'inspiration', 'accountability', 'finance',
  'universal understanding (astrological)', 'other',
] as const;
export const GOALS = [
  'social skills', 'finance', 'understanding', 'music', 'love life', 'diet',
  'health', 'household chores/cleaning', 'other',
] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = typeof SEASONS[number];

export type Survey = {
  priorities: string[];
  priorities_other: string;
  goals: string[];
  goals_other: string;
  putting_off: string;
  inspirations: string;
  saved_step: number;
};

export const EMPTY_SURVEY: Survey = {
  priorities: [], priorities_other: '', goals: [], goals_other: '',
  putting_off: '', inspirations: '', saved_step: 0,
};

export function toggleOption(selected: string[], option: string): string[] {
  return selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
}

export function validateSurveyStep(survey: Survey, step: number): string | null {
  const selected = step === 0 ? survey.priorities : survey.goals;
  const other = step === 0 ? survey.priorities_other : survey.goals_other;
  if (step < 2) {
    if (selected.length === 0) return 'Choose at least one. You can change this later.';
    if (selected.includes('other') && !other.trim()) return 'Tell us a little about “other”.';
    if (other.length > 1000) return 'Please keep your answer under 1,000 characters.';
  }
  if (step === 2 && survey.putting_off.length > 4000) return 'Please keep your answer under 4,000 characters.';
  if (step === 3) {
    if (!survey.inspirations.trim()) return 'Share something that inspires you.';
    if (survey.inspirations.length > 4000) return 'Please keep your answer under 4,000 characters.';
  }
  return null;
}

export function prepareSurvey(survey: Survey, step: number): Survey {
  return {
    ...survey,
    priorities_other: survey.priorities.includes('other') ? survey.priorities_other.trim() : '',
    goals_other: survey.goals.includes('other') ? survey.goals_other.trim() : '',
    putting_off: survey.putting_off.trim(),
    inspirations: survey.inspirations.trim(),
    saved_step: Math.max(survey.saved_step, step + 1),
  };
}
