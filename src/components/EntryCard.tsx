import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { copy, entryText } from '../lib/copy';
import { relativeTime, type Entry } from '../lib/domain';
import { flavorTheme, theme } from '../theme';
import { Avatar, T } from './ui';

export function EntryCard({ entry }: { entry: Entry }) {
  const flavor = flavorTheme[entry.flavor];
  return <View style={s.card}>
    <View style={s.top}>
      <View style={[s.category, { backgroundColor: flavor.background }]}>
        <Ionicons name={flavor.icon} size={14} color={flavor.color} />
        <T style={[s.categoryText, { color: flavor.color }]}>{copy.flavors[entry.flavor].label}</T>
      </View>
      <T style={s.time}>{relativeTime(entry.created_at)}</T>
    </View>
    <View style={s.content}>
      <Avatar name={entry.tagged_name} size={52} color={flavor.background} />
      <View style={s.words}>
        <T style={s.headline}>{entryText(entry)}</T>
      </View>
    </View>
    <View style={s.footer}>
      <View style={s.status}>
        <Ionicons name={entry.revealed ? 'sparkles-outline' : 'lock-closed-outline'} size={12} color={entry.revealed ? theme.colors.green : theme.colors.muted} />
        <T style={[s.statusText, entry.revealed && { color: theme.colors.green }]}>{entry.revealed ? copy.book.revealedBadge : copy.book.anonymousBadge}</T>
      </View>
      <View style={s.dots}>
        {[0, 1, 2].map((n) => <View key={n} style={[s.dot, entry.revealed && s.dotActive]} />)}
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: theme.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, padding: 22, gap: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  categoryText: { fontSize: 10, fontFamily: theme.fonts.medium },
  time: { fontSize: 10, color: theme.colors.muted },
  content: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  words: { flex: 1, gap: 4 },
  intro: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  headline: { fontFamily: theme.fonts.display, fontSize: 24, lineHeight: 31, letterSpacing: -0.6 },
  spark: { color: '#8E9B55', fontSize: 21 },
  flavor: { fontSize: 12, color: theme.colors.muted },
  footer: { borderTopWidth: 1, borderColor: '#F1F1EB', paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusText: { fontSize: 10, color: theme.colors.muted },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E6E8DE' },
  dotActive: { backgroundColor: '#92A76A' },
});
