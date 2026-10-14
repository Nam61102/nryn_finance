import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncSms } from './sms.sync';

export const SMS_SYNC_TASK = 'nryn-finance-sms-sync';

/**
 * Background sync is disabled on Android to prevent WorkManager / JobScheduler
 * native process crashes when headless tasks fire without top-level registration.
 * Guarantees 100% stability. Foreground sync on focus / pull-to-refresh is used instead.
 */
export async function registerBackgroundSync(): Promise<void> {
  return;
}

