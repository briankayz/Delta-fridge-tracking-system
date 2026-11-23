# Delta Asset Guard · Field app

Expo (React Native) app for Delta field staff. Built for people who are not technical: plain words,
one big status per screen, large buttons, light high-contrast theme for outdoor use.

| Tab | Who sees it | What it does |
|---|---|---|
| **Respond** | Asset Protection, area managers, ops leads, technicians | Open alerts nearest first → directions → call the store → one tap: *Cooler recovered*, *Found it here*, *It was an approved move*, *Can't find it* |
| **Install** | Technicians, ops leads, admins | 3 steps: scan/type the beacon ID → pick the store (nearest first) → pick a fence size → "This cooler is now protected" |
| **Check** | Everyone | Scan/type a beacon ID → *Protected*, *Moved*, *Unplugged*, *Not reporting* or *Not installed yet* |
| **More** | Everyone | Account, reports waiting to send, sign out. **Demo mode** (demo servers only): use this phone as the beacon of a cooler it installed, with *Simulate theft* and an *Advanced* sensor view |

## Run

```bash
npm install
npx expo start            # scan the QR with Expo Go (same Wi-Fi as the backend)
npx expo start --web      # browser version (add its origin to backend CORS_ORIGINS)
```

The app finds the backend automatically (the laptop running Expo, port 8787). Override with
`EXPO_PUBLIC_API_URL=http://<ip>:8787`, or tap **Change server** on the sign-in screen.

## How it works with the platform

- Sign-in uses the same accounts and roles as the web dashboard; the session token is kept in the
  device's secure storage (Keychain / Android Keystore).
- Installing a beacon calls `POST /api/v1/assets/:id/provision`, which issues a per-beacon device
  credential. In demo mode this phone can then send telemetry as that beacon.
- Field reports go to `POST /api/v1/incidents/:id/field-update`. With no signal they are saved on the
  phone and sent automatically when the connection returns.
- All text is in `src/i18n.ts`, ready for Shona/Ndebele translations.

## Honest limits

- A phone cannot measure a fridge's mains voltage or cabinet temperature. In demo beacon mode those
  values are simulated and labelled as such; production beacons are dedicated in-fridge devices.
- The Respond list refreshes every 15 s (pull down to refresh). Push notifications need a
  production build with Expo push or FCM credentials.
