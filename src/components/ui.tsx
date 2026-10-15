import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = { background: '#FAF9F6', surface: '#FFFFFF', ink: '#29362F', muted: '#68746C', accent: '#637B6C', tint: '#EAF0EB', border: '#DAE2DC', error: '#9B443C' };

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>{children}</View>
      </ScrollView>
      {footer && <View style={styles.footer}>{footer}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Brand() { return <Text style={styles.brand}>Slow</Text>; }
export function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Body({ children }: { children: ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Label({ children }: { children: ReactNode }) { return <Text style={styles.label}>{children}</Text>; }
export function ErrorText({ message }: { message: string | null }) { return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null; }

export function Button({ title, onPress, busy = false, disabled = false, quiet = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; quiet?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, quiet && styles.quietButton, (pressed || disabled || busy) && { opacity: 0.6 }]}>
    {busy ? <ActivityIndicator color={quiet ? colors.accent : '#FFFFFF'} /> : <Text style={[styles.buttonText, quiet && { color: colors.accent }]}>{title}</Text>}
  </Pressable>;
}

export function Field({ label, multiline, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Label>{label}</Label>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} multiline={multiline}
      style={[styles.input, multiline && styles.multiline]} {...props} />
  </View>;
}

export function Choice({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selectedChoice]}>
    <Text style={[styles.choiceText, selected && { color: colors.ink }]}>{label}</Text>
    <Text style={styles.choiceMark}>{selected ? '✓' : '+'}</Text>
  </Pressable>;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, width: '100%', maxWidth: 528, alignSelf: 'center', gap: 8 },
  brand: { fontSize: 22, fontWeight: '600', color: colors.accent, letterSpacing: -0.5, marginBottom: 18 },
  heading: { fontSize: 32, lineHeight: 39, fontWeight: '500', color: colors.ink, letterSpacing: -0.6 },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  label: { fontSize: 14, lineHeight: 22, fontWeight: '500', color: colors.ink },
  error: { color: colors.error, lineHeight: 23, fontSize: 15 },
  button: { minHeight: 52, backgroundColor: colors.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 14 },
  quietButton: { backgroundColor: 'transparent' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  field: { gap: 8 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 144, textAlignVertical: 'top', lineHeight: 24 },
  choice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 15, minHeight: 52, backgroundColor: colors.surface },
  selectedChoice: { borderColor: colors.accent, backgroundColor: colors.tint },
  choiceText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.muted },
  choiceMark: { color: colors.accent, fontSize: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
});
