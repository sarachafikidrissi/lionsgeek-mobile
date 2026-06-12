# Voice calls in EAS Build (iOS & Android)

For **calls to work** in builds from EAS (production/preview), do the following.

## 1. EAS Secrets (required)

EAS Build runs in the cloud and **does not use your local `.env`**. Set these secrets so the built app gets the right config:

| Secret name | Description | Your value |
|-------------|-------------|------------|
| `EXPO_PUBLIC_APP_URL` | Your API base URL | `https://mylionsgeek.ma` |
| `EXPO_PUBLIC_AGORA_APP_ID` | Agora App ID (same as Laravel backend) | `691bdcfa6cdf445da548e421725f4b53` |

**Set them via CLI (copy-paste from your `.env`):**

```bash
eas secret:create --name EXPO_PUBLIC_APP_URL --value "https://mylionsgeek.ma" --scope project
eas secret:create --name EXPO_PUBLIC_AGORA_APP_ID --value "691bdcfa6cdf445da548e421725f4b53" --scope project
```

Or in [Expo dashboard](https://expo.dev) → your project → **Secrets**.

Then run a **new build** (secrets apply to builds started after they are set):

```bash
eas build --platform all --profile production
```

## 2. Permissions (already added)

- **Android**: `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` are in `app.json` so the app can use the microphone and speaker.
- **iOS**: `NSMicrophoneUsageDescription` is in `app.json` so the system can show the microphone permission prompt.

No extra steps needed if you have the latest `app.json`.

## 3. Backend

- Laravel API must be reachable at `EXPO_PUBLIC_APP_URL` (HTTPS in production).
- Laravel `.env` must have `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` set for token generation.

## 4. If calls still don’t work

- Confirm the two EAS secrets are set and **rebuild** the app.
- On first call, allow **microphone** when the system prompts.
- Check device/network: backend and Ably must be reachable; Agora needs internet.
