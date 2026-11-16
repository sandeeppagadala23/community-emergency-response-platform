/**
 * Date and Time utilities for Community Emergency Response Platform
 * Indian Standard Time (IST, UTC+5:30) standardized display
 */

export function formatIstTime(
  isoDateStr?: string | null,
  mode: '12h' | '24h' | 'full' | 'relative' = '12h'
): string {
  if (!isoDateStr) return '—';

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return '—';

  // Format in Asia/Kolkata timezone
  const tz = 'Asia/Kolkata';

  if (mode === 'relative') {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  if (mode === '12h') {
    // Resident format: "2:30 PM IST"
    const timeStr = date.toLocaleTimeString('en-IN', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${timeStr} IST`;
  }

  if (mode === '24h') {
    // Security/Admin format: "14:30:15 IST"
    const timeStr = date.toLocaleTimeString('en-IN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${timeStr} IST`;
  }

  // Full format: "24 Oct 2026, 14:30 IST"
  const dateStr = date.toLocaleDateString('en-IN', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-IN', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr}, ${timeStr} IST`;
}

export function formatMonthGroup(isoDateStr: string): string {
  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return 'Unknown Date';
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  });
}
