const CACHE_NAME = "music-console-offline-v1";
const INDEX_URL = new URL("./", self.registration.scope).href;
const CORE_URLS = [
  INDEX_URL,
  new URL("manifest.webmanifest", self.registration.scope).href,
  new URL("app-icon.svg", self.registration.scope).href,
];

function pageAssetUrls(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(([, path]) => new URL(path, INDEX_URL))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch(INDEX_URL, { cache: "reload" });
  if (!indexResponse.ok) throw new Error("无法缓存应用入口");
  const html = await indexResponse.clone().text();
  await cache.put(INDEX_URL, indexResponse);

  const urls = [...new Set([...CORE_URLS.slice(1), ...pageAssetUrls(html)])];
  await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { cache: "reload" });
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith("music-console-offline-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) (await caches.open(CACHE_NAME)).put(INDEX_URL, response.clone());
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    }))
  );
});
