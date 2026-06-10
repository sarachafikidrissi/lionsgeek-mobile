import { format, isValid, parseISO, startOfDay } from 'date-fns';
import EventsInfoAPI from '@/api/eventsInfoSection';

// Resolves multilingual event name JSON to a display string.
export function getEventDisplayName(name) {
  if (!name) return 'Untitled event';
  if (typeof name === 'string') {
    try {
      const parsed = JSON.parse(name);
      return getEventDisplayName(parsed);
    } catch {
      return name;
    }
  }
  if (typeof name === 'object') {
    return name.en || name.fr || name.ar || Object.values(name).find(Boolean) || 'Untitled event';
  }
  return String(name);
}

// Event cover path to absolute URL on lionsgeek.ma.
export function getEventCoverUrl(cover) {
  if (!cover || typeof cover !== 'string') return null;
  if (cover.startsWith('http')) return cover;
  const base = EventsInfoAPI.BASE_URL;
  if (cover.includes('/')) {
    return `${base}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }
  return `${base}/storage/images/events/${cover}`;
}

export function getEventDate(event) {
  if (!event?.date) return null;
  const parsed = typeof event.date === 'string' ? parseISO(event.date) : new Date(event.date);
  return isValid(parsed) ? parsed : null;
}

// List filter: event calendar day is today or in the future.
export function isEventActiveForList(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return false;
  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  return eventDay >= today;
}

// Scan allowed until midnight on the event's calendar day.
export function canScanEvent(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return false;
  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  return eventDay.getTime() === today.getTime();
}

export function formatEventDate(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return '—';
  return format(eventDate, 'EEE, MMM d, yyyy · HH:mm');
}

export function filterActiveEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .filter(isEventActiveForList)
    .sort((a, b) => {
      const da = getEventDate(a)?.getTime() ?? 0;
      const db = getEventDate(b)?.getTime() ?? 0;
      return da - db;
    });
}

export function groupEventsByDay(events) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const live = [];
  const upcoming = [];

  events.forEach((event) => {
    const eventDate = getEventDate(event);
    if (!eventDate) return;
    const dayKey = format(eventDate, 'yyyy-MM-dd');
    if (dayKey === today) {
      live.push(event);
    } else {
      upcoming.push(event);
    }
  });

  return { live, upcoming };
}

// Maps lionsgeek.ma validate-event-invitation messages to UI status.
export function mapValidationMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('credentials match')) return 'success';
  if (normalized.includes('already participated')) return 'warning';
  if (normalized.includes('another event')) return 'error';
  if (normalized.includes('no such participant')) return 'error';
  return 'info';
}
