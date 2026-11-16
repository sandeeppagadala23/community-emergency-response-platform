import { apiClient } from './apiClient';
import {
  AvailableVolunteer,
  CreateEmergencyReportPayload,
  EmergencyReportEvent,
  EmergencyReport,
} from '../types/report';

export const reportService = {
  async getReports(): Promise<EmergencyReport[]> {
    if (apiClient.isMockMode()) {
      throw {
        status: 501,
        code: 'LIVE_ACCOUNT_REQUIRED',
        message: 'Sign in with a live account to load saved reports.',
      };
    }

    return apiClient.request<EmergencyReport[]>('/reports/api/reports/');
  },

  async createReport(payload: CreateEmergencyReportPayload): Promise<EmergencyReport> {
    if (apiClient.isMockMode()) {
      throw {
        status: 501,
        code: 'LIVE_ACCOUNT_REQUIRED',
        message: 'Sign in with a live account to save an emergency report.',
      };
    }

    return apiClient.request<EmergencyReport>('/reports/api/reports/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateReportStatus(
    id: number,
    status: EmergencyReport['status'],
    response_notes: string,
  ): Promise<Pick<EmergencyReport, 'id' | 'status' | 'status_display' | 'responded_by' | 'responded_by_username' | 'response_notes' | 'updated_at'>> {
    return apiClient.request(`/reports/api/reports/${id}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, response_notes }),
    });
  },

  async getAvailableVolunteers(): Promise<AvailableVolunteer[]> {
    return apiClient.request<AvailableVolunteer[]>('/reports/api/volunteers/');
  },

  async assignVolunteer(
    reportId: number,
    volunteerId: number,
  ): Promise<EmergencyReport> {
    return apiClient.request<EmergencyReport>(`/reports/api/reports/${reportId}/assign/`, {
      method: 'POST',
      body: JSON.stringify({ volunteer_id: volunteerId }),
    });
  },

  async getReportHistory(reportId: number): Promise<EmergencyReportEvent[]> {
    return apiClient.request<EmergencyReportEvent[]>(
      `/reports/api/reports/${reportId}/history/`,
    );
  },
};
