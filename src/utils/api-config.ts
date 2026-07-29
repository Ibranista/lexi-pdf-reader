import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

function devApiBaseUrl(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)?.extra
      ?.expoGo?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:3000/v1` : undefined;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? devApiBaseUrl() ?? 'http://localhost:3000/v1';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export interface TokenPayload {
  token: string;
  expires: string;
}

export interface AuthTokens {
  access: TokenPayload;
  refresh: TokenPayload;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
  isAnonymous?: boolean;
  hasCompletedOnboarding?: boolean;
  interests?: string[];
  onboardedAt?: number | null;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ApiErrorResponse {
  code: number;
  message: string;
  reason?: string;
  stack?: string;
}

let sessionLostHandler: (() => void) | null = null;

export function onSessionLost(handler: () => void): void {
  sessionLostHandler = handler;
}

export function notifySessionLost(): void {
  sessionLostHandler?.();
}

export const tokenStorage = {
  getAccessToken: () => SecureStore.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStore.getItem(REFRESH_TOKEN_KEY),
  setTokens: (tokens: AuthTokens) => {
    SecureStore.setItem(ACCESS_TOKEN_KEY, tokens.access.token);
    SecureStore.setItem(REFRESH_TOKEN_KEY, tokens.refresh.token);
  },
  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
