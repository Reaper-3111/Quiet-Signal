import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { PLAN_ITEMS } from '../safetyPlan';
import { colors, ui } from '../theme';

export function SafetyPlan({ done, onToggle, onBack }: { done: Record<number, boolean>; onToggle: (i: number, v: boolean) => void; onBack: () => void }) {
  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Safety plan</Text>
      <ScrollView>
        {PLAN_ITEMS.map((item, i) => (
          <Pressable key={i} style={ui.row} onPress={() => onToggle(i, !done[i])}>
            <Text style={{ color: colors.text, flex: 1, paddingRight: 12 }}>{item}</Text>
            <Switch value={!!done[i]} onValueChange={(v) => onToggle(i, v)} />
          </Pressable>
        ))}
      </ScrollView>
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 16 }}>Back</Text>
    </View>
  );
}
