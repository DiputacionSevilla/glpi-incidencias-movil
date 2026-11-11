// Installability only. Authenticated HTML and API responses are never intercepted or cached.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
