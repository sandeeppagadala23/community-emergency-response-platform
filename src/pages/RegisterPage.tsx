import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBackendUnavailable(false);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        username,
        email,
        phone_number: phoneNumber,
        password,
        confirm_password: confirmPassword,
      });
      navigate('/sos', { replace: true });
    } catch (registrationError) {
      const normalizedError = apiClient.normalizeError(registrationError);
      if (normalizedError.status === 502 || normalizedError.status === 0) {
        setBackendUnavailable(true);
        setError('Could not reach the registration server on port 8001. Your account was not confirmed as created.');
      } else {
        setError(normalizedError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper dark:bg-paper-dark px-4 py-10 text-ink dark:text-ink-dark">
      <section className="w-full max-w-md rounded-panel border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark p-6 shadow-overlay sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-control border border-rule dark:border-rule-dark text-signal">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold">Green Meadows</h1>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Emergency Response</p>
          </div>
        </div>

        <h2 className="font-serif text-lg font-semibold">Create resident account</h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-muted-dark">
          Create an account to sign in and test the emergency SOS workflow.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-control border border-signal/30 bg-signal/5 p-3 text-sm text-signal"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              {backendUnavailable && (
                <p className="mt-1">
                  Check the backend connection and try again. No account was created.
                </p>
              )}
            </div>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium" htmlFor="register-username">
            Username
            <input
              id="register-username"
              name="username"
              autoComplete="username"
              required
              maxLength={150}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="register-email">
            Email
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="register-phone">
            Phone number
            <input
              id="register-phone"
              name="phone_number"
              type="tel"
              autoComplete="tel"
              required
              maxLength={15}
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="register-password">
            Password
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="register-confirm-password">
            Confirm password
            <input
              id="register-confirm-password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-control bg-action px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted dark:text-ink-muted-dark">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-action underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
};
