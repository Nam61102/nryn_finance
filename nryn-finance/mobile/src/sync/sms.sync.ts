import { getItem, setItem } from '../services/storage';
import { api } from '../services/api';
import { listInbox, hasPermission, isSupported } from '../native/sms.reader';
import { filterTransactional, type RawSms } from '../native/sms.filter';

const DEVICE_KEY = 'nryn_finance_device_id';
const BATCH = Number(process.env.EXPO_PUBLIC_BATCH_SIZE || 200);
const BACKFILL_DAYS = Number(process.env.EXPO_PUBLIC_BACKFILL_DAYS || 180);

export async function getDeviceId(): Promise<string> {
  let id = await getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await setItem(DEVICE_KEY, id);
  }
  return id;
}

export type SyncProgress = {
  phase: 'idle' | 'reading' | 'uploading' | 'done' | 'error';
  read: number;
  kept: number;
  uploaded: number;
  duplicates: number;
  rejected: Record<string, number>;
  error?: string;
};

type Opts = {
  onProgress?: (p: SyncProgress) => void;
  full?: boolean;              // true = first-run backfill
};

/**
 * Cursor-based catch-up (§3.2).
 *
 * The cursor advances ONLY after the server acknowledges a batch. If the app
 * is killed, the network drops or the backend restarts mid-sync, the next run
 * re-reads from the last acknowledged point and nothing is lost.
 *
 * Designed as if "sync on app open" were the only trigger, because on Android
 * it effectively is — Xiaomi, OnePlus and Samsung all kill background work.
 */
export async function syncSms(opts: Opts = {}): Promise<SyncProgress> {
  const progress: SyncProgress = { phase: 'idle', read: 0, kept: 0, uploaded: 0, duplicates: 0, rejected: {} };
  const emit = () => opts.onProgress?.({ ...progress });

  if (!isSupported() || !(await hasPermission())) {
    progress.phase = 'error';
    progress.error = 'SMS reading is Android-only — this platform has no inbox access';
    emit();
    return progress;
  }

  const deviceId = await getDeviceId();

  // Ask the server where we were, rather than trusting local state.
  let cursor = 0;
  try {
    const res = await api.get<{ cursor: number }>(`/ingest/cursor?deviceId=${deviceId}`);
    cursor = res.cursor || 0;
  } catch { /* first run */ }

  if (opts.full || !cursor) {
    cursor = Date.now() - BACKFILL_DAYS * 864e5;
  }

  progress.phase = 'reading';
  emit();

  let indexFrom = 0;
  let pending: RawSms[] = [];
  try {
    // Read the inbox in pages, checkpointing after every upload.
    const maxScan = opts.full ? 3000 : 1000;
    while (progress.read < maxScan) {
      const queryOpts: any = { indexFrom, maxCount: 500 };
      if (!opts.full && cursor > 0) {
        queryOpts.minDate = cursor + 1;
      }
      const page = await listInbox(queryOpts);
      if (!page.length) break;

      progress.read += page.length;
      const { kept, rejected } = filterTransactional(page);
      progress.kept += kept.length;
      for (const [k, v] of Object.entries(rejected)) progress.rejected[k] = (progress.rejected[k] || 0) + v;
      pending.push(...kept);
      emit();

      while (pending.length >= BATCH) {
        await upload(pending.splice(0, BATCH), deviceId, progress, emit);
      }

      if (page.length < 500) break;
      indexFrom += page.length;
    }

    if (pending.length) await upload(pending, deviceId, progress, emit);

    progress.phase = 'done';
    emit();
  } catch (err: any) {
    progress.phase = 'error';
    progress.error = err?.message || String(err);
    emit();
  }

  return progress;
}

async function upload(batch: RawSms[], deviceId: string, progress: SyncProgress, emit: () => void) {
  progress.phase = 'uploading';
  emit();
  const res = await api.post<{ accepted: number; duplicates: number; cursor: number }>('/ingest/sms', {
    deviceId,
    messages: batch.map((m) => ({ smsId: m._id, sender: m.address, body: m.body, receivedAt: m.date })),
  });
  progress.uploaded += res.accepted;
  progress.duplicates += res.duplicates;
  progress.phase = 'reading';
  emit();
}

export async function markBackfillDone() {
  const deviceId = await getDeviceId();
  await api.post('/ingest/backfill-done', { deviceId }).catch(() => {});
}
