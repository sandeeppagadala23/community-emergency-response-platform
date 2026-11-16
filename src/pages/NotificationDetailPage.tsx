import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getNotificationRelatedTarget,
  notificationService,
} from '../services/notificationService';
import { InAppNotification } from '../types/notification';
import { formatIstTime } from '../utils/dateUtils';
import { SkeletonRow } from '../components/common/Skeleton';
import { PermissionDenied } from '../components/common/PermissionDenied';
import { NotFound } from '../components/common/NotFound';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const NotificationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [notification, setNotification] = useState<InAppNotification | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAndRead = async () => {
      if (!id) return;
      try {
        const notif = await notificationService.getNotificationById(id);
        if (isMounted) {
          setNotification(notif);
          setIsLoading(false);

          // Mark as read if not yet read
          if (!notif.read) {
            notificationService.markAsRead(id, notif).catch((error) => {
              console.error('Unable to mark notification as read.', error);
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorStatus(err.status || 500);
          setIsLoading(false);
        }
      }
    };

    fetchAndRead();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (errorStatus === 403) {
    return <PermissionDenied backTo="/notifications" backLabel="Return to inbox" />;
  }

  if (errorStatus === 404) {
    return <NotFound backTo="/notifications" backLabel="Return to inbox" />;
  }

  if (isLoading || !notification) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonRow count={3} heightClass="h-20" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Back button */}
      <div>
        <Link
          to="/notifications"
          className="inline-flex items-center gap-1 text-xs font-semibold text-action dark:text-teal-400 hover:text-action-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to notifications</span>
        </Link>
      </div>

      <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-rule dark:border-rule-dark pb-4">
          <div className="space-y-1">
            <h1 className="font-serif text-lg font-bold text-ink dark:text-ink-dark">
              {notification.title}
            </h1>
            <p className="text-xs font-mono text-ink-muted dark:text-ink-muted-dark">
              Received {formatIstTime(notification.created_at, 'full')}
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-ink-muted border border-rule dark:border-rule-dark">
            Read
          </span>
        </div>

        {/* Notification Body */}
        <div className="text-sm text-ink dark:text-ink-dark leading-relaxed">
          {notification.body}
        </div>

        {/* Associated Incident Link */}
        <div className="pt-4 border-t border-rule dark:border-rule-dark flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-mono text-ink-muted">
            {notification.resource_type === 'REPORT' ? 'Report notification' : 'Incident ID:'}{' '}
            <span className="font-semibold text-ink dark:text-ink-dark">
                {notification.resource_type === 'REPORT'
                  ? (notification.report_id ? `#${notification.report_id}` : 'Update')
                  : notification.incident_id}
            </span>
          </div>

          <Link
            to={getNotificationRelatedTarget(notification)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-action text-white hover:bg-action-hover transition-colors"
          >
            <span>{notification.resource_type === 'REPORT' ? 'View Reports' : 'View Incident Details'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
