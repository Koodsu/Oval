export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}
