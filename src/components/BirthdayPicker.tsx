import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { copy } from '../lib/copy';
import { localDate } from '../lib/domain';
import { Button } from './ui';

export type BirthdayPickerProps = { value: string; onChange: (value: string) => void };

export default function BirthdayPicker({ value, onChange }: BirthdayPickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const initial = new Date(today.getFullYear() - 13, 0, 1);
  return <View>
    <Button secondary label={value || copy.onboarding.birthday} onPress={() => setOpen(true)} icon="calendar-outline" />
    {open && <DateTimePicker value={value ? new Date(`${value}T12:00:00`) : initial}
      mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={today} minimumDate={new Date(1900, 0, 1)}
      onChange={(event, selected) => {
        if (Platform.OS !== 'ios') setOpen(false);
        if (event.type === 'set' && selected) onChange(localDate(selected));
      }} />}
    {open && Platform.OS === 'ios' && <Button secondary label={copy.common.done} onPress={() => {
      if (!value) onChange(localDate(initial));
      setOpen(false);
    }} />}
  </View>;
}
