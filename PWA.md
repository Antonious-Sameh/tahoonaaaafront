# PWA Implementation Notes

This project is an installable, production-ready PWA on top of the existing
React/Vite app — no architecture changes, no offline-first behavior (this
system is online-only by design; caching here is purely for load speed).

## What's cached, and what never is

- **Precached (for instant repeat loads):** the built app shell — hashed
  JS/CSS bundles, `index.html`, and the icon files. Pure performance; the
  app still needs the network for every real screen.
- **Runtime-cached:** Google Fonts (the Cairo font used throughout —
  `StaleWhileRevalidate` for the stylesheet, long-lived `CacheFirst` for the
  actual font files, since those are immutable/content-versioned).
- **NEVER cached, by explicit rule:** anything under `/api/` —
  `NetworkOnly`, always. This is the one non-negotiable rule: no
  authenticated response, no financial data, nothing from the backend is
  ever served stale or from cache. See `vite.config.js`'s `workbox.runtimeCaching`.

## Updates — no stuck-on-old-version risk

`registerType: 'prompt'` (not `autoUpdate`) — deliberately. A new service
worker installs and waits in the background; the person sees a dismissible
toast ("يتوفر تحديث جديد للنظام") and the update only applies when they
tap "تحديث الآن" (`src/main.jsx`), which reloads the page onto the new
version. This avoids code silently swapping under someone mid-sale.

Every deployment produces new content-hashed filenames for every asset, so
the service worker's precache manifest always differs from what's cached —
update detection is automatic and correct on every deploy, nothing to
version by hand. `vercel.json` also sets `Cache-Control: no-cache` on
`/sw.js` and `/manifest.webmanifest` specifically, so Vercel's CDN never
serves a stale copy of either and delays update detection.

## Icons

Generated from a single hand-authored SVG (a simple gear glyph on the
app's existing brand blue gradient — see the two source SVGs' logic in the
git history / regenerate by re-running the icon script if ever needed) —
`public/icons/` has every PWA size (72–512, `any` + `maskable` purposes),
plus `public/favicon.ico`, `public/favicon.svg`, and
`public/apple-touch-icon.png` (opaque, no alpha — required by iOS). The
maskable variant was verified against a worst-case circular crop (Android's
most aggressive icon mask shape) to confirm nothing gets clipped.

## Known iOS/Safari limitations (real, not fixable from this codebase)

- No install-prompt event on iOS — Safari doesn't support
  `beforeinstallprompt`; "install" is always the manual Share → "إضافة إلى
  الشاشة الرئيسية" flow. No code path can trigger it programmatically.
- `theme-color`/`background_color` support in Safari standalone mode is
  more limited than Chrome/Edge's; the safe-area and status-bar-style meta
  tags are what actually control the visible chrome on iOS.
- No web push notifications on iOS below 16.4, and even from 16.4+ they
  require the app to already be installed to the home screen first — not
  wired up in this project at all (not requested, not needed for an
  online-only business app).
- Service worker update checks on iOS are more conservative about timing
  than Chrome's — a person may need to fully quit and reopen the installed
  app (not just background/foreground it) for the update check to run.

None of these affect core functionality — they're standard, well-known iOS
PWA platform constraints, not implementation bugs.
