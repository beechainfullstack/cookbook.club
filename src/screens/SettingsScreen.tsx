import { useState } from 'react';
import { Brand, Body, Button, ErrorText, Heading, Screen } from '../components/ui';
import { supabase } from '../lib/supabase';

export function SettingsScreen({ onEdit, onPreferences, onBack }: { onEdit: () => void; onPreferences: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    setBusy(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) setError('Couldn’t sign out. Please try again.');
    setBusy(false);
  }
  return <Screen footer={<Button title="Back" quiet onPress={onBack} disabled={busy} />}>
    <Brand /><Heading>Settings</Heading>
    <Body>Change things whenever you need to.</Body>
    <Button title="Edit survey answers" onPress={onEdit} quiet disabled={busy} />
    <Button title="Schedule, channels, and pause" onPress={onPreferences} quiet disabled={busy} />
    <Button title="Sign out" onPress={signOut} quiet busy={busy} />
    <ErrorText message={error} />
  </Screen>;
}
