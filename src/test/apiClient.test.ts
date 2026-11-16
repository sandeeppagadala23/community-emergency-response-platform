import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/apiClient';
import { contactService } from '../services/contactService';
import { UserProfile } from '../types/auth';

describe('API client no-content responses', () => {
  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setBaseUrl('');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats a successful 204 contact deletion as success without parsing JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(contactService.deleteContact(7)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guardian-contacts/7/',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'omit',
      }),
    );
  });

  it('sends the per-tab Django session key as a bearer credential', async () => {
    const user: UserProfile = {
      id: 'admin-42',
      name: 'Admin Example',
      role: 'ADMIN',
      flat: 'Control Room',
      society: 'Green Meadows',
      phone: '',
      email: 'admin@example.in',
    };
    apiClient.setAuth('test-session-key', user);
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.request('/reports/api/reports/')).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      '/reports/api/reports/',
      expect.objectContaining({
        credentials: 'omit',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-session-key',
        }),
      }),
    );
    expect(apiClient.getCurrentUser()).toEqual(user);
  });

  it('sends cookies only for CSRF-protected authentication endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.request('/api/auth/csrf/');
    await apiClient.request('/alerts/api/notifications/');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/csrf/',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/alerts/api/notifications/',
      expect.objectContaining({ credentials: 'omit' }),
    );
  });
});
