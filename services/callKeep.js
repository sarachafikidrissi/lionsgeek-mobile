import uuid from "react-native-uuid";
import { Platform, AppState } from "react-native";
import Constants from "expo-constants";

/**
 * CallKeep wrapper with lazy native-module loading.
 *
 * IMPORTANT: `react-native-callkeep` is a native module that does NOT exist in
 * Expo Go. If we `import` it at the top of this file, Expo Go crashes the
 * whole app on startup because the module's `NativeEventEmitter(NativeCalls)`
 * constructor throws at evaluation time.
 *
 * Solution: load the library lazily with a guarded `require`, and make every
 * exported function a no-op when the native module is unavailable. In that
 * fallback mode the app continues to work and the JS-side `useCallRinger`
 * hook handles the ringing instead.
 *
 * What this gives us when the native module IS available (i.e. dev build):
 *  - iOS:     real CallKit incoming-call UI + system ringtone.
 *  - Android: native ConnectionService incoming-call full-screen UI with system ringtone.
 */

let RNCallKeep = null;
let nativeChecked = false;
let nativeAvailable = false;

function getRNCallKeep() {
  if (nativeChecked) return RNCallKeep;
  nativeChecked = true;

  // In Expo Go the native module is not bundled; skip the require entirely so
  // we never even touch react-native-callkeep's NativeEventEmitter.
  if (Constants.appOwnership === "expo") {
    console.log("[CallKeep] Skipped: running inside Expo Go (use a dev build for native calling)");
    return null;
  }

  try {
    const mod = require("react-native-callkeep");
    RNCallKeep = mod?.default || mod?.RNCallKeep || mod;
    nativeAvailable = !!RNCallKeep;
    if (!nativeAvailable) {
      console.log("[CallKeep] react-native-callkeep loaded but module is empty");
    }
  } catch (e) {
    console.log("[CallKeep] react-native-callkeep not available:", e?.message);
    RNCallKeep = null;
    nativeAvailable = false;
  }
  return RNCallKeep;
}

export function isCallKeepAvailable() {
  if (!nativeChecked) getRNCallKeep();
  return nativeAvailable;
}

let isSetup = false;

const uuidToBackendId = new Map();
const backendIdToUuid = new Map();

const options = {
  ios: {
    appName: "LionsGeek",
    supportsVideo: false,
    maximumCallGroups: "1",
    maximumCallsPerCallGroup: "1",
  },
  android: {
    alertTitle: "Permissions required",
    alertDescription: "LionsGeek needs permission to display incoming calls",
    cancelButton: "Cancel",
    okButton: "OK",
    additionalPermissions: [],
    foregroundService: {
      channelId: "com.lionsgeek.callservice",
      channelName: "LionsGeek call service",
      notificationTitle: "LionsGeek is on a call",
    },
  },
};

export async function setupCallKeep() {
  const native = getRNCallKeep();
  if (!native) return false;
  if (isSetup) return true;
  try {
    await native.setup(options);
    if (Platform.OS === "android") {
      native.setAvailable(true);
    }
    isSetup = true;
    return true;
  } catch (e) {
    console.warn("[CallKeep] setup failed:", e?.message || e);
    return false;
  }
}

function makeUuidForBackendId(backendId) {
  const existing = backendIdToUuid.get(backendId);
  if (existing) return existing;
  const id = String(uuid.v4());
  backendIdToUuid.set(backendId, id);
  uuidToBackendId.set(id, backendId);
  return id;
}

export function getBackendIdForUuid(callUuid) {
  return uuidToBackendId.get(callUuid) ?? null;
}

export function getUuidForBackendId(backendId) {
  return backendIdToUuid.get(backendId) ?? null;
}

export async function showIncomingCall({ callId, callerName, callerHandle }) {
  const native = getRNCallKeep();
  if (!native) return null;
  await setupCallKeep();
  const callUuid = makeUuidForBackendId(callId);
  const handle = String(callerHandle || callerName || "Unknown");
  const name = String(callerName || "Incoming call");
  try {
    native.displayIncomingCall(callUuid, handle, name, "generic", false);
  } catch (e) {
    console.warn("[CallKeep] displayIncomingCall failed:", e?.message || e);
  }
  return callUuid;
}

