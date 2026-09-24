# NRYN Finance — mobile

Expo dev build, Android. **Expo Go cannot run this** — reading SMS needs a
native module.

## See it in a browser first (no Android build)

```bash
npm install
npm run web          # opens http://localhost:8081
```

Everything renders except SMS reading — the ring, month switcher, category
chips, expense list, budgets and manual entry all work against the same
backend. Use this to check the UI before spending 20 minutes on an APK.

Two web-only notes: the token goes to `localStorage` instead of the keystore
(fine on your own machine, not secure storage), and `EXPO_PUBLIC_API_URL`
should be `http://localhost:4200` rather than the LAN IP.

## On a real phone

```bash
npm install
npx expo install --fix
npx expo prebuild --platform android
npx eas build --profile development --platform android    # or: npx expo run:android
npx expo start --dev-client -c
```

## `.env.local`

```
EXPO_PUBLIC_API_URL=http://192.168.1.5:4200   # YOUR LAN IP — never localhost
EXPO_PUBLIC_BACKFILL_DAYS=180
EXPO_PUBLIC_BATCH_SIZE=200
```

Expo caches env values. After editing this file you **must** restart with
`npx expo start -c`, or the old URL stays baked in and you'll chase a ghost.

## Structure

```
src/native/sms.filter.ts    THE PRIVACY BOUNDARY — four gates, runs before any fetch
src/native/sms.reader.ts    the only file that knows about the native SMS module
src/sync/sms.sync.ts        cursor, paging, batching, retry
src/sync/background.task.ts best-effort only — Android kills this, by design assume it never runs
src/components/             BudgetRing · MonthSwitcher · CategoryChip · ExpenseRow · PaceBanner
src/app/(tabs)/             Home · Category · (+) · Budget · Profile
```

## Test the filter after ANY change to it

```bash
npm run test:filter
```

Sixteen assertions that OTPs, promos and personal messages never leave the
device. This is the one suite worth running every single time.

## Swapping the SMS module

`sms.reader.ts` is the only file that touches `react-native-get-sms-android`.
If it fights you, replace it with a ~60-line local Expo module wrapping
`ContentResolver` on `content://sms/inbox` — the interface stays identical and
nothing else changes.
