import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { LOCAL, NATIONAL } from '../resources';
import { colors, ui } from '../theme';

export function Resources({ onBack }: { onBack: () => void }) {
  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Resources</Text>
      <Text style={ui.p}>Calls you place from here show in your phone's call history.</Text>
      <ScrollView>
        {[...NATIONAL, ...LOCAL].map((r) => (
          <View key={r.name} style={{ backgroundColor: colors.card, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>{r.name}</Text>
            <Text style={{ color: colors.dim, marginVertical: 4 }}>{r.detail}</Text>
            {r.phone ? <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)}><Text style={{ color: colors.accent }}>Call {r.phone}</Text></Pressable> : null}
            {r.url ? <Pressable onPress={() => Linking.openURL(r.url!)}><Text style={{ color: colors.accent }}>{r.url}</Text></Pressable> : null}
          </View>
        ))}
      </ScrollView>
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 16 }}>Back</Text>
    </View>
  );
}
