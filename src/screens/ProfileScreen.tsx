import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { EntryCard } from '../components/EntryCard';
import { Avatar, Button, Empty, Notice, shared, T } from '../components/ui';
import { enablePush, errorCopy, signOut } from '../lib/backend';
import { copy } from '../lib/copy';
import type { Entry, Profile, School } from '../lib/domain';
import { useBook } from '../lib/useBook';
import { theme } from '../theme';

export function ProfileScreen({ profile, school, demoEntries, resetDemo }: {
  profile: Profile; school: School; demoEntries?: Entry[]; resetDemo: () => void;
}) {
  const feed = useBook(school.id, profile.id, undefined, demoEntries);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(errorCopy(failure)); }
    finally { setBusy(false); }
  }
  return <View style={s.root}>
    <T style={shared.eyebrow}>{copy.profile.eyebrow}</T>
    <View style={s.identity}><Avatar name={profile.display_name} size={70} /><View style={{ flex: 1, gap: 7 }}>
      <T style={s.name}>{profile.display_name}</T><T style={shared.body}>{school.name}</T>
      <View style={shared.row}><Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.green} /><T style={s.member}>{copy.profile.member}</T></View>
    </View></View>
    <T style={shared.heading}>{copy.profile.title}</T><T style={shared.body}>{copy.profile.description}</T>
    <View style={s.notifications}><T style={s.title}>{copy.permissions.notifications_title}</T><T style={shared.body}>{copy.permissions.notifications_subtitle}</T>
      <Button secondary busy={busy} label={copy.profile.enableNotifications} onPress={() => {
        void run(async () => {
          if (demoEntries) { setNotice(copy.profile.notificationsUnavailable); return; }
          await enablePush(); setNotice(copy.profile.notificationsEnabled);
        });
      }} icon="notifications-outline" />
      <Notice message={notice} /><Notice message={error} error />
    </View>
    <Notice message={feed.error} error />
    {feed.error && <Button label={copy.common.retry} onPress={feed.refresh} secondary />}
    {feed.entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    {feed.loading && <ActivityIndicator color={theme.colors.green} />}
    {!feed.loading && !feed.error && feed.entries.length === 0 && <Empty title={copy.profile.emptyTitle} body={copy.profile.emptyBody} />}
    {feed.hasMore && <Button label={copy.book.loadMore} onPress={feed.loadMore} busy={feed.loading} secondary />}
    <Button secondary label={demoEntries ? copy.demo.reset : copy.common.signOut} busy={busy}
      onPress={() => { if (demoEntries) resetDemo(); else void run(signOut); }} />
  </View>;
}

const s = StyleSheet.create({
  root: { maxWidth: 700, width: '100%', alignSelf: 'center', gap: 20 },
  identity: { flexDirection: 'row', gap: 20, alignItems: 'center', paddingVertical: 15 },
  name: { fontFamily: theme.fonts.display, fontSize: 29 }, member: { fontSize: 10, color: theme.colors.green },
  notifications: { backgroundColor: theme.colors.lightGreen, borderRadius: 16, padding: 24, gap: 14 },
  title: { fontFamily: theme.fonts.display, fontSize: 24 },
});
