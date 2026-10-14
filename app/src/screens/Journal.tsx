import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { addNote, addPhoto, exportPdf, listEntries, type Entry } from '../journal';
import { colors, ui } from '../theme';

export function Journal({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => listEntries().then(setEntries).catch(() => setMsg('Could not reach the server.')), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setMsg('');
    try { await fn(); await load(); } catch { setMsg('That did not work. Try again.'); }
  };

  const photo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    // Taken in-app and uploaded; it is not saved to the photo library.
    const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    const a = r.assets?.[0];
    if (!r.canceled && a?.base64) await run(() => addPhoto(a.base64!, a.mimeType ?? 'image/jpeg'));
  };

  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Journal</Text>
      <Text style={ui.p}>Entries are encrypted on the server, not kept on this phone.</Text>
      <TextInput style={[ui.input, { minHeight: 70 }]} multiline value={text} onChangeText={setText} placeholder="What happened?" placeholderTextColor={colors.dim} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[ui.btn, { flex: 1 }]} onPress={() => text.trim() && run(async () => { await addNote(text.trim()); setText(''); })}><Text style={ui.btnText}>Add note</Text></Pressable>
        <Pressable style={[ui.btn, ui.btnAlt, { flex: 1 }]} onPress={photo}><Text style={ui.btnText}>Photo</Text></Pressable>
      </View>
      {msg ? <Text style={[ui.p, { color: '#ff8a80', marginTop: 8 }]}>{msg}</Text> : null}
      <ScrollView style={{ marginTop: 12 }}>
        {[...entries].reverse().map((e) => (
          <View key={e.id} style={{ backgroundColor: colors.card, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: colors.dim, fontSize: 12 }}>{new Date(e.at).toLocaleString()} · {e.kind}</Text>
            {e.text ? <Text style={{ color: colors.text, marginTop: 4 }}>{e.text}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <Pressable style={[ui.btn, ui.btnAlt]} onPress={() => run(exportPdf)}><Text style={ui.btnText}>Export dated PDF</Text></Pressable>
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 16 }}>Back</Text>
    </View>
  );
}
