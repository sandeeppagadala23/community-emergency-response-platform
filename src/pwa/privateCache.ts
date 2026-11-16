export const PRIVATE_API_CACHE = 'cerp-private-api-v1';
export const PRIVATE_CACHE_SCOPE_PARAM = '__cerp_session_scope';

export async function sessionCacheScope(
  token: string,
  cryptoApi: Crypto | undefined = globalThis.crypto,
): Promise<string | null> {
  if (!token || !cryptoApi?.subtle) return null;

  const digest = await cryptoApi.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function clearPrivateCacheForSession(
  token: string,
  cacheStorage: CacheStorage | undefined = globalThis.caches,
  cryptoApi: Crypto | undefined = globalThis.crypto,
): Promise<void> {
  const scope = await sessionCacheScope(token, cryptoApi);
  if (!scope || !cacheStorage) return;
  const cacheNames = await cacheStorage.keys();
  if (!cacheNames.includes(PRIVATE_API_CACHE)) return;

  const cache = await cacheStorage.open(PRIVATE_API_CACHE);
  const entries = await cache.keys();
  await Promise.all(
    entries
      .filter((entry) => new URL(entry.url).searchParams.get(PRIVATE_CACHE_SCOPE_PARAM) === scope)
      .map((entry) => cache.delete(entry)),
  );
}

export function isPrivateOfflineDataRequest(request: Request, url: URL): boolean {
  if (request.method !== 'GET' || !request.headers.has('Authorization')) return false;
  if (url.pathname.startsWith('/api/auth/')) return false;
  return /^\/alerts\/api\/sos\/(?:list\/|[A-Za-z0-9_-]+\/(?:status\/)?)$/.test(url.pathname)
    || url.pathname === '/alerts/api/notifications/';
}
