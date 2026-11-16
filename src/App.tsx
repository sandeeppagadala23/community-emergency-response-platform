import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AppShell } from './components/layout/AppShell';
import { ReportPage } from './pages/ReportPage';
import { PermissionDenied } from './components/common/PermissionDenied';
import { NotFound } from './components/common/NotFound';
import { PwaStatus } from './components/common/PwaStatus';
import { UserRole } from './types/auth';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const SosHomePage = lazy(() => import('./pages/SosHomePage').then((m) => ({ default: m.SosHomePage })));
const GuardianContactsPage = lazy(() => import('./pages/GuardianContactsPage').then((m) => ({ default: m.GuardianContactsPage })));
const SosStatusPage = lazy(() => import('./pages/SosStatusPage').then((m) => ({ default: m.SosStatusPage })));
const MyIncidentsPage = lazy(() => import('./pages/MyIncidentsPage').then((m) => ({ default: m.MyIncidentsPage })));
const IncidentListPage = lazy(() => import('./pages/IncidentListPage').then((m) => ({ default: m.IncidentListPage })));
const IncidentDetailPage = lazy(() => import('./pages/IncidentDetailPage').then((m) => ({ default: m.IncidentDetailPage })));
const NotificationLogPage = lazy(() => import('./pages/NotificationLogPage').then((m) => ({ default: m.NotificationLogPage })));
const NotificationsInboxPage = lazy(() => import('./pages/NotificationsInboxPage').then((m) => ({ default: m.NotificationsInboxPage })));
const NotificationDetailPage = lazy(() => import('./pages/NotificationDetailPage').then((m) => ({ default: m.NotificationDetailPage })));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="p-8 text-center text-xs text-ink-muted">Loading...</div>
);

// Guard routes by authenticated user and persona.
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center">Checking your session...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <AppShell>
        <PermissionDenied
          backTo={role === 'RESIDENT' ? '/sos' : '/incidents'}
          backLabel={role === 'RESIDENT' ? 'Return to SOS' : 'Return to incident board'}
        />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
};

// Root role-based redirect
const RoleRedirect: React.FC = () => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Checking your session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'RESIDENT') {
    return <Navigate to="/sos" replace />;
  }

  return <Navigate to="/incidents" replace />;
};

const LoginRoute: React.FC = () => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Checking your session...</div>;
  if (user) {
    return <Navigate to={role === 'RESIDENT' ? '/sos' : '/incidents'} replace />;
  }
  return <LoginPage />;
};

const RegisterRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Checking your session...</div>;
  if (user) return <Navigate to="/sos" replace />;
  return <RegisterPage />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <>
            <PwaStatus />
            <BrowserRouter>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/register" element={<RegisterRoute />} />

              {/* Root Role Redirect */}
              <Route path="/" element={<RoleRedirect />} />

              {/* Resident Routes */}
              <Route
                path="/sos"
                element={
                  <ProtectedRoute allowedRoles={['RESIDENT']}>
                    <SosHomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sos/active/:id"
                element={
                  <ProtectedRoute allowedRoles={['RESIDENT']}>
                    <SosStatusPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-incidents"
                element={
                  <ProtectedRoute allowedRoles={['RESIDENT']}>
                    <MyIncidentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts"
                element={
                  <ProtectedRoute>
                    <GuardianContactsPage />
                  </ProtectedRoute>
                }
              />

              {/* Incident Board & Detail */}
              <Route
                path="/incidents"
                element={
                  <ProtectedRoute
                    allowedRoles={['GUARDIAN', 'VOLUNTEER', 'SECURITY', 'ADMIN']}
                  >
                    <IncidentListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/incidents/:id"
                element={
                  <ProtectedRoute>
                    <IncidentDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Incident Notification Log & Retry (Security, Admin) */}
              <Route
                path="/incidents/:id/notifications"
                element={
                  <ProtectedRoute allowedRoles={['SECURITY', 'ADMIN']}>
                    <NotificationLogPage />
                  </ProtectedRoute>
                }
              />

              {/* In-app Notifications Inbox & Detail (All roles) */}
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsInboxPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications/:id"
                element={
                  <ProtectedRoute>
                    <NotificationDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Design System & Component Reference */}
              <Route
                path="/design-system"
                element={
                  <AppShell>
                    <DesignSystemPage />
                  </AppShell>
                }
              />

              {/* 404 Catch All */}
              <Route
                path="*"
                element={
                  <AppShell>
                    <NotFound backTo="/" backLabel="Return to home" />
                  </AppShell>
                }
              />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
