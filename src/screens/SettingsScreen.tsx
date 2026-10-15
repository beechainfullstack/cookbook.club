import { useState } from 'react';
import { Brand, Body, Button, ErrorText, Heading, Screen } from '../components/ui';
import { supabase } from '../lib/supabase';
import { detachPushToken } from '../lib/notifications';

export function SettingsScreen({ onEdit, onPreferences, onBack }: { onEdit: () => void; onPreferences: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) await detachPushToken(data.user.id);
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    } catch { setError('Couldn’t sign out. Check your connection and try again.'); }
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
