import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/apiClient';
import { PwaStatus } from '../components/common/PwaStatus';
import {
  clearPrivateCacheForSession,
  isPrivateOfflineDataRequest,
  PRIVATE_API_CACHE,
  PRIVATE_CACHE_SCOPE_PARAM,
  sessionCacheScope,
} from '../pwa/privateCache';

function fakeCrypto(): Crypto {
  return {
    subtle: {
      digest: vi.fn(async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const bytes = new Uint8Array(32);
        const input = new Uint8Array(data as ArrayBuffer);
        bytes[31] = input.reduce((sum, byte) => sum + byte, 0) % 256;
        return bytes.buffer;
      }),
    },
  } as unknown as Crypto;
}

describe('PWA private offline support', () => {
  afterEach(() => {
    apiClient.clearAuth();
    apiClient.resetBaseUrl();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses a distinct cache scope for each tab session credential', async () => {
    const cryptoApi = fakeCrypto();
    const first = await sessionCacheScope('session-one', cryptoApi);
    const second = await sessionCacheScope('session-two', cryptoApi);

    expect(first).not.toBe(second);
    expect(first).toHaveLength(64);
  });

  it('clears only cached responses belonging to the logged-out session', async () => {
    const cryptoApi = fakeCrypto();
    const scope = await sessionCacheScope('session-one', cryptoApi);
    const owned = new Request(`https://example.test/alerts/api/sos/list/?${PRIVATE_CACHE_SCOPE_PARAM}=${scope}`);
    const other = new Request(`https://example.test/alerts/api/sos/list/?${PRIVATE_CACHE_SCOPE_PARAM}=another-session`);
    const cache = {
      keys: vi.fn().mockResolvedValue([owned, other]),
      delete: vi.fn().mockResolvedValue(true),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue([PRIVATE_API_CACHE]),
      open: vi.fn().mockResolvedValue(cache),
    } as unknown as CacheStorage;

    await clearPrivateCacheForSession('session-one', cacheStorage, cryptoApi);

    expect(cacheStorage.open).toHaveBeenCalledWith(PRIVATE_API_CACHE);
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith(owned);
  });

  it('only considers authenticated GETs for incident and notification reads cacheable', () => {
    const authenticatedGet = new Request('https://example.test/alerts/api/sos/42/', {
      headers: { Authorization: 'Bearer session-key' },
    });

    expect(isPrivateOfflineDataRequest(authenticatedGet, new URL(authenticatedGet.url))).toBe(true);
    const publicId = new Request('https://example.test/alerts/api/sos/INC-2026-42/', {
      headers: { Authorization: 'Bearer session-key' },
    });
    expect(isPrivateOfflineDataRequest(publicId, new URL(publicId.url))).toBe(true);
    expect(isPrivateOfflineDataRequest(
      new Request('https://example.test/alerts/api/notifications/', { method: 'POST' }),
      new URL('https://example.test/alerts/api/notifications/'),
    )).toBe(false);
    expect(isPrivateOfflineDataRequest(
      new Request('https://example.test/api/auth/me/', {
        headers: { Authorization: 'Bearer session-key' },
      }),
      new URL('https://example.test/api/auth/me/'),
    )).toBe(false);
    expect(isPrivateOfflineDataRequest(
      new Request('https://example.test/alerts/api/notifications/'),
      new URL('https://example.test/alerts/api/notifications/'),
    )).toBe(false);
  });

  it('does not send mutation requests when browser connectivity is offline', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', Object.create(navigator, {
      onLine: { configurable: true, value: false },
    }));

    await expect(apiClient.request('/alerts/api/sos/', {
      method: 'POST',
      body: JSON.stringify({ emergency_type: 'FIRE' }),
    })).rejects.toMatchObject({
      code: 'OFFLINE',
      message: expect.stringContaining('This action was not sent'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows and clears the connectivity banner when network state changes', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    render(<PwaStatus />);
    expect(screen.getByRole('status')).toHaveTextContent(/You’re offline/);

    fireEvent(window, new Event('online'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    delete (navigator as Navigator & { onLine?: boolean }).onLine;
  });

  it('offers the browser install prompt when available', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt');
    Object.assign(installEvent, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    render(<PwaStatus />);
    fireEvent(window, installEvent);
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }));

    expect(prompt).toHaveBeenCalledOnce();
  });

  it('shows Add to Home Screen guidance on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    render(<PwaStatus />);
    fireEvent.click(screen.getByRole('button', { name: 'Install on iPhone or iPad' }));
    expect(screen.getByText(/In Safari, tap Share, then choose “Add to Home Screen”/)).toBeInTheDocument();

    Reflect.deleteProperty(navigator, 'userAgent');
    Reflect.deleteProperty(window, 'matchMedia');
  });
});
