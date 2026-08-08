/**
 * The anonymous session every install starts with.
 *
 * `POST /auth/device` mints a real user row, so highlights, vocabulary and the
 * AI allowance exist before there is an account and survive signing in without
 * a migration step (spec §1). Nothing in the reader is gated on having called
 * it — but every authenticated endpoint is, so the axios interceptors run this
 * before the first request rather than leaving it to each screen to remember.
 *
 * The minted user is deliberately *not* put in the auth store: `user !== null`
 * there means "has an account", which is what raises the sign-in wall. An
 * anonymous row is an identity, not an account.
 */
import axios from "axios";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

import {
  API_BASE_URL,
  tokenStorage,
  type AuthResponse,
} from "@/utils/api-config";

/**
 * The id this install is known by — not security-bearing: it names the
 * device, it doesn't authenticate it. Backed by react-native-device-info's
 * getUniqueId(), which on Android is ANDROID_ID-based and on iOS is
 * identifierForVendor (Keychain-backed fallback), rather than a value we mint
 * ourselves — so it survives reinstalls instead of resetting on every one.
 */
export function deviceId(): Promise<string> {
  return DeviceInfo.getUniqueId();
}

/** The backend accepts these three; anything else (macos, windows) reads as web. */
function platform(): "ios" | "android" | "web" {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "web";
}

function locale(): string | undefined {
  try {
    // Hermes ships Intl; guarded because a build without it would throw here
    // and take the whole bootstrap — and the session — down with it.
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/** Bare axios: this call is what the interceptors are waiting on. */
async function register(): Promise<void> {
  const { data } = await axios.post<AuthResponse>(
    `${API_BASE_URL}/auth/device`,
    {
      appVersion: Constants.expoConfig?.version,
      deviceId: await deviceId(),
      locale: locale(),
      model: Device.modelName ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      platform: platform(),
    },
  );
  tokenStorage.setTokens(data.tokens);
}

/** Shared so a burst of parallel requests provisions one session, not five. */
let inFlight: Promise<void> | null = null;

/**
 * Resolves once there is a usable access token. A no-op when one is already
 * stored, which is every launch after the first.
 */
export function ensureSession(): Promise<void> {
  if (tokenStorage.getAccessToken()) return Promise.resolve();
  if (!inFlight) {
    inFlight = register().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Provisions a *new* anonymous session, discarding whatever is stored. Used
 * when a refresh has failed: the reader is signed out either way, and coming
 * back as a fresh anonymous identity keeps them reading instead of stranding
 * them on the login screen.
 */
export async function resetSession(): Promise<void> {
  await tokenStorage.clearTokens();
  inFlight = null;
  return ensureSession();
}
