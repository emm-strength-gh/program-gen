/* Service worker for the Powerlifting Program Hub.
 *
 * Strategy:
 *   HTML / navigation  -> network-first, cache fallback.  Online you always get the
 *                         newest build you pushed to GitHub; offline you get the last
 *                         one that loaded successfully.
 *   Icons + manifest   -> cache-first, revalidated in the background.
 *   Google Fonts       -> cache-first and effectively permanent (they never change
 *                         at a given URL), so the app looks right offline too.
 *
 * Bumping CACHE_VERSION discards every old cache on the next activation. You only
 * need to do that if you change the file list below — normal edits to
 * program-generator.html are picked up automatically by the network-first rule.
 */

const CACHE_VERSION = "v1";
const CACHE_SHELL = `program-hub-shell-${CACHE_VERSION}`;
const CACHE_FONTS = `program-hub-fonts-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./program-generator.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
];

const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

/* ---------------------------------------------------------------- install */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then(cache =>
      /* Individually, so one failed asset can't abort the whole install. */
      Promise.all(SHELL_ASSETS.map(url =>
        cache.add(new Request(url, { cache: "reload" }))
             .catch(err => console.warn("[sw] precache skipped:", url, err))
      ))
    )
  );
});

/* --------------------------------------------------------------- activate */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_SHELL && k !== CACHE_FONTS)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Lets the page tell a waiting worker to take over immediately. */
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* ------------------------------------------------------------------ fetch */
self.addEventListener("fetch", event => {
  const req = event.request;

  // Never interfere with anything but plain GETs.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // --- Google Fonts: cache-first, stored permanently once fetched.
  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(cacheFirst(req, CACHE_FONTS));
    return;
  }

  // --- Anything else off-origin: leave it alone.
  if (url.origin !== self.location.origin) return;

  // --- The app page itself (or any navigation): network-first.
  if (req.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(req, CACHE_SHELL));
    return;
  }

  // --- Same-origin static files: cache-first.
  event.respondWith(cacheFirst(req, CACHE_SHELL));
});

/* -------------------------------------------------------------- strategies */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // Offline and never cached — fall back to the app shell if we have it.
    const shell = await cache.match("./program-generator.html", { ignoreSearch: true });
    if (shell) return shell;
    return new Response(
      "<h1>Offline</h1><p>This page hasn't been cached yet. Reconnect once and it will work offline afterwards.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) {
    // Refresh in the background; don't block the response on it.
    fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    }).catch(() => {});
    return hit;
  }
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}
