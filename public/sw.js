/*
 * RSTR service worker (spec 6). Every font file and stylesheet fetched from Google Fonts is cached and served
 * from the cache afterwards, so a pairing used once draws offline. The app's own files are network-first
 * with the cache as the fallback, so the app opens offline after one visit.
 */
const FONTS = 'rstr-fonts-v1';
const APP = 'rstr-app-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
    e.respondWith(fetch(req).then(async (res) => {
      if (res.ok) { const c = await caches.open(APP); await c.put(req, res.clone()); }
      return res;
    }, async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
  }
});
