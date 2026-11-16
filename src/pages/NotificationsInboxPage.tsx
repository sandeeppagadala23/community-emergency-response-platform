import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrowserNotificationPermission,
  getNotificationInboxTarget,
  notificationService,
  requestBrowserNotificationPermission,
} from '../services/notificationService';
import { InAppNotification } from '../types/notification';
import { apiClient } from '../services/apiClient';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonRow } from '../components/common/Skeleton';
import { formatIstTime } from '../utils/dateUtils';
import { ChevronRight, AlertCircle, RefreshCw, BellRing } from 'lucide-react';

export const NotificationsInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [readFailures, setReadFailures] = useState<Record<string, string>>({});
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const hasLoadedInboxRef = useRef(false);
  const seenBrowserNotificationIds = useRef(new Set<string>());
  const [browserPermission, setBrowserPermission] =
    useState<BrowserNotificationPermission>(() =>
      typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    );
  const [browserPermissionError, setBrowserPermissionError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      if (!isMountedRef.current) return;
      if (hasLoadedInboxRef.current && browserPermission === 'granted') {
        data
          .filter((notification) => !notification.read)
          .filter((notification) => !seenBrowserNotificationIds.current.has(notification.id))
          .forEach((notification) => {
            seenBrowserNotificationIds.current.add(notification.id);
            try {
              const browserNotification = new Notification(notification.title, {
                body: notification.body,
                tag: notification.id,
              });
              browserNotification.onclick = () => {
                window.focus();
                navigate(getNotificationInboxTarget(notification));
                browserNotification.close();
              };
            } catch (notificationError: unknown) {
              setBrowserPermissionError(
                apiClient.normalizeError(notificationError).message,
              );
            }
          });
      }
      data.forEach((notification) =>
        seenBrowserNotificationIds.current.add(notification.id),
      );
      hasLoadedInboxRef.current = true;
      setNotifications(data);
      setLoadError(null);
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      setLoadError(apiClient.normalizeError(error).message);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [browserPermission, navigate]);

  const enableBrowserNotifications = async () => {
    setBrowserPermissionError(null);
    try {
      setBrowserPermission(await requestBrowserNotificationPermission());
    } catch (permissionError: unknown) {
      setBrowserPermissionError(apiClient.normalizeError(permissionError).message);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void fetchInbox();
    const interval = setInterval(() => void fetchInbox(), 10000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchInbox]);

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMarkingIds((prev) => new Set(prev).add(id));
    setReadFailures((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const currentNotification = notifications.find((notification) => notification.id === id);
      if (!currentNotification) {
        throw new Error('Notification not found in the current inbox.');
      }
      const updated = await notificationService.markAsRead(id, currentNotification);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (err: any) {
      setReadFailures((prev) => ({
        ...prev,
        [id]: err.message || 'Failed to mark as read.',
      }));
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleOpenNotification = async (notification: InAppNotification) => {
    if (!notification.read) {
      try {
        const updated = await notificationService.markAsRead(
          notification.id,
          notification,
        );
        setNotifications((previous) =>
          previous.map((item) => item.id === notification.id ? updated : item),
        );
        setReadFailures((previous) => {
          const next = { ...previous };
          delete next[notification.id];
          return next;
        });
      } catch (error: unknown) {
        setReadFailures((previous) => ({
          ...previous,
          [notification.id]: apiClient.normalizeError(error).message,
        }));
        // If mark as read fails, still allow navigation to view the item
      }
    }
    navigate(getNotificationInboxTarget(notification));
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAllRead || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    setMarkAllReadError(null);
    try {
      await notificationService.markAllAsRead();
      const readAt = new Date().toISOString();
      setNotifications((previous) =>
        previous.map((notification) => notification.read
          ? notification
          : { ...notification, read: true, read_at: readAt }),
      );
      setReadFailures({});
    } catch (error: unknown) {
      setMarkAllReadError(apiClient.normalizeError(error).message);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header & Filter Controls */}
      <div className="border-b border-rule dark:border-rule-dark pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
            Notifications
          </h1>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
            Emergency alerts dispatched to your account.
          </p>
        </div>

        {/* Filter Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {browserPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={() => void enableBrowserNotifications()}
              disabled={browserPermission === 'granted'}
              className="inline-flex items-center gap-1.5 rounded-control border border-rule px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-action disabled:cursor-default disabled:opacity-70 dark:border-rule-dark dark:text-ink-muted-dark"
            >
              <BellRing className="h-3.5 w-3.5" />
              {browserPermission === 'granted'
                ? 'Browser alerts enabled'
                : 'Enable browser alerts'}
            </button>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllAsRead()}
              disabled={isMarkingAllRead || markingIds.size > 0}
              className="rounded-control border border-rule px-2.5 py-1.5 text-xs font-semibold text-action hover:border-action disabled:cursor-not-allowed disabled:opacity-60 dark:border-rule-dark dark:text-teal-400"
            >
              {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
            </button>
          )}
          <div className="inline-flex rounded-control border border-rule dark:border-rule-dark p-0.5 bg-paper dark:bg-paper-dark text-xs">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 font-semibold rounded-control transition-colors ${
              filter === 'ALL'
                ? 'bg-action text-white'
                : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`px-3 py-1 font-semibold rounded-control transition-colors ${
              filter === 'UNREAD'
                ? 'bg-action text-white'
                : 'text-ink-muted dark:text-ink-muted-dark hover:text-ink'
            }`}
          >
            Unread ({unreadCount})
          </button>
          </div>
        </div>
      </div>

      {browserPermission === 'denied' && (
        <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
          Browser alerts are blocked. Allow notifications for this site in your browser settings.
        </p>
      )}
      {browserPermissionError && (
        <p role="alert" className="text-xs text-signal">
          Could not enable browser notifications: {browserPermissionError}
        </p>
      )}
      {markAllReadError && (
        <p role="alert" className="rounded-control border border-signal/30 bg-signal/5 p-3 text-sm text-signal">
          Could not mark notifications as read. They remain unread. {markAllReadError}
          <button type="button" className="ml-2 font-semibold underline" onClick={() => void handleMarkAllAsRead()}>
            Retry
          </button>
        </p>
      )}

      {isLoading ? (
        <SkeletonRow count={4} heightClass="h-20" />
      ) : loadError && notifications.length === 0 ? (
        <EmptyState
          message={`Could not load notifications: ${loadError}`}
          actionText="Retry"
          onAction={() => void fetchInbox()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            filter === 'UNREAD'
              ? 'You have no unread notifications.'
              : 'You have no notifications in your inbox.'
          }
        />
      ) : (
        <>
          {loadError && (
            <p role="alert" className="rounded-control border border-signal/30 bg-signal/5 p-3 text-sm text-signal">
              Could not refresh notifications. Showing the last loaded data. {loadError}
              <button type="button" className="ml-2 font-semibold underline" onClick={() => void fetchInbox()}>
                Retry
              </button>
            </p>
          )}
          <div className="border border-rule dark:border-rule-dark rounded-panel bg-surface dark:bg-surface-dark divide-y divide-rule dark:divide-rule-dark overflow-hidden shadow-sm">
            {filtered.map((item) => {
            const isUnread = !item.read;
            const hasError = Boolean(readFailures[item.id]);
            const isMarking = markingIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => void handleOpenNotification(item)}
                className={`p-4 cursor-pointer transition-colors relative hover:bg-stone-50 dark:hover:bg-stone-800/40 flex items-start justify-between gap-3 ${
                  isUnread ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                }`}
              >
                {/* Left accent bar for unread notifications */}
                {isUnread && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 bg-action dark:bg-teal-400"
                    aria-hidden="true"
                  />
                )}

                <div className="space-y-1 flex-1 pl-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm ${
                        isUnread
                          ? 'font-bold text-ink dark:text-ink-dark'
                          : 'font-normal text-ink-muted dark:text-ink-muted-dark'
                      }`}
                    >
                      {item.title}
                    </span>
                    {isUnread ? (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-signal-light text-signal font-bold">
                        Unread
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-ink-muted">
                        Read
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark line-clamp-2">
                    {item.body}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-ink-muted">
                    <span>{formatIstTime(item.created_at, 'relative')}</span>
                    <span>·</span>
                    <span className="text-action dark:text-teal-400">{item.incident_id}</span>
                  </div>

                  {hasError && (
                    <div className="flex items-center gap-1.5 text-[11px] text-signal font-medium pt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{readFailures[item.id]}</span>
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, item.id)}
                        className="underline ml-1"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(e, item.id)}
                      disabled={isMarking}
                      className="text-xs text-action dark:text-teal-400 font-medium px-2 py-1 rounded border border-rule dark:border-rule-dark hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title="Mark as Read (Note: this only updates read state, never delivery state)"
                    >
                      {isMarking ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Mark read</span>
                      )}
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-ink-muted" />
                </div>
              </div>
            );
            })}
          </div>
        </>
      )}
    </div>
  );
};
