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

export function deviceId(): Promise<string> {
  return DeviceInfo.getUniqueId();
}

function platform(): "ios" | "android" | "web" {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "web";
}

function locale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

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

let inFlight: Promise<void> | null = null;

export function ensureSession(): Promise<void> {
  if (tokenStorage.getAccessToken()) return Promise.resolve();
  if (!inFlight) {
    inFlight = register().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function resetSession(): Promise<void> {
  await tokenStorage.clearTokens();
  inFlight = null;
  return ensureSession();
}
