import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import * as Ably from "ably";
import API from "@/api";
import { useRouter } from "expo-router";
import { useAppContext } from "@/context";
import CallKeep from "@/services/callKeep";

const CallContext = createContext(null);

export function CallProvider({ children }) {
    const { user, token } = useAppContext();
    const router = useRouter();
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [pendingCallAsCaller, setPendingCallAsCaller] = useState(null);
    const ablyClientRef = useRef(null);
    const channelRef = useRef(null);
    const pendingCallRef = useRef(null);
    const incomingCallRef = useRef(null);
    const activeCallRef = useRef(null);
    const tokenRef = useRef(null);
    pendingCallRef.current = pendingCallAsCaller;
    incomingCallRef.current = incomingCall;
    activeCallRef.current = activeCall;
    tokenRef.current = token;

    const channelName = user?.id ? `call:user:${user.id}` : null;

    useEffect(() => {
        if (!token || !user?.id || !channelName) {
            if (ablyClientRef.current) {
                ablyClientRef.current.close();
                ablyClientRef.current = null;
                channelRef.current = null;
            }
            return;
        }

        let mounted = true;
        (async () => {
            try {
                // Sanity-check that the backend can mint tokens for this user.
                const initialTokenData = await API.getCallAblyToken(token);
                if (!mounted || !initialTokenData?.token) return;

                const client = new Ably.Realtime({
                    authCallback: async (_tokenParams, callback) => {
                        try {
                            const fresh = await API.getCallAblyToken(token);
                            if (!fresh?.token) {
                                callback('Failed to fetch Ably token', null);
                                return;
                            }
                            callback(null, fresh.token);
                        } catch (err) {
                            callback(err?.message || 'Ably token request failed', null);
                        }
                    },
                });
                ablyClientRef.current = client;
                const channel = client.channels.get(channelName);
                channelRef.current = channel;

                channel.subscribe("incoming-call", async (msg) => {
                    const data = msg.data;
                    if (!data?.call_id) return;
                    const callerName = data.caller?.name || "Incoming call";
                    setIncomingCall({
                        callId: data.call_id,
                        channel_name: data.channel_name,
                        caller: data.caller || {},
                        caller_token: data.caller_token,
                    });
                    // Show the OS-level native incoming call UI with system
                    // ringtone (CallKit on iOS / ConnectionService on Android).
                    let callKeepOk = false;
                    try {
                        await CallKeep.showIncomingCall({
                            callId: data.call_id,
                            callerName,
                            callerHandle: String(data.caller?.id ?? callerName),
                        });
                        callKeepOk = true;
                    } catch (e) {
                        console.warn('[CallContext] CallKeep.showIncomingCall failed', e);
                    }
                    // Navigate to the in-app screen as a fallback. On Android with
                    // ConnectionService the system UI is shown over the app; on
                    // iOS CallKit takes over the whole screen so the user
                    // generally never sees this. If CallKeep failed the in-app
                    // screen at least gives the user manual accept/reject.
                    router.replace("/incoming-call");
                });

                channel.subscribe("call-accepted", (msg) => {
                    const data = msg.data;
                    const pending = pendingCallRef.current;
                    if (data?.call_id && pending?.callId === data.call_id) {
                        console.log('[CallContext] call-accepted → opening /call');
                        setActiveCall({
                            callId: data.call_id,
                            channelName: pending.channelName,
                            token: pending.token,
                            isCaller: true,
                        });
                        setPendingCallAsCaller(null);
                        try { CallKeep.setCallActive(CallKeep.getUuidForBackendId(data.call_id)); } catch (_) {}
                        setTimeout(() => router.replace("/call"), 0);
                    }
                });

                channel.subscribe("call-rejected", (msg) => {
                    const callId = msg?.data?.call_id;
                    setPendingCallAsCaller(null);
                    if (callId) CallKeep.endCallByBackendId(callId);
                });

                channel.subscribe("call-ended", (msg) => {
                    const callId = msg?.data?.call_id;
                    setActiveCall(null);
                    setIncomingCall(null);
                    setPendingCallAsCaller(null);
                    if (callId) {
                        CallKeep.endCallByBackendId(callId);
                    } else {
                        CallKeep.endAllCalls();
                    }
                    router.replace("/(tabs)");
                });
            } catch (e) {
                console.error("[CallContext] Ably init error:", e);
            }
        })();

        return () => {
            mounted = false;
            if (ablyClientRef.current) {
                ablyClientRef.current.close();
                ablyClientRef.current = null;
                channelRef.current = null;
            }
        };
    }, [token, user?.id, channelName]);

    // ──────────────────────────────────────────────────────────────────────
    // CallKeep → CallContext bridge
    // The user can answer / hang up directly from the native CallKit /
    // ConnectionService UI (which is the whole point of using CallKeep).
    // When that happens we get an event from the native side and have to
    // translate it back into our existing accept / reject / end actions.
    // ──────────────────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            await CallKeep.setupCallKeep();
        })();

        const unsubscribe = CallKeep.addCallKeepListeners({
            onAnswer: async ({ callId }) => {
                console.log('[CallContext] CallKeep onAnswer → accept', { callId });
                // The CallKeep UUID maps to the backend call id only if we
                // already received the incoming-call Ably event; if so, the
                // incomingCall state is already set, otherwise the call may
                // have been delivered via a push notification while the app
                // was killed – fall back to using the incomingCallRef.
                if (!incomingCallRef.current || !tokenRef.current) {
                    return;
                }
                try {
                    const data = await API.acceptCall(incomingCallRef.current.callId, tokenRef.current);
                    if (data?.token && data?.channel_name) {
                        setActiveCall({
                            callId: data.call_id,
                            channelName: data.channel_name,
                            token: data.token,
                            isCaller: false,
                        });
                        setIncomingCall(null);
                        try { CallKeep.setCallActive(CallKeep.getUuidForBackendId(data.call_id)); } catch (_) {}
                        setTimeout(() => router.replace('/call'), 0);
                    }
                } catch (e) {
                    console.error('[CallContext] CallKeep accept failed', e?.response?.data || e?.message);
                    setIncomingCall(null);
                }
            },
            onEndCall: async ({ callId }) => {
                console.log('[CallContext] CallKeep onEndCall', { callId });
                const tok = tokenRef.current;
                // Decide what "end" means based on current state.
                const incoming = incomingCallRef.current;
                const active = activeCallRef.current;
                const pending = pendingCallRef.current;
                try {
                    if (active?.callId && tok) {
                        await API.endCall(active.callId, tok);
                    } else if (incoming?.callId && tok) {
                        await API.rejectCall(incoming.callId, tok);
                    } else if (pending?.callId && tok) {
                        await API.endCall(pending.callId, tok);
                    }
                } catch (e) {
                    console.warn('[CallContext] CallKeep end action API call failed', e?.message);
                }
                setIncomingCall(null);
                setActiveCall(null);
                setPendingCallAsCaller(null);
                router.replace('/(tabs)');
            },
        });

        return () => {
            try { unsubscribe?.(); } catch (_) {}
        };
    }, [router]);

    const initiate = useCallback(
        async (calleeId) => {
            if (!token) throw new Error("Not authenticated");
            const data = await API.initiateCall(calleeId, token);
            if (!data?.call_id) throw new Error(data?.message || "Failed to start call");
            const callee = data?.call?.callee || { id: calleeId, name: null, image: null };
            setPendingCallAsCaller({
                callId: data.call_id,
                channelName: data.channel_name,
                token: data.token,
                calleeId,
                callee: { id: callee.id, name: callee.name, image: callee.image ?? callee.avatar },
            });
            // Register the outgoing call with CallKeep so the OS knows we're in
            // a call (proper audio routing, mute button on lock screen, etc.).
            try {
                await CallKeep.startOutgoingCall({
                    callId: data.call_id,
                    calleeName: callee.name || 'Calling…',
                    calleeHandle: String(callee.id ?? calleeId),
                });
            } catch (e) {
                console.warn('[CallContext] CallKeep.startOutgoingCall failed', e);
            }
            setTimeout(() => router.replace("/outgoing-call"), 0);
            return data;
        },
        [token, router]
    );

    const cancelPendingCall = useCallback(
        async () => {
            const pending = pendingCallRef.current;
            if (!pending?.callId || !token) {
                setPendingCallAsCaller(null);
                CallKeep.endAllCalls();
                return;
            }
            try {
                await API.endCall(pending.callId, token);
            } catch (e) {
                console.error("[CallContext] Cancel call error:", e);
            }
            CallKeep.endCallByBackendId(pending.callId);
            setPendingCallAsCaller(null);
            router.replace("/(tabs)");
        },
        [token, router]
    );

    const accept = useCallback(
        async () => {
            if (!incomingCall?.callId || !token) {
                console.log('[CallContext] accept aborted – no incomingCall or token');
                return null;
            }
            console.log('[CallContext] accept → API.acceptCall', incomingCall.callId);
            let data;
            try {
                data = await API.acceptCall(incomingCall.callId, token);
            } catch (err) {
                console.error('[CallContext] API.acceptCall failed', err?.response?.data || err?.message);
                CallKeep.endCallByBackendId(incomingCall.callId);
                setIncomingCall(null);
                throw err;
            }
            console.log('[CallContext] accept response', {
                hasToken: !!data?.token,
                hasChannel: !!data?.channel_name,
                callId: data?.call_id,
            });

            if (data?.token && data?.channel_name) {
                setActiveCall({
                    callId: data.call_id,
                    channelName: data.channel_name,
                    token: data.token,
                    isCaller: false,
                });
                try { CallKeep.setCallActive(CallKeep.getUuidForBackendId(data.call_id)); } catch (_) {}
            }
            setIncomingCall(null);
            if (data?.token && data?.channel_name) {
                setTimeout(() => {
                    console.log('[CallContext] navigating to /call');
                    router.replace('/call');
                }, 0);
            }
            return data;
        },
        [incomingCall, token, router]
    );

    const reject = useCallback(async () => {
        if (!incomingCall?.callId || !token) return;
        try {
            await API.rejectCall(incomingCall.callId, token);
        } finally {
            CallKeep.endCallByBackendId(incomingCall.callId);
            setIncomingCall(null);
        }
    }, [incomingCall, token]);

    const end = useCallback(
        async () => {
            if (!activeCall?.callId || !token) return;
            try {
                await API.endCall(activeCall.callId, token);
            } finally {
                CallKeep.endCallByBackendId(activeCall.callId);
                setActiveCall(null);
                setPendingCallAsCaller(null);
            }
        },
        [activeCall, token]
    );

    const clearIncomingCall = useCallback(() => {
        if (incomingCall?.callId) CallKeep.endCallByBackendId(incomingCall.callId);
        setIncomingCall(null);
    }, [incomingCall]);
    const clearActiveCall = useCallback(() => {
        if (activeCall?.callId) CallKeep.endCallByBackendId(activeCall.callId);
        setActiveCall(null);
    }, [activeCall]);

    const value = {
        incomingCall,
        activeCall,
        pendingCallAsCaller,
        initiate,
        accept,
        reject,
        end,
        cancelPendingCall,
        clearIncomingCall,
        clearActiveCall,
        setActiveCall,
    };

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

const noop = () => {};
const noopAsync = async () => {};
const safeDefault = {
    incomingCall: null,
    activeCall: null,
    pendingCallAsCaller: null,
    initiate: noopAsync,
    accept: noopAsync,
    reject: noopAsync,
    end: noopAsync,
    cancelPendingCall: noopAsync,
    clearIncomingCall: noop,
    clearActiveCall: noop,
    setActiveCall: noop,
};

export function useCallContext() {
    try {
        const ctx = useContext(CallContext);
        return ctx ?? safeDefault;
    } catch (_) {
        return safeDefault;
    }
}
