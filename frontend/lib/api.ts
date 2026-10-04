import {
  ApiResponse,
  AuthResponseData,
  User,
  UserRole,
  DashboardStats,
  AdminApplicationItem,
  AdminApplicationDetail,
  AdminUserItem,
  AdminUserDetail,
  AuditLogItem,
  AdminSettings,
} from '@/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000';

const TOKEN_KEY = 'visa_access_token';
const REFRESH_TOKEN_KEY = 'visa_refresh_token';
const USER_KEY = 'visa_user';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export type AuthStateListener = (user: User | null) => void;
const authListeners = new Set<AuthStateListener>();

export function subscribeAuthChange(listener: AuthStateListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function notifyAuthChange(user: User | null): void {
  authListeners.forEach((fn) => {
    try {
      fn(user);
    } catch {
      // Ignore listener errors
    }
  });
}

export function setCachedUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChange(user);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChange(null);
}

// In-flight refresh promise singleton to prevent duplicate concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  // If a refresh is already in-flight, reuse the same promise
  if (refreshPromise) {
    return refreshPromise;
  }

  const storedRefreshToken = getRefreshToken();
  if (!storedRefreshToken) {
    clearTokens();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData?.data?.accessToken;
        const newRefreshToken = refreshData?.data?.refreshToken;
        if (newAccessToken) {
          setTokens(newAccessToken, newRefreshToken);
          return newAccessToken;
        }
      }

      // If the refresh token was explicitly rejected as invalid, expired, or revoked (401 or 403)
      if (refreshRes.status === 401 || refreshRes.status === 403) {
        clearTokens();
        return null;
      }

      // If server returned 500 or temporary error, DO NOT clear tokens.
      return null;
    } catch {
      // Temporary network error or server unreachable: DO NOT clear tokens!
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  isRetry?: boolean;
  timeoutMs?: number;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { requiresAuth = true, isRetry = false, headers = {}, timeoutMs = 30000, signal, ...customConfig } = options;

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = !signal && typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller && timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const effectiveSignal = signal || controller?.signal;

  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      signal: effectiveSignal,
      ...customConfig,
    });

    if (timeoutId) clearTimeout(timeoutId);

    // 401 handling: Short-lived access token expired, attempt refresh once
    if (response.status === 401 && requiresAuth && !isRetry) {
      const newAccessToken = await refreshSession();
      if (newAccessToken) {
        // Retry original request once with new access token
        return await request<T>(endpoint, {
          ...options,
          isRetry: true,
        });
      }
      // If refresh failed because refresh token was rejected, clearTokens() has already been invoked.
      // If refresh failed due to temporary network error, tokens were not cleared.
    }

    // Handle non-2xx responses (including 403 Forbidden which MUST NOT clear the session)
    if (!response.ok) {
      let errorMessage = 'An unexpected error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (response.status === 401) {
          errorMessage = 'Your session has expired. Please sign in again.';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (response.status === 409) {
          errorMessage = 'Conflict occurred with the existing record.';
        } else if (response.status === 422) {
          errorMessage = 'Validation failed. Please verify the input data.';
        } else if (response.status >= 500) {
          errorMessage = 'Internal server error. Please try again later.';
        }
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    if (err.name === 'TypeError' && err.message?.includes('fetch')) {
      throw new Error('Visa Autofill server is unavailable.');
    }
    if (err.message?.includes('P1001') || err.message?.includes('ETIMEDOUT')) {
      throw new Error('Unable to load this data. Please try again.');
    }
    throw err;
  }
}

// ==========================================
// Authentication APIs
// ==========================================

// In-flight getCurrentUser promise singleton to prevent duplicate /api/auth/me requests
let currentUserPromise: Promise<User | null> | null = null;

export async function getCurrentUser(timeoutMs: number = 8000): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;

  if (currentUserPromise) {
    return currentUserPromise;
  }

  currentUserPromise = (async () => {
    try {
      const res = await request<{ user: User }>('/api/auth/me', {
        timeoutMs,
      });
      if (res.data?.user) {
        setCachedUser(res.data.user);
        return res.data.user;
      }
      return getCachedUser();
    } catch {
      // If tokens were cleared due to invalid/expired session
      if (!getAccessToken()) {
        return null;
      }
      // For network timeout or temporary error, preserve session via cached user
      return getCachedUser();
    } finally {
      currentUserPromise = null;
    }
  })();

  return currentUserPromise;
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthResponseData> {
  const res = await request<AuthResponseData>('/api/auth/login', {
    method: 'POST',
    requiresAuth: false,
    body: JSON.stringify({ email, password }),
  });

  if (!res.data) {
    throw new Error(res.message || 'Login failed');
  }

  const { tokens, token, user } = res.data;
  const accessToken = tokens?.accessToken || token;
  const refreshToken = tokens?.refreshToken;

  if (accessToken) {
    setTokens(accessToken, refreshToken);
  }
  if (user) {
    setCachedUser(user);
  }

  return res.data;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await request('/api/auth/logout', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Ignore server error on logout
  } finally {
    clearTokens();
  }
}

