import { apiClient } from './apiClient';
import {
  ContactOtpResponse,
  GuardianContact,
  GuardianContactInput,
} from '../types/contact';

const contactsEndpoint = '/api/guardian-contacts/';

export const contactService = {
  getContacts(): Promise<GuardianContact[]> {
    return apiClient.request<GuardianContact[]>(contactsEndpoint);
  },

  createContact(contact: GuardianContactInput): Promise<GuardianContact> {
    return apiClient.request<GuardianContact>(contactsEndpoint, {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  updateContact(
    id: number,
    contact: GuardianContactInput,
  ): Promise<GuardianContact> {
    return apiClient.request<GuardianContact>(`${contactsEndpoint}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(contact),
    });
  },

  async deleteContact(id: number): Promise<void> {
    await apiClient.request(`${contactsEndpoint}${id}/`, { method: 'DELETE' });
  },

  requestVerificationCode(id: number): Promise<ContactOtpResponse> {
    return apiClient.request<ContactOtpResponse>(
      `${contactsEndpoint}${id}/send-otp/`,
      { method: 'POST' },
    );
  },

  verifyContact(id: number, code: string): Promise<{ is_verified: boolean }> {
    return apiClient.request<{ is_verified: boolean }>(
      `${contactsEndpoint}${id}/verify-otp/`,
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    );
  },
};
