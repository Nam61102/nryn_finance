import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { RawSms } from './sms.filter';

/**
 * Thin wrapper over the native SMS content provider.
 *
 * Deliberately one file: the plan starts on the community module
 * (react-native-get-sms-android) to prove the flow end to end, and swapping in
 * a local Expo module later is a change to THIS file only.
 *
 * Android only. iOS gives no app any access to the SMS inbox, ever.
 */
const SmsAndroid = (NativeModules as any).SmsModule || null;

export const isSupported = () => Platform.OS === 'android' && Boolean(SmsAndroid);

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
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
    const filter = {
      box: 'inbox',
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
