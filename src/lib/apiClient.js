import { API_BASE_URL } from '@/config';
import { getDeviceId } from './deviceId';

// The short-lived access token lives in memory only (never localStorage) —
// it's gone on a full page reload by design, which is exactly what the
// silent-refresh-on-boot flow in AuthContext is for. The longer-lived
// refresh token DOES need to survive a reload, so it's the one persisted.
const REFRESH_TOKEN_KEY = 'system1_refresh_token';

let accessToken = null;
let refreshPromise = null; // de-dupes concurrent refresh attempts into one request

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token) {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage unavailable — the session just won't survive a reload.
  }
}

/** Clears everything client-side (used on logout and on an unrecoverable auth failure). */
export function clearSession() {
  setAccessToken(null);
  setStoredRefreshToken(null);
}

async function doRefresh() {
  const refreshToken = getStoredRefreshToken();
  const deviceId = getDeviceId();
  if (!refreshToken) throw new ApiError('لا توجد جلسة دخول', 401);

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, deviceId }),
  });
  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    clearSession();
    throw new ApiError(payload?.error?.message || 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى', res.status, payload?.error?.details);
  }

  setAccessToken(payload.data.accessToken);
  setStoredRefreshToken(payload.data.refreshToken); // rotated on every use — see backend design
  return payload.data.accessToken;
}

/** Exported so AuthContext can drive the silent-login-on-boot flow with it directly. */
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(method, path, { body, auth = true, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);

  // Access token expired mid-session (not a login/refresh failure itself,
  // since those pass auth:false) — refresh once and retry the original
  // request; `retry: false` on the retry prevents an infinite loop if the
  // refresh token itself has also gone bad.
  if (res.status === 401 && auth && retry) {
    await refreshAccessToken();
    return request(method, path, { body, auth, retry: false });
  }

  if (!res.ok || !payload?.success) {
    throw new ApiError(payload?.error?.message || 'حدث خطأ غير متوقع', res.status, payload?.error?.details);
  }

  return payload; // { success: true, data, pagination? }
}

export const apiGet = (path, opts) => request('GET', path, opts);
export const apiPost = (path, body, opts) => request('POST', path, { ...opts, body });
export const apiPatch = (path, body, opts) => request('PATCH', path, { ...opts, body });
export const apiDelete = (path, opts) => request('DELETE', path, opts);

/** Builds `path?a=1&b=2`, skipping undefined/null/empty-string values — for GET list endpoints. */
export function withQuery(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
