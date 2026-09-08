import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as settingsApi from '@/services/api/settings';

const SettingsContext = createContext(null);

/**
 * Fetches shop settings once for the whole authenticated app (mounted
 * inside the RequireAuth-protected route tree — settings genuinely require
 * auth, and there's nothing useful to show before login anyway) rather than
 * having every page that needs shop info (AppLayout's header, the invoice
 * preview on POS/Sales/Purchases history, the print header on Reports, the
 * Settings page itself) fetch it independently. `reload()` is called after
 * a successful save on the Settings page so every other consumer picks up
 * the change immediately, without needing its own refetch logic.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return settingsApi.getSettings()
      .then((res) => setSettings(res.data))
      .catch(() => {
        // Consumers render sensible fallbacks (e.g. empty shop name) when
        // settings is still null — a failure here shouldn't block the app.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

export default SettingsContext;
