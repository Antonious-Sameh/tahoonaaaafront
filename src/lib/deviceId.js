// Persistent, client-generated identifier for THIS device/browser — matches
// the backend's device-limit design exactly (see the backend's
// src/services/README.md, "auth.service.js"). Deliberately NOT derived from
// IP or User-Agent (both change too often to reliably mean "the same
// device"); generated once with crypto.randomUUID() and reused forever
// after, so this browser keeps counting as the same one of the shop's two
// allowed device slots across sessions.

const DEVICE_ID_KEY = 'system1_device_id';

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (e.g. some private-browsing configurations) —
    // fall back to a session-only id; this device just won't be remembered
    // as "already registered" on the next visit, which only means an extra
    // login, not a hard failure.
    return crypto.randomUUID();
  }
}

export default getDeviceId;
