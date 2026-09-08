import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  apiGet, apiPost, apiPatch, apiDelete,
  setAccessToken, getStoredRefreshToken, setStoredRefreshToken, refreshAccessToken, clearSession,
} from '@/lib/apiClient';
import { getDeviceId } from '@/lib/deviceId';

const AuthContext = createContext(null);

/**
 * Real, JWT-backed authentication — replaces ShopContext's old mock
 * accessCode comparison. On mount, if a refresh token was saved from a
 * previous visit, it silently exchanges it for a fresh access token instead
 * of forcing the shop password to be re-entered every page load; if that
 * fails (expired, or the device was revoked from Settings on another
 * device), the person just sees the login screen.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'guest'
  const [device, setDevice] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      if (!getStoredRefreshToken()) {
        setStatus('guest');
        return;
      }
      try {
        await refreshAccessToken();
        if (mountedRef.current) setStatus('authed');
      } catch {
        if (mountedRef.current) setStatus('guest');
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(async (password, deviceLabel) => {
    const deviceId = getDeviceId();
    const res = await apiPost('/auth/login', { password, deviceId, deviceLabel }, { auth: false });
    setAccessToken(res.data.accessToken);
    setStoredRefreshToken(res.data.refreshToken);
    setDevice(res.data.device);
    setStatus('authed');
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Best-effort — even if the network call fails, still clear the
      // local session so the person isn't stuck "logged in" on this device.
    }
    clearSession();
    setDevice(null);
    setStatus('guest');
  }, []);

  /** Requires the current password; on success every OTHER device is signed out server-side. */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await apiPatch('/auth/password', { currentPassword, newPassword });
  }, []);

  const listDevices = useCallback(async () => {
    const res = await apiGet('/auth/devices');
    return res.data;
  }, []);

  /** Frees up a device slot — see the backend's device-limit design (max 2 registered at once). */
  const revokeDevice = useCallback(async (id) => {
    await apiDelete(`/auth/devices/${id}`);
  }, []);

  const value = useMemo(() => ({
    status,
    isAuthed: status === 'authed',
    isChecking: status === 'checking',
    device,
    login,
    logout,
    changePassword,
    listDevices,
    revokeDevice,
  }), [status, device, login, logout, changePassword, listDevices, revokeDevice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
