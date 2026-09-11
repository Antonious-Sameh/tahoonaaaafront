import React from 'react';
import ReactDOM from 'react-dom/client';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App';
import '@/index.css';


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
