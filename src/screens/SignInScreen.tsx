import { useState } from 'react';
import { Brand, Body, Button, ErrorText, Field, Heading, Screen } from '../components/ui';
import { authRedirectUrl, supabase } from '../lib/supabase';

export function SignInScreen({ authError }: { authError: string | null }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);

  async function signIn() {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError('Enter a valid email address.'); return; }
    if (Date.now() - sentAt < 60000 && sentTo === address) { setError('Please wait a minute before requesting another link.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: authRedirectUrl, shouldCreateUser: true } });
      if (signInError) throw signInError;
      setSentTo(address);
      setSentAt(Date.now());
    } catch {
      setError('We couldn’t send a link. Check your connection, wait a minute, and try again.');
    } finally { setBusy(false); }
  }

  return <Screen footer={<Button title={sentTo ? 'Send another link' : 'Send me a sign-in link'} busy={busy} onPress={signIn} />}>
    <Brand />
    <Heading>{sentTo ? 'Check your email.' : 'A little space\nfor yourself.'}</Heading>
    <Body>{sentTo ? `We sent a sign-in link to ${sentTo}. Open it on this device to continue. No password needed.` : 'One short check-in, about once a week. Nothing to keep up with.'}</Body>
    <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} onSubmitEditing={signIn} />
    <ErrorText message={error || authError} />
    <Body>No streaks. No feed. Just a note when it’s time.</Body>
  </Screen>;
}
