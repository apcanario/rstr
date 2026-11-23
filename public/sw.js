/*
 * RSTR service worker (spec 6). Every font file and stylesheet fetched from Google Fonts is cached and served
 * from the cache afterwards, so a pairing used once draws offline. The app's own files are network-first
 * with the cache as the fallback, so the app opens offline after one visit.
 *
 * The app cache stays small (review R3 M1): a navigation is stored under its path without the search (every
 * `?s=` design shares one entry), and each time a fresh page is stored, the hashed `assets/` files it no
 * longer names are deleted.
 */
const FONTS = 'rstr-fonts-v1';
const APP = 'rstr-app-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** Drop cached hashed assets that the page just stored does not name (the build has no lazy chunks; if it gets some, keep them here too). */
async function prune(c, html) {
  const named = new Set([...html.matchAll(/assets\/[^"'\s)>]+/g)].map((m) => m[0]));
  for (const k of await c.keys()) {
    const p = new URL(k.url).pathname;
    const i = p.indexOf('/assets/');
    if (i >= 0 && !named.has(p.slice(i + 1))) await c.delete(k);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) await c.put(req.url, res.clone());
      return res;
    }));
  } else if (url.origin === self.location.origin) {
    const nav = req.mode === 'navigate';
    const key = nav ? url.origin + url.pathname : req;
    e.respondWith(fetch(req).then(async (res) => {
      if (res.ok) {
        const c = await caches.open(APP);
        await c.put(key, res.clone());
        if (nav) e.waitUntil(res.clone().text().then((html) => prune(c, html)));
      }
      return res;
    }, async () => (await caches.match(key, { ignoreSearch: true })) || Response.error()));
  }
});
