import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_NOTIFICATION_PREF_TYPES, defaultNotificationTypePrefs, isNotificationTypeEnabledInPrefs } from '@/constants/notificationPreferences';

const STORAGE_KEY = '@lionsgeek_notification_type_prefs_v1';

function mergeWithDefaults(raw) {
  const base = defaultNotificationTypePrefs();
  if (!raw || typeof raw !== 'object') return base;
  const next = { ...base };
  for (const t of ALL_NOTIFICATION_PREF_TYPES) {
    if (typeof raw[t] === 'boolean') next[t] = raw[t];
  }
  return next;
}

export default function useNotificationPreferences() {
  const [prefs, setPrefs] = useState(() => defaultNotificationTypePrefs());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = json ? JSON.parse(json) : null;
        if (!cancelled) setPrefs(mergeWithDefaults(parsed));
      } catch {
        if (!cancelled) setPrefs(defaultNotificationTypePrefs());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next) => {
    setPrefs(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const setTypeEnabled = useCallback(
    (type, enabled) => {
      const next = { ...prefs, [type]: !!enabled };
      persist(next);
    },
    [prefs, persist],
  );

  const isTypeEnabled = useCallback(
    (type) => isNotificationTypeEnabledInPrefs(type, prefs),
    [prefs],
  );

  return { prefs, ready, setTypeEnabled, isTypeEnabled };
}
