import axios from 'axios';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_BASE_URL, tokenStorage, type AuthResponse } from '@/utils/api-config';

const DEVICE_ID_KEY = 'deviceId';

export function deviceId(): string {
  const existing = SecureStore.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const minted = Crypto.randomUUID();
  SecureStore.setItem(DEVICE_ID_KEY, minted);
  return minted;
}

function platform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

function locale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

async function register(): Promise<void> {
  const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/device`, {
    appVersion: Constants.expoConfig?.version,
    deviceId: deviceId(),
    locale: locale(),
    model: Device.modelName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    platform: platform(),
  });
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
