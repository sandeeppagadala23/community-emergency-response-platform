import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { incidentService } from '../services/incidentService';
import { IncidentDetail, ResponderAssignment } from '../types/incident';

const authState = vi.hoisted(() => ({ role: 'ADMIN' }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ role: authState.role }),
}));

const arrivalConfirmation = {
  id: 21,
  incident_id: '42',
  assignment_id: 9,
  responder_id: 8,
  responder_name: 'Jordan Responder',
  confirmed_by_id: 5,
  confirmed_by_name: 'Dispatch Operator',
  confirmed_by_role: 'SECURITY',
  confirmed_at: '2026-11-11T12:00:00Z',
  confirmation_result: 'CONFIRMED' as const,
  confirmation_note: '',
};

const makeAssignment = (
  confirmation: ResponderAssignment['arrival_confirmation'] = null,
  checkedInAt: string | null = '2026-11-11T11:55:00Z',
): ResponderAssignment => ({
  id: 9,
  responder_id: 8,
  responder_name: 'Jordan Responder',
  responder_role: 'VOLUNTEER',
  assigned_at: '2026-11-11T11:00:00Z',
  checked_in_at: checkedInAt,
  arrival_confirmation: confirmation,
});

const makeIncident = (
  confirmation: ResponderAssignment['arrival_confirmation'] = null,
  checkedInAt: string | null = '2026-11-11T11:55:00Z',
): IncidentDetail => {
  const assignment = makeAssignment(confirmation, checkedInAt);
  return {
    id: '42',
    emergency_type: 'MEDICAL',
    status: 'ACKNOWLEDGED',
    description: 'Needs assistance',
    created_at: '2026-11-11T10:00:00Z',
    has_location: false,
    timeline: [],
    created_by_role: 'RESIDENT',
    is_reporter: false,
    can_check_in: checkedInAt === null,
    my_assignment: assignment,
    assignments: [assignment],
    resident_acknowledged_at: null,
  };
};

let currentIncident: IncidentDetail;

function renderIncidentPage() {
  return render(
    <MemoryRouter initialEntries={['/incidents/42']}>
      <Routes>
        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('independent responder arrival confirmation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState.role = 'ADMIN';
    currentIncident = makeIncident();
    vi.spyOn(incidentService, 'getIncidentById').mockImplementation(
      async () => currentIncident,
    );
    vi.spyOn(incidentService, 'getAvailableResponders').mockResolvedValue([]);
    vi.spyOn(incidentService, 'confirmResponderArrival').mockImplementation(
      async () => {
        currentIncident = makeIncident(arrivalConfirmation);
        return currentIncident.assignments[0];
      },
    );
    vi.spyOn(incidentService, 'transitionIncident').mockResolvedValue();
  });

  it.each([
    ['ADMIN', true],
    ['SECURITY', true],
    ['VOLUNTEER', false],
    ['RESIDENT', false],
    ['GUARDIAN', false],
  ])('%s confirmation action visibility follows the role', async (role, canConfirm) => {
    authState.role = role;
    renderIncidentPage();

    await screen.findByText('Responder assignment and arrival');
    const confirmationAction = screen.queryByRole('button', {
      name: 'Confirm Jordan Responder arrived',
    });
    expect(confirmationAction !== null).toBe(canConfirm);
  });

  it('shows a self-reported arrival as pending and updates to confirmed backend state', async () => {
    const confirm = vi.mocked(incidentService.confirmResponderArrival);
    renderIncidentPage();

    expect(await screen.findByText(/Arrival reported · awaiting independent confirmation/))
      .toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm Jordan Responder arrived' }),
    );

    expect(await screen.findByText(/Independently confirmed by Dispatch Operator/))
      .toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('42', 9);

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Select independently confirmed responder' }),
      { target: { value: '42:9' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start response' }));

    await waitFor(() => {
      expect(incidentService.transitionIncident).toHaveBeenCalledWith(
        '42',
        'IN_PROGRESS',
        9,
      );
    });
  });

  it('keeps the arrival pending and reports API failures without falsely confirming it', async () => {
    vi.mocked(incidentService.confirmResponderArrival).mockRejectedValueOnce(
      new Error('Confirmation failed'),
    );
    renderIncidentPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm Jordan Responder arrived' }),
    );

    expect(await screen.findAllByText('Confirmation failed')).not.toHaveLength(0);
    expect(screen.getByText(/Arrival reported · awaiting independent confirmation/))
      .toBeInTheDocument();
  });

  it('disables repeated confirmation clicks while the request is pending', async () => {
    let resolveConfirmation!: (assignment: ResponderAssignment) => void;
    const pendingConfirmation = new Promise<ResponderAssignment>((resolve) => {
      resolveConfirmation = resolve;
    });
    const confirm = vi.mocked(incidentService.confirmResponderArrival);
    confirm.mockReturnValue(pendingConfirmation);
    renderIncidentPage();

    const button = await screen.findByRole('button', {
      name: 'Confirm Jordan Responder arrived',
    });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledTimes(1);

    currentIncident = makeIncident(arrivalConfirmation);
    await act(async () => {
      resolveConfirmation(currentIncident.assignments[0]);
      await pendingConfirmation;
    });
    expect(await screen.findByText(/Independently confirmed by Dispatch Operator/))
      .toBeInTheDocument();
  });

  it('lets an assigned responder report arrival without showing confirmation controls', async () => {
    authState.role = 'VOLUNTEER';
    currentIncident = makeIncident(null, null);
    renderIncidentPage();

    expect(await screen.findByRole('button', { name: 'Report arrival' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm Jordan Responder arrived' }),
    ).not.toBeInTheDocument();
  });
});
