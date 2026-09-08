import React from 'react';
import ReactDOM from 'react-dom/client';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App';
import '@/index.css';

// PWA update flow — deliberately NOT auto-updating (registerType: 'prompt'
// in vite.config.js). A new service worker installs in the background and
// waits; the person is shown a dismissible toast and update happens only
// when they explicitly confirm, which then reloads the page. This matters
// for a business app doing financial transactions (a sale mid-checkout
// shouldn't have its code silently swapped underneath it). Every new
// deployment produces a new set of content-hashed asset filenames, so the
// service worker always detects real updates correctly — no manual cache
// versioning to maintain, no risk of a stale build sticking around
// indefinitely.
const updateSW = registerSW({
  onNeedRefresh() {
    toast('يتوفر تحديث جديد للنظام', {
      id: 'pwa-update-available',
      duration: Infinity,
      action: { label: 'تحديث الآن', onClick: () => updateSW(true) },
      cancel: { label: 'لاحقاً', onClick: () => {} },
    });
  },
  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);
