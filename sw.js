const CACHE = "englisch-vokabeln-v3";
const ASSETS = ["./", "./index.html", "./vocab.json", "./manifest.webmanifest", "./src/logic.js", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("message", function (e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
      }
      return res;
    }).catch(function () { return caches.match("./index.html"); });
  }));
});
