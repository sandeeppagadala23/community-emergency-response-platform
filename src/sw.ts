/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { ExpirationPlugin } from 'workbox-expiration';
import { NetworkFirst } from 'workbox-strategies';
import {
  clearPrivateCacheForSession,
  isPrivateOfflineDataRequest,
  PRIVATE_API_CACHE,
  PRIVATE_CACHE_SCOPE_PARAM,
  sessionCacheScope,
} from './pwa/privateCache';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
};

const OFFLINE_FALLBACK_URL = '/offline.html';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const offlineFallback = createHandlerBoundToURL(OFFLINE_FALLBACK_URL);
const appShellFallback = createHandlerBoundToURL('/index.html');
const appNavigation = new NetworkFirst({
  cacheName: 'cerp-app-navigation-v1',
  plugins: [
    {
      handlerDidError: async ({ event, request }) => {
        const options = { event, request, url: new URL(request.url) };
        try {
          return await appShellFallback(options);
        } catch {
          return offlineFallback(options);
        }
      },
    },
  ],
});

registerRoute(
  new NavigationRoute(appNavigation, {
    denylist: [/^\/api\//, /^\/alerts\//, /^\/reports\/api\//],
  }),
);

const privateScopePlugin = {
  async cacheKeyWillBeUsed({ request }: { request: Request }) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const scope = token ? await sessionCacheScope(token) : null;
    if (!scope) throw new Error('Private offline cache requires an authenticated session.');

    const scopedUrl = new URL(request.url);
    scopedUrl.searchParams.set(PRIVATE_CACHE_SCOPE_PARAM, scope);
    const cacheHeaders = new Headers(request.headers);
    cacheHeaders.delete('Authorization');
    cacheHeaders.delete('X-CSRFToken');
    return new Request(scopedUrl.toString(), {
      method: 'GET',
      headers: cacheHeaders,
      credentials: 'omit',
    });
  },
  cacheWillUpdate: async ({ response }: { response: Response }) => {
    if (response.status !== 200 || response.headers.has('www-authenticate')) return null;
    if (!response.headers.get('content-type')?.includes('application/json')) return null;
    return response;
  },
};

const privateApiStrategy = new NetworkFirst({
  cacheName: PRIVATE_API_CACHE,
  networkTimeoutSeconds: 4,
  plugins: [
    privateScopePlugin,
    new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
});

registerRoute(
  ({ request, url }) => isPrivateOfflineDataRequest(request, url),
  privateApiStrategy,
);

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; token?: string } | null;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (data?.type !== 'CLEAR_PRIVATE_CACHE' || !data.token) return;
  event.waitUntil(clearPrivateCacheForSession(data.token).catch(() => undefined));
});
