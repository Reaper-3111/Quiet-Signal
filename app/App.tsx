import * as Linking from 'expo-linking';
import * as ScreenCapture from 'expo-screen-capture';
import * as SMS from 'expo-sms';
import { Accelerometer } from 'expo-sensors';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { startRecording, stopRecording } from './src/audio';
import { armCheckin, cancelCheckin, fireAlert, fireCheckinDuress, flushQueue } from './src/alert';
import { env, postJson } from './src/api';
import { COUNTDOWN_SECONDS } from './src/config';
import { guard } from './src/guard';
import { startLive, stopLive } from './src/location';
import { classify } from './src/pin';
import { emptyState, load, update } from './src/storage';
import { Checkin } from './src/screens/Checkin';
import { Decoy } from './src/screens/Decoy';
import { FakeCallSetup, IncomingCall } from './src/screens/FakeCall';
import { Journal } from './src/screens/Journal';
import { Resources } from './src/screens/Resources';
import { SafetyPlan } from './src/screens/SafetyPlan';
import { Hold } from './src/screens/Hold';
import { Home } from './src/screens/Home';
import { PinPad } from './src/screens/PinPad';
import { Setup } from './src/screens/Setup';
import { Status } from './src/screens/Status';
import { ui } from './src/theme';
import type { AlertRecord, Kind, Settings, State } from './src/types';

