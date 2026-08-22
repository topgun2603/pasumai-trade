/*
  The service worker, kept deliberately small.

  A service worker is what makes the console installable, and it is also the
  easiest thing in a web app to get catastrophically wrong: one that caches the
  wrong asset serves a stale application to a person who cannot clear it, and a
  farmer on a village connection is exactly who cannot be talked through a hard
  refresh over the telephone.

  So this does one thing. It answers *navigations* that fail — no network, or a
  network that times out — with a page that says so. Everything else falls
  straight through to the network as though it were not here.

  What it deliberately does not do:

    - **Precache the application shell.** Next's chunks are content-hashed and
      change on every deploy; a shell cached by hand goes stale silently and
      the failure looks like a bug in the app rather than in the cache.
    - **Touch anything but navigations.** API calls, uploads and the session
      exchange must never be served from a cache. A cached `/api/auth/session`
      is a person signed in as somebody else.
    - **Cache successful pages.** Every console page is per-account, and showing
      one farmer another's listings from a cache would be worse than any offline
      experience.
*/

const CACHE = "pasumai-shell-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE])),
  );
  // Take over immediately rather than waiting for every tab to close. A stale
  // worker lingering after a deploy is the thing that makes these hard to
  // reason about.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Navigations only. `mode: "navigate"` is the browser telling us this is a
  // page the person is going to look at, which is the only case worth handling.
  if (request.mode !== "navigate") return;

  // A range request is a media seek, not a page load, and answering one with
  // HTML breaks the player.
  if (request.headers.has("range")) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE);
      return (
        cached ??
        new Response("You are offline.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
