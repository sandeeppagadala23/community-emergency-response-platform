import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ContactRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { contactService } from '../services/contactService';
import {
  GuardianContact,
  GuardianContactInput,
  GuardianType,
} from '../types/contact';
import { formatIstTime } from '../utils/dateUtils';

const emptyContact = (): GuardianContactInput => ({
  name: '',
  relationship: '',
  phone_number: '',
  email: '',
  guardian_type: 'PRIMARY',
});

export const GuardianContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<GuardianContact[]>([]);
  const [form, setForm] = useState<GuardianContactInput>(emptyContact);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [otpContactId, setOtpContactId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await contactService.getContacts());
      setError(null);
    } catch (loadError: unknown) {
      setError(apiClient.normalizeError(loadError).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchContacts = async () => {
      try {
        const loadedContacts = await contactService.getContacts();
        if (active) {
          setContacts(loadedContacts);
          setError(null);
        }
      } catch (loadError: unknown) {
        if (active) setError(apiClient.normalizeError(loadError).message);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchContacts();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyContact());
    setEditingId(null);
  };

  const saveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      if (editingId === null) {
        await contactService.createContact(form);
        setMessage('Emergency contact added. Verify it before it receives SOS notifications.');
      } else {
        await contactService.updateContact(editingId, form);
        setMessage('Emergency contact updated. Changed phone or email details require verification again.');
      }
      resetForm();
      await loadContacts();
    } catch (saveError: unknown) {
      setError(apiClient.normalizeError(saveError).message);
    } finally {
      setIsSaving(false);
    }
  };

  const editContact = (contact: GuardianContact) => {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      relationship: contact.relationship,
      phone_number: contact.phone_number,
      email: contact.email,
      guardian_type: contact.guardian_type,
    });
    setError(null);
    setMessage(null);
  };

  const deleteContact = async (contact: GuardianContact) => {
    if (!window.confirm(`Remove ${contact.name} from your emergency contacts?`)) return;
    setDeletingId(contact.id);
    setError(null);
    setMessage(null);
    try {
      await contactService.deleteContact(contact.id);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      if (editingId === contact.id) resetForm();
      if (otpContactId === contact.id) setOtpContactId(null);
      setMessage('Emergency contact removed.');
    } catch (deleteError: unknown) {
      setError(apiClient.normalizeError(deleteError).message);
    } finally {
      setDeletingId(null);
    }
  };

  const requestOtp = async (contactId: number) => {
    setIsSendingOtp(true);
    setOtpCode('');
    setOtpContactId(contactId);
    setError(null);
    setMessage(null);
    try {
      const result = await contactService.requestVerificationCode(contactId);
      setMessage(result.detail);
    } catch (otpError: unknown) {
      setError(apiClient.normalizeError(otpError).message);
      setOtpContactId(null);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async (contactId: number) => {
    setIsVerifying(true);
    setError(null);
    setMessage(null);
    try {
      await contactService.verifyContact(contactId, otpCode);
      setOtpContactId(null);
      setOtpCode('');
      setMessage('Emergency contact verified and eligible for alert routing.');
      await loadContacts();
    } catch (otpError: unknown) {
      setError(apiClient.normalizeError(otpError).message);
    } finally {
      setIsVerifying(false);
    }
  };

  const updateForm = <K extends keyof GuardianContactInput>(
    key: K,
    value: GuardianContactInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="border-b border-rule pb-3 dark:border-rule-dark">
        <h1 className="font-serif text-xl font-bold text-ink dark:text-ink-dark sm:text-2xl">
          Emergency contacts
        </h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-muted-dark">
          Manage your primary and secondary guardians. Only verified contacts are used for SOS alert routing.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-signal/30 bg-signal-light/40 p-3 text-sm text-signal">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-ok/30 bg-ok-light p-3 text-sm text-ok dark:bg-ok-light-dark">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-ink dark:text-ink-dark">
          Your contacts
        </h2>
        {isLoading ? (
          <p role="status" className="rounded-control border border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            Loading contacts…
          </p>
        ) : contacts.length === 0 ? (
          <p className="rounded-control border border-dashed border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            No emergency contacts yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact) => (
              <li key={contact.id} className="space-y-3 rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink dark:text-ink-dark">{contact.name}</h3>
                      <span className="rounded-control border border-rule px-2 py-0.5 text-[11px] text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
                        {contact.guardian_type_display}
                      </span>
                      <span className={`rounded-control border px-2 py-0.5 text-[11px] font-semibold ${contact.is_verified ? 'border-ok/30 bg-ok-light text-ok dark:bg-ok-light-dark' : 'border-warn/30 bg-warn-light text-warn-text dark:text-warn-text-dark dark:bg-warn-light-dark'}`}>
                        {contact.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                      {contact.relationship} · {contact.phone_number}
                    </p>
                    {contact.email && (
                      <p className="break-all text-sm text-ink-muted dark:text-ink-muted-dark">{contact.email}</p>
                    )}
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                      Added {formatIstTime(contact.created_at, '12h')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!contact.is_verified && (
                      <button
                        type="button"
                        onClick={() => void requestOtp(contact.id)}
                        disabled={isSendingOtp}
                        className="rounded-control border border-action px-3 py-1.5 text-xs font-semibold text-action disabled:opacity-50 dark:text-teal-400"
                      >
                        {isSendingOtp && otpContactId === contact.id ? 'Requesting…' : 'Verify contact'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => editContact(contact)}
                      className="inline-flex items-center gap-1 rounded-control border border-rule px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-action dark:border-rule-dark dark:text-ink-muted-dark"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteContact(contact)}
                      disabled={deletingId === contact.id}
                      className="inline-flex items-center gap-1 rounded-control border border-signal/30 px-3 py-1.5 text-xs font-semibold text-signal disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === contact.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
                {otpContactId === contact.id && !contact.is_verified && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void verifyOtp(contact.id);
                    }}
                    className="flex flex-col gap-2 border-t border-rule pt-3 dark:border-rule-dark sm:flex-row"
                  >
                    <label className="sr-only" htmlFor={`otp-${contact.id}`}>Six-digit verification code</label>
                    <input
                      id={`otp-${contact.id}`}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Six-digit code"
                      className="min-w-0 flex-1 rounded-control border border-rule bg-paper px-3 py-2 text-sm text-ink dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
                    />
                    <button
                      type="submit"
                      disabled={isVerifying || otpCode.length !== 6}
                      className="rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {isVerifying ? 'Verifying…' : 'Confirm code'}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={saveContact} className="space-y-4 rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink dark:text-ink-dark">
          {editingId === null ? <Plus className="h-5 w-5" /> : <Pencil className="h-4 w-4" />}
          {editingId === null ? 'Add emergency contact' : 'Edit emergency contact'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium" htmlFor="contact-name">
            Name
            <input id="contact-name" required maxLength={150} value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm dark:border-rule-dark dark:bg-paper-dark" />
          </label>
          <label className="block text-sm font-medium" htmlFor="contact-relationship">
            Relationship
            <input id="contact-relationship" required maxLength={50} value={form.relationship} onChange={(event) => updateForm('relationship', event.target.value)} className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm dark:border-rule-dark dark:bg-paper-dark" />
          </label>
          <label className="block text-sm font-medium" htmlFor="contact-phone">
            Phone number
            <input id="contact-phone" required type="tel" maxLength={15} value={form.phone_number} onChange={(event) => updateForm('phone_number', event.target.value)} className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm dark:border-rule-dark dark:bg-paper-dark" />
          </label>
          <label className="block text-sm font-medium" htmlFor="contact-email">
            Email <span className="font-normal text-ink-muted">(optional)</span>
            <input id="contact-email" type="email" maxLength={254} value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm dark:border-rule-dark dark:bg-paper-dark" />
          </label>
          <label className="block text-sm font-medium" htmlFor="contact-type">
            Contact priority
            <select id="contact-type" value={form.guardian_type} onChange={(event) => updateForm('guardian_type', event.target.value as GuardianType)} className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm dark:border-rule-dark dark:bg-paper-dark">
              <option value="PRIMARY">Primary guardian</option>
              <option value="SECONDARY">Secondary guardian</option>
            </select>
          </label>
        </div>
        <p className="flex items-start gap-2 text-xs text-ink-muted dark:text-ink-muted-dark">
          <ContactRound className="mt-0.5 h-4 w-4 shrink-0" />
          Verification codes expire after 10 minutes and allow up to five attempts. Development codes are written to the Django console, not sent externally.
        </p>
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          {editingId !== null && (
            <button type="button" onClick={resetForm} className="rounded-control border border-rule px-4 py-2 text-xs font-semibold text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
              Cancel
            </button>
          )}
          <button type="submit" disabled={isSaving} className="rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {isSaving ? 'Saving…' : editingId === null ? 'Add contact' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
