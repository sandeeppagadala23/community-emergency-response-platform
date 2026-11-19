import { apiClient } from './apiClient';
import { SecurityDashboardData, SecurityGuard } from '../types/security';

export const securityService = {
  getDashboard(): Promise<SecurityDashboardData> {
    return apiClient.request<SecurityDashboardData>('/api/auth/security/dashboard/');
  },

  getProfile(): Promise<SecurityGuard> {
    return apiClient.request<SecurityGuard>('/api/auth/security/profile/');
  },

  updateProfile(
    data: Partial<Pick<SecurityGuard, 'shift'>> & { email?: string },
  ): Promise<SecurityGuard> {
    return apiClient.request<SecurityGuard>('/api/auth/security/profile/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  listGuards(): Promise<SecurityGuard[]> {
    return apiClient.request<SecurityGuard[]>('/api/admin/security-guards/');
  },

  createGuard(data: {
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number: string;
    employee_id?: string;
    shift?: string;
    password: string;
    society_id?: number | null;
  }): Promise<SecurityGuard> {
    return apiClient.request<SecurityGuard>('/api/admin/security-guards/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateGuard(
    id: number,
    data: Partial<SecurityGuard> & {
      is_active?: boolean;
      password?: string;
      phone_number?: string;
      society_id?: number | null;
    },
  ): Promise<SecurityGuard> {
    return apiClient.request<SecurityGuard>(`/api/admin/security-guards/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getGuard(id: number): Promise<SecurityGuard> {
    return apiClient.request<SecurityGuard>(`/api/admin/security-guards/${id}/`);
  },
};
