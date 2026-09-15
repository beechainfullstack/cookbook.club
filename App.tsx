import { Ionicons } from '@expo/vector-icons';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Brand, Button, Notice, T } from './src/components/ui';
import { demoEntries, demoPeople, demoProfile, demoSchool, initialTags } from './src/data/demo';
import { backend, demoEnabled, errorCopy, supabase } from './src/lib/backend';
import { copy } from './src/lib/copy';
import type { DemoTag, Profile, School, Tab } from './src/lib/domain';
import { BookScreen } from './src/screens/BookScreen';
import { Onboarding } from './src/screens/Onboarding';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TagScreen } from './src/screens/TagScreen';
import { theme } from './src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

function Cookbook() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(!demoEnabled && !!supabase);
  const [authError, setAuthError] = useState('');
  const [account, setAccount] = useState<{
    userId: string; revision: number; profile: Profile | null; school: School | null; error: string;
  } | null>(null);
  const [birthday, setBirthday] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>('book');
  const [tags, setTags] = useState<DemoTag[]>(initialTags);
  const entries = useMemo(() => demoEnabled ? demoEntries(tags) : undefined, [tags]);
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const desktop = width >= 760;
  const userId = session?.user.id;
  const currentAccount = account?.userId === userId && account?.revision === reload ? account : null;
  const profile = demoEnabled ? demoProfile : currentAccount?.profile;
  const school = demoEnabled ? demoSchool : currentAccount?.school;
  const loading = authLoading || (!demoEnabled && !!userId && !currentAccount);
  const error = authError || currentAccount?.error;

  useEffect(() => {
    if (demoEnabled || !supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next); setAuthLoading(false); setAuthError('');
      if (event === 'SIGNED_OUT') { setBirthday(''); setTab('book'); setAccount(null); }
    });
    void supabase.auth.getSession().then(({ data, error: failure }) => {
      if (failure) setAuthError(errorCopy(failure));
      else { setSession(data.session); setAuthError(''); }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  useEffect(() => {
    if (demoEnabled || !userId) return;
    let active = true;
    void (async () => {
      try {
        const { data, error: failure } = await backend().from('profiles').select('id,display_name,school_id').eq('id', userId).maybeSingle();
        if (failure) throw failure;
        if (!active) return;
        if (!data) {
          setAccount({ userId, revision: reload, profile: null, school: null, error: '' });
          return;
        }
        const { data: schoolData, error: schoolFailure } = await backend().from('schools').select('id,name,location').eq('id', data.school_id).single();
        if (schoolFailure) throw schoolFailure;
        if (!active) return;
        setAccount({ userId, revision: reload, school: schoolData, profile: data, error: '' });
      } catch (failure) {
        if (active) setAccount({ userId, revision: reload, school: null, profile: null, error: errorCopy(failure) });
      }
    })();
    return () => { active = false; };
  }, [userId, reload]);

  useEffect(() => {
    if (Platform.OS === 'web' || !profile) return;
    const handle = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'myPage' && data.userId === profile.id) {
        setTab('myPage');
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) handle(response); });
    return () => subscription.remove();
  }, [profile]);

  function navigate(next: Tab) { setTab(next); scroll.current?.scrollTo({ y: 0, animated: false }); }
  const navIcons = { book: 'book-outline', tag: 'add-circle-outline', myPage: 'person-outline' } as const;
  const nav = <View style={[s.nav, !desktop && s.mobileNav]}>
    {(['book', 'tag', 'myPage'] as const).map((item) => <Pressable key={item}
      accessibilityRole="tab" accessibilityState={{ selected: tab === item }}
      onPress={() => navigate(item)} style={[s.navItem, !desktop && s.mobileNavItem, tab === item && s.navActive]}>
      <Ionicons name={navIcons[item]} size={18} color={tab === item ? theme.colors.green : theme.colors.muted} />
      <T style={[s.navText, tab === item && s.navTextActive]}>{copy.navigation[item]}</T>
    </Pressable>)}
  </View>;

  if (!demoEnabled && !supabase) return <View style={s.center}><Brand /><T style={s.configTitle}>{copy.config.title}</T><T style={s.configBody}>{copy.config.body}</T></View>;
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.green} accessibilityLabel={copy.common.loading} /></View>;
  if (error && !profile) return <View style={s.center}><Notice message={error} error /><Button label={copy.common.retry} onPress={() => setReload((n) => n + 1)} /></View>;
  if (!profile || !school) return <Onboarding key={userId ?? 'signed-out'} session={session} birthday={birthday} setBirthday={setBirthday} onEnrolled={() => setReload((n) => n + 1)} />;

  return <View style={s.app}>
    <View style={s.header}><View style={[s.headerInner, !desktop && { paddingHorizontal: 20 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.accessibility.logo} onPress={() => navigate('book')}><Brand /></Pressable>
      {desktop && nav}
      <Pressable accessibilityRole="button" accessibilityLabel={copy.navigation.myPage} onPress={() => navigate('myPage')} style={s.account}>
        <Avatar name={profile.display_name} size={32} color={theme.colors.peach} />
        {desktop && <T style={s.accountName}>{profile.display_name.split(' ')[0]}</T>}
        {desktop && <Ionicons name="chevron-down" size={12} color={theme.colors.muted} />}
      </Pressable>
    </View></View>
    <ScrollView ref={scroll} contentContainerStyle={[s.scroll, !desktop && { padding: 20, paddingTop: 25, paddingBottom: 32 }]}
      keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        {demoEnabled && <View style={s.demo}><View style={s.demoDot} /><T style={s.demoText}>{copy.demo.notice}</T></View>}
        {tab === 'book' && <BookScreen school={school} onTag={() => navigate('tag')} demoEntries={entries} />}
        {tab === 'tag' && <TagScreen phone={session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : ''}
          demoPeople={demoEnabled ? demoPeople : undefined} schoolName={school.name} onBook={() => navigate('book')}
          onTagged={(person, flavor, id) => {
            if (demoEnabled) setTags((previous) => [...previous, { id, taggerId: demoProfile.id, recipientId: person.id, flavor, createdAt: new Date().toISOString() }]);
          }} />}
        {tab === 'myPage' && <ProfileScreen profile={profile} school={school} demoEntries={entries} resetDemo={() => setTags(initialTags())} />}
      </View>
    </ScrollView>
    {!desktop && nav}
  </View>;
}

export default function App() {
  const [loaded, error] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, Fraunces_500Medium });
  return <SafeAreaProvider><SafeAreaView style={s.safe}>
    <StatusBar style="dark" />
    {loaded || error ? <Cookbook /> : <View style={s.center}><ActivityIndicator color={theme.colors.green} accessibilityLabel={copy.common.loading} /></View>}
  </SafeAreaView></SafeAreaProvider>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, app: { flex: 1 },
  header: { backgroundColor: theme.colors.background, borderBottomWidth: 1, borderColor: theme.colors.line },
  headerInner: { maxWidth: 1110, width: '100%', alignSelf: 'center', minHeight: 86, paddingHorizontal: 35,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 }, navItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 17, paddingVertical: 12, borderRadius: 9 },
  navActive: { backgroundColor: '#EBEEDF' }, navText: { color: theme.colors.muted, fontSize: 11, fontFamily: theme.fonts.medium },
  navTextActive: { color: theme.colors.green }, mobileNav: { justifyContent: 'space-around', borderTopWidth: 1, borderColor: theme.colors.line, padding: 8, backgroundColor: theme.colors.background },
  mobileNavItem: { flexDirection: 'column', gap: 5, flex: 1, paddingVertical: 9, paddingHorizontal: 5 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 9 }, accountName: { fontSize: 11, fontFamily: theme.fonts.medium },
  scroll: { padding: 35, paddingTop: 30, paddingBottom: 60 },
  content: { maxWidth: 1040, width: '100%', alignSelf: 'center', gap: 24 },
  demo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  demoText: { fontSize: 9, color: theme.colors.muted }, demoDot: { height: 5, width: 5, borderRadius: 3, backgroundColor: '#A5B471' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 20, backgroundColor: theme.colors.background },
  configTitle: { fontFamily: theme.fonts.display, fontSize: 32, textAlign: 'center', maxWidth: 420 },
  configBody: { color: theme.colors.muted, lineHeight: 23, maxWidth: 350, textAlign: 'center' },
});
