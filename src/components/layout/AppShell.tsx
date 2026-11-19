import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { notificationService } from '../../services/notificationService';
import { DemoBar } from '../common/DemoBar';
import {
  AlertTriangle,
  History,
  Bell,
  LayoutDashboard,
  LogOut,
  Shield,
  ShieldCheck,
  FilePlus2,
  ContactRound,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadCountUnavailable, setUnreadCountUnavailable] = useState(false);

  const isResident = role === 'RESIDENT';

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;

    const fetchUnread = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const count = await notificationService.getUnreadCount();
        if (isMounted) {
          setUnreadCount(count);
          setUnreadCountUnavailable(false);
        }
      } catch {
        if (isMounted) {
          setUnreadCountUnavailable(true);
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchUnread();
    const interval = setInterval(() => {
      void fetchUnread();
    }, 10000);

    const handleNotificationRead = () => {
      void fetchUnread();
    };
    window.addEventListener('cerp:notification_read', handleNotificationRead);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('cerp:notification_read', handleNotificationRead);
    };
  }, [location.pathname, user]);

  return (
    <div className="app-shell min-h-screen flex flex-col bg-paper dark:bg-paper-dark text-ink dark:text-ink-dark transition-colors duration-150">
      {/* Demo helper banner */}
      <DemoBar />

      {/* Top Application Bar */}
      <header className="app-header border-b border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark px-4 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-control bg-paper dark:bg-stone-900 border border-rule dark:border-rule-dark flex items-center justify-center text-signal">
              <Shield className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base tracking-tight text-ink dark:text-ink-dark">
                  {user?.society && user.society !== 'Not assigned'
                    ? user.society
                    : 'Community Response'}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-rule dark:border-rule-dark text-ink-muted dark:text-ink-muted-dark">
                  Emergency Response
                </span>
              </div>
              <p className="text-[11px] text-ink-muted dark:text-ink-muted-dark leading-none mt-0.5">
                {user
                  ? `${user.name} · ${
                      role === 'VOLUNTEER' && user.flat === 'Not assigned'
                        ? 'Volunteer'
                        : role === 'GUARDIAN'
                          ? 'Guardian'
                          : role === 'SECURITY'
                            ? `Security${(user as unknown as { employee_id?: string }).employee_id ? ` · ${(user as unknown as { employee_id?: string }).employee_id}` : ''}`
                            : user.flat
                    }`
                  : 'Emergency Dispatch'}
              </p>
            </div>
          </div>

          {/* Right Top Bar Actions */}
          <div className="flex items-center gap-3">
            {user && (
              <NavLink
                to="/contacts"
                className="hidden items-center gap-1.5 rounded-control border border-rule px-2 py-1 text-xs font-semibold text-ink-muted hover:border-action hover:text-action dark:border-rule-dark dark:text-ink-muted-dark md:inline-flex"
              >
                <ContactRound className="h-4 w-4" />
                <span>{role === 'GUARDIAN' ? 'My Residents' : 'Contacts'}</span>
              </NavLink>
            )}
            {role && (
              <span className="role-badge hidden md:inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-control">
                {role}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 p-1 text-xs text-ink-muted transition-colors hover:text-signal dark:text-ink-muted-dark"
              title="Sign out of system"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t('signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop navigation rail and main content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <aside
          aria-label="Main navigation"
          className="app-sidebar hidden md:flex flex-col w-56 border-r border-rule dark:border-rule-dark bg-surface/50 dark:bg-surface-dark/50 p-3 shrink-0"
        >
          <div className="space-y-1">
            {isResident ? (
              <NavLink
                to="/sos"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
                }
              >
                <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
                <span>Raise Emergency</span>
              </NavLink>
            ) : role === 'SECURITY' ? (
              <NavLink
                to="/security"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
                }
              >
                <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                <span>Security Dashboard</span>
              </NavLink>
            ) : (
              <NavLink
                to="/incidents"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
                }
              >
                <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />
                <span>Incident board</span>
              </NavLink>
            )}

            {isResident && (
              <NavLink
                to="/my-incidents"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
                }
              >
                <History className="w-4 h-4" strokeWidth={1.75} />
                <span>My Reports</span>
              </NavLink>
            )}

            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
              }
            >
              <FilePlus2 className="w-4 h-4" strokeWidth={1.75} />
              <span>{role === 'GUARDIAN' ? 'Resident Reports' : 'Report an Issue'}</span>
            </NavLink>

            <NavLink
              to="/contacts"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
              }
            >
              <ContactRound className="w-4 h-4" strokeWidth={1.75} />
              <span>{role === 'GUARDIAN' ? 'My Residents' : 'Emergency Contacts'}</span>
            </NavLink>

            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold rounded-control transition-colors ${isActive ? 'bg-action text-white' : ''}`
              }
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                <span>{t('notifications')}</span>
              </span>
              {unreadCount > 0 ? (
                <span
                  className="min-w-5 rounded-full bg-signal px-1.5 py-0.5 text-center text-[11px] font-bold text-white"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount}
                </span>
              ) : unreadCountUnavailable ? (
                    <span
                      className="text-xs font-bold text-signal"
                      title="Unread count unavailable. Open notifications to retry."
                      aria-label="Unread notification count unavailable"
                    >
                      !
                    </span>
              ) : null}
            </NavLink>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 pb-24 md:pb-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Resident Mobile Bottom Bar (or collapsible mobile bar for others) */}
      <nav
        aria-label="Mobile Navigation"
        className="mobile-navigation md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface dark:bg-surface-dark border-t border-rule dark:border-rule-dark py-1.5 px-3 flex items-center justify-around shadow-overlay"
      >
        {isResident ? (
          <>
            {/* SOS Home (Default) */}
            <NavLink
              to="/sos"
              className={({ isActive }) =>
                `flex min-w-[58px] min-h-[48px] flex-col items-center justify-center px-1 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-signal'
                    : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
                }`
              }
            >
              <AlertTriangle className="w-5 h-5 mb-0.5" strokeWidth={2} />
              <span>SOS</span>
            </NavLink>

            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `flex min-w-[58px] min-h-[48px] flex-col items-center justify-center px-1 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
                }`
              }
            >
              <FilePlus2 className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
              <span>Report</span>
            </NavLink>

            {/* My Incidents */}
            <NavLink
              to="/my-incidents"
              className={({ isActive }) =>
                `flex min-w-[58px] min-h-[48px] flex-col items-center justify-center px-1 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
                }`
              }
            >
              <History className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
              <span>{t('myIncidents')}</span>
            </NavLink>

            {/* Notifications */}
            <NavLink
              to="/contacts"
              className={({ isActive }) =>
                `flex min-w-[58px] min-h-[48px] flex-col items-center justify-center px-1 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
                }`
              }
            >
              <ContactRound className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
              <span>Contacts</span>
            </NavLink>
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `relative flex min-w-[58px] min-h-[48px] flex-col items-center justify-center px-1 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
                }`
              }
            >
              <div className="relative">
                <Bell className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full font-mono text-[9px] font-bold bg-signal text-white">
                    {unreadCount}
                  </span>
                )}
                {unreadCountUnavailable && (
                  <span
                    className="absolute -top-1 -right-2 rounded-full bg-surface px-1 font-mono text-[9px] font-bold text-signal dark:bg-surface-dark"
                    title="Unread count unavailable. Open notifications to retry."
                    aria-label="Unread notification count unavailable"
                  >
                    !
                  </span>
                )}
              </div>
              <span>{t('notifications')}</span>
            </NavLink>
          </>
        ) : (
          <>
            {/* Mobile Nav for Non-Residents */}
            {role === 'SECURITY' ? (
              <NavLink
                to="/security"
                className={({ isActive }) =>
                  `flex min-h-[48px] flex-col items-center justify-center py-1 px-4 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'text-action dark:text-teal-400'
                      : 'text-ink-muted dark:text-ink-muted-dark'
                  }`
                }
              >
                <ShieldCheck className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
                <span>Dashboard</span>
              </NavLink>
            ) : (
              <NavLink
                to="/incidents"
                className={({ isActive }) =>
                  `flex min-h-[48px] flex-col items-center justify-center py-1 px-4 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'text-action dark:text-teal-400'
                      : 'text-ink-muted dark:text-ink-muted-dark'
                  }`
                }
              >
                <LayoutDashboard className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
                <span>Incidents</span>
              </NavLink>
            )}

            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `flex min-h-[48px] flex-col items-center justify-center py-1 px-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark'
                }`
              }
            >
              <FilePlus2 className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
              <span>{role === 'GUARDIAN' ? 'Reports' : 'Report'}</span>
            </NavLink>

            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `relative flex min-h-[48px] flex-col items-center justify-center py-1 px-4 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark'
                }`
              }
            >
              <div className="relative">
                <Bell className="w-5 h-5 mb-0.5" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full font-mono text-[9px] font-bold bg-signal text-white">
                    {unreadCount}
                  </span>
                )}
                {unreadCountUnavailable && (
                  <span
                    className="absolute -top-1 -right-2 rounded-full bg-surface px-1 font-mono text-[9px] font-bold text-signal dark:bg-surface-dark"
                    title="Unread count unavailable. Open notifications to retry."
                    aria-label="Unread notification count unavailable"
                  >
                    !
                  </span>
                )}
              </div>
              <span>Notifications</span>
              {unreadCountUnavailable && (
                <span
                  className="text-[9px] font-bold text-signal"
                  title="Unread count unavailable. Open notifications to retry."
                  aria-label="Unread notification count unavailable"
                >
                  !
                </span>
              )}
            </NavLink>
            <NavLink
              to="/contacts"
              className={({ isActive }) =>
                `flex min-h-[48px] flex-col items-center justify-center px-3 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'text-action dark:text-teal-400'
                    : 'text-ink-muted dark:text-ink-muted-dark'
                }`
              }
            >
              <ContactRound className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
              <span>{role === 'GUARDIAN' ? 'Residents' : 'Contacts'}</span>
            </NavLink>
          </>
        )}
      </nav>
    </div>
  );
};