export async function startOutgoingCall({ callId, calleeName, calleeHandle }) {
  const native = getRNCallKeep();
  if (!native) return null;
  await setupCallKeep();
  const callUuid = makeUuidForBackendId(callId);
  const handle = String(calleeHandle || calleeName || "Unknown");
  try {
    native.startCall(callUuid, handle, String(calleeName || handle), "generic", false);
  } catch (e) {
    console.warn("[CallKeep] startCall failed:", e?.message || e);
  }
  return callUuid;
}

export function setCallActive(callUuid) {
  const native = getRNCallKeep();
  if (!native || !callUuid) return;
  try {
    native.setCurrentCallActive(callUuid);
  } catch (e) {
    console.warn("[CallKeep] setCurrentCallActive failed:", e?.message || e);
  }
}

export function endCall(callUuid) {
  const native = getRNCallKeep();
  if (!native) return;
  if (!callUuid) {
    endAllCalls();
    return;
  }
  try {
    native.endCall(callUuid);
  } catch (e) {
    console.warn("[CallKeep] endCall failed:", e?.message || e);
  } finally {
    const backendId = uuidToBackendId.get(callUuid);
    uuidToBackendId.delete(callUuid);
    if (backendId != null) backendIdToUuid.delete(backendId);
  }
}

export function endCallByBackendId(backendId) {
  const id = backendIdToUuid.get(backendId);
  if (id) endCall(id);
}

export function endAllCalls() {
  const native = getRNCallKeep();
  if (native) {
    try {
      native.endAllCalls();
    } catch (e) {
      console.warn("[CallKeep] endAllCalls failed:", e?.message || e);
    }
  }
  uuidToBackendId.clear();
  backendIdToUuid.clear();
}

export function setMuted(callUuid, muted) {
  const native = getRNCallKeep();
  if (!native) return;
  try {
    native.setMutedCall(callUuid, !!muted);
  } catch (e) {
    console.warn("[CallKeep] setMutedCall failed:", e?.message || e);
  }
}

export function addCallKeepListeners({ onAnswer, onEndCall, onMute, onAudioRoute } = {}) {
  const native = getRNCallKeep();
  if (!native) return () => {};

  const handleAnswer = ({ callUUID }) => {
    const backendId = uuidToBackendId.get(callUUID);
    onAnswer && onAnswer({ callUUID, callId: backendId });
  };
  const handleEnd = ({ callUUID }) => {
    const backendId = uuidToBackendId.get(callUUID);
    onEndCall && onEndCall({ callUUID, callId: backendId });
    uuidToBackendId.delete(callUUID);
    if (backendId != null) backendIdToUuid.delete(backendId);
  };
  const handleMute = ({ muted, callUUID }) => {
    const backendId = uuidToBackendId.get(callUUID);
    onMute && onMute({ muted, callUUID, callId: backendId });
  };
  const handleAudioRoute = ({ output }) => {
    onAudioRoute && onAudioRoute({ output });
  };

  try {
    native.addEventListener("answerCall", handleAnswer);
    native.addEventListener("endCall", handleEnd);
    native.addEventListener("didPerformSetMutedCallAction", handleMute);
    native.addEventListener("didChangeAudioRoute", handleAudioRoute);
  } catch (e) {
    console.warn("[CallKeep] addEventListener failed:", e?.message);
    return () => {};
  }

  return () => {
    try {
      native.removeEventListener("answerCall");
      native.removeEventListener("endCall");
      native.removeEventListener("didPerformSetMutedCallAction");
      native.removeEventListener("didChangeAudioRoute");
    } catch (_) {
      // ignore
    }
  };
}

export function isAppForeground() {
  return AppState.currentState === "active";
}

export default {
  setupCallKeep,
  showIncomingCall,
  startOutgoingCall,
  setCallActive,
  endCall,
  endCallByBackendId,
  endAllCalls,
  setMuted,
  addCallKeepListeners,
  getBackendIdForUuid,
  getUuidForBackendId,
  isAppForeground,
  isCallKeepAvailable,
};
