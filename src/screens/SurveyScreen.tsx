import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Brand, Body, Button, Choice, colors, ErrorText, Field, Heading, Label, Screen, styles } from '../components/ui';
import { chooseAndUploadPhoto, loadPhotos, type Photo, saveSurvey } from '../lib/data';
import { GOALS, prepareSurvey, PRIORITIES, SEASONS, type Season, type Survey, toggleOption, validateSurveyStep } from '../lib/survey';

const questions = ['What is most important to you?', 'What do you need to accomplish?', 'What tasks have you been putting off?', 'What inspires you?'];
const subtexts = ['This can change.', 'Choose any that fit.', 'You can answer this later.', 'Media, hobbies, and people.'];

export function SurveyScreen({ userId, initial, editing, onComplete, onCancel }: {
  userId: string; initial: Survey; editing: boolean; onComplete: () => Promise<void>; onCancel: () => void;
}) {
  const [survey, setSurvey] = useState(initial);
  const [step, setStep] = useState(editing ? 0 : Math.min(initial.saved_step, 3));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  useEffect(() => {
    let active = true;
    loadPhotos(userId).then((items) => { if (active) setPhotos(items); }).catch(() => { if (active) setPhotoError('Couldn’t load your photos. Reopen the survey to try again.'); });
    return () => { active = false; };
  }, [userId]);

  const update = (values: Partial<Survey>) => { setSurvey((previous) => ({ ...previous, ...values })); setError(null); };
  const locked = busy || photoBusy;

  async function next() {
    const validation = validateSurveyStep(survey, step);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = prepareSurvey(survey, step);
      await saveSurvey(userId, saved);
      setSurvey(saved);
      if (step === 3) await onComplete();
      else setStep(step + 1);
    } catch { setError('Couldn’t save your answer. Your text is still here. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  async function addPhoto() {
    if (!season) { setPhotoError('Choose a season tag first.'); return; }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      if (await chooseAndUploadPhoto(userId, season)) setPhotos(await loadPhotos(userId));
    } catch { setPhotoError('Couldn’t upload the photo. Choose an image under 5 MB and try again.'); }
    finally { setPhotoBusy(false); }
  }

  const options = step === 0 ? PRIORITIES : GOALS;
  const selections = step === 0 ? survey.priorities : survey.goals;

  return <Screen footer={<>
    <ErrorText message={error} />
    <Button title={step === 3 ? 'Save answers' : step === 2 && !survey.putting_off.trim() ? 'Skip for now' : 'Continue'} onPress={next} busy={busy} disabled={photoBusy} />
    <Button title={step > 0 || editing ? 'Back' : 'Back to sign-in'} quiet disabled={locked} onPress={() => { setError(null); if (step > 0) setStep(step - 1); else onCancel(); }} />
  </>}>
    <Brand />
    <View accessibilityLabel={`Question ${step + 1} of 4`} style={{ gap: 10 }}>
      <Label>Question {step + 1} of 4</Label>
      <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}><View style={{ width: `${(step + 1) * 25}%`, height: 3, backgroundColor: colors.accent }} /></View>
    </View>
    <Heading>{questions[step]}</Heading>
    <Body>{subtexts[step]}</Body>
    {step < 2 && <View style={{ gap: 10 }}>
      {options.map((option) => <Choice key={option} label={option} selected={selections.includes(option)} disabled={locked}
        onPress={() => update(step === 0 ? { priorities: toggleOption(selections, option) } : { goals: toggleOption(selections, option) })} />)}
      {selections.includes('other') && <Field label="Something else" value={step === 0 ? survey.priorities_other : survey.goals_other}
        maxLength={1000} editable={!locked} onChangeText={(text) => update(step === 0 ? { priorities_other: text } : { goals_other: text })} />}
    </View>}
    {step === 2 && <Field label="Things you’ve been putting off (optional)" placeholder="Anything that’s been on your mind…" multiline maxLength={4000}
      value={survey.putting_off} editable={!locked} onChangeText={(text) => update({ putting_off: text })} />}
    {step === 3 && <>
      <Field label="What inspires you" placeholder="A song, a person, something you love doing…" multiline maxLength={4000}
        value={survey.inspirations} editable={!locked} onChangeText={(text) => update({ inspirations: text })} />
      <Label>Share photos you’d like to remember. (Optional)</Label>
      <Body>Choose the season you associate with the photo. The upload date is saved automatically.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SEASONS.map((item) => <View key={item} style={{ width: '47%' }}><Choice label={item} selected={item === season} onPress={() => setSeason(item)} disabled={locked} /></View>)}
      </View>
      <Button title="Add a photo" onPress={addPhoto} quiet busy={photoBusy} disabled={busy} />
      <ErrorText message={photoError} />
      {photos.map((photo) => <View key={photo.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
        <Image source={{ uri: photo.url }} accessibilityLabel={`Saved ${photo.season_tag} photo`} style={{ width: 72, height: 72, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 4 }}><Text style={styles.label}>{photo.season_tag}</Text><Text style={styles.body}>Uploaded {new Date(photo.uploaded_at).toLocaleDateString()}</Text></View>
      </View>)}
    </>}
  </Screen>;
}
