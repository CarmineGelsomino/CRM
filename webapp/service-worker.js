const CACHE_NAME = "trade-crm-static-v1";
const APP_SCOPE = self.registration.scope;

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((cacheName) => cacheName !== CACHE_NAME)
                .map((cacheName) => caches.delete(cacheName))
        );
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(request.url);
    const isSameOrigin = requestUrl.origin === self.location.origin;
    const isAppAsset = requestUrl.href.startsWith(APP_SCOPE);
    const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination);

    if (!isSameOrigin || !isAppAsset || !isStaticAsset) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            event.waitUntil(updateCache(cache, request));
            return cachedResponse;
        }

        return updateCache(cache, request);
    })());
});

async function updateCache(cache, request) {
    const response = await fetch(request);

    if (response.ok) {
        await cache.put(request, response.clone());
    }

    return response;
}
