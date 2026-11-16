import { ApiError } from '../types/api';
import { UserProfile } from '../types/auth';
import { clearPrivateCacheForSession } from '../pwa/privateCache';

/**
 * API client used throughout the application. Handles authentication tokens,
 * CSRF protection, and generic error normalization.
 */
export class ApiClient {
  private token: string | null = null;
  private currentUser: UserProfile | null = null;
  private baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '';

  /** Endpoints that require the CSRF cookie and header */
  private static readonly csrfCookieEndpoints = new Set([
    '/api/auth/csrf/',
    '/api/auth/login/',
    '/api/auth/register/',
    '/api/auth/logout/',
  ]);

  /** Cached CSRF token obtained from the backend */
  private csrfToken: string | null = null;
  /** In‑flight promise used to co‑ordinate concurrent refreshes */
  private csrfRefreshPromise: Promise<void> | null = null;

  // ---------------------------------------------------------------------
  // Public helper methods (auth & configuration)
  // ---------------------------------------------------------------------
  setAuth(token: string | null, user: UserProfile | null) {
    // Clear cached CSRF token when auth state changes (Django rotates token on login).
    this.csrfToken = null;
    this.token = token;
    this.currentUser = user;
    if (token) {
      sessionStorage.setItem('cerp_token', token);
      if (user) sessionStorage.setItem('cerp_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('cerp_token');
      sessionStorage.removeItem('cerp_user');
    }
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.trim();
    window.dispatchEvent(new CustomEvent('cerp:backend_changed', { detail: this.baseUrl }));
  }

  resetBaseUrl() {
    this.setBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getToken(): string | null {
    if (!this.token) this.token = sessionStorage.getItem('cerp_token');
    return this.token;
  }

  getCurrentUser(): UserProfile | null {
    if (!this.currentUser) {
      const stored = sessionStorage.getItem('cerp_user');
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch {
          this.currentUser = null;
        }
      }
    }
    return this.currentUser;
  }

  clearAuth() {
    const previousToken = this.token ?? sessionStorage.getItem('cerp_token');
    if (previousToken) {
      void clearPrivateCacheForSession(previousToken).catch(() => undefined);
      navigator.serviceWorker?.controller?.postMessage({
        type: 'CLEAR_PRIVATE_CACHE',
        token: previousToken,
      });
    }
    this.token = null;
    this.currentUser = null;
    sessionStorage.removeItem('cerp_token');
    sessionStorage.removeItem('cerp_user');
  }

  isMockMode(): boolean {
    return this.baseUrl.trim() === 'mock';
  }

  // ---------------------------------------------------------------------
  // Error handling utilities
  // ---------------------------------------------------------------------
  normalizeError(err: unknown): ApiError {
    if (typeof err === 'object' && err !== null && 'status' in err && 'message' in err) {
      return err as ApiError;
    }
    if (err instanceof Error) {
      return {
        status: 0,
        code: 'NETWORK_ERROR',
        message: err.message || 'Unable to connect to emergency services. Check your connection.',
      };
    }
    return {
      status: 500,
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred. Help is being notified.',
    };
  }

  // ---------------------------------------------------------------------
  // Cookie handling – robust parsing that tolerates cookie attributes.
  // ---------------------------------------------------------------------
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // ---------------------------------------------------------------------
  // CSRF token management
  // ---------------------------------------------------------------------
  /**
   * Fetch a fresh CSRF token from the backend. The request includes
   * `credentials: 'include'` so the cookie is set by the browser. The method
   * deduplicates concurrent calls via `csrfRefreshPromise`.
   */
  private async refreshCsrfToken(): Promise<void> {
    if (this.csrfRefreshPromise) {
      await this.csrfRefreshPromise;
      return;
    }
    const url = `${this.baseUrl.replace(/\\+$/, '')}/api/auth/csrf/`;
    this.csrfRefreshPromise = (async () => {
      try {
        const resp = await fetch(url, { credentials: 'include' });
        if (!resp.ok) return;
        const data = (await resp.json()) as { csrfToken: string };
        if (data && typeof data.csrfToken === 'string') {
          this.csrfToken = data.csrfToken;
        }
      } catch {
        // ignore errors – fallback to existing cookie if any
      } finally {
        this.csrfRefreshPromise = null;
      }
    })();
    await this.csrfRefreshPromise;
  }

  // ---------------------------------------------------------------------
  // Core request method used by the rest of the codebase.
  // ---------------------------------------------------------------------
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanBase = this.baseUrl.replace(/\\+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

    const requiresCsrf = ApiClient.csrfCookieEndpoints.has(cleanEndpoint);

    // Ensure a CSRF token is available when required (do not self-recurse if already requesting csrf).
    if (requiresCsrf && cleanEndpoint !== '/api/auth/csrf/') {
      const activeCsrfToken = this.csrfToken || this.getCookie('csrftoken');
      if (!activeCsrfToken) {
        await this.refreshCsrfToken();
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> | undefined || {}),
    };

    const token = this.getToken();
    if (token && !token.startsWith('demo_')) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (requiresCsrf) {
      const activeCsrfToken = this.csrfToken || this.getCookie('csrftoken');
      if (activeCsrfToken) {
        headers['X-CSRFToken'] = activeCsrfToken;
      }
    }

    const method = (options.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw this.normalizeError({
        status: 0,
        code: 'OFFLINE',
        message: 'You are offline. This action was not sent. Reconnect and try again.',
      });
    }

    const response = await fetch(url, {
      ...options,
      cache: method === 'GET' ? 'no-store' : options.cache,
      credentials: requiresCsrf ? 'include' : 'omit',
      headers,
    });

    if (response.status === 401) {
      let errBody: { code?: string; message?: string } = {};
      try {
        errBody = await response.json();
      } catch {}
      if (errBody.code === 'INVALID_CREDENTIALS') {
        throw this.normalizeError({
          status: 401,
          code: errBody.code,
          message: errBody.message || 'Invalid identifier or password.',
        });
      }
      this.clearAuth();
      window.dispatchEvent(new CustomEvent('cerp:unauthorized'));
      throw this.normalizeError({ status: 401, code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' });
    }

    if (!response.ok) {
      let errBody: unknown = {};
      try {
        errBody = await response.json();
      } catch {}
      const body = isRecord(errBody) ? errBody : {};
      const message =
        (typeof (body as any).message === 'string' && (body as any).message) ||
        (typeof (body as any).detail === 'string' && (body as any).detail) ||
        validationMessage(body) ||
        response.statusText ||
        'Request failed.';
      throw this.normalizeError({
        status: response.status,
        code: typeof (body as any).code === 'string' ? (body as any).code : `HTTP_${response.status}`,
        message,
        retry_after: typeof (body as any).retry_after === 'number' ? (body as any).retry_after : undefined,
        field_errors: validationFieldErrors(body),
      });
    }

    if (response.status === 204) return undefined as unknown as T;
    return (await response.json()) as T;
  }
}

// -------------------------------------------------------------------------
// Helper functions used by the client (unchanged from the original file).
// -------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationMessage(body: Record<string, unknown>): string | null {
  const messages = Object.entries(body).flatMap(([field, value]) => {
    if (typeof value === 'string') return [`${field}: ${value}`];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string').map((msg) => `${field}: ${msg}`);
    }
    return [];
  });
  return messages.length ? messages.join(' ') : null;
}

function validationFieldErrors(body: Record<string, unknown>): Record<string, string> | undefined {
  const source = isRecord((body as any).field_errors)
    ? (body as any).field_errors
    : isRecord((body as any).errors)
    ? (body as any).errors
    : body;
  const fieldErrors = Object.fromEntries(
    Object.entries(source).flatMap(([field, value]) => {
      if (['code', 'detail', 'message'].includes(field)) return [];
      if (typeof value === 'string') return [[field, value]];
      if (Array.isArray(value)) {
        const msgs = value.filter((i): i is string => typeof i === 'string');
        return msgs.length ? [[field, msgs.join(' ')]] : [];
      }
      return [];
    })
  );
  return Object.keys(fieldErrors).length ? fieldErrors : undefined;
}

export const apiClient = new ApiClient();