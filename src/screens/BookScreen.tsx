import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BookArt } from '../components/BookArt';
import { EntryCard } from '../components/EntryCard';
import { Button, Empty, Notice, shared, T } from '../components/ui';
import { copy, format } from '../lib/copy';
import { flavorIds, type Entry, type Flavor, type School } from '../lib/domain';
import { useBook } from '../lib/useBook';
import { flavorTheme, theme } from '../theme';

export function BookScreen({ school, onTag, demoEntries }: { school: School; onTag: () => void; demoEntries?: Entry[] }) {
  const [filter, setFilter] = useState<Flavor>();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const feed = useBook(school.id, undefined, filter, demoEntries);
  return <View style={s.root}>
    <View style={s.schoolCrumb}><Ionicons name="school-outline" size={15} color={theme.colors.green} />
      <T style={s.schoolCrumbText}>{school.name}</T><View style={s.crumbDot} /><T style={s.schoolCrumbHint}>{copy.navigation.book}</T></View>
    <View style={s.hero}>
      <View style={s.heroText}><T style={shared.eyebrow}>{copy.book.eyebrow}</T>
        <T style={[s.heroHeading, width < 600 && { fontSize: 43, lineHeight: 49 }]}>{copy.the_book.header_title}</T>
        <T style={s.heroDescription}>{copy.book.description}</T>
        <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><Button label={copy.book.tagCtaButton} onPress={onTag} icon="add-outline" /></View>
      </View>
      {width >= 700 && <BookArt />}
    </View>
    <View style={s.columns}>
      <View style={s.feed}>
        <View style={s.feedHeader}>
          <View style={{ gap: 6 }}><T style={s.sectionTitle}>{copy.book.section}</T><T style={s.hint}>{copy.book.sectionHint}</T></View>
          <Pressable onPress={feed.refresh} accessibilityRole="button" accessibilityLabel={copy.book.refresh} style={s.refresh}>
            <Ionicons name="refresh-outline" size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          <Pressable onPress={() => setFilter(undefined)} accessibilityRole="button" accessibilityState={{ selected: !filter }}
            style={[s.filter, !filter && s.activeFilter]}><T style={[s.filterText, !filter && s.activeFilterText]}>{copy.book.all}</T></Pressable>
          {flavorIds.map((flavor) => <Pressable key={flavor} onPress={() => setFilter(flavor)}
            accessibilityRole="button" accessibilityState={{ selected: flavor === filter }}
            accessibilityLabel={format(copy.accessibility.filter, { flavor: copy.flavors[flavor].label })}
            style={[s.filter, flavor === filter && s.activeFilter]}>
            <Ionicons name={flavorTheme[flavor].icon} size={14} color={filter === flavor ? '#FFFFFF' : theme.colors.muted} />
            <T style={[s.filterText, filter === flavor && s.activeFilterText]}>{copy.flavors[flavor].label}</T>
          </Pressable>)}
        </ScrollView>
        <Notice message={feed.error} error />
        {feed.error && <Button label={copy.common.retry} onPress={feed.refresh} secondary />}
        {feed.entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
        {feed.loading && <ActivityIndicator color={theme.colors.green} style={{ padding: 20 }} />}
        {!feed.loading && !feed.error && feed.entries.length === 0 && <Empty title={copy.the_book.header_title} body={copy.the_book.empty_state} />}
        {feed.hasMore && <Button secondary label={copy.book.loadMore} onPress={feed.loadMore} busy={feed.loading} />}
        {!feed.hasMore && feed.entries.length > 0 && <View style={s.end}><Ionicons name="flower-outline" size={17} color={theme.colors.muted} /><T style={s.endText}>{copy.book.end}</T></View>}
      </View>
      {wide && <View style={s.sidebar}>
        <View style={s.schoolCard}>
          <T style={[shared.eyebrow, { fontSize: 8 }]}>{copy.book.schoolLabel}</T>
          <View style={s.schoolIcon}><Ionicons name="school-outline" size={28} color={theme.colors.green} /></View>
          <T style={s.schoolName}>{school.name}</T><T style={s.location}>{school.location}</T>
          <View style={s.schoolFooter}><Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.green} /><T style={s.schoolPrivacy}>{copy.book.schoolOnly}</T></View>
        </View>
        <View style={s.ruleCard}><View style={s.ruleIcon}><Ionicons name="sparkles-outline" size={21} color={theme.colors.green} /></View>
          <T style={s.ruleTitle}>{copy.book.communityTitle}</T><T style={s.ruleText}>{copy.book.communityBody}</T>
          <View style={s.unlock}><View style={s.unlockDots}>{[0, 1, 2].map((i) => <View key={i} style={s.unlockDot}><Ionicons name="person" size={10} color={theme.colors.green} /></View>)}</View>
            <Ionicons name="arrow-forward" size={15} color={theme.colors.muted} /><Ionicons name="lock-open-outline" size={17} color={theme.colors.green} /></View>
        </View>
        <T style={s.sidebarFooter}>{copy.brand.name} {copy.common.dot} {copy.book.permanent}</T>
      </View>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 28 },
  schoolCrumb: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  schoolCrumbText: { fontFamily: theme.fonts.medium, fontSize: 11 },
  crumbDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#A7AAA0', marginHorizontal: 2 },
  schoolCrumbHint: { fontSize: 11, color: theme.colors.muted },
  hero: { backgroundColor: '#F0F1E7', borderRadius: 20, padding: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', gap: 20 },
  heroText: { flex: 1, gap: 17 },
  heroHeading: { fontFamily: theme.fonts.display, fontSize: 51, lineHeight: 57, letterSpacing: -1.8 },
  heroDescription: { fontSize: 12, color: '#717762', lineHeight: 20, maxWidth: 310 },
  columns: { flexDirection: 'row', gap: 30, alignItems: 'flex-start' },
  feed: { flex: 1, gap: 14 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 3, marginBottom: 5 },
  sectionTitle: { fontFamily: theme.fonts.display, fontSize: 26, letterSpacing: -0.6 },
  hint: { color: theme.colors.muted, fontSize: 11 },
  refresh: { padding: 12, borderRadius: 22 },
  filters: { gap: 6, paddingBottom: 8 },
  filter: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 },
  activeFilter: { backgroundColor: theme.colors.green, borderColor: theme.colors.green },
  filterText: { fontSize: 10, color: theme.colors.muted, fontFamily: theme.fonts.medium },
  activeFilterText: { color: '#FFFFFF' },
  sidebar: { width: 249, gap: 18, paddingTop: 4 },
  schoolCard: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14, backgroundColor: theme.colors.paper, padding: 23, alignItems: 'center', gap: 12 },
  schoolIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F0F2E7', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  schoolName: { fontFamily: theme.fonts.display, fontSize: 24, textAlign: 'center' },
  location: { fontSize: 10, color: theme.colors.muted },
  schoolFooter: { flexDirection: 'row', gap: 7, borderTopWidth: 1, borderColor: theme.colors.line, paddingTop: 16, marginTop: 8 },
  schoolPrivacy: { flex: 1, color: theme.colors.muted, fontSize: 10, lineHeight: 17 },
  ruleCard: { backgroundColor: '#F0F2E6', padding: 22, borderRadius: 14, gap: 13 },
  ruleIcon: { marginBottom: 5 }, ruleTitle: { fontFamily: theme.fonts.display, fontSize: 22, lineHeight: 28 },
  ruleText: { color: '#758068', fontSize: 11, lineHeight: 19 },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  unlockDots: { flexDirection: 'row', gap: 3 },
  unlockDot: { width: 22, height: 22, borderRadius: 12, backgroundColor: '#DBE3C8', alignItems: 'center', justifyContent: 'center' },
  sidebarFooter: { fontSize: 8, color: theme.colors.muted, textAlign: 'center', lineHeight: 15 },
  end: { alignItems: 'center', gap: 10, paddingVertical: 23 },
  endText: { fontSize: 10, color: theme.colors.muted, textAlign: 'center' },
});
