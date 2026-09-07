/* eslint-env serviceworker */

/**
 * Offline for a local-first app.
 *
 * The app kept all its data on the device and still needed the network to
 * start, which made "local-first" true of the storage and false of the
 * experience: added to a home screen and opened on a plane, it was a blank
 * page.
 *
 * Two strategies, because the two kinds of file have opposite needs:
 *
 * - Built assets carry a content hash in the filename, so a given URL can never
 *   change. Cache-first is safe and instant.
 * - index.html has a fixed URL and points at those hashes, so it must be
 *   allowed to change. Network-first, falling back to the cached copy, is what
 *   makes a new build reachable while still opening offline.
 *
 * Caching on demand rather than precaching a generated manifest keeps the build
 * honest: there is no list to fall out of step with what was actually emitted.
 */

const CACHE = 'personal-os-v1'
const SHELL = './index.html'

self.addEventListener('install', (event) => {
  // Take over as soon as this version is ready rather than waiting for every
  // tab to close — a stale worker serving a stale shell is the failure mode.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations: fresh if possible, cached shell if not. This is what lets a
  // new deploy be picked up and an offline launch still work.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          return response
        })
        .catch(() =>
          caches.match(SHELL).then((cached) => cached ?? new Response('', { status: 504 })),
        ),
    )
    return
  }

  // Everything else: serve from cache, and populate it on the way past.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Opaque and error responses are not worth keeping.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
