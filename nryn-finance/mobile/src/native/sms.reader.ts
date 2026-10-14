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
 * Read a page of the inbox safely without crashing on native or parse errors.
 */
export function listInbox(opts: ListOpts = {}): Promise<RawSms[]> {
  return new Promise((resolve) => {
    if (!isSupported()) return resolve([]);
    const SmsAndroid = getSmsAndroid();
    if (!SmsAndroid || typeof SmsAndroid.list !== 'function') {
      return resolve([]);
    }

    const filter: Record<string, any> = {
      box: 'inbox',
      sortOrder: 'date DESC',
      indexFrom: Math.max(0, opts.indexFrom ?? 0),
      maxCount: Math.max(1, opts.maxCount ?? 500),
    };

    if (opts.minDate && opts.minDate > 0) {
      filter.minDate = opts.minDate;
    }
    if (opts.maxDate && opts.maxDate > 0) {
      filter.maxDate = opts.maxDate;
    }

    try {
      SmsAndroid.list(
        JSON.stringify(filter),
        (err: string) => {
          console.warn('SmsAndroid.list warning:', err);
          resolve([]);
        },
        (_count: number, smsList: string) => {
          try {
            if (!smsList || typeof smsList !== 'string') {
              return resolve([]);
            }
            const parsed = JSON.parse(smsList);
            if (!Array.isArray(parsed)) {
              return resolve([]);
            }
            resolve(
              parsed.map((m) => ({
                _id: String(m?._id || Math.random().toString(36).slice(2)),
                address: String(m?.address || ''),
                body: String(m?.body || ''),
                date: Number(m?.date) || 0,
              })),
            );
          } catch (e: any) {
            console.warn('listInbox JSON parse warning:', e);
            resolve([]);
          }
        },
      );
    } catch (nativeErr) {
      console.warn('SmsAndroid.list exception:', nativeErr);
      resolve([]);
    }
  });
}
