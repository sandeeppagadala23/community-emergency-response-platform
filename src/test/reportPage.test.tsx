import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ReportPage } from '../pages/ReportPage';
import { apiClient } from '../services/apiClient';
import { reportService } from '../services/reportService';
import { EmergencyReport } from '../types/report';

const savedReport: EmergencyReport = {
  id: 15,
  title: 'Kitchen smoke',
  reporter: 4,
  reporter_username: 'resident-test',
  reporter_name: 'Resident Example',
  incident_type: 'FIRE',
  incident_type_display: 'Fire',
  location: 'Block A, Flat 101',
  latitude: null,
  longitude: null,
  description: 'Smoke is coming from the kitchen.',
  responded_by: null,
  responded_by_username: null,
  assigned_volunteer: null,
  assigned_volunteer_username: null,
  assigned_volunteer_name: null,
  response_notes: '',
  status: 'PENDING',
  status_display: 'Reported',
  created_at: '2026-10-28T10:00:00Z',
  updated_at: '2026-10-28T10:00:00Z',
};

const renderReportPage = () => render(
  <MemoryRouter>
    <AuthProvider>
      <ReportPage />
    </AuthProvider>
  </MemoryRouter>,
);

const installAuthenticatedSession = (
  initialProfile: {
    id: string;
    name: string;
    role: 'RESIDENT' | 'ADMIN';
    flat: string;
    society: string;
    phone: string;
    email: string;
  },
) => {
  let profile = initialProfile;
  apiClient.setAuth('session_test_user', profile);
  vi.spyOn(apiClient, 'request').mockImplementation(
    async function mockRequest<T>(endpoint: string): Promise<T> {
      if (endpoint === '/api/auth/csrf/') return { csrfToken: 'csrf-test' } as T;
      if (endpoint === '/api/auth/me/') return profile as T;
      if (endpoint === '/reports/api/reports/') return [] as T;
      if (endpoint === '/api/guardian-contacts/') return [] as T;
      throw new Error(`Unexpected API request: ${endpoint}`);
    },
  );
  return (nextProfile: typeof initialProfile) => {
    profile = nextProfile;
    apiClient.setAuth('session_test_user', profile);
  };
};

