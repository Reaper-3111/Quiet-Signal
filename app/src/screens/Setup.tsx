import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { guard } from '../guard';
import { defaultTemplate, normalizePhone } from '../message';
import { hashPin } from '../pin';
import { colors, ui } from '../theme';
import type { Settings } from '../types';
import { PinPad } from './PinPad';

type Step = 'welcome' | 'pin' | 'pin2' | 'duress' | 'duress2' | 'contacts' | 'message' | 'options' | 'finish';
const FIRST_RUN: Step[] = ['welcome', 'pin', 'pin2', 'duress', 'duress2', 'contacts', 'message', 'options', 'finish'];
const EDIT: Step[] = ['contacts', 'message', 'options', 'finish'];

interface Props {
  settings: Settings;
  onSave: (s: Settings, sendIntros: boolean) => Promise<void>;
  onTest: () => void;
  onDone: () => void;
}

export function Setup({ settings, onSave, onTest, onDone }: Props) {
  const steps = settings.setupDone ? EDIT : FIRST_RUN;
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<Settings>(settings);
  const [pins, setPins] = useState({ pin: '', duress: '' });
  const [phones, setPhones] = useState([...settings.contacts, '', '', '', '', ''].slice(0, 5));
  const [error, setError] = useState('');
  const [tested, setTested] = useState(false);
  const step = steps[i];
  const next = () => { setError(''); setI(i + 1); };
  const patch = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));

  const takePin = async (kind: 'pin' | 'duress', confirm: boolean, entered: string) => {
    if (!confirm) {
      if (kind === 'duress' && entered === pins.pin) return setError('The duress PIN must differ from your PIN.');
      setPins({ ...pins, [kind]: entered });
      return next();
    }
    if (entered !== pins[kind]) { setError('PINs did not match. Try again.'); return setI(i - 1); }
    patch(kind === 'pin' ? { pin: await hashPin(entered) } : { duress: await hashPin(entered) });
    next();
  };

  const takeContacts = () => {
    const nums = phones.filter((p) => p.trim()).map(normalizePhone);
    if (!nums.length || nums.includes(null)) return setError('Enter 1 to 5 valid phone numbers.');
    patch({ contacts: [...new Set(nums as string[])] });
    next();
  };

  const allowLocation = async () => {
    guard.systemDialog = true;
    try {
      await Location.requestForegroundPermissionsAsync();
      await Location.requestBackgroundPermissionsAsync();
    } finally {
      guard.systemDialog = false;
    }
  };

  const finish = async () => {
    await onSave({ ...draft, setupDone: true }, !settings.setupDone || draft.contacts.join() !== settings.contacts.join());
    setTested(true);
  };

  if (step === 'pin' || step === 'pin2' || step === 'duress' || step === 'duress2') {
    const kind = step.startsWith('pin') ? 'pin' : 'duress';
    const confirm = step.endsWith('2');
    const title = kind === 'pin' ? (confirm ? 'Confirm your PIN' : 'Choose a 6 digit PIN') : (confirm ? 'Confirm duress PIN' : 'Choose a different 6 digit duress PIN');
    return (
      <View style={ui.screen}>
        {kind === 'duress' && !confirm ? (
          <Text style={ui.p}>If someone forces you to stop an alert, entering this PIN will look like it cancelled, but the alert still sends.</Text>
        ) : null}
        {error ? <Text style={[ui.p, { color: '#ff8a80' }]}>{error}</Text> : null}
        <PinPad title={title} onDone={(p) => takePin(kind, confirm, p)} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[ui.screen, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
      {step === 'welcome' && (
        <>
          <Text style={ui.h1}>Set up</Text>
          <Text style={ui.p}>This tool texts people you choose, with your location, when you press a button. It needs phone signal and is not a substitute for calling 911.</Text>
          <Text style={ui.p}>If Family Sharing is on, anything bought with the account is visible to the organizer. This app is free and has no purchases.</Text>
          <Text style={ui.p}>Anyone who knows your PIN, or who can see your screen during setup, can see what you enter here.</Text>
        </>
      )}
      {step === 'contacts' && (
        <>
          <Text style={ui.h1}>Who should be alerted?</Text>
          <Text style={ui.p}>One to five people. Each gets a one-time text now explaining they were chosen.</Text>
          {phones.map((p, k) => (
            <TextInput key={k} style={[ui.input, { marginBottom: 8 }]} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={colors.dim}
              value={p} onChangeText={(t) => setPhones(phones.map((x, j) => (j === k ? t : x)))} />
          ))}
        </>
      )}
      {step === 'message' && (
        <>
          <Text style={ui.h1}>Your message</Text>
          <Text style={ui.label}>Your name, as contacts know you</Text>
          <TextInput style={ui.input} value={draft.name} onChangeText={(t) => patch({ name: t, template: defaultTemplate(t) })} />
          <Text style={ui.label}>Alert text</Text>
          <Text style={ui.p}>{'{address}, {coords} and {link} are filled in when it sends.'}</Text>
          <TextInput style={[ui.input, { minHeight: 120 }]} multiline value={draft.template} onChangeText={(t) => patch({ template: t })} />
        </>
      )}
      {step === 'options' && (
        <>
          <Text style={ui.h1}>Options</Text>
          <Text style={ui.p}>With cancel off, releasing the hold button sends immediately and nothing can stop it. That means more false alarms and no take-backs, but nobody can force you to cancel.</Text>
          <View style={ui.row}><Text style={{ color: colors.text }}>PIN can cancel hold button</Text><Switch value={draft.cancelHold} onValueChange={(v) => patch({ cancelHold: v })} /></View>
          <View style={ui.row}><Text style={{ color: colors.text }}>PIN can cancel check-in timer</Text><Switch value={draft.cancelCheckin} onValueChange={(v) => patch({ cancelCheckin: v })} /></View>
          <Text style={ui.label}>911</Text>
          <Text style={ui.p}>Off: contacts are texted only. Dialer: the phone dialer opens with 911 entered; you tap to call. Dispatch: a dispatch center calls 911 for you.</Text>
          {(['off', 'dialer', 'dispatch'] as const).map((o) => (
            <Pressable key={o} style={[ui.btn, draft.call911 === o ? null : ui.btnAlt, { marginTop: 6, padding: 12 }]} onPress={() => patch({ call911: o })}>
              <Text style={ui.btnText}>{o[0].toUpperCase() + o.slice(1)}</Text>
            </Pressable>
          ))}
        </>
      )}
      {step === 'finish' && (
        <>
          <Text style={ui.h1}>Finish</Text>
          <Text style={ui.p}>Location set to Always lets live tracking work while the phone is locked. Choose "Allow" if asked twice.</Text>
          <Pressable style={[ui.btn, ui.btnAlt]} onPress={allowLocation}>
            <Text style={ui.btnText}>Allow location</Text>
          </Pressable>
          <Pressable style={ui.btn} onPress={finish}><Text style={ui.btnText}>Save and notify contacts</Text></Pressable>
          {tested ? (
            <>
              <Text style={ui.p}>Saved. Send a test so you can trust it works. The text says TEST.</Text>
              <Pressable style={[ui.btn, ui.btnAlt]} onPress={onTest}><Text style={ui.btnText}>Send test alert</Text></Pressable>
              <Pressable style={[ui.btn, ui.btnAlt]} onPress={onDone}><Text style={ui.btnText}>Done</Text></Pressable>
            </>
          ) : null}
        </>
      )}

      {error ? <Text style={[ui.p, { color: '#ff8a80' }]}>{error}</Text> : null}
      {step !== 'finish' ? (
        <Pressable style={ui.btn} onPress={step === 'contacts' ? takeContacts : next}><Text style={ui.btnText}>Next</Text></Pressable>
      ) : null}
      {settings.setupDone ? <Text onPress={onDone} style={{ color: colors.dim, textAlign: 'center', marginTop: 24 }}>Back</Text> : null}
    </ScrollView>
  );
}
