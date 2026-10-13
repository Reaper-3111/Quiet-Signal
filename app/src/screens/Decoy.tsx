import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DEFAULT_PLACE } from '../config';

// WMO weather codes grouped into plain descriptions.
const describe = (code: number) =>
  code === 0 ? 'Clear' : code <= 3 ? 'Partly cloudy' : code <= 48 ? 'Fog' : code <= 57 ? 'Drizzle' : code <= 67 ? 'Rain'
  : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow showers' : 'Thunderstorms';

interface Forecast {
  place: string;
  temp: number;
  code: number;
  days: { date: string; hi: number; lo: number; code: number }[];
}

async function fetchForecast(): Promise<Forecast> {
  let { lat, lng, name } = { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng, name: DEFAULT_PLACE.name };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) {
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      name = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0]?.city ?? 'Current location';
    }
  } catch {
    // fall back to the default place
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto`;
  const d = await (await fetch(url)).json();
  return {
    place: name,
    temp: Math.round(d.current.temperature_2m),
    code: d.current.weather_code,
    days: d.daily.time.map((date: string, i: number) => ({
      date, hi: Math.round(d.daily.temperature_2m_max[i]), lo: Math.round(d.daily.temperature_2m_min[i]), code: d.daily.weather_code[i],
    })),
  };
}

/** A working weather screen. Five quick taps on the temperature call onSecret. */
export function Decoy({ onSecret, footer }: { onSecret?: () => void; footer?: string }) {
  const [f, setF] = useState<Forecast | null>(null);
  const taps = useRef<number[]>([]);

  useEffect(() => { fetchForecast().then(setF).catch(() => {}); }, []);

  const tapTemp = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) { taps.current = []; onSecret?.(); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2c6fb7', paddingTop: 70 }}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 24 }}>{f?.place ?? ' '}</Text>
        <Text onPress={tapTemp} suppressHighlighting style={{ color: '#fff', fontSize: 90, fontWeight: '200' }}>
          {f ? `${f.temp}°` : '--'}
        </Text>
        <Text style={{ color: '#dbe9f7', fontSize: 20 }}>{f ? describe(f.code) : ' '}</Text>
      </View>
      <ScrollView style={{ marginTop: 30 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
        {f?.days.map((d) => (
          <View key={d.date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#ffffff44' }}>
            <Text style={{ color: '#fff', width: 60 }}>{new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })}</Text>
            <Text style={{ color: '#fff', flex: 1 }}>{describe(d.code)}</Text>
            <Text style={{ color: '#fff' }}>{d.hi}° / {d.lo}°</Text>
          </View>
        ))}
      </ScrollView>
      {footer ? <Text style={{ color: '#ffffff99', textAlign: 'center', fontSize: 12, marginBottom: 6 }}>{footer}</Text> : null}
    </View>
  );
}