describe('Emergency report page', () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    sessionStorage.clear();
    apiClient.clearAuth();
    apiClient.setBaseUrl('');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: originalGeolocation,
      });
    } else {
      Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('routes /reports to the protected report page', async () => {
    const resident = {
      id: 'resident-test',
      name: 'Resident Example',
      role: 'RESIDENT' as const,
      flat: 'B-304',
      society: 'Green Meadows',
      phone: '1234567890',
      email: 'resident@example.in',
    };
    window.history.pushState({}, '', '/reports');
    installAuthenticatedSession(resident);

    render(<App />);

    expect(await screen.findByRole('heading', {
      name: 'Raise a Complaint / Report Emergency',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeEnabled();
  });

  it('redirects signed-out visitors from /reports to login', async () => {
    window.history.pushState({}, '', '/reports');

    render(<App />);

    expect(await screen.findByLabelText('Username, email, or phone')).toBeInTheDocument();
  });

  it('routes authenticated users to the database-backed contacts page', async () => {
    const resident = {
      id: 'resident-test',
      name: 'Resident Example',
      role: 'RESIDENT' as const,
      flat: 'B-304',
      society: 'Green Meadows',
      phone: '1234567890',
      email: 'resident@example.in',
    };
    window.history.pushState({}, '', '/contacts');
    installAuthenticatedSession(resident);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Emergency contacts' }))
      .toBeInTheDocument();
  });

  it('exposes report navigation to residents and from the incident board', async () => {
    const resident = {
      id: 'resident-test',
      name: 'Resident Example',
      role: 'RESIDENT' as const,
      flat: 'B-304',
      society: 'Green Meadows',
      phone: '1234567890',
      email: 'resident@example.in',
    };
    const admin = {
      id: 'admin-test',
      name: 'Admin Example',
      role: 'ADMIN' as const,
      flat: 'Control Room',
      society: 'Green Meadows',
      phone: '1234567890',
      email: 'admin@example.in',
    };
    window.history.pushState({}, '', '/sos');
    const setAuthenticatedProfile = installAuthenticatedSession(resident);
    const residentView = render(<App />);

    expect(await screen.findByRole('link', { name: 'Report' })).toHaveAttribute('href', '/reports');
    residentView.unmount();

    setAuthenticatedProfile(admin);
    window.history.pushState({}, '', '/incidents');
    render(<App />);

    expect(await screen.findByRole('link', { name: 'Raise Complaint' }))
      .toHaveAttribute('href', '/reports');
  });

  it('requires category, location, and details before submission', async () => {
    const createReport = vi.spyOn(reportService, 'createReport');
    const user = userEvent.setup();

    renderReportPage();

    expect(screen.getByLabelText(/Incident title/)).toBeRequired();
    expect(screen.getByLabelText(/Complaint \/ emergency category/)).toBeRequired();
    expect(screen.getByLabelText(/Location \/ flat \/ address/)).toBeRequired();
    expect(screen.getByLabelText(/Detailed description/)).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(createReport).not.toHaveBeenCalled();
  });

  it('uses the existing Django report list and creation endpoints', async () => {
    const request = vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce([savedReport])
      .mockResolvedValueOnce(savedReport);

    await expect(reportService.getReports()).resolves.toEqual([savedReport]);
    await expect(reportService.createReport({
      title: 'Kitchen smoke',
      incident_type: 'FIRE',
      location: savedReport.location,
      description: savedReport.description,
    })).resolves.toEqual(savedReport);

    expect(request).toHaveBeenNthCalledWith(1, '/reports/api/reports/');
    expect(request).toHaveBeenNthCalledWith(2, '/reports/api/reports/', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Kitchen smoke',
        incident_type: 'FIRE',
        location: savedReport.location,
        description: savedReport.description,
      }),
    });
  });

  it('submits the report and shows the persisted record in the refreshed list', async () => {
    vi.spyOn(reportService, 'getReports')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedReport]);
    const createReport = vi.spyOn(reportService, 'createReport').mockResolvedValue(savedReport);
    const user = userEvent.setup();

    renderReportPage();

    await user.type(screen.getByLabelText(/Incident title/), '  Kitchen smoke  ');
    await user.selectOptions(screen.getByLabelText(/Complaint \/ emergency category/), 'FIRE');
    await user.type(screen.getByLabelText(/Location \/ flat \/ address/), '  Block A, Flat 101  ');
    await user.type(screen.getByLabelText(/Detailed description/), '  Smoke is coming from the kitchen.  ');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        title: 'Kitchen smoke',
        incident_type: 'FIRE',
        location: 'Block A, Flat 101',
        description: 'Smoke is coming from the kitchen.',
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Report #15 was saved successfully.');
    expect(screen.getByText('Kitchen smoke · #15')).toBeInTheDocument();
    expect(screen.getByText('Smoke is coming from the kitchen.')).toBeInTheDocument();
  });

  it('lets admins inspect incident history and assign an eligible volunteer', async () => {
    const acknowledgedReport: EmergencyReport = {
      ...savedReport,
      status: 'ACKNOWLEDGED',
      status_display: 'Acknowledged',
    };
    const assignedReport: EmergencyReport = {
      ...acknowledgedReport,
      status: 'ASSIGNED',
      status_display: 'Assigned',
      assigned_volunteer: 25,
      assigned_volunteer_username: 'volunteer-one',
      assigned_volunteer_name: 'Volunteer One',
    };
    vi.spyOn(reportService, 'getReports').mockResolvedValue([acknowledgedReport]);
    vi.spyOn(reportService, 'getAvailableVolunteers').mockResolvedValue([
      { id: 25, name: 'Volunteer One', username: 'volunteer-one' },
    ]);
    const historyRequest = vi.spyOn(reportService, 'getReportHistory').mockResolvedValue([{
      id: 31,
      event_type: 'CREATED',
      event_type_display: 'Report created',
      from_status: '',
      to_status: 'PENDING',
      details: 'Emergency report submitted.',
      actor: 4,
      actor_username: 'resident-test',
      actor_name: 'Resident Example',
      created_at: '2026-10-28T10:00:00Z',
    }]);
    const assignRequest = vi.spyOn(reportService, 'assignVolunteer').mockResolvedValue(assignedReport);
    const admin = {
      id: '1',
      name: 'Admin Example',
      role: 'ADMIN' as const,
      flat: 'Control Room',
      society: 'Green Meadows',
      phone: '',
      email: 'admin@example.in',
    };
    const user = userEvent.setup();

    installAuthenticatedSession(admin);
    renderReportPage();

    await user.click(await screen.findByRole('button', { name: 'View incident history' }));
    expect(await screen.findByText(/Emergency report submitted\./)).toBeInTheDocument();
    expect(historyRequest).toHaveBeenCalledWith(savedReport.id);

    await user.selectOptions(
      screen.getByLabelText('Assign an available volunteer'),
      '25',
    );
    await user.click(screen.getByRole('button', { name: 'Assign volunteer' }));

    await waitFor(() => {
      expect(assignRequest).toHaveBeenCalledWith(savedReport.id, 25);
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Report #15 was assigned to Volunteer One.',
    );
    expect(screen.getByText(/Assigned to Volunteer One/)).toBeInTheDocument();
  });

  it('rounds detected GPS to six decimals and submits numeric coordinates', async () => {
    const reportWithCoordinates = {
      ...savedReport,
      latitude: 12.971599,
      longitude: 77.594563,
    };
    vi.spyOn(reportService, 'getReports')
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([reportWithCoordinates]);
    const createReport = vi.spyOn(reportService, 'createReport')
      .mockResolvedValue(reportWithCoordinates);
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 12.9715987645,
          longitude: 77.594562987,
        } as GeolocationCoordinates,
        timestamp: Date.now(),
      });
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const user = userEvent.setup();

    renderReportPage();

    await user.click(screen.getByRole('button', { name: 'Detect my location' }));
    expect(await screen.findByText('GPS coordinates: 12.971599, 77.594563')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Incident title/), 'Kitchen smoke');
    await user.selectOptions(screen.getByLabelText(/Complaint \/ emergency category/), 'FIRE');
    await user.type(screen.getByLabelText(/Location \/ flat \/ address/), 'Block A entrance');
    await user.type(screen.getByLabelText(/Detailed description/), 'Smoke is visible.');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        title: 'Kitchen smoke',
        incident_type: 'FIRE',
        location: 'Block A entrance',
        description: 'Smoke is visible.',
        latitude: 12.971599,
        longitude: 77.594563,
      });
    });
    expect(await screen.findByText('GPS coordinates: 12.971599, 77.594563')).toBeInTheDocument();
  });

  it('lets a report proceed with a manual address when GPS permission is denied', async () => {
    vi.spyOn(reportService, 'getReports').mockResolvedValue([]);
    const createReport = vi.spyOn(reportService, 'createReport').mockResolvedValue(savedReport);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(
          (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: 1, message: 'Permission denied' } as GeolocationPositionError);
          },
        ),
      },
    });
    const user = userEvent.setup();

    renderReportPage();
    await user.click(screen.getByRole('button', { name: 'Detect my location' }));
    expect(await screen.findByText(/Location permission was denied/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Incident title/), 'Damaged entry light');
    await user.selectOptions(screen.getByLabelText(/Complaint \/ emergency category/), 'OTHER');
    await user.type(screen.getByLabelText(/Location \/ flat \/ address/), 'Near the main gate');
    await user.type(screen.getByLabelText(/Detailed description/), 'The entry light is damaged.');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        title: 'Damaged entry light',
        incident_type: 'OTHER',
        location: 'Near the main gate',
        description: 'The entry light is damaged.',
      });
    });
  });

  it('shows backend submission failures without a success message', async () => {
    vi.spyOn(reportService, 'getReports').mockResolvedValue([]);
    vi.spyOn(reportService, 'createReport').mockRejectedValue({
      status: 400,
      code: 'HTTP_400',
      message: 'Please provide a valid location.',
    });
    const user = userEvent.setup();

    renderReportPage();

    await user.type(screen.getByLabelText(/Incident title/), 'Damaged fixture');
    await user.selectOptions(screen.getByLabelText(/Complaint \/ emergency category/), 'OTHER');
    await user.type(screen.getByLabelText(/Location \/ flat \/ address/), 'Near main gate');
    await user.type(screen.getByLabelText(/Detailed description/), 'A damaged light fixture needs attention.');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please provide a valid location.');
    expect(screen.queryByText(/was saved successfully/)).not.toBeInTheDocument();
  });

  it('keeps the saved report visible if the follow-up list refresh fails', async () => {
    vi.spyOn(reportService, 'getReports')
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Report list temporarily unavailable.'));
    vi.spyOn(reportService, 'createReport').mockResolvedValue(savedReport);
    const user = userEvent.setup();

    renderReportPage();

    await user.type(screen.getByLabelText(/Incident title/), 'Kitchen smoke');
    await user.selectOptions(screen.getByLabelText(/Complaint \/ emergency category/), 'FIRE');
    await user.type(screen.getByLabelText(/Location \/ flat \/ address/), savedReport.location);
    await user.type(screen.getByLabelText(/Detailed description/), savedReport.description);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Report #15 was saved successfully.');
    expect(screen.getByText('Kitchen smoke · #15')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh reports');
  });
});
