import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// PWA icon design: see public/icons/ (generated from a single source SVG,
// see FRONTEND_INTEGRATION.md's "PWA" section for the full rationale).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // GenerateSW (the default strategy) builds the service worker from
      // this config — no hand-written service worker file to maintain,
      // and Workbox's precache manifest is what makes updates detect
      // correctly (a new build's file hashes differ, so the SW knows
      // there's something new — see registerType below).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'نظام إدارة المحل',
        short_name: 'إدارة المحل',
        description: 'نظام إدارة محل قطع غيار السيارات — المبيعات والمشتريات والمخزون والتقارير',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // Matches the app's actual initial paint (the dark login/loading
        // screen) so standalone launch has no white flash before the app
        // shell mounts — see App.jsx's RequireAuth loading state and
        // LoginPage.jsx, both bg-slate-950.
        background_color: '#020617',
        // Matches the authenticated app shell's persistent white header
        // bar (AppLayout.jsx) — where most real usage time is spent.
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell (hashed JS/CSS + icons) for instant
        // repeat loads — this is pure performance, not offline-first: the
        // app still needs the network for every real piece of data.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        // Never let a navigation to an API-shaped path fall back to the
        // cached shell — not that any should occur, but this keeps the
        // intent explicit rather than relying on the exclusion below alone.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // API calls are NEVER cached — always hit the network fresh.
            // This is the one non-negotiable rule: financial data,
            // authenticated responses, and anything from this project's
            // backend must never be served stale or from cache.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // The Arabic UI font (Cairo) is loaded from Google Fonts (see
            // index.css) — its stylesheet rarely changes, so serve it fast
            // from cache and revalidate in the background.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // The actual font files are immutable (content-versioned by
            // URL) — safe to cache aggressively and long-term.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // No service worker during local development — avoids caching/HMR
        // surprises while actively developing; the built-and-served
        // production bundle is what actually needs this tested (see
        // `npm run build && npm run start`).
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // هنا @ بتمثل src
    },
  },
});
