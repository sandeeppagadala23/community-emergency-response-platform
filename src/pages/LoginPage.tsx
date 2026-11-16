import React, { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export const LoginPage: React.FC = () => {
  const { login, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      navigate(returnTo || '/', { replace: true });
    } catch (loginError) {
      setError(apiClient.normalizeError(loginError).message);
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

        <h2 className="font-serif text-lg font-semibold">Sign in</h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-muted-dark">
          Sign in with your community account to access live emergency alerts and reports.
        </p>

        {(error || authError) && (
          <div
            role="alert"
            className="mt-5 rounded-control border border-signal/30 bg-signal/5 p-3 text-sm text-signal"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || authError}</span>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium" htmlFor="identifier">
            Username, email, or phone
            <input
              id="identifier"
              name="identifier"
              aria-label="Username, email, or phone"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1.5 w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="password">
            Password
            <span className="relative mt-1.5 block">
              <input
                id="password"
                name="password"
                aria-label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-control border border-rule bg-paper px-3 py-2.5 pr-11 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20 dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink dark:text-ink-muted-dark dark:hover:text-ink-dark"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-control bg-action px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted dark:text-ink-muted-dark">
          New resident?{' '}
          <Link to="/register" className="font-semibold text-action underline underline-offset-2">
            Create an account
          </Link>
        </p>

      </section>
    </main>
  );
};
