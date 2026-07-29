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

export {
  API_BASE_URL,
  tokenStorage,
  type ApiErrorResponse,
  type AuthResponse,
  type AuthTokens,
  type TokenPayload,
  type User,
} from '@/utils/api-config';

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

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!tokenStorage.getAccessToken() && !isSessionEndpoint(config.url)) {
      try {
        await ensureSession();
      } catch {}
    }
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isSessionEndpoint(originalRequest?.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

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

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return 'Something went wrong';
};

export const authApi = {
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),

  setOnboarding: (body: { hasCompletedOnboarding?: boolean; interests?: string[] }) =>
    api.patch<{ user: User }>('/auth/onboarding', body).then((r) => r.data.user),

  linkEmail: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/link/email', body).then((r) => {
      tokenStorage.setTokens(r.data.tokens);
      return r.data;
    }),

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
