import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { incidentService } from '../services/incidentService';
import { apiClient } from '../services/apiClient';
import { IncidentDetail } from '../types/incident';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ role: 'ADMIN' }),
}));

const incident: IncidentDetail = {
  id: '42',
  emergency_type: 'MEDICAL',
  status: 'OPEN',
  description: 'Needs assistance',
  created_at: '2026-10-28T10:00:00Z',
  has_location: false,
  location_text: '',
  timeline: [],
  created_by_role: 'RESIDENT',
  is_reporter: false,
  can_check_in: false,
  my_assignment: null,
  assignments: [],
  resident_acknowledged_at: null,
};

describe('Incident text location', () => {
  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setBaseUrl('');
    vi.restoreAllMocks();
  });

  it('lets authorized desk users add a landmark and shows it after saving', async () => {
    vi.spyOn(incidentService, 'getIncidentById').mockResolvedValue(incident);
    const updateLocation = vi
      .spyOn(incidentService, 'updateIncidentLocation')
      .mockResolvedValue({ location_text: 'Block B, garden entrance' });

    render(
      <MemoryRouter initialEntries={['/incidents/42']}>
        <Routes>
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/No GPS or address was included/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Add address or landmark'), {
      target: { value: 'Block B, garden entrance' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(updateLocation).toHaveBeenCalledWith('42', 'Block B, garden entrance');
    });
    expect(await screen.findByText('Block B, garden entrance')).toBeInTheDocument();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Location description saved.');
  });
});
