import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IncidentListPage } from '../pages/IncidentListPage';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/incidentService', () => ({
  incidentService: {
    getIncidents: vi.fn(),
  },
}));

describe('Volunteer incident dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '17',
        name: 'Volunteer One',
        role: 'VOLUNTEER',
        flat: 'Not assigned',
        society: 'Green Meadows',
        phone: '',
        email: 'volunteer@example.test',
      },
      role: 'VOLUNTEER',
      isLoading: false,
      authError: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(incidentService.getIncidents).mockResolvedValue([]);
  });

  it('explains that incidents are assigned by an administrator when none are assigned', async () => {
    render(
      <MemoryRouter>
        <IncidentListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(incidentService.getIncidents).toHaveBeenCalled();
    });
    expect(await screen.findByText(/No incidents are assigned to you yet/)).toBeInTheDocument();
    expect(screen.getByText(/An administrator will assign an emergency and notify you here/)).toBeInTheDocument();
    expect(screen.getByText(/Check your notifications and refresh this page/)).toBeInTheDocument();
    expect(screen.getByText(/Showing incidents assigned to you/)).toBeInTheDocument();
    expect(screen.queryByText(/Block B/)).not.toBeInTheDocument();
  });
});
