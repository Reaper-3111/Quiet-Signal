import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { postJson } from '../api';
import { colors, ui } from '../theme';
import type { AlertRecord, Settings } from '../types';

type Recipient = { phone: string; status: string };

export function Status({ alerts, settings, onSafe, onBack }: {
  alerts: AlertRecord[]; settings: Settings; onSafe: (a: AlertRecord) => void; onBack: () => void;
}) {
  const [receipts, setReceipts] = useState<Record<string, Recipient[]>>({});

  useEffect(() => {
    alerts.forEach((a) => {
      if (!a.server) return;
      postJson(a.server, `/v1/alerts/${a.id}`, settings.tokens[a.server], undefined, 4000, 'GET')
        .then((r) => setReceipts((prev) => ({ ...prev, [a.id]: r.recipients })))
        .catch(() => {});
    });
  }, [alerts, settings.tokens]);

  const list = [...alerts].reverse();
  const live = list.find((a) => !a.safe && a.payload.kind !== 'intro' && a.payload.kind !== 'test');

  return (
    <View style={ui.screen}>
      <Text style={ui.h1}>Status</Text>
      <ScrollView>
        {list.length === 0 ? <Text style={ui.p}>Nothing sent yet.</Text> : null}
        {list.map((a) => (
          <View key={a.id} style={{ backgroundColor: colors.card, borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <Text style={{ color: colors.text }}>
              {a.payload.kind}{a.payload.duress ? ' (forced cancel)' : ''} · {new Date(a.at).toLocaleString()}
            </Text>
            <Text style={{ color: colors.dim, marginTop: 4 }}>
              {a.state === 'sent' ? 'Server accepted' : 'Waiting to send'}{a.safe ? ' · marked safe' : ''}
            </Text>
            {(receipts[a.id] ?? []).map((r) => (
              <Text key={r.phone} style={{ color: colors.dim }}>{r.phone}: {r.status}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
      {live ? <Pressable style={ui.btn} onPress={() => onSafe(live)}><Text style={ui.btnText}>I'm safe</Text></Pressable> : null}
      <Text onPress={onBack} style={{ color: colors.dim, textAlign: 'center', marginTop: 24 }}>Back</Text>
    </View>
  );
}
