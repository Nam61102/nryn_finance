import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { RawSms } from './sms.filter';

/**
 * Thin wrapper over the native SMS content provider.
 *
 * Android only. react-native-get-sms-android exports NativeModules.Sms (getName() = "Sms").
 */
export const getSmsAndroid = () => {
  let mod: any = null;
  try {
    mod = require('react-native-get-sms-android');
    if (mod && mod.default) mod = mod.default;
  } catch {}
  if (!mod || !mod.list) {
    mod = (NativeModules as any).Sms || (NativeModules as any).SmsModule || null;
  }
  return mod;
};

export const isSupported = () => {
  if (Platform.OS !== 'android') return false;
  return Boolean(getSmsAndroid());
};

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.warn('requestPermission error', e);
    return false;
  }
}

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  } catch {
    return false;
  }
}

type ListOpts = {
  minDate?: number;      // epoch ms, exclusive lower bound — the sync cursor
  maxDate?: number;
  indexFrom?: number;
  maxCount?: number;
};

/**
 * Read a page of the inbox. Pages of ~500 keep memory flat on a 20k-message
 * inbox; the caller checkpoints the cursor after every page so an interrupted
 * backfill resumes instead of restarting (§3.1).
 */
export function listInbox(opts: ListOpts = {}): Promise<RawSms[]> {
  return new Promise((resolve, reject) => {
    if (!isSupported()) return resolve([]);
    const SmsAndroid = getSmsAndroid();
    if (!SmsAndroid || typeof SmsAndroid.list !== 'function') {
      return reject(new Error('SmsAndroid native module is unavailable on this device'));
    }

    const filter = {
      box: 'inbox',
      sortOrder: 'date DESC',
      indexFrom: opts.indexFrom ?? 0,
      maxCount: opts.maxCount ?? 500,
      ...(opts.minDate ? { minDate: opts.minDate } : {}),
      ...(opts.maxDate ? { maxDate: opts.maxDate } : {}),
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (err: string) => reject(new Error(err)),
      (_count: number, smsList: string) => {
        try {
          const parsed = JSON.parse(smsList) as any[];
          resolve(
            parsed.map((m) => ({
              _id: String(m._id),
              address: String(m.address || ''),
              body: String(m.body || ''),
              date: Number(m.date) || 0,
            })),
          );
        } catch (e: any) {
          reject(e);
        }
      },
    );
  });
}
