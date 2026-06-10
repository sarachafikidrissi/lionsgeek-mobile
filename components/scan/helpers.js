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

// Event cover filename/path to a loadable absolute image URL.
// Filenames from the API often contain spaces (e.g. "POST CODE 2.png") and must
// be URI-encoded. In proxy mode images are served via mylionsgeek because the
// device may not reach lionsgeek.ma directly.
export function getEventCoverUrl(cover) {
  if (!cover || typeof cover !== 'string') return null;
  if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;

  const publicBase = EventsInfoAPI.BASE_URL;
  const appBase = EventsInfoAPI.APP_URL;
  const useProxy = EventsInfoAPI.USE_PROXY;

  let filename = cover.trim();
  if (filename.includes('/')) {
    filename = filename.replace(/^\/+/, '').split('/').pop() || filename;
  }

  const encoded = encodeURIComponent(filename);

  if (useProxy && appBase) {
    return `${appBase}/api/events-info/images/events/${encoded}`;
  }

  if (!publicBase) return null;
  return `${publicBase}/storage/images/events/${encoded}`;
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

// All events with a valid date (no today/future filter).
export function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => getEventDate(event));
}

export function sortEventsByDate(events, order = 'desc') {
  return [...events].sort((a, b) => {
    const da = getEventDate(a)?.getTime() ?? 0;
    const db = getEventDate(b)?.getTime() ?? 0;
    return order === 'desc' ? db - da : da - db;
  });
}

export function filterEventsByName(events, query) {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  return events.filter((event) => getEventDisplayName(event?.name).toLowerCase().includes(q));
}

export function getEventStatusLabel(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return 'Unknown';
  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  if (eventDay.getTime() === today.getTime()) return 'Today';
  if (eventDay > today) return 'Upcoming';
  return 'Past';
}

// Turns an events fetch failure into a specific, actionable message so the
// real root cause (missing config vs. auth vs. network) is visible on screen.
export function resolveEventsError(err) {
  const status = err?.response?.status;
  if (status === 401) {
    return 'Invalid API key (401). Fix EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY in .env, then restart: npx expo start -c';
  }
  if (status) {
    return `Events server returned ${status}.`;
  }

  // No HTTP response at all: either the config was never bundled, or the
  // device could not reach the server.
  const message = String(err?.message || '');
  if (message.includes('is not set')) {
    return 'Events API not configured in the running build. Set EXPO_PUBLIC_EVENTS_INFO_SECTION_URL and _KEY in .env, then restart: npx expo start -c';
  }
  if (message.toLowerCase().includes('network')) {
    return 'Network error reaching the events server. Check the device has internet and can reach lionsgeek.ma.';
  }
  return `Could not load events: ${message || 'unknown error'}`;
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
