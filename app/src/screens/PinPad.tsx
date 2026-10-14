import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme';

export const PIN_LENGTH = 6;

/** Calls onDone with the digits once PIN_LENGTH are entered, then clears itself. */
export function PinPad({ title, onDone }: { title?: string; onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const press = (d: string) => {
    const next = pin + d;
    if (next.length < PIN_LENGTH) return setPin(next);
    setPin('');
    onDone(next);
  };
  return (
    <View style={{ alignItems: 'center' }}>
      {title ? <Text style={{ color: colors.dim, marginBottom: 12 }}>{title}</Text> : null}
      <Text style={{ color: colors.text, fontSize: 28, letterSpacing: 8, height: 40 }}>{'•'.repeat(pin.length)}</Text>
      <View style={{ width: 270, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
          <Pressable
            key={i}
            disabled={!k}
            onPress={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}
            style={{ width: 80, height: 60, margin: 5, borderRadius: 30, backgroundColor: k ? colors.card : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 24 }}>{k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
