# Powerlifting Program Hub — iPhone home-screen app

`program-generator.html` wrapped as an installable PWA. Runs full-screen with its own
icon, works offline, and exports CSV through the iOS share sheet.

## Files

| File | Purpose |
|---|---|
| `program-generator.html` | The app. Same code as before plus a PWA `<head>`, safe-area CSS, iOS-safe export, and service worker registration. |
| `manifest.webmanifest` | App name, icon set, colours, `display: standalone`. |
| `sw.js` | Service worker. Offline caching. |
| `index.html` | Redirects the bare repo URL to the app. Delete if you don't want it. |
| `icons/` | 192, 512, 512-maskable, and the 180px `apple-touch-icon` iOS uses. |
| `.nojekyll` | Stops GitHub Pages running the files through Jekyll. |
| `test-boot.js` | Smoke test — `npm install jsdom && node test-boot.js`. |
| `make_icons.py` | Regenerates the icons if you want a different mark. |

Everything uses **relative paths**, so it works from `username.github.io/repo-name/`
without you editing anything.

## Deploy

1. Push all of it to the repo root (or a `/docs` folder), keeping the `icons/` folder structure.
2. Repo → **Settings** → **Pages** → Source: *Deploy from a branch* → `main` / root.
3. Wait for the green tick, then open `https://<username>.github.io/<repo-name>/` on your iPhone.

HTTPS is required for service workers, and GitHub Pages gives you that for free.

> A public repo makes the page public to anyone with the URL. GitHub Pages on a
> **private** repo needs a paid plan — on the free tier, publishing a private repo's
> Pages site makes the site itself public even though the code stays private. Nothing
> here is sensitive and no data leaves your phone, but if you'd rather the URL not be
> reachable at all, Cloudflare Pages with Cloudflare Access is the free alternative.

## Install on the iPhone

Must be **Safari** — Chrome/Firefox on iOS can't install to the home screen.

1. Open the URL in Safari.
2. Share button → **Add to Home Screen** → Add.
3. Launch from the icon. No address bar, no tab bar.

Once it's loaded a first time it works in airplane mode.

## What changed inside the HTML

Five edits, all additive — nothing existing was removed:

1. **`<head>` block** — manifest link, `apple-mobile-web-app-capable`, apple-touch-icon,
   `viewport-fit=cover`, and a `theme-color` meta with an id.
2. **CSS at the end of `<style>`** — `env(safe-area-inset-*)` padding so content clears
   the Dynamic Island and the home indicator. `env()` is `0px` in a desktop browser, so
   your desktop layout is byte-identical.
3. **Input font size on touch screens** — bumped to 16px under
   `(max-width:680px) and (pointer:coarse)`. Below 16px, iOS zooms the whole viewport
   when you tap a field, which was going to be miserable on the maxes inputs. Desktop
   keeps 15px/13px.
4. **`exportActive()`** — in a standalone iOS app, `<a download>` fails silently. It now
   detects standalone mode and passes the CSV to `navigator.share()`, giving you Save to
   Files, iCloud Drive, AirDrop, Mail. Browser tabs and desktop keep the old download path,
   and cancelling the share sheet no longer triggers a phantom download.
5. **`applyTheme()` + service worker registration** — the status bar tint now follows your
   light/dark toggle rather than the OS setting, and a new version auto-activates instead
   of leaving you on a stale cache.

Your `localStorage` theme preference still works; it's a preference, not data, so losing
it costs nothing. The app generates from inputs rather than storing state, so there's no
training data at risk in the cache.

## Updating the app later

Push a new `program-generator.html` and reopen the app. HTML is fetched network-first, so
you get the new build whenever you're online, and the old one stays as the offline
fallback. Only bump `CACHE_VERSION` in `sw.js` if you add or rename files.

If it ever feels stuck on an old build: delete the home-screen icon, then in Safari go
Settings → Safari → Advanced → Website Data and remove the site, then re-add it.

## Known rough edges

- **Landscape is your friend.** The week-by-week preview table is wide. It scrolls
  horizontally in portrait, but rotating the phone is more comfortable. If you end up
  using this on the phone a lot, a card-per-day mobile layout for the preview would be
  the real fix — worth doing as a separate pass.
- **Unsigned, uninstalled, unlisted.** This is not in the App Store and doesn't need to be.
  No expiry, no re-signing, no developer account.
- **Fonts.** Barlow Condensed / Inter / JetBrains Mono load from Google Fonts and are
  cached after the first visit. Before that first load, offline falls back to system fonts —
  the layout holds, the type just looks different.
