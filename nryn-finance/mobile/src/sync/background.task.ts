import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncSms } from './sms.sync';

export const SMS_SYNC_TASK = 'nryn-finance-sms-sync';

/**
 * Best-effort ONLY. Android throttles background fetch hard and manufacturer
 * battery managers kill it outright, so nothing in this app may depend on it.
 * The guaranteed path is sync-on-open; this is a bonus that shortens latency.
 */
TaskManager.defineTask(SMS_SYNC_TASK, async () => {
  try {
    const p = await syncSms();
    return p.uploaded > 0 ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  if (Platform.OS !== 'android') return;   // no background fetch on web
  const already = await TaskManager.isTaskRegisteredAsync(SMS_SYNC_TASK);
  if (already) return;
  await BackgroundFetch.registerTaskAsync(SMS_SYNC_TASK, {
    minimumInterval: 15 * 60,   // Android's floor; treat as a hint, not a promise
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
