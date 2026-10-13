import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PinResult } from '../pin';
import { colors, ui } from '../theme';
import type { Checkin as CheckinT, Settings } from '../types';
import { PinPad } from './PinPad';

const OPTIONS = [{ label: '30 minutes', min: 30 }, { label: '1 hour', min: 60 }, { label: '2 hours', min: 120 }, { label: '4 hours', min: 240 }];

interface Props {
  settings: Settings;
  active?: CheckinT;
  onArm: (min: number) => void;
  classify: (pin: string) => Promise<PinResult>;
  onCancel: () => void;
  onDuress: () => void;
  onBack: () => void;
}

export function Checkin({ settings, active, onArm, classify, onCancel, onDuress, onBack }: Props) {
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');

  const submit = async (pin: string) => {
    const r = await classify(pin);
    if (r === 'real') onCancel();
    if (r === 'duress') { onDuress(); setNote('Cancelled'); setEntering(false); }
  };

  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Check-in timer</Text>
      {active ? (
        <>
          <Text style={ui.p}>An alert will send at {new Date(active.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} unless you cancel with your PIN.</Text>
          {!settings.cancelCheckin ? <Text style={ui.p}>PIN cancel is off for check-ins, so this cannot be stopped.</Text>
            : entering ? <PinPad title="Enter PIN to cancel" onDone={submit} />
            : <Pressable style={ui.btn} onPress={() => setEntering(true)}><Text style={ui.btnText}>I'm OK, cancel</Text></Pressable>}
        </>
      ) : (
        <>
          <Text style={ui.p}>{note || 'If you do not check in before the time is up, the alert sends by itself, even if your phone is off.'}</Text>
          {OPTIONS.map((o) => (
            <Pressable key={o.min} style={[ui.btn, ui.btnAlt]} onPress={() => onArm(o.min)}><Text style={ui.btnText}>{o.label}</Text></Pressable>
          ))}
        </>
      )}
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 32 }}>Back</Text>
    </View>
  );
}
