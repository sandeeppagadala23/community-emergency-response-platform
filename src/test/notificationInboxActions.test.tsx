import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { NotificationsInboxPage } from '../pages/NotificationsInboxPage';
import { notificationService } from '../services/notificationService';
import { InAppNotification } from '../types/notification';

const reportNotification: InAppNotification = {
  id: 'inapp_report_7',
  recipient_id: 'resident-1',
  incident_id: '',
  report_id: '7',
  resource_type: 'REPORT',
  title: 'Report assigned',
  body: 'A volunteer has been assigned to your report.',
  created_at: '2026-11-05T12:00:00Z',
  read: false,
  emergency_type: 'MEDICAL',
  flat: 'A-101',
};

const assignedSosNotification: InAppNotification = {
  id: 'inapp_31',
  raw_id: 31,
  recipient_id: 'volunteer-1',
  incident_id: '31',
  notification_type: 'SOS_ASSIGNED',
  resource_type: 'SOS',
  title: 'SOS incident assigned',
  body: 'Medical SOS alert #31 has been assigned to you.',
  created_at: '2026-11-09T12:00:00Z',
  read: false,
  emergency_type: 'MEDICAL',
  flat: 'Not assigned',
};

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsInboxPage />} />
        <Route path="/reports" element={<div>Reports destination</div>} />
        <Route path="/incidents/:id" element={<IncidentDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function IncidentDestination() {
  const { id } = useParams();
  return <div>Incident destination #{id}</div>;
}

describe('notification inbox report routing and bulk read action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates report-linked notification rows to reports', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue([reportNotification]);

    renderInbox();
    fireEvent.click(await screen.findByText('Report assigned'));

    expect(await screen.findByText('Reports destination')).toBeInTheDocument();
  });

  it('marks an assigned SOS notification read and opens its incident', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue([assignedSosNotification]);
    const markAsRead = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      ...assignedSosNotification,
      read: true,
      read_at: '2026-11-09T12:01:00Z',
    });

    renderInbox();
    fireEvent.click(await screen.findByText('SOS incident assigned'));

    await waitFor(() => expect(markAsRead).toHaveBeenCalledWith(
      'inapp_31',
      assignedSosNotification,
    ));
    expect(await screen.findByText('Incident destination #31')).toBeInTheDocument();
  });

  it('marks notifications read only after the bulk endpoint succeeds', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue([reportNotification]);
    const markAll = vi.spyOn(notificationService, 'markAllAsRead').mockResolvedValue();

    renderInbox();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(markAll).toHaveBeenCalledOnce());
    expect(await screen.findByText('Read')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
  });

  it('keeps unread state and displays an error if mark-all fails', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue([reportNotification]);
    vi.spyOn(notificationService, 'markAllAsRead').mockRejectedValue({
      code: 'OFFLINE',
      message: 'You are offline. This action was not sent.',
    });

    renderInbox();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('They remain unread.');
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });
});
