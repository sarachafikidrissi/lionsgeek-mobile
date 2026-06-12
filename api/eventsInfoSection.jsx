import axios from 'axios';

// Public LionsGeek site. Used directly when not proxying, and always used to
// resolve cover-image URLs (which live on lionsgeek.ma).
const PUBLIC_URL = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_URL ||
  process.env.EVENTS_INFO_SECTION_URL ||
  ''
).replace(/\/+$/, '');

// Local app server (mylionsgeek) reachable on the LAN. Used as the proxy host
// so a device without direct public-internet access can still load events.
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/+$/, '');

const USE_PROXY =
  String(process.env.EXPO_PUBLIC_EVENTS_INFO_USE_PROXY || '').toLowerCase() === 'true';

const API_KEY = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY ||
  process.env.EVENTS_INFO_SECTION_KEY ||
  ''
).trim();

// In proxy mode requests go to the local server under /api/events-info/*;
// otherwise they hit lionsgeek.ma directly under /api/*.
const REQUEST_BASE = USE_PROXY ? APP_URL : PUBLIC_URL;
const API_PREFIX = USE_PROXY ? 'api/events-info' : 'api';

const ensureConfig = () => {
  if (USE_PROXY && !APP_URL) {
    throw new Error(
      'EXPO_PUBLIC_APP_URL is not set but proxy mode is on. Set it in .env and restart Expo with: npx expo start -c'
    );
  }
  if (!USE_PROXY && !PUBLIC_URL) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_URL is not set. Add it to .env and restart Expo with: npx expo start -c'
    );
  }
  if (!API_KEY) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY is not set. Add it to .env and restart Expo with: npx expo start -c'
    );
  }
};

const authHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const buildUrl = (endpoint) => `${REQUEST_BASE}/${API_PREFIX}/${endpoint}`;

const get = async (endpoint) => {
  ensureConfig();
  return axios.get(buildUrl(endpoint), { headers: authHeaders() });
};

const put = async (endpoint, data) => {
  ensureConfig();
  return axios.put(buildUrl(endpoint), data, { headers: authHeaders() });
};

export const EventsInfoAPI = {
  // Public site URL (lionsgeek.ma). Used for image src when not proxying.
  BASE_URL: PUBLIC_URL,
  APP_URL,
  USE_PROXY,
  getEvents: () => get('events'),
  getEvent: (eventId) => get(`events/${eventId}`),
  validateEventInvitation: (payload) => put('validate-event-invitation', payload),
};

export default EventsInfoAPI;
