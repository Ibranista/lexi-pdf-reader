/**
 * Where the API lives, what its auth payloads look like, and where tokens are
 * kept.
 *
 * Split out of `axios.ts` so the anonymous-session bootstrap can read and write
 * tokens without importing the configured client — that client has to call the
 * bootstrap from its own interceptors, and the two importing each other is a
 * cycle Metro resolves by handing one of them a half-built module.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * In development the bundle is served by Metro from the dev machine, and the
 * device already knows that machine's address — it's the host it pulled the
 * bundle from (`hostUri`, e.g. "192.168.0.186:8081"). Reusing it for the API
 * means the base URL tracks the machine's current LAN IP on its own, so it
 * never goes stale when the network (and therefore the IP) changes. Hardcoding
 * an address in `.env` is exactly what broke suggestions and chat before: the
 * IP moved and every request went to a host that no longer existed.
 */
function devApiBaseUrl(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Expo Go / older field names, kept as a fallback.
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)?.extra
      ?.expoGo?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:3000/v1` : undefined;
}

// An explicit EXPO_PUBLIC_API_URL always wins (that's how production points at
// a real domain). With none set — the dev default — track the Metro host, and
// only fall back to localhost when even that is unavailable.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? devApiBaseUrl() ?? 'http://localhost:3000/v1';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// ---------------------------------------------------------------------------
// Types (match the backend's auth responses)
// ---------------------------------------------------------------------------
export interface TokenPayload {
  token: string;
  expires: string;
}

export interface AuthTokens {
  access: TokenPayload;
  refresh: TokenPayload;
}

export interface User {
  /** A uuid — `User.id` is `String @id @default(uuid())` server-side. */
  id: string;
  /** Null for an anonymous row; the API renders it as "". */
  email: string;
  name: string;
  /** Stored lowercase, but `serializeUser` uppercases it on the way out. */
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
  /**
   * True for the row `/auth/device` mints. Such a user is a real, syncing
   * identity but not an account, so the app still treats it as signed out.
   */
  isAnonymous?: boolean;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

/** Shape produced by the backend's error middleware (ApiError). */
export interface ApiErrorResponse {
  code: number;
  message: string;
  /** Stable machine field the client branches on, e.g. `AI_QUOTA_EXHAUSTED`. */
  reason?: string;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Token storage (expo-secure-store)
// ---------------------------------------------------------------------------
/**
 * Told when a stored account session turns out to be dead — a refresh the
 * server refused. The auth store registers itself here rather than the client
 * importing the store, which would close a cycle: the store calls `authApi`.
 */
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
