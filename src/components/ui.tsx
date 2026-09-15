import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextProps, type TextInputProps } from 'react-native';
import { copy } from '../lib/copy';
import { initials } from '../lib/domain';
import { theme } from '../theme';

export function T({ style, ...props }: TextProps) {
  return <Text {...props} style={[s.text, style]} />;
}

export function Button({ label, onPress, disabled, busy, secondary, icon }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || busy) && s.disabled, pressed && s.pressed]}>
      {busy ? <ActivityIndicator color={secondary ? theme.colors.ink : '#FFF'} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={secondary ? theme.colors.ink : '#FFF'} />}
          <T style={[s.buttonText, secondary && { color: theme.colors.ink }]}>{label}</T>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={s.field}><T style={s.label}>{label}</T><TextInput {...props} accessibilityLabel={label}
    placeholderTextColor={theme.colors.muted} style={[s.input, props.style]} /></View>;
}

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return <View accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite"
    style={[s.notice, error && { backgroundColor: '#F8E9E5' }]}>
    <Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={18} color={error ? theme.colors.red : theme.colors.green} />
    <T style={[s.noticeText, error && { color: theme.colors.red }]}>{message}</T>
  </View>;
}

export function Avatar({ name, size = 42, color = theme.colors.lightGreen }: { name: string; size?: number; color?: string }) {
  return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    <T style={{ fontFamily: theme.fonts.medium, fontSize: size * 0.3 }}>{initials(name)}</T>
  </View>;
}

export function Brand() {
  return <View style={s.brand}><View style={s.brandMark}><Ionicons name="book-outline" size={22} color={theme.colors.ink} /></View>
    <T style={s.brandText}>{copy.brand.name}</T></View>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return <View style={s.empty}><Ionicons name="book-outline" size={36} color={theme.colors.green} />
    <T style={s.emptyTitle}>{title}</T><T style={s.emptyBody}>{body}</T></View>;
}

export const shared = StyleSheet.create({
  eyebrow: { fontFamily: theme.fonts.bold, fontSize: 10, letterSpacing: 2.1, color: theme.colors.muted },
  heading: { fontFamily: theme.fonts.display, fontSize: 42, lineHeight: 48, letterSpacing: -1.3 },
  body: { color: theme.colors.muted, fontSize: 14, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const s = StyleSheet.create({
  text: { fontFamily: theme.fonts.regular, color: theme.colors.ink, fontSize: 14 },
  button: { minHeight: 48, paddingHorizontal: 22, paddingVertical: 13, backgroundColor: theme.colors.green,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  secondary: { backgroundColor: theme.colors.lightGreen },
  buttonText: { color: '#FFF', fontFamily: theme.fonts.bold, fontSize: 13 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  field: { gap: 8 }, label: { fontFamily: theme.fonts.medium, fontSize: 12 },
  input: { minHeight: 50, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, paddingHorizontal: 15,
    backgroundColor: theme.colors.paper, color: theme.colors.ink, fontFamily: theme.fonts.regular, fontSize: 15 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: theme.colors.lightGreen, borderRadius: 10 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00000005' },
  brand: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  brandMark: { width: 37, height: 37, backgroundColor: theme.colors.lime, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  brandText: { fontFamily: theme.fonts.display, fontSize: 24, letterSpacing: -1.2 },
  empty: { paddingVertical: 44, paddingHorizontal: 20, gap: 14, alignItems: 'center' },
  emptyTitle: { fontFamily: theme.fonts.display, fontSize: 24, textAlign: 'center' },
  emptyBody: { color: theme.colors.muted, lineHeight: 22, textAlign: 'center', maxWidth: 350 },
});
