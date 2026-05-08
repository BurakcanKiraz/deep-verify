// Deep-Verify Service Worker
const CACHE_NAME = 'deep-verify-v1';
const ASSETS = ['./index.html','./css/variables.css','./css/base.css','./css/components.css','./css/layout.css','./js/storage.js','./js/parser.js','./js/verifier.js','./js/ui.js','./js/app.js','./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.crossref.org') || e.request.url.includes('api.openalex.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({error:'offline'}), {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
