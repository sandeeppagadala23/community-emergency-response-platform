import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { apiClient } from '../services/apiClient';

describe('Backend sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiClient.clearAuth();
    apiClient.setBaseUrl('');
    vi.restoreAllMocks();
  });

  it('submits credentials to the proxied Django login endpoint', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      token: 'session_1_resident',
      user: {
        id: 'usr_1',
        name: 'Resident Example',
        role: 'RESIDENT',
        flat: 'B-304',
        society: 'Green Meadows',
        phone: '1234567890',
        email: 'resident@example.in',
      },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Username, email, or phone'), 'resident');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'resident', password: 'password' }),
      });
    });
    expect(apiClient.getCurrentUser()?.name).toBe('Resident Example');
    expect(apiClient.isMockMode()).toBe(false);
  });

  it('restores the identity authenticated by this tab session', async () => {
    const admin = {
      id: '1',
      name: 'Admin Example',
      role: 'ADMIN' as const,
      flat: 'Control Room',
      society: 'Green Meadows',
      phone: '',
      email: 'admin@example.in',
    };
    const resident = {
      ...admin,
      id: '2',
      name: 'Resident Example',
      role: 'RESIDENT' as const,
      flat: 'B-304',
      email: 'resident@example.in',
    };
    apiClient.setAuth('session_1', admin);
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({ csrfToken: 'csrf-test' })
      .mockResolvedValueOnce(resident)
      .mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getCurrentUser()).toMatchObject({
        id: '2',
        role: 'RESIDENT',
        name: 'Resident Example',
      });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('cerp_user')).toContain('"id":"2"');
  });

  it('rehydrates the same Admin identity and trusted role after refresh', async () => {
    const admin = {
      id: '1',
      name: 'Admin Example',
      role: 'ADMIN' as const,
      flat: 'Control Room',
      society: 'Green Meadows',
      phone: '',
      email: 'admin@example.in',
    };
    apiClient.setAuth('session_1', admin);
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({ csrfToken: 'csrf-test' })
      .mockResolvedValueOnce(admin);

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getCurrentUser()).toMatchObject({
        id: '1',
        role: 'ADMIN',
        name: 'Admin Example',
      });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not present hardcoded demo credentials', () => {

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Username, email, or phone')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Sunita Rao|Shanti Sharma/ })).not.toBeInTheDocument();
  });

  it('does not authenticate locally and sends entered credentials to Django', async () => {
    const request = vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({ csrfToken: 'csrf-test' })
      .mockRejectedValueOnce({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid identifier or password.',
      });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Username, email, or phone'), 'shanti');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid identifier or password.');
    expect(request).toHaveBeenNthCalledWith(2, '/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'shanti', password: 'not-a-real-password' }),
    });
    expect(apiClient.getCurrentUser()).toBeNull();
    expect(apiClient.isMockMode()).toBe(false);
  });

  it('clears stale local demo session markers instead of restoring them', async () => {
    const profile = {
      id: 'legacy-demo-user',
      name: 'Legacy Demo User',
      role: 'RESIDENT' as const,
      flat: 'A-101',
      society: 'Example',
      phone: '',
      email: '',
    };
    sessionStorage.setItem('cerp_token', `demo_${profile.id}`);
    sessionStorage.setItem('cerp_user', JSON.stringify(profile));
    apiClient.resetBaseUrl();
    const request = vi.spyOn(apiClient, 'request');

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getCurrentUser()).toBeNull();
    });
    expect(apiClient.isMockMode()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('creates a resident account through the Django registration endpoint', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      token: 'session_2_newresident',
      user: {
        id: 'usr_2',
        name: 'newresident',
        role: 'RESIDENT',
        flat: 'Estate Office',
        society: 'Green Meadows Apartments, Bengaluru',
        phone: '9876501237',
        email: 'newresident@example.com',
      },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Username'), 'newresident');
    await user.type(screen.getByLabelText('Email'), 'newresident@example.com');
    await user.type(screen.getByLabelText('Phone number'), '9876501237');
    await user.type(screen.getByLabelText('Password'), 'StrongResidentPass!2026');
    await user.type(screen.getByLabelText('Confirm password'), 'StrongResidentPass!2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newresident',
          email: 'newresident@example.com',
          phone_number: '9876501237',
          password: 'StrongResidentPass!2026',
          confirm_password: 'StrongResidentPass!2026',
        }),
      });
    });
    expect(apiClient.getCurrentUser()?.name).toBe('newresident');
  });

  it('explains that registration was not confirmed when the API returns 502', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({ csrfToken: 'csrf-test' })
      .mockRejectedValueOnce({
      status: 502,
      code: 'HTTP_502',
      message: 'Bad Gateway',
      });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Username'), 'newresident');
    await user.type(screen.getByLabelText('Email'), 'newresident@example.com');
    await user.type(screen.getByLabelText('Phone number'), '9876501237');
    await user.type(screen.getByLabelText('Password'), 'StrongResidentPass!2026');
    await user.type(screen.getByLabelText('Confirm password'), 'StrongResidentPass!2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/Could not reach the registration server on port 8001/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(apiClient.getCurrentUser()).toBeNull();
  });
});
