// axios.ts
//
// The one configured client. Two things happen in its interceptors that no
// screen has to think about:
//
//  - every request is guaranteed a session, anonymous if there is no account
//    (spec §1) — reading, highlighting and AI all work signed out, and they
//    only work because the device row was registered before the first call;
//  - a 401 refreshes once, and if the refresh is refused the reader drops back
//    to a fresh anonymous session instead of being thrown onto /login mid-book.
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { ensureSession, resetSession } from '@/services/device-session';
import {
  API_BASE_URL,
  notifySessionLost,
  tokenStorage,
  type ApiErrorResponse,
  type AuthResponse,
  type AuthTokens,
  type User,
} from '@/utils/api-config';

// Re-exported so existing `from "@/utils/axios"` imports keep working; the
// definitions live in api-config so device-session can reach them too.
export {
  API_BASE_URL,
  tokenStorage,
  type ApiErrorResponse,
  type AuthResponse,
  type AuthTokens,
  type TokenPayload,
  type User,
} from '@/utils/api-config';

/**
 * Endpoints that establish a session. They must never wait on one, or the
 * bootstrap would be waiting on itself.
 */
const SESSION_ENDPOINTS = [
  '/auth/device',
  '/auth/login',
  '/auth/register',
  '/auth/refresh-tokens',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isSessionEndpoint = (url?: string) =>
  !!url && SESSION_ENDPOINTS.some((path) => url.includes(path));

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request — guarantee a session, then attach the token
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!tokenStorage.getAccessToken() && !isSessionEndpoint(config.url)) {
      try {
        await ensureSession();
      } catch {
        // Offline on first launch. Let the request go and fail on its own —
        // callers already fall back, and throwing here would turn a missing
        // network into a missing feature.
      }
    }
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response — refresh on 401, queue whatever else is in flight
// ---------------------------------------------------------------------------
let isRefreshing = false;
let refreshQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  refreshQueue = [];
};

/**
 * The refresh was refused, or there was nothing to refresh with. Any account
 * session is over — but the reader is mid-document, so they come back as a new
 * anonymous identity rather than being sent to a login screen they never asked
 * for. Their local library, highlights and notes are untouched either way.
 */
const fallBackToAnonymous = async (): Promise<string | null> => {
  notifySessionLost();
  try {
    await resetSession();
    return tokenStorage.getAccessToken();
  } catch {
    await tokenStorage.clearTokens();
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 402 is the quota wall and 403 a permission — neither is about the token.
    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isSessionEndpoint(originalRequest?.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // A refresh is already running — ride on its result.
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      let accessToken: string | null = null;

      if (refreshToken) {
        try {
          // Plain axios so this call skips the interceptors above.
          const { data } = await axios.post<AuthTokens>(`${API_BASE_URL}/auth/refresh-tokens`, {
            refreshToken,
          });
          tokenStorage.setTokens(data);
          accessToken = data.access.token;
        } catch {
          accessToken = await fallBackToAnonymous();
        }
      } else {
        accessToken = await fallBackToAnonymous();
      }

      if (!accessToken) {
        processQueue(error, null);
        return Promise.reject(error);
      }

      processQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Surfaces the backend's `{ code, message }` errors as something readable. */
export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return 'Something went wrong';
};

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------
export const authApi = {
  /**
   * The caller's own user, anonymous or not. How a launch that already had a
   * token learns `hasCompletedOnboarding` — `/auth/device` only answers on the
   * launch that mints the session.
   */
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),

  /**
   * Record the onboarding answer against whichever row this session belongs to.
   * Anonymous is the normal case: readers onboard before they have an account.
   */
  setOnboarding: (body: { hasCompletedOnboarding?: boolean; interests?: string[] }) =>
    api.patch<{ user: User }>('/auth/onboarding', body).then((r) => r.data.user),

  /**
   * Turns the anonymous row into an email account, in place (spec §1.2) —
   * `/auth/register` would create a *second* user and leave everything already
   * read, highlighted and saved behind on the first one.
   */
  linkEmail: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/link/email', body).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

  /** Signing up with no anonymous session to upgrade. */
  register: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

  /** Sign in with a Google id token; `linkGoogle` upgrades in place instead. */
  google: (idToken: string) =>
    api.post<AuthResponse>('/auth/google', { idToken }).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

  linkGoogle: (idToken: string) =>
    api.post<AuthResponse>('/auth/link/google', { idToken }).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

  logout: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
    await tokenStorage.clearTokens();
  },

  forgotPassword: (body: { email: string }) => api.post('/auth/forgot-password', body),

  resetPassword: (token: string, body: { password: string }) =>
    api.post(`/auth/reset-password?token=${encodeURIComponent(token)}`, body),

  sendVerificationEmail: () => api.post('/auth/send-verification-email'),

  verifyEmail: (token: string) => api.post(`/auth/verify-email?token=${encodeURIComponent(token)}`),
};

export const userApi = {
  getUsers: (params?: {
    name?: string;
    role?: string;
    sortBy?: string;
    limit?: number;
    page?: number;
  }) =>
    api.get<{
      results: User[];
      page: number;
      limit: number;
      totalPages: number;
      totalResults: number;
    }>('/users', { params }),

  getUser: (id: string) => api.get<User>(`/users/${id}`),

  createUser: (body: { name: string; email: string; password: string; role?: string }) =>
    api.post<User>('/users', body),

  updateUser: (id: string, body: Partial<{ name: string; email: string; password: string }>) =>
    api.patch<User>(`/users/${id}`, body),

  deleteUser: (id: string) => api.delete(`/users/${id}`),
};

export default api;