// ==========================================
// Admin Dashboard & Application APIs
// ==========================================

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await request<DashboardStats>('/api/admin/dashboard/stats');
  if (!res.data) {
    throw new Error(res.message || 'Failed to fetch dashboard statistics');
  }
  return res.data;
}

export async function getAdminApplications(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  userId?: string;
} = {}): Promise<{
  data: AdminApplicationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.userId) query.set('userId', params.userId);

  const endpoint = `/api/admin/applications${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await request<AdminApplicationItem[]>(endpoint);

  return {
    data: res.data || [],
    page: res.page || 1,
    limit: res.limit || 15,
    total: res.total || 0,
    totalPages: res.totalPages || 1,
  };
}

export async function getAdminApplication(id: string): Promise<AdminApplicationDetail> {
  const res = await request<AdminApplicationDetail>(`/api/admin/applications/${id}`);
  if (!res.data) {
    throw new Error('Application details not found');
  }
  return res.data;
}

export async function deleteAdminApplication(id: string): Promise<void> {
  await request(`/api/admin/applications/${id}`, {
    method: 'DELETE',
  });
}

export async function downloadApplicationPdf(
  id: string,
  fallbackFileName?: string
): Promise<void> {
  let token = getAccessToken();
  const url = `${API_BASE_URL}/api/admin/applications/${id}/pdf`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new Error('Unable to connect to Visa Autofill server.');
  }

  // Handle token refresh on 401
  if (response.status === 401) {
    const newAccessToken = await refreshSession();
    if (newAccessToken) {
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      try {
        response = await fetch(url, { headers });
      } catch {
        throw new Error('Unable to connect to Visa Autofill server.');
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to download this PDF.');
    }
    if (response.status === 404) {
      throw new Error('Original PDF not found for this application.');
    }
    if (response.status >= 500) {
      throw new Error('Internal server error while streaming PDF. Please try again.');
    }
    throw new Error('Failed to download PDF.');
  }

  let fileName = fallbackFileName || `application_${id}.pdf`;
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      fileName = match[1].replace(/['"]/g, '');
      try {
        fileName = decodeURIComponent(fileName);
      } catch {
        // fallback
      }
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

// ==========================================
// Admin User Management APIs
// ==========================================

export async function getAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
} = {}): Promise<{
  data: AdminUserItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);

  const endpoint = `/api/admin/users${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await request<AdminUserItem[]>(endpoint);

  return {
    data: res.data || [],
    page: res.page || 1,
    limit: res.limit || 15,
    total: res.total || 0,
    totalPages: res.totalPages || 1,
  };
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await request<AdminUserDetail>(`/api/admin/users/${id}`);
  if (!res.data) {
    throw new Error('User details not found');
  }
  return res.data;
}

export async function updateUserRole(id: string, role: UserRole): Promise<User> {
  const res = await request<User>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.data) {
    throw new Error(res.message || 'Failed to update user role');
  }
  return res.data;
}

export async function updateUserStatus(id: string, isActive: boolean): Promise<User> {
  const res = await request<User>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
  if (!res.data) {
    throw new Error(res.message || 'Failed to update user status');
  }
  return res.data;
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
}): Promise<User> {
  const res = await request<User>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.data) {
    throw new Error(res.message || 'Failed to create user');
  }
  return res.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await request(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  await request(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password, newPassword: password }),
  });
}

export const resetUserPassword = setUserPassword;

export async function changeOwnPassword(data: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==========================================
// Admin Audit Logs & Settings
// ==========================================

export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  action?: string;
} = {}): Promise<{
  data: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.action) query.set('action', params.action);

  const endpoint = `/api/admin/audit-logs${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await request<AuditLogItem[]>(endpoint);

  return {
    data: res.data || [],
    page: res.page || 1,
    limit: res.limit || 20,
    total: res.total || 0,
    totalPages: res.totalPages || 1,
  };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const res = await request<AdminSettings>('/api/admin/settings');
  if (!res.data) {
    throw new Error(res.message || 'Failed to fetch settings');
  }
  return res.data;
}
