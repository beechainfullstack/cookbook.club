import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Brand, Body, Button, colors, ErrorText, Heading, Screen } from './src/components/ui';
import { parseAuthCallback } from './src/lib/auth-url';
import { loadUserData, type UserData } from './src/lib/data';
import { authRedirectUrl, clearWebAuthUrl, isConfigured, supabase } from './src/lib/supabase';
import { HomeScreen } from './src/screens/HomeScreen';
import { PreferencesScreen } from './src/screens/PreferencesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SurveyScreen } from './src/screens/SurveyScreen';
import { EmailFeedbackScreen } from './src/screens/EmailFeedbackScreen';
import { listenForNotes, syncPushToken } from './src/lib/notifications';

type Route = 'survey' | 'preferences' | 'home' | 'settings';

function SignedInApp({ session }: { session: Session }) {
  const [data, setData] = useState<UserData | null>(null);
  const [route, setRoute] = useState<Route>('home');
  const [error, setError] = useState<string | null>(null);
  const [surveyReturn, setSurveyReturn] = useState<'home' | 'settings'>('home');
  const userId = session.user.id;

  const refresh = useCallback(async () => {
    const latest = await loadUserData(userId);
    setData(latest);
    return latest;
  }, [userId]);

  const initialize = useCallback(async () => {
    setError(null);
    try {
      const latest = await refresh();
      setRoute(latest.onboarded ? 'home' : latest.survey.saved_step >= 4 ? 'preferences' : 'survey');
    } catch { setError('Couldn’t load your saved answers. Check your connection and try again.'); }
  }, [refresh]);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void listenForNotes(() => { void refresh().catch(() => {}); }).then((unsubscribe) => {
      if (active) cleanup = unsubscribe; else unsubscribe();
    }).catch(() => {});
    return () => { active = false; cleanup?.(); };
  }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch(() => {});
    });
    return () => subscription.remove();
  }, [refresh]);
  const pushEnabled = data?.preferences?.channels.includes('push') ?? false;
  useEffect(() => {
    if (!pushEnabled || Platform.OS === 'web') return;
    const sync = () => { void syncPushToken(userId).catch(() => {}); };
    sync();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => subscription.remove();
  }, [pushEnabled, userId]);

  if (error) return <Screen><Brand /><Heading>Let’s try again.</Heading><ErrorText message={error} />
    <Button title="Retry" onPress={initialize} /><Button title="Sign out" quiet onPress={() => { void supabase.auth.signOut({ scope: 'local' }); }} /></Screen>;
  if (!data) return <Screen><Brand /><ActivityIndicator color={colors.accent} accessibilityLabel="Loading your answers" /></Screen>;

  if (route === 'survey') return <SurveyScreen userId={userId} initial={data.survey} editing={data.onboarded}
    onComplete={async () => { await refresh(); setRoute(data.onboarded ? surveyReturn : 'preferences'); }}
    onCancel={() => { if (data.onboarded) setRoute(surveyReturn); else void supabase.auth.signOut({ scope: 'local' }); }} />;
  if (route === 'preferences') return <PreferencesScreen userId={userId} initial={data.preferences} onboarding={!data.onboarded}
    onSaved={async () => { await refresh(); setRoute('home'); }} onBack={() => setRoute(data.onboarded ? 'settings' : 'survey')} />;
  if (route === 'settings') return <SettingsScreen onBack={() => setRoute('home')}
    onEdit={() => { setSurveyReturn('settings'); setRoute('survey'); }} onPreferences={() => setRoute('preferences')} />;
  return <HomeScreen userId={userId} lastMessage={data.lastMessage} lastFeedback={data.lastFeedback} onEdit={() => { setSurveyReturn('home'); setRoute('survey'); }} onSettings={() => setRoute('settings')} />;
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastLink = useRef<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    let authVersion = 0;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      authVersion++;
      if (active) { setSession(next); setReady(true); }
    });
    const initialVersion = authVersion;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authVersion !== initialVersion) return;
      if (error) setAuthError('Couldn’t restore your session. Request a new sign-in link.');
      setSession(data.session);
      setReady(true);
    }).catch(() => { if (active) { setAuthError('Couldn’t restore your session. Request a new sign-in link.'); setReady(true); } });

    async function handleUrl(url: string | null) {
      if (!url || !active || lastLink.current === url) return;
      const callback = parseAuthCallback(url, authRedirectUrl);
      if (callback.kind === 'none') return;
      lastLink.current = url;
      clearWebAuthUrl();
      if (callback.kind === 'error') { setAuthError(callback.message); return; }
      const { error } = await supabase.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
      if (active) setAuthError(error ? 'This link couldn’t sign you in. Please request a new one.' : null);
    }
    Linking.getInitialURL().then(handleUrl).catch(() => { if (active) setAuthError('Couldn’t open this link. Please request a new one.'); });
    const links = Linking.addEventListener('url', ({ url }) => { void handleUrl(url).catch(() => { if (active) setAuthError('Couldn’t open this link. Please request a new one.'); }); });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    return () => { active = false; subscription.subscription.unsubscribe(); links.remove(); appState.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);

  if (!isConfigured) return <Screen><Brand /><Heading>A small setup step.</Heading><Body>Set your Supabase URL and publishable key in the local environment, then restart Expo. Setup instructions are included with the project.</Body></Screen>;
  if (!ready) return <Screen><Brand /><ActivityIndicator color={colors.accent} accessibilityLabel="Opening Slow" /></Screen>;
  return session ? <SignedInApp key={session.user.id} session={session} /> : <SignInScreen authError={authError} />;
}

export default function App() {
  const [feedback] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('feedback_token');
    if (!token) return null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const rating = params.get('rating');
    return { token, rating: rating === '1' ? 1 as const : rating === '-1' ? -1 as const : null };
  });
  return <SafeAreaProvider><StatusBar style="dark" />{feedback ? <EmailFeedbackScreen {...feedback} /> : <AppContent />}</SafeAreaProvider>;
}
