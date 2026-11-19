// Service Worker: macht den Zazen-Timer offline-fähig.
// Läuft auf iOS 12 und neuer sowie in Chrome/Edge unter Windows.
//
// Änderungen an index.html kommen automatisch an, sobald jemand die App mit Internet öffnet.
// Nummer nur hochzählen (zazen-v2 …), wenn du Icons oder Schriften austauschst.
var CACHE = 'zazen-v2';

// Alle Dateien der App. Jede davon MUSS auf dem Server liegen, sonst klappt der Offline-Modus nicht.
var FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './shippori-mincho-latin-500-normal.woff2',
  './shippori-mincho-latin-600-normal.woff2',
  './zen-kaku-gothic-new-94-400-normal.woff2',
  './zen-kaku-gothic-new-116-400-normal.woff2',
  './zen-kaku-gothic-new-latin-400-normal.woff2',
  './zen-kaku-gothic-new-latin-500-normal.woff2',
  './zen-kaku-gothic-new-latin-700-normal.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || req.url.indexOf('http') !== 0) return;
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(event));
  }
});

// Die Seite selbst: mit Internet die neueste Version holen (höchstens 3 s warten),
// sonst die gespeicherte Version zeigen.
function networkFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('timeout')); }, 3000);
    });
    return Promise.race([fetch(req), timeout])
      .then(function (res) {
        if (res && res.status === 200) cache.put(req, res.clone()).catch(function () {});
        return res;
      })
      .catch(function () {
        return cache.match(req, { ignoreSearch: true })
          .then(function (hit) { return hit || cache.match('./index.html'); })
          .then(function (hit) { return hit || cache.match('./'); })
          .then(function (hit) { return hit || Response.error(); });
      });
  });
}

// Schriften und Icons: sofort aus dem Speicher, im Hintergrund auffrischen.
function cacheFirst(event) {
  var req = event.request;
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var network = fetch(req)
        .then(function (res) {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            cache.put(req, res.clone()).catch(function () {});
          }
          return res;
        })
        .catch(function () { return undefined; });
      event.waitUntil(network);
      if (hit) return hit;
      return network.then(function (res) { return res || Response.error(); });
    });
  });
}
