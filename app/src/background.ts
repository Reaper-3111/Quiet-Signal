import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { flushQueue } from './alert';
import { env } from './api';
import { isReal } from './fire';
import { startLive } from './location';
import { load } from './storage';
import { checkWipe } from './wipe';
import { drainWidgetQueue } from './widgets';

// Lets the OS retry queued alerts (and check for a remote wipe) while the app is closed.
// The OS decides when it runs, at most every 15 minutes, so the in-app 30 second retry stays.
const TASK = 'queue-retry';

TaskManager.defineTask(TASK, async () => {
  try {
    if (await checkWipe()) return BackgroundTask.BackgroundTaskResult.Success;
    await drainWidgetQueue();
    const done = await flushQueue(env, (await load()).alerts);
    if (done.some((d) => isReal(d.rec.payload.kind))) await startLive().catch(() => {});
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRetry() {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
