import { describe, it, expect, beforeEach } from 'vitest';
import { mockBackend } from '../services/mockBackend';
import { DEMO_PERSONAS } from '../constants/personas';
import { CreateSosPayload } from '../types/incident';

describe('Auth, Privacy, and Authorization (Acceptance Criteria 1, 3, 4, 11)', () => {
  beforeEach(() => {
    mockBackend.reset();
  });

  it('resident can create SOS and receives incident ID, status, and creation time', () => {
    const resident = DEMO_PERSONAS.RESIDENT.profile;
    const payload: CreateSosPayload = {
      emergency_type: 'MEDICAL',
      description: 'Need oxygen assistance',
      latitude: 12.9249,
      longitude: 77.6748,
      accuracy: 10,
    };

    const res = mockBackend.createSos(resident, payload);
    expect(res.incident).toBeDefined();
    expect(res.incident.id).toMatch(/^INC-2026-BLR-/);
    expect(res.incident.status).toBe('OPEN');
    expect(res.incident.created_at).toBeDefined();
    expect(res.incident.emergency_type).toBe('MEDICAL');
  });

  it('SOS works with location unavailable', () => {
    const resident = DEMO_PERSONAS.RESIDENT.profile;
    const payload: CreateSosPayload = {
      emergency_type: 'FALL',
      // No coordinates provided
    };

    const res = mockBackend.createSos(resident, payload);
    expect(res.incident.status).toBe('OPEN');
    expect(res.incident.has_location).toBe(false);
    expect(res.incident.location).toBeUndefined();
  });

  it('validation error 400 when emergency type is missing', () => {
    const resident = DEMO_PERSONAS.RESIDENT.profile;
    const payload = {} as CreateSosPayload;

    expect(() => mockBackend.createSos(resident, payload)).toThrowError();
  });

  it('user cannot open another resident’s incident: returns 403 Forbidden', () => {
    // Another resident (not Mrs. Sharma) tries to open Mrs. Sharma's incident
    const unauthorizedResident = {
      ...DEMO_PERSONAS.RESIDENT.profile,
      id: 'usr_res_other_99',
      name: 'Mr. Anand Verma',
      flat: 'A-201',
    };

    expect(() => {
      mockBackend.getIncidentById(unauthorizedResident, 'INC-2026-BLR-1082');
    }).toThrow();
  });
});
