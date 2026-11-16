import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SosHomePage } from '../pages/SosHomePage';
import { SosStatusPage } from '../pages/SosStatusPage';
import { apiClient } from '../services/apiClient';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'resident-test',
      name: 'Resident Example',
      role: 'RESIDENT',
      flat: 'B-304',
      society: 'Green Meadows',
    },
  }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

let originalGeolocation: PropertyDescriptor | undefined;

describe('SOS activation page', () => {
  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setBaseUrl('');
    vi.restoreAllMocks();
    originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    } else {
      Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('captures browser GPS coordinates and submits them to the Django SOS API', async () => {
    const position: GeolocationPosition = {
      coords: {
        latitude: 12.971612347,
        longitude: 77.594612987,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    };
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const request = vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 987,
        category: 'MEDICAL',
        message: 'Need assistance',
        status: 'PENDING',
        created_at: '2026-10-28T10:00:00Z',
        latitude: '12.971612',
        longitude: '77.594613',
      })
      .mockResolvedValueOnce({
        id: '987',
        status: 'OPEN',
        created_at: '2026-10-28T10:00:00Z',
        emergency_type: 'MEDICAL',
        counts: {
          total_recipients: 1,
          sent: 1,
          delivered: 0,
          failed: 0,
          acknowledged: 0,
        },
        stages: {
          recorded: true,
          sent: true,
          delivered: false,
          acknowledged: false,
        },
        is_reporter: true,
        has_checked_in_responder: false,
        resident_acknowledged_at: null,
        is_simulated: true,
        recipient_roles: ['SECURITY'],
      });

    render(
      <MemoryRouter initialEntries={['/sos']}>
        <Routes>
          <Route path="/sos" element={<SosHomePage />} />
          <Route path="/sos/active/:id" element={<SosStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Location ready/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Medical/ }));
    fireEvent.click(screen.getByText(/Can't hold\? Tap for one-click confirmation/i));
    fireEvent.click(screen.getByRole('button', { name: /Confirm and Send SOS/i }));

    expect(await screen.findByRole('heading', { name: 'Your alert has been recorded' }))
      .toBeInTheDocument();
    expect(screen.getByText('987')).toBeInTheDocument();
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/alerts/api/sos/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Idempotency-Key': expect.any(String) },
        }),
      );
    });
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/alerts/api/sos/987/status/');
    });
    const requestBody = JSON.parse(request.mock.calls[0][1]?.body as string);
    expect(requestBody).toMatchObject({
      emergency_type: 'MEDICAL',
      latitude: 12.971612,
      longitude: 77.594613,
      accuracy: 8,
    });
    expect(requestBody).not.toHaveProperty('reporter');
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );

  });

  it('submits a resident-entered address when browser GPS is unavailable', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        }),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 988,
      category: 'FIRE',
      message: '',
      status: 'PENDING',
      created_at: '2026-10-28T10:00:00Z',
      latitude: null,
      longitude: null,
      location_text: 'Block B, near the garden entrance',
    });

    render(
      <MemoryRouter initialEntries={['/sos']}>
        <Routes>
          <Route path="/sos" element={<SosHomePage />} />
          <Route path="/sos/active/:id" element={<p>Active alert page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/Location unavailable/);
    expect(await screen.findByText('User denied Geolocation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Fire/ }));
    fireEvent.change(screen.getByLabelText(/Address or landmark/), {
      target: { value: 'Block B, near the garden entrance' },
    });
    fireEvent.click(screen.getByText(/Can't hold\? Tap for one-click confirmation/i));
    fireEvent.click(screen.getByRole('button', { name: /Confirm and Send SOS/i }));

    expect(await screen.findByText('Active alert page')).toBeInTheDocument();
    const requestBody = JSON.parse(request.mock.calls[0][1]?.body as string);
    expect(requestBody.location_text).toBe('Block B, near the garden entrance');
    expect(requestBody.latitude).toBeUndefined();
    expect(requestBody.longitude).toBeUndefined();
  });
});
