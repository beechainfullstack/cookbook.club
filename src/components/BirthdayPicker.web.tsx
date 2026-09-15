import { copy } from '../lib/copy';
import { localDate } from '../lib/domain';
import { theme } from '../theme';
import type { BirthdayPickerProps } from './BirthdayPicker';

export default function BirthdayPicker({ value, onChange }: BirthdayPickerProps) {
  return <input type="date" aria-label={copy.onboarding.birthday} value={value}
    min="1900-01-01" max={localDate(new Date())} onChange={(event) => onChange(event.target.value)}
    style={{ width: '100%', minHeight: 50, border: `1px solid ${theme.colors.line}`, borderRadius: 10,
      background: theme.colors.paper, padding: '0 14px', color: theme.colors.ink,
      fontFamily: theme.fonts.regular, fontSize: 15, boxSizing: 'border-box' }} />;
}
