import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors, ui } from '../theme';

const DELAYS = [{ label: 'In 1 minute', min: 1 }, { label: 'In 5 minutes', min: 5 }, { label: 'In 15 minutes', min: 15 }];

/** Setup screen for a fake call. The call only rings while the app stays open (no notifications are allowed). */
export function FakeCallSetup({ scheduled, onSchedule, onBack }: {
  scheduled?: { at: number; caller: string };
  onSchedule: (min: number, caller: string) => void;
  onBack: () => void;
}) {
  const [caller, setCaller] = useState('Mom');
  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Fake call</Text>
      {scheduled ? (
        <Text style={ui.p}>{scheduled.caller} will call at {new Date(scheduled.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Leave the app open.</Text>
      ) : (
        <>
          <Text style={ui.p}>A realistic incoming call as a reason to leave the room. Leave the app open until it rings.</Text>
          <TextInput style={ui.input} value={caller} onChangeText={setCaller} />
          {DELAYS.map((d) => (
            <Pressable key={d.min} style={[ui.btn, ui.btnAlt]} onPress={() => onSchedule(d.min, caller || 'Mom')}><Text style={ui.btnText}>{d.label}</Text></Pressable>
          ))}
        </>
      )}
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 32 }}>Back</Text>
    </View>
  );
}

/** Full-screen incoming (then connected) call. */
export function IncomingCall({ caller, onEnd }: { caller: string; onEnd: () => void }) {
  const [answered, setAnswered] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 100 }}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 34 }}>{caller}</Text>
        <Text style={{ color: '#aaa', fontSize: 18, marginTop: 8 }}>{answered ? 'on call' : 'mobile'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 80 }}>
        <Pressable onPress={onEnd} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#e0382d' }} />
        {!answered ? <Pressable onPress={() => setAnswered(true)} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#34c759' }} /> : null}
      </View>
    </View>
  );
}
