import { Pressable, Text, View } from 'react-native';
import { colors, ui } from '../theme';

export type Target = 'hold' | 'checkin' | 'status' | 'settings';

export function Home({ onGo, onInstant, onExit }: { onGo: (t: Target) => void; onInstant: () => void; onExit: () => void }) {
  const Item = ({ label, to }: { label: string; to: Target }) => (
    <Pressable style={[ui.btn, ui.btnAlt]} onPress={() => onGo(to)}><Text style={ui.btnText}>{label}</Text></Pressable>
  );
  return (
    <View style={ui.screen}>
      <Pressable style={[ui.btn, { backgroundColor: '#b3261e', paddingVertical: 32 }]} onPress={onInstant}>
        <Text style={ui.btnText}>Send alert now</Text>
      </Pressable>
      <Item label="Hold button" to="hold" />
      <Item label="Check-in timer" to="checkin" />
      <Item label="Status" to="status" />
      <Item label="Settings" to="settings" />
      <Text onPress={onExit} style={{ color: colors.dim, textAlign: 'center', marginTop: 32, padding: 12 }}>Exit</Text>
    </View>
  );
}
