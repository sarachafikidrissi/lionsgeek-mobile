import axios from 'axios';

const BASE_URL = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_URL ||
  process.env.EVENTS_INFO_SECTION_URL ||
  ''
).replace(/\/+$/, '');

const API_KEY = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY ||
  process.env.EVENTS_INFO_SECTION_KEY ||
  ''
).trim();

const ensureConfig = () => {
  if (!BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_URL is not set. Add it to .env and restart Expo.'
    );
  }
  if (!API_KEY) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY is not set. Add it to .env and restart Expo.'
    );
  }
};

const authHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const get = async (endpoint) => {
  ensureConfig();
  const url = `${BASE_URL}/api/${endpoint}`;
  return axios.get(url, { headers: authHeaders() });
};

const put = async (endpoint, data) => {
  ensureConfig();
  const url = `${BASE_URL}/api/${endpoint}`;
  return axios.put(url, data, { headers: authHeaders() });
};

export const EventsInfoAPI = {
  BASE_URL,
  getEvents: () => get('events'),
  getEvent: (eventId) => get(`events/${eventId}`),
  validateEventInvitation: (payload) => put('validate-event-invitation', payload),
};

export default EventsInfoAPI;
