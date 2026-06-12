import { format, isValid, parseISO, startOfDay } from 'date-fns';

export function getSessionDate(session) {
  if (!session?.start_date) return null;
  const parsed =
    typeof session.start_date === 'string' ? parseISO(session.start_date) : new Date(session.start_date);
  return isValid(parsed) ? parsed : null;
}

export function formatSessionDate(session) {
  const sessionDate = getSessionDate(session);
  if (!sessionDate) return '—';
  return format(sessionDate, 'EEE, MMM d, yyyy · HH:mm');
}

export function getSessionStatusLabel(session) {
  const sessionDate = getSessionDate(session);
  if (!sessionDate) return 'Unknown';
  const today = startOfDay(new Date());
  const day = startOfDay(sessionDate);
  if (day.getTime() === today.getTime()) return 'Today';
  if (day > today) return 'Upcoming';
  return 'Past';
}

export function canScanSession(session) {
  return getSessionStatusLabel(session) === 'Today';
}

export function getSessionAvailabilityLabel(session) {
  if (session?.isFinish) return 'Completed';
  if (session?.isAvailable) return 'Available';
  return 'Unavailable';
}

export function normalizeInfoSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((session) => getSessionDate(session));
}

export function sortSessionsByDate(sessions, order = 'desc') {
  return [...sessions].sort((a, b) => {
    const da = getSessionDate(a)?.getTime() ?? 0;
    const db = getSessionDate(b)?.getTime() ?? 0;
    return order === 'desc' ? db - da : da - db;
  });
}

export function filterSessionsByName(sessions, query) {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter(
    (session) =>
      String(session?.name || '')
        .toLowerCase()
        .includes(q) ||
      String(session?.formation || '')
        .toLowerCase()
        .includes(q)
  );
}

export function mapInfoParticipant(participant) {
  return {
    ...participant,
    name: participant?.full_name || participant?.name || 'Unknown',
  };
}

export function mapInfoParticipants(participants) {
  if (!Array.isArray(participants)) return [];
  return participants.map(mapInfoParticipant);
}

export function getParticipantCounts(participants = []) {
  const list = Array.isArray(participants) ? participants : [];
  const registered = list.length;
  const scanned = list.filter((p) => p.is_visited).length;
  return {
    registered,
    scanned,
    pending: registered - scanned,
  };
}

export function formatSessionCapacity(session, registeredCount = 0) {
  const registered = Math.max(0, Number(registeredCount) || 0);
  const places = Number(session?.places);
  if (!Number.isFinite(places)) return `${registered}`;
  return `${registered}/${places}`;
}

export function findParticipantById(participants, participantId) {
  if (!Array.isArray(participants) || participantId == null) return null;
  return participants.find((p) => String(p.id) === String(participantId)) ?? null;
}

export function isSameSessionId(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

function formatParticipantTimestamp(value) {
  if (!value) return null;
  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(parsed)) return String(value);
  return format(parsed, 'MMM d, yyyy · HH:mm');
}

const PARTICIPANT_DETAIL_FIELDS = [
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'code', label: 'Invitation code' },
  { key: 'formation_field', label: 'Formation field' },
  { key: 'gender', label: 'Gender' },
  { key: 'current_step', label: 'Current step' },
  { key: 'education_level', label: 'Education level' },
  { key: 'created_at', label: 'Registered on', format: formatParticipantTimestamp },
  { key: 'updated_at', label: 'Last updated', format: formatParticipantTimestamp },
];

export function getParticipantDetailRows(participant) {
  if (!participant || typeof participant !== 'object') return [];

  const rows = [];
  const seenLabels = new Set();

  PARTICIPANT_DETAIL_FIELDS.forEach(({ key, label, format: formatValue }) => {
    const raw = participant[key];
    if (raw == null || raw === '') return;
    if (seenLabels.has(label)) return;

    const value = formatValue ? formatValue(raw) : String(raw);
    if (!value) return;

    rows.push({ label, value });
    seenLabels.add(label);
  });

  return rows;
}

export function resolveInfoSessionError(err) {
  const status = err?.response?.status;
  if (status === 401) {
    return 'Invalid API key (401). Fix EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY in .env, then restart: npx expo start -c';
  }
  if (status) {
    return `Info session server returned ${status}.`;
  }

  const message = String(err?.message || '');
  if (message.includes('is not set')) {
    return 'API not configured in the running build. Set EXPO_PUBLIC_EVENTS_INFO_SECTION_URL and _KEY in .env, then restart: npx expo start -c';
  }
  if (message.toLowerCase().includes('network')) {
    return 'Network error reaching the info session server. Check the device has internet and can reach lionsgeek.ma.';
  }
  return `Could not load info sessions: ${message || 'unknown error'}`;
}

export function mapValidationMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('credentials match')) return 'success';
  if (normalized.includes('already participated')) return 'warning';
  if (normalized.includes('another session')) return 'error';
  if (normalized.includes('no such participant')) return 'error';
  return 'info';
}
