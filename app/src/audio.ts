import { AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { addAudio } from './journal';

const CHUNK_MS = 30_000;
const MAX_CHUNKS = 240; // two hours
let running = false;

/** Records in 30 second chunks, uploading each and deleting the local file. Nothing stays on the phone. */
export async function startRecording(alertId: string) {
  if (running) return;
  const perm = await AudioModule.requestRecordingPermissionsAsync();
  if (!perm.granted) return;
  running = true;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  for (let i = 0; i < MAX_CHUNKS && running; i++) {
    const rec = new AudioModule.AudioRecorder(RecordingPresets.LOW_QUALITY);
    await rec.prepareToRecordAsync();
    rec.record();
    await new Promise((r) => setTimeout(r, CHUNK_MS));
    await rec.stop();
    if (rec.uri) {
      const data = await FileSystem.readAsStringAsync(rec.uri, { encoding: FileSystem.EncodingType.Base64 }).catch(() => '');
      if (data) await addAudio(data, alertId).catch(() => {});
      await FileSystem.deleteAsync(rec.uri, { idempotent: true }).catch(() => {});
    }
  }
  running = false;
}

export const stopRecording = () => { running = false; };
