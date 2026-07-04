# Making Parthsaarthi Installable (PWA)

**Status:** Planned, not yet implemented. This doc is the implementation plan — pick it up directly next time instead of re-deriving it.

## Context

Students currently only reach the booking portal through a browser tab/bookmark. The ask is to let students "download/install" it like an app. Given the tech stack (React 19 + Vite 8 SPA, `HashRouter`, served same-origin by Express behind an Apache reverse proxy at a configurable `BASE_PATH`), the right-sized solution is a **Progressive Web App (PWA)**: a web app manifest + minimal service worker that makes Chrome/Edge/Android show an "Install app" affordance and lets iOS Safari users "Add to Home Screen." This needs no app store account, no review process, and ships with the next normal deploy — chosen over a Play Store/TWA wrapper, which was explicitly ruled out for now (see decision below).

Because this app is data-driven and updated frequently (17 shipped phases per the main README, active development), the service worker must be conservative: cache only the static shell, never cache `/api/*` or auth state, and always fetch a fresh `index.html` so students get the latest build on next load instead of a stale cached version.

## Decision made

Asked: how installable should this be?
- **Chosen: PWA — install from browser.** Manifest + minimal service worker, "Install App"/"Add to Home Screen" in Chrome/Edge/Safari, standalone window, no store review.
- Rejected (for now): PWA + Play Store listing via TWA/Bubblewrap — needs a Google Play Developer account ($25 one-time), app signing, a store listing, and Google's review process. iOS App Store would be a separate native-wrapper effort (Apple doesn't support TWA). Revisit if there's ever a real need for a store listing.

## Key constraints found during exploration

- Production is deployed under a **variable base path** (`/` on-prem root, `/parthsaarthi/` behind the reverse proxy, `/slot-booking-platform/` on GH Pages) — `client/vite.config.js` reads `VITE_BASE_PATH`. Every new URL (manifest link, icon paths, `start_url`/`scope`, service-worker registration) must be **relative**, not root-absolute, so it works under all three. Note: `client/index.html`'s existing favicon link (`href="/Parthsaarthi.ico"`) is already root-absolute and likely 404s under the `/parthsaarthi/` subpath — worth fixing alongside this work since it directly affects the install icon's reliability, but it's a pre-existing bug independent of this task.
- No manifest, icons folder, or service worker exist yet (`client/public/` only has `Parthsaarthi.ico`, `favicon.svg`, `icons.svg`).
- Only square-ish source art available is `client/src/assets/PSLogo.png` (574×481, not square) and a 32×32 `.ico`. Need to produce proper square PNG icons (192×192, 512×512, plus a maskable variant) from the logo — pad to a square canvas rather than stretching.
- `server/src/index.js` sets a `helmet` CSP with `default-src 'self'`; a same-origin `sw.js` and `manifest.webmanifest` need no CSP changes.
- App uses `HashRouter`, so service-worker scope (directory-level) is unaffected by client-side route changes.
- `client/src/components/AppFooter.jsx` is rendered on every page — the natural, low-noise spot for an "Install app" affordance / iOS instructions.

## Implementation plan

### 1. Icons
Generate a square icon set from `client/src/assets/PSLogo.png` (pad to square, add safe-zone padding for the maskable variant):
- `client/public/icons/icon-192.png`
- `client/public/icons/icon-512.png`
- `client/public/icons/maskable-512.png` (extra padding so Android's circular/squircle mask doesn't clip the logo)
- `client/public/apple-touch-icon.png` (180×180, no transparency — iOS ignores alpha and shows it as black)

### 2. Web app manifest — `client/public/manifest.webmanifest`
```json
{
  "name": "Parthsaarthi | SIP Booking Portal",
  "short_name": "Parthsaarthi",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#F8FAF7",
  "theme_color": "#064e3b",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
`start_url`/`scope` of `"."` resolve relative to the manifest's own URL per spec — works identically under `/`, `/parthsaarthi/`, or `/slot-booking-platform/` with no per-environment templating.

### 3. `client/index.html`
- `<link rel="manifest" href="manifest.webmanifest" />` (relative — matches the base-path pattern above)
- `<meta name="theme-color" content="#064e3b" />`
- `<link rel="apple-touch-icon" href="apple-touch-icon.png" />`
- iOS standalone-mode meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`
- Fix the existing favicon `href="/Parthsaarthi.ico"` → `href="Parthsaarthi.ico"` (relative) while touching this file, so the tab icon and install icon are consistent across all deploy targets.

### 4. Minimal hand-written service worker — `client/public/sw.js`
No new dependency (`vite-plugin-pwa`'s Vite-8 compatibility is unverified, and this app's needs are narrow enough not to justify Workbox). Behavior:
- `install`: precache nothing build-specific (no hashed-filename manifest available without a build plugin) — just the icons and the offline fallback.
- `fetch`:
  - Ignore non-GET requests and anything under `/api/` — always network, never intercepted, so booking data/auth is never served stale.
  - Network-first for navigations (`index.html`) so a new deploy is picked up on next load, falling back to cache only if offline.
  - Cache-first for same-origin static assets (Vite's hashed JS/CSS chunks are safe to cache indefinitely since the filename changes on content change).
- Versioned cache name (bump on notable changes) so `activate` cleans up old caches.

### 5. Registration + install UX — new `client/src/lib/registerSW.js` and small addition to `AppFooter.jsx`
- Register the service worker from `client/src/main.jsx`, guarded by `import.meta.env.PROD` (skip in `vite dev` so it never fights HMR) and `'serviceWorker' in navigator`.
- Capture the `beforeinstallprompt` event (Chrome/Edge/Android) in a tiny context/hook; expose an "Install app" button in `AppFooter.jsx` that calls `.prompt()` when available.
- iOS Safari never fires `beforeinstallprompt` — detect iOS + Safari + not already `display-mode: standalone`, and show a one-time dismissible tip ("Tap Share → Add to Home Screen") instead, stored in `localStorage` so it doesn't nag every visit.

### 6. No server or deploy-process changes needed
`client/public/*` already gets copied into `client/dist/` by Vite and then into `server/public/` per the existing manual copy step in the main README's Build & Deploy section — the new manifest/icons/sw.js ride along automatically.

## Verification (once implemented)
1. `cd client && npm run build && npm run preview` — open in Chrome, DevTools → Application → Manifest: confirm no installability errors, icons render correctly.
2. Run a Lighthouse PWA audit against the preview build.
3. Trigger install on: desktop Chrome/Edge (address-bar install icon), Android Chrome ("Install app" menu entry), and iOS Safari (Share → Add to Home Screen) — confirm the launched app opens standalone (no browser chrome), correct icon/name/splash background.
4. With the app installed, run through the full student booking flow (login → book a slot → cancel) to confirm Google Identity Services and API calls behave identically in standalone mode.
5. Open DevTools → Network with the SW active: confirm `/api/*` requests always show as network requests (not `(ServiceWorker)`), and static assets are served from cache on a repeat load.
6. Simulate a deploy: change something trivial, rebuild, reload the installed app, and confirm the new version loads (network-first HTML) rather than being stuck on a cached shell.