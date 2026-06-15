import axios from 'axios';

const PUBLIC_URL = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_URL ||
  process.env.EVENTS_INFO_SECTION_URL ||
  ''
).replace(/\/+$/, '');

const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/+$/, '');

const USE_PROXY =
  String(process.env.EXPO_PUBLIC_EVENTS_INFO_USE_PROXY || '').toLowerCase() === 'true';

const API_KEY = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY ||
  process.env.EVENTS_INFO_SECTION_KEY ||
  ''
).trim();

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

const postMultipart = async (endpoint, formData) => {
  ensureConfig();
  return axios.post(buildUrl(endpoint), formData, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const InfoSessionAPI = {
  BASE_URL: PUBLIC_URL,
  APP_URL,
  USE_PROXY,
  getInfoSessions: () => get('lionsgate/infosessions'),
  getSessionData: (sessionId) => get(`session-data?id=${sessionId}`),
  validateInvitation: (payload) => put('validate-invitation', payload),
  manualChecking: (participantId) => put('manual-checking', { id: Number(participantId) }),
  getProfileData: (participantId) => get(`profile-data?id=${participantId}`),
  uploadSessionPhoto: (participantId, photoFile) => {
    const form = new FormData();
    form.append('id', String(participantId));
    form.append('photo', photoFile);
    return postMultipart('session-photo', form);
  },
};

export default InfoSessionAPI;
