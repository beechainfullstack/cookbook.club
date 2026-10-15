import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Brand, Body, Button, Choice, colors, ErrorText, Field, Heading, Label, Screen, styles } from '../components/ui';
import { savePreferences } from '../lib/data';
import { registerPushToken } from '../lib/notifications';
import { DAYS, defaultPreferences, type Preferences, validatePreferences } from '../lib/settings';

export function PreferencesScreen({ userId, initial, onboarding, onSaved, onBack }: {
  userId: string; initial: Preferences | null; onboarding: boolean; onSaved: () => Promise<void>; onBack: () => void;
}) {
  const [preferences, setPreferences] = useState(initial || defaultPreferences());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const locked = busy || permissionBusy;
  const update = (changes: Partial<Preferences>) => { setPreferences((previous) => ({ ...previous, ...changes })); setError(null); };

  async function togglePush(on: boolean) {
    if (!on) { update({ channels: preferences.channels.filter((channel) => channel !== 'push'), expo_push_token: null }); return; }
    setPermissionBusy(true);
    setError(null);
    try {
      const token = await registerPushToken(true);
      if (token) update({ channels: [...preferences.channels.filter((channel) => channel !== 'push'), 'push'], expo_push_token: token });
      else setError('Push permission is off. You can enable it in your device settings, or use email instead.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Couldn’t request push permission. Try again or use email.');
    } finally { setPermissionBusy(false); }
  }

  async function save() {
    const next = { ...preferences, timezone: preferences.timezone.trim(), time: preferences.time.trim() };
    const validation = validatePreferences(next);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError(null);
    try {
      if (next.channels.includes('push') && !next.expo_push_token) {
        const token = await registerPushToken(true);
        if (!token) throw new Error('Push permission is off. Turn push off to save email-only preferences.');
        next.expo_push_token = token;
      }
      await savePreferences(userId, next, onboarding);
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Couldn’t save your preferences. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return <Screen footer={<>
    <ErrorText message={error} />
    <Button title={onboarding ? 'Finish setup' : 'Save preferences'} busy={busy} disabled={permissionBusy} onPress={save} />
    <Button title="Back" quiet disabled={locked} onPress={onBack} />
  </>}>
    <Brand />
    <Heading>A note on your terms.</Heading>
    <Body>About once a week, at a time that works for you.</Body>
    <View style={styles.card}>
      <View style={styles.row}><Label>Push notifications</Label><Switch accessibilityLabel="Push notifications" value={preferences.channels.includes('push')} disabled={locked} onValueChange={togglePush} trackColor={{ false: colors.border, true: colors.accent }} /></View>
      <View style={styles.row}><Label>Email</Label><Switch accessibilityLabel="Email notifications" value={preferences.channels.includes('email')} disabled={locked}
        onValueChange={(on) => update({ channels: on ? [...preferences.channels.filter((channel) => channel !== 'email'), 'email'] : preferences.channels.filter((channel) => channel !== 'email') })} trackColor={{ false: colors.border, true: colors.accent }} /></View>
    </View>
    {preferences.channels.length === 0 && <Body>Both channels are off. You won’t receive check-ins unless you turn one on.</Body>}
    <Label>Day of the week</Label>
    <View style={{ gap: 8 }}>
      {DAYS.map((day, index) => <Choice key={day} label={day} selected={preferences.day === index} disabled={locked} onPress={() => update({ day: index })} />)}
    </View>
    <Field label="Local time (24-hour)" value={preferences.time} onChangeText={(time) => update({ time })} placeholder="09:00" maxLength={5} autoCorrect={false} editable={!locked} />
    <Field label="Timezone" value={preferences.timezone} onChangeText={(timezone) => update({ timezone })} placeholder="America/New_York" autoCapitalize="none" autoCorrect={false} maxLength={100} editable={!locked} />
    <Body>We’ve used your device’s timezone. Change it if you need to.</Body>
    {!onboarding && <View style={styles.row}><Label>Pause messages</Label><Switch accessibilityLabel="Pause messages" value={preferences.paused} onValueChange={(paused) => update({ paused })} disabled={locked} trackColor={{ false: colors.border, true: colors.accent }} /></View>}
  </Screen>;
}
