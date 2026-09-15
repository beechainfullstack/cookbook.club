import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BirthdayPicker from '../components/BirthdayPicker';
import { BookArt } from '../components/BookArt';
import { Brand, Button, Field, Notice, shared, T } from '../components/ui';
import { backend, errorCopy, signOut } from '../lib/backend';
import { copy, format } from '../lib/copy';
import { isOldEnough, normalizePhone, validBirthday, type Profile, type School } from '../lib/domain';
import { theme } from '../theme';

type Step = 'welcome' | 'age' | 'blocked' | 'phone' | 'code' | 'school';

export function Onboarding({ session, birthday, setBirthday, onEnrolled }: {
  session: Session | null; birthday: string; setBirthday: (value: string) => void;
  onEnrolled: (profile: Profile) => void;
}) {
  const [step, setStep] = useState<Step>(session ? (birthday ? 'school' : 'age') : 'welcome');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'school') return;
    let active = true;
    const timer = setTimeout(() => {
      void backend().from('schools').select('id,name,location').ilike('name', `%${schoolSearch.replace(/[%_]/g, '')}%`)
        .order('name').limit(40).then(({ data, error: failure }) => {
          if (!active) return;
          if (failure) setError(errorCopy(failure));
          else setSchools(data);
        });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [step, schoolSearch]);

  function nextAge() {
    setError('');
    if (!validBirthday(birthday)) { setError(copy.errors.invalidBirthday); return; }
    setStep(isOldEnough(birthday) ? session ? 'school' : 'phone' : 'blocked');
  }

  async function action(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await run(); } catch (failure) { setError(errorCopy(failure)); }
    finally { setBusy(false); }
  }

  function sendCode() {
    const normalized = normalizePhone(phone);
    if (!normalized) { setError(copy.errors.invalidPhone); return; }
    if (!isOldEnough(birthday)) { setStep('age'); return; }
    void action(async () => {
      const { error: failure } = await backend().auth.signInWithOtp({ phone: normalized });
      if (failure) throw failure;
      setPhone(normalized); setStep('code');
    });
  }

  function verify() {
    void action(async () => {
      const { error: failure } = await backend().auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
      if (failure) { setError(copy.errors.invalidCode); return; }
      setStep('school');
    });
  }

  function enroll() {
    if (!isOldEnough(birthday)) { setStep('age'); return; }
    if (name.trim().length < 2 || name.trim().length > 40 || /[<>]/.test(name)) { setError(copy.errors.invalidName); return; }
    if (!schoolId) { setError(copy.errors.schoolRequired); return; }
    void action(async () => {
      const { data, error: failure } = await backend().rpc('enroll', {
        p_birth_date: birthday, p_display_name: name.trim(), p_school_id: schoolId, p_school_code: schoolCode.trim(),
      });
      if (failure) throw failure;
      onEnrolled(data);
    });
  }

  const headings: Record<Step, string> = {
    welcome: copy.onboarding.welcome_title, age: copy.onboarding.age_gate_prompt, blocked: copy.onboarding.ageBlockedTitle,
    phone: copy.onboarding.phoneTitle, code: copy.onboarding.codeTitle, school: copy.onboarding.schoolTitle,
  };
  const descriptions: Record<Step, string> = {
    welcome: format(copy.onboarding.welcome_subtitle, { school_name: copy.onboarding.schoolFallback }),
    age: copy.onboarding.ageBody, blocked: copy.onboarding.age_gate_error,
    phone: copy.onboarding.phoneBody, code: format(copy.onboarding.codeBody, { phone_number: phone }), school: copy.onboarding.schoolBody,
  };

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Brand />
      <View style={s.card}>
        {step === 'welcome' && <View style={s.art}><BookArt /></View>}
        <T style={shared.eyebrow}>{copy.onboarding.welcomeEyebrow}</T>
        <T style={shared.heading}>{headings[step]}</T>
        <T style={shared.body}>{descriptions[step]}</T>
        <Notice message={error} error />
        {step === 'welcome' && <Button label={copy.onboarding.start} onPress={() => setStep('age')} icon="arrow-forward" />}
        {step === 'age' && <>
          <BirthdayPicker value={birthday} onChange={setBirthday} />
          <Button label={copy.common.continue} onPress={nextAge} />
        </>}
        {step === 'phone' && <>
          <Field label={copy.onboarding.phoneLabel} value={phone} onChangeText={setPhone} placeholder={copy.onboarding.phonePlaceholder}
            keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={22} />
          <Button label={copy.onboarding.sendCode} onPress={sendCode} busy={busy} />
        </>}
        {step === 'code' && <>
          <Field label={copy.onboarding.codeLabel} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            placeholder={copy.onboarding.codePlaceholder} keyboardType="number-pad" maxLength={8}
            autoComplete="sms-otp" textContentType="oneTimeCode" />
          <Button label={copy.onboarding.verify} onPress={verify} busy={busy} disabled={code.length < 6} />
          <Button secondary label={copy.onboarding.resend} onPress={sendCode} disabled={busy} />
          <Button secondary label={copy.onboarding.backToPhone} onPress={() => { setCode(''); setStep('phone'); }} disabled={busy} />
        </>}
        {step === 'school' && <>
          <Field label={copy.onboarding.nameLabel} value={name} onChangeText={setName}
            placeholder={copy.onboarding.namePlaceholder} maxLength={40} autoComplete="name" />
          <Field label={copy.onboarding.schoolLabel} value={schoolSearch} onChangeText={setSchoolSearch} placeholder={copy.onboarding.schoolSearch} />
          <View style={s.schools}>
            {schools.length === 0 && <T style={shared.body}>{copy.onboarding.schoolEmpty}</T>}
            {schools.map((school) => <Pressable key={school.id} accessibilityRole="radio" accessibilityState={{ checked: school.id === schoolId }}
              onPress={() => setSchoolId(school.id)} style={[s.school, school.id === schoolId && s.selected]}>
              <View style={{ flex: 1 }}><T>{school.name}</T><T style={s.location}>{school.location}</T></View>
              <Ionicons name={school.id === schoolId ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={theme.colors.green} />
            </Pressable>)}
          </View>
          <Field label={copy.onboarding.accessCodeLabel} value={schoolCode} onChangeText={setSchoolCode}
            placeholder={copy.onboarding.accessCodePlaceholder} autoCapitalize="none" autoCorrect={false} maxLength={128} />
          <Button label={copy.onboarding.join} onPress={enroll} busy={busy} disabled={!schoolId || !schoolCode.trim()} />
          <Button secondary label={copy.common.signOut} onPress={() => { void action(signOut); }} />
        </>}
      </View>
      <T style={s.footer}>{copy.brand.tagline}</T>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 45, gap: 32 },
  card: { width: '100%', maxWidth: 430, gap: 22, paddingVertical: 15 },
  art: { alignItems: 'center' },
  schools: { gap: 8 }, school: { padding: 14, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selected: { borderColor: theme.colors.green, backgroundColor: theme.colors.lightGreen },
  location: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  footer: { color: theme.colors.muted, fontSize: 11, paddingBottom: 30 },
});
