// axios.ts
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router, type Href } from 'expo-router';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// NOTE: on an Android emulator "localhost" points at the emulator itself —
// use http://10.0.2.2:3000/v1, or your machine's LAN IP on a physical device.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// ---------------------------------------------------------------------------
// Types (match your backend responses)
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
  id: number;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Shape produced by your error middleware (ApiError)
export interface ApiErrorResponse {
  code: number;
  message: string;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Token storage helpers (expo-secure-store)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — auto-refresh on 401, queue concurrent requests
// ---------------------------------------------------------------------------
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  refreshQueue = [];
};

const onAuthFailure = async () => {
  await tokenStorage.clearTokens();
  // Adjust to whatever your login route ends up being.
  // Cast needed until a /login route actually exists (expo-router typed routes).
  router.replace('/login' as Href);
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh-tokens');

    // Only try refresh on 401s from non-auth endpoints, once per request
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        await onAuthFailure();
        return Promise.reject(error);
      }

      // If a refresh is already in flight, wait for it
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Plain axios (not `api`) so this call skips the interceptors
        const { data } = await axios.post<AuthTokens>(`${BASE_URL}/auth/refresh-tokens`, {
          refreshToken,
        });

        tokenStorage.setTokens(data);
        processQueue(null, data.access.token);

        originalRequest.headers.Authorization = `Bearer ${data.access.token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await onAuthFailure();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Helper to surface your backend's { code, message } errors nicely
// ---------------------------------------------------------------------------
export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return 'Something went wrong';
};

// ---------------------------------------------------------------------------
// Ready-made API calls matching your routes
// ---------------------------------------------------------------------------
export const authApi = {
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
  getUsers: (params?: { name?: string; role?: string; sortBy?: string; limit?: number; page?: number }) =>
    api.get<{ results: User[]; page: number; limit: number; totalPages: number; totalResults: number }>('/users', { params }),

  getUser: (id: number) => api.get<User>(`/users/${id}`),

  createUser: (body: { name: string; email: string; password: string; role?: string }) =>
    api.post<User>('/users', body),

  updateUser: (id: number, body: Partial<{ name: string; email: string; password: string }>) =>
    api.patch<User>(`/users/${id}`, body),

  deleteUser: (id: number) => api.delete(`/users/${id}`),
};

export default api;