type Screen = 'decoy' | 'pin' | 'home' | 'hold' | 'countdown' | 'checkin' | 'status' | 'setup' | 'journal' | 'resources' | 'plan' | 'fakecall' | 'call';
const isReal = (k: Kind) => k !== 'intro' && k !== 'test';
const REAL: Screen[] = ['home', 'checkin', 'status', 'setup', 'journal', 'resources', 'plan', 'fakecall'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('decoy');
  const [state, setState] = useState<State>(emptyState());
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  const [holdFromHome, setHoldFromHome] = useState(false); // widget launches must not reach real mode via Back
  const [fake, setFake] = useState<{ at: number; caller: string }>();
  const strikes = useRef(0);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const { settings } = state;

  const refresh = useCallback(() => load().then(setState), []);

  // Sends silently. Live tracking starts once a server has the alert.
  const fire = useCallback(async (kind: Kind, duress = false) => {
    const s = (await load()).settings;
    if (!s.setupDone) return;
    const out = await fireAlert(env, s, kind, duress);
    if (out.via === 'server' && isReal(kind)) {
      startLive().catch(() => {});
      if (s.recordAudio) startRecording(out.id).catch(() => {});
    }
    refresh();
  }, [refresh]);

  const retryQueue = useCallback(async () => {
    const done = await flushQueue(env, (await load()).alerts);
    if (done.some((d) => isReal(d.rec.payload.kind))) startLive().catch(() => {});
    if (done.length) refresh();
  }, [refresh]);

  // Fake call: rings only while the app stays open, since notifications are never used.
  useEffect(() => {
    if (!fake) return;
    const t = setTimeout(() => setScreen('call'), Math.max(0, fake.at - Date.now()));
    return () => clearTimeout(t);
  }, [fake]);

  const exit = useCallback(() => setScreen('decoy'), []);

  // Start-up, retry loop, and deep links from widgets and shortcuts.
  useEffect(() => {
    refresh().then(retryQueue);
    const timer = setInterval(retryQueue, 30_000);
    const handle = ({ url }: { url: string }) => {
      const { hostname, path } = Linking.parse(url);
      const target = hostname || path;
      if (target === 'alert') fire('instant');
      if (target === 'hold') load().then((s) => { if (s.settings.setupDone) { setHoldFromHome(false); setScreen('hold'); } });
    };
    Linking.getInitialURL().then((url: string | null) => url && handle({ url }));
    const sub = Linking.addEventListener('url', handle);
    return () => { clearInterval(timer); sub.remove(); };
  }, [refresh, retryQueue, fire]);

  // Leaving the app always returns to the decoy, so the app switcher never shows a real screen.
  // A hold countdown that is interrupted sends instead of stalling.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') return retryQueue();
      if (guard.systemDialog) return;
      if (screenRef.current === 'countdown') fire('hold');
      if (screenRef.current !== 'decoy') setScreen('decoy');
    });
    return () => sub.remove();
  }, [fire, retryQueue]);

  // Block screenshots and blank the Android recents tile on every non-decoy screen.
  useEffect(() => {
    (screen === 'decoy' ? ScreenCapture.allowScreenCaptureAsync() : ScreenCapture.preventScreenCaptureAsync()).catch(() => {});
  }, [screen]);

  // Shake = quick exit from real mode.
  useEffect(() => {
    if (!REAL.includes(screen)) return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => { if (Math.hypot(x, y, z) > 2.8) exit(); });
    return () => sub.remove();
  }, [screen, exit]);

  // Hold countdown.
  useEffect(() => {
    if (screen !== 'countdown') return;
    setLeft(COUNTDOWN_SECONDS);
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [screen]);
  useEffect(() => {
    if (screen === 'countdown' && left <= 0) { fire('hold'); exit(); }
  }, [left, screen, fire, exit]);

  const unlock = async (pin: string) => {
    const r = await classify(pin, settings.pin, settings.duress);
    if (r === 'real') { strikes.current = 0; return setScreen(settings.setupDone ? 'home' : 'setup'); }
    if (++strikes.current >= 3) { strikes.current = 0; exit(); }
  };

  const onCountdownPin = async (pin: string) => {
    const r = await classify(pin, settings.pin, settings.duress);
    if (r === 'real') exit();
    if (r === 'duress') { fire('hold', true); exit(); } // looks cancelled, sends anyway
  };

  const onHoldRelease = () => {
    if (settings.cancelHold) setScreen('countdown');
    else { fire('hold'); exit(); }
  };

  const saveSettings = async (s: Settings, intros: boolean) => {
    await update((st) => { st.settings = { ...s, tokens: st.settings.tokens }; });
    await refresh();
    if (intros) await fireAlert(env, s, 'intro');
    refresh();
  };

  const markSafe = async (a: AlertRecord) => {
    const message = "I'm safe now. This follows my earlier alert. No action needed.";
    if (a.server) await postJson(a.server, `/v1/alerts/${a.id}/safe`, settings.tokens[a.server], { message }, 6000).catch(() => {});
    else if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync(a.payload.contacts, message);
    await update((s) => { const r = s.alerts.find((x) => x.id === a.id); if (r) r.safe = true; });
    await stopLive();
    stopRecording();
    refresh();
  };

  const armTimer = async (min: number) => {
    const ci = await armCheckin(env, settings, new Date(Date.now() + min * 60_000));
    if (ci) await update((s) => { s.checkin = ci; });
    refresh();
  };
  const endTimer = async (cancel: boolean) => {
    const ci = state.checkin;
    if (ci) await (cancel ? cancelCheckin(env, ci) : fireCheckinDuress(env, settings, ci));
    await update((s) => { delete s.checkin; });
    refresh();
  };

  const body = () => {
    switch (screen) {
      case 'pin':
        return <View style={ui.screen}><PinPad title="Enter code" onDone={unlock} /></View>;
      case 'home':
        return <Home onGo={(t) => { setHoldFromHome(t === 'hold'); setScreen(t === 'settings' ? 'setup' : t); }} onInstant={() => fire('instant')} onExit={exit} />;
      case 'hold':
        return <Hold onRelease={onHoldRelease} onBack={holdFromHome ? () => setScreen('home') : undefined} />;
      case 'countdown':
        return (
          <View style={{ flex: 1 }}>
            <Decoy footer={`Refreshing in ${left}s`} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 24, backgroundColor: '#101418cc' }}>
              <PinPad onDone={onCountdownPin} />
            </View>
          </View>
        );
      case 'checkin':
        return (
          <Checkin settings={settings} active={state.checkin} onArm={armTimer}
            classify={(p) => classify(p, settings.pin, settings.duress)}
            onCancel={() => endTimer(true)} onDuress={() => endTimer(false)} onBack={() => setScreen('home')} />
        );
      case 'status':
        return <Status alerts={state.alerts} settings={settings} onSafe={markSafe} onBack={() => setScreen('home')} />;
      case 'journal':
        return <Journal onBack={() => setScreen('home')} />;
      case 'resources':
        return <Resources onBack={() => setScreen('home')} />;
      case 'plan':
        return <SafetyPlan done={state.plan ?? {}} onBack={() => setScreen('home')}
          onToggle={(i, v) => update((s) => { s.plan = { ...s.plan, [i]: v }; }).then(setState)} />;
      case 'fakecall':
        return <FakeCallSetup scheduled={fake} onBack={() => setScreen('home')} onSchedule={(min, caller) => setFake({ at: Date.now() + min * 60_000, caller })} />;
      case 'call':
        return <IncomingCall caller={fake?.caller ?? 'Mom'} onEnd={() => { setFake(undefined); exit(); }} />;
      case 'setup':
        return <Setup settings={settings} onSave={saveSettings} onTest={() => fire('test')} onDone={() => setScreen(settings.setupDone ? 'home' : 'decoy')} />;
      default:
        return <Decoy onSecret={() => setScreen(settings.pin ? 'pin' : 'setup')} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {body()}
    </View>
  );
}
