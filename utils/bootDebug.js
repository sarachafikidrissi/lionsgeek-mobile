import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOT_KEY = 'debug_boot_stage_54c5de';
const PREV_KEY = 'debug_boot_prev_54c5de';

export async function bootLog(stage, data = {}) {
  const entry = { stage, data, ts: Date.now(), sessionId: '54c5de' };
  try {
    const prev = await AsyncStorage.getItem(BOOT_KEY);
    if (prev) await AsyncStorage.setItem(PREV_KEY, prev);
    await AsyncStorage.setItem(BOOT_KEY, JSON.stringify(entry));
  } catch (_) {}
  // #region agent log
  fetch('http://127.0.0.1:7277/ingest/c64fc3e4-b2e1-4f88-b4fa-74f77e49ad88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'54c5de'},body:JSON.stringify({sessionId:'54c5de',location:'bootDebug.js',message:stage,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

export async function readPreviousBootStage() {
  try {
    const raw = await AsyncStorage.getItem(PREV_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/** Last stage written before the most recent launch (useful right after a crash). */
export async function readCurrentBootStage() {
  try {
    const raw = await AsyncStorage.getItem(BOOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function readBootCrashReport() {
  const [previous, current] = await Promise.all([
    readPreviousBootStage(),
    readCurrentBootStage(),
  ]);
  return { previous, current };
}

export function bootLogSync(stage, data = {}) {
  bootLog(stage, data).catch(() => {});
}
