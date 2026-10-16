import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, ui } from '../theme';

// Walkthrough for alerts that need no screen (docs/triggers.md). Setup uses the TEST link first,
// so the person can try the trigger safely before switching it to the real one.

interface Step { title: string; body: string[]; link?: string; action?: { label: string; run: () => void } }

const openShortcuts = { label: 'Open Shortcuts', run: () => Linking.openURL('shortcuts://').catch(() => {}) };
const openSettings = { label: 'Open Settings', run: () => Linking.openSettings() };

const IOS: Step[] = [
  {
    title: 'Make the shortcut',
    body: ['In Shortcuts, tap +, add the action "Open URLs", and enter the link below.', 'Name it something ordinary, such as "Weather". Start with the TEST link; you will switch it at the end.'],
    link: 'skyline://test', action: openShortcuts,
  },
  {
    title: 'Back Tap',
    body: ['Settings > Accessibility > Touch > Back Tap > Triple Tap, then choose your shortcut.', 'Triple-tapping the back of the phone now runs it, even in a pocket.'],
    action: openSettings,
  },
  {
    title: 'Action Button',
    body: ['iPhone 15 Pro and later: Settings > Action Button, swipe to Shortcut, then choose your shortcut.', 'Skip this if your phone has no Action Button.'],
    action: openSettings,
  },
  {
    title: 'Apple Watch',
    body: ['In the Watch app on this phone, install Skyline on the watch.', 'Add the Skyline complication to a watch face. One tap on it sends the alert, like "Radar" on the widget. The app on the watch also has a "Radar" button.', 'Open this app now and then so the watch has your current details.'],
  },
  {
    title: 'Siri (optional)',
    body: ['The shortcut name is the phrase. Pick something harmless, such as "Weather".', 'Skip this if the other person could hear you say it.'],
  },
  {
    title: 'Try it, then switch',
    body: ['Use the trigger once. The Status screen should show a TEST alert, and contacts get a text marked TEST.', 'Then edit the shortcut and change the link to the one below. From then on it sends a real alert.'],
    link: 'skyline://alert', action: openShortcuts,
  },
];

const ANDROID: Step[] = [
  {
    title: 'Make a shortcut',
    body: ['Use a launcher shortcut or a button-mapping app that can open a link, and set it to the link below.', 'Power-button shortcuts differ by phone maker; check your phone\'s settings. Start with the TEST link.'],
    link: 'skyline://test', action: openSettings,
  },
  {
    title: 'Wear OS watch',
    body: ['On the watch, install Skyline from the Play Store.', 'Add the "Weather" tile. Tapping "Radar" on the tile sends the alert.', 'Open this app now and then so the watch has your current details.'],
  },
  {
    title: 'Try it, then switch',
    body: ['Use the trigger once. The Status screen should show a TEST alert.', 'Then change the shortcut to the link below. From then on it sends a real alert.'],
    link: 'skyline://alert',
  },
];

export function Triggers({ onBack }: { onBack: () => void }) {
  const steps = Platform.OS === 'ios' ? IOS : ANDROID;
  const [i, setI] = useState(0);
  const s = steps[i];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[ui.screen, { flexGrow: 1 }]}>
      <Text style={{ color: colors.dim, marginBottom: 4 }}>Step {i + 1} of {steps.length}</Text>
      <Text style={ui.h1}>{s.title}</Text>
      {s.body.map((b) => <Text key={b} style={ui.p}>{b}</Text>)}
      {s.link ? <Text selectable style={[ui.input, { marginBottom: 12 }]}>{s.link}</Text> : null}
      {s.action ? <Pressable style={[ui.btn, ui.btnAlt]} onPress={s.action.run}><Text style={ui.btnText}>{s.action.label}</Text></Pressable> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {i > 0 ? <Pressable style={[ui.btn, ui.btnAlt, { flex: 1 }]} onPress={() => setI(i - 1)}><Text style={ui.btnText}>Back</Text></Pressable> : null}
        <Pressable style={[ui.btn, { flex: 1 }]} onPress={() => (i < steps.length - 1 ? setI(i + 1) : onBack())}>
          <Text style={ui.btnText}>{i < steps.length - 1 ? 'Next' : 'Done'}</Text>
        </Pressable>
      </View>
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 24 }}>Close</Text>
    </ScrollView>
  );
}
