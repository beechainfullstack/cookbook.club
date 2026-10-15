import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, colors, ErrorText, Field, Label, styles } from './ui';

export function FeedbackForm({ initialRating = null, initialComment = '', alreadySaved = false, onSave }: {
  initialRating?: -1 | 1 | null; initialComment?: string; alreadySaved?: boolean;
  onSave: (rating: -1 | 1, comment: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [saved, setSaved] = useState(alreadySaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!rating) { setError('Choose thumbs up or thumbs down first.'); return; }
    setBusy(true); setError(null);
    try { await onSave(rating, comment); setSaved(true); }
    catch { setError('Couldn’t save your feedback. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <Label>Was this helpful?</Label>
    <View accessibilityRole="radiogroup" style={styles.row}>
      {([1, -1] as const).map((value) => <Pressable key={value} accessibilityRole="radio"
        accessibilityLabel={value === 1 ? 'Thumbs up' : 'Thumbs down'} accessibilityState={{ checked: rating === value, disabled: busy }}
        disabled={busy} onPress={() => { setRating(value); setSaved(false); setError(null); }}
        style={[styles.choice, { flex: 1, justifyContent: 'center' }, rating === value && { borderColor: colors.accent, backgroundColor: colors.tint }]}>
        <Text style={styles.choiceText}>{value === 1 ? '👍' : '👎'}</Text>
      </Pressable>)}
    </View>
    <Field label="A short comment (optional)" value={comment} maxLength={280} editable={!busy}
      onChangeText={(value) => { setComment(value); setSaved(false); }} placeholder="One line is enough." />
    <ErrorText message={error} />
    {saved ? <Body>Feedback saved. Thank you.</Body> : <Button title="Save feedback" busy={busy} onPress={save} />}
  </View>;
}
