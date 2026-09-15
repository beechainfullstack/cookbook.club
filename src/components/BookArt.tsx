import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { copy } from '../lib/copy';
import { theme } from '../theme';
import { T } from './ui';

export function BookArt() {
  return <View style={s.scene} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
    <View style={s.orbit} />
    <View style={s.backPage} />
    <View style={s.book}>
      <View style={s.spine} />
      <T style={s.eyebrow}>{copy.book.chapter}</T>
      <T style={s.title}>{copy.navigation.book}</T>
      <View style={s.flame}><Ionicons name="flame-outline" size={48} color={theme.colors.ink} /></View>
      <View style={s.rule} /><View style={[s.rule, { width: 52 }]} />
      <T style={s.footer}>{copy.brand.name}</T>
    </View>
    <View style={s.star}><Ionicons name="sparkles" size={32} color="#8F9C54" /></View>
    <View style={s.badge}><Ionicons name="heart-outline" size={15} color={theme.colors.ink} /><T style={s.badgeText}>{copy.book.permanent}</T></View>
  </View>;
}

const s = StyleSheet.create({
  scene: { width: 285, height: 248, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 214, height: 214, borderRadius: 107, backgroundColor: '#ECEEDD' },
  backPage: { position: 'absolute', width: 161, height: 204, backgroundColor: '#DBDFC5', borderRadius: 5, transform: [{ rotate: '8deg' }], left: 66, top: 18 },
  book: { width: 159, height: 205, backgroundColor: '#E5EBCA', borderWidth: 1, borderColor: '#B9C19C', borderRadius: 5,
    transform: [{ rotate: '-9deg' }], alignItems: 'center', paddingTop: 23, gap: 9, boxShadow: '7px 10px 0 #263C3010' },
  spine: { position: 'absolute', left: 8, top: 0, bottom: 0, width: 1, backgroundColor: '#B9C19C' },
  eyebrow: { fontSize: 6, letterSpacing: 1.4, fontFamily: theme.fonts.bold },
  title: { fontFamily: theme.fonts.display, fontSize: 29, letterSpacing: -1.5 },
  flame: { marginVertical: 2 }, rule: { height: 1, width: 72, backgroundColor: '#A9B58B' },
  footer: { fontSize: 8, fontFamily: theme.fonts.medium, marginTop: 4 },
  star: { position: 'absolute', right: 17, top: 17, transform: [{ rotate: '10deg' }] },
  badge: { position: 'absolute', bottom: 4, left: 22, backgroundColor: '#FFFDF5', borderColor: '#E5E3D5', borderWidth: 1,
    borderRadius: 8, flexDirection: 'row', gap: 7, paddingVertical: 10, paddingHorizontal: 12, transform: [{ rotate: '3deg' }] },
  badgeText: { fontSize: 10 },
});
