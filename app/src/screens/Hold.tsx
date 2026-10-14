import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, ui } from '../theme';

/** Dead man's switch: nothing happens while held; releasing starts the send (or the countdown). */
export function Hold({ onRelease, onBack }: { onRelease: () => void; onBack?: () => void }) {
  const held = useRef(false);
  return (
    <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <Pressable
        onPressIn={() => { held.current = true; }}
        onPressOut={() => { if (held.current) { held.current = false; onRelease(); } }}
        style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.dim, fontSize: 18 }}>Hold</Text>
      </Pressable>
      {onBack ? <Text onPress={onBack} style={{ color: colors.dim, marginTop: 40 }}>Back</Text> : null}
    </View>
  );
}
