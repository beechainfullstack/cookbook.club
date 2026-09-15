import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Empty, Field, Notice, shared, T } from '../components/ui';
import { backend, errorCopy, newRequestId, submitTag, syncDeviceContacts } from '../lib/backend';
import { copy, entryText, format } from '../lib/copy';
import { flavorIds, type Flavor, type Person } from '../lib/domain';
import { flavorTheme, theme } from '../theme';

export function TagScreen({ demoPeople, phone, schoolName, onTagged, onBook }: {
  demoPeople?: Person[]; phone: string; schoolName: string;
  onTagged: (person: Person, flavor: Flavor, id: string) => void; onBook: () => void;
}) {
  const [people, setPeople] = useState<Person[]>(demoPeople ?? []);
  const [friend, setFriend] = useState<Person>();
  const [flavor, setFlavor] = useState<Flavor>();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const submitting = useRef(false);

  useEffect(() => {
    if (demoPeople) return;
    let active = true;
    void backend().rpc('get_contacts').then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) setError(errorCopy(failure)); else setPeople(data);
    });
    return () => { active = false; };
  }, [demoPeople]);

  async function sync() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const matched = demoPeople ?? await syncDeviceContacts(phone);
      setPeople(matched);
      if (friend && !matched.some((person) => person.id === friend.id)) setFriend(undefined);
      setNotice(format(copy.tag.synced, { count: matched.length }));
    } catch (failure) { setError(errorCopy(failure)); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!friend || !flavor || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (!demoPeople) await submitTag(friend.id, flavor, requestId);
      onTagged(friend, flavor, requestId);
      setSuccess(true);
    } catch (failure) { setError(errorCopy(failure)); }
    finally { setBusy(false); submitting.current = false; }
  }

  const matches = people.filter((person) => person.display_name.toLowerCase().includes(search.toLowerCase()));

  if (success && friend) return <View style={s.success}>
    <View style={s.successIcon}><Ionicons name="sparkles-outline" size={35} color={theme.colors.green} /></View>
    <T style={[shared.heading, { textAlign: 'center' }]}>{copy.core_loop.success_toast}</T>
    <T style={shared.body}>{format(copy.tag.successBody, { user_name: friend.display_name })}</T>
    <Button label={copy.tag.successAction} onPress={onBook} />
    <Button secondary label={copy.tag.another} onPress={() => {
      setFriend(undefined); setFlavor(undefined); setRequestId(newRequestId()); setSuccess(false);
    }} />
  </View>;

  return <View style={s.root}>
    <T style={shared.eyebrow}>{copy.tag.eyebrow}</T><T style={shared.heading}>{copy.core_loop.prompt_title}</T><T style={shared.body}>{copy.tag.description}</T>
    <Notice message={error} error /><Notice message={notice} />
    <View style={s.panel}>
      <View style={s.panelHeader}><View style={{ flex: 1, gap: 5 }}><T style={s.title}>{copy.permissions.contacts_title}</T><T style={s.hint}>{copy.tag.contactsHint}</T></View>
        <Button secondary label={people.length ? copy.tag.resync : copy.tag.sync} busy={busy} onPress={() => { void sync(); }} />
      </View>
      <T style={s.hint}>{format(copy.permissions.contacts_subtitle, { school_name: schoolName })}</T>
      {!demoPeople && Platform.OS === 'web' && <T style={s.hint}>{copy.tag.webContacts}</T>}
      {people.length === 0 ? <Empty title={copy.tag.empty} body={copy.tag.emptyBody} /> : <>
        <Field label={copy.common.search} placeholder={copy.core_loop.picker_search_placeholder} value={search} onChangeText={setSearch} />
        <View style={s.people}>
          {matches.length === 0 && <T style={shared.body}>{copy.tag.noResults}</T>}
          {matches.map((person) => <Pressable key={person.id} disabled={busy} accessibilityRole="radio"
            accessibilityLabel={format(copy.accessibility.selectFriend, { user_name: person.display_name })}
            accessibilityState={{ checked: person.id === friend?.id }}
            onPress={() => { setFriend(person); setRequestId(newRequestId()); }} style={[s.person, friend?.id === person.id && s.selected]}>
            <Avatar name={person.display_name} size={35} /><T style={{ flex: 1, fontSize: 12 }}>{person.display_name}</T>
            {friend?.id === person.id && <Ionicons name="checkmark-circle" size={18} color={theme.colors.green} />}
          </Pressable>)}
        </View>
      </>}
    </View>
    <View style={s.panel}><T style={s.title}>{copy.core_loop.flavor_picker_title}</T>
      <View style={s.flavors}>{flavorIds.map((id) => <Pressable key={id} disabled={busy}
        accessibilityRole="radio" accessibilityState={{ checked: flavor === id }}
        accessibilityLabel={format(copy.accessibility.selectFlavor, { flavor: copy.flavors[id].label })}
        onPress={() => { setFlavor(id); setRequestId(newRequestId()); }} style={[s.flavor, flavor === id && s.selected]}>
        <View style={[s.flavorIcon, { backgroundColor: flavorTheme[id].background }]}><Ionicons name={flavorTheme[id].icon} size={23} color={flavorTheme[id].color} /></View>
        <T style={s.flavorLabel}>{copy.flavors[id].label}</T><T style={s.flavorDescription}>{copy.flavors[id].description}</T>
      </Pressable>)}</View>
    </View>
    {friend && flavor && <View style={s.preview}><T style={shared.eyebrow}>{copy.tag.preview}</T>
      <T style={s.previewText}>{entryText({ tagged_name: friend.display_name, flavor, revealed: false, tagger_names: [] })}</T>
    </View>}
    <Button label={copy.core_loop.submit_button} disabled={!friend || !flavor} busy={busy} onPress={() => { void submit(); }} icon="add-outline" />
    <T style={s.privacy}>{copy.tag.privacy}</T>
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 18, maxWidth: 730, width: '100%', alignSelf: 'center' },
  panel: { backgroundColor: theme.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, padding: 20, gap: 20 },
  panelHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  title: { fontFamily: theme.fonts.display, fontSize: 22 }, hint: { fontSize: 11, lineHeight: 18, color: theme.colors.muted },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { minWidth: 200, flexGrow: 1, flexBasis: '45%', flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line },
  selected: { borderColor: theme.colors.green, backgroundColor: theme.colors.lightGreen },
  flavors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flavor: { width: '30%', minWidth: 115, flexGrow: 1, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 12, padding: 15, gap: 10 },
  flavorIcon: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flavorLabel: { fontFamily: theme.fonts.bold, fontSize: 13 },
  flavorDescription: { color: theme.colors.muted, fontSize: 10, lineHeight: 16 },
  preview: { padding: 24, borderRadius: 12, backgroundColor: theme.colors.lightGreen, gap: 12 },
  previewText: { fontFamily: theme.fonts.display, fontSize: 24, lineHeight: 34 },
  privacy: { fontSize: 11, color: theme.colors.muted, textAlign: 'center', lineHeight: 18 },
  success: { alignItems: 'center', gap: 25, maxWidth: 500, alignSelf: 'center', paddingVertical: 70 },
  successIcon: { padding: 25, borderRadius: 45, backgroundColor: theme.colors.lime },
});
