import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import * as Ably from "ably";
import API from "@/api";
import { useRouter } from "expo-router";
import { useAppContext } from "@/context";

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
    pendingCallRef.current = pendingCallAsCaller;

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
                const tokenData = await API.getCallAblyToken(token);
                if (!mounted || !tokenData?.token) return;
                const client = new Ably.Realtime({
                    authCallback: (tokenParams, callback) => {
                        callback(null, tokenData.token);
                    },
                });
                ablyClientRef.current = client;
                const channel = client.channels.get(channelName);
                channelRef.current = channel;

                channel.subscribe("incoming-call", (msg) => {
                    const data = msg.data;
                    if (data?.call_id) {
                        setIncomingCall({
                            callId: data.call_id,
                            channel_name: data.channel_name,
                            caller: data.caller || {},
                            caller_token: data.caller_token,
                        });
                        router.replace("/incoming-call");
                    }
                });

                channel.subscribe("call-accepted", (msg) => {
                    const data = msg.data;
                    const pending = pendingCallRef.current;
                    if (data?.call_id && pending?.callId === data.call_id) {
                        setActiveCall({
                            callId: data.call_id,
                            channelName: pending.channelName,
                            token: pending.token,
                        });
                        setPendingCallAsCaller(null);
                        router.replace("/call");
                    }
                });

                channel.subscribe("call-rejected", () => {
                    setPendingCallAsCaller(null);
                });

                channel.subscribe("call-ended", () => {
                    setActiveCall(null);
                    setIncomingCall(null);
                    setPendingCallAsCaller(null);
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
            router.replace("/outgoing-call");
            return data;
        },
        [token, router]
    );

    const cancelPendingCall = useCallback(
        async () => {
            const pending = pendingCallRef.current;
            if (!pending?.callId || !token) {
                setPendingCallAsCaller(null);
                return;
            }
            try {
                await API.endCall(pending.callId, token);
            } catch (e) {
                console.error("[CallContext] Cancel call error:", e);
            }
            setPendingCallAsCaller(null);
            router.replace("/(tabs)");
        },
        [token, router]
    );

    const accept = useCallback(
        async () => {
            if (!incomingCall?.callId || !token) return null;
            const data = await API.acceptCall(incomingCall.callId, token);
            setIncomingCall(null);
            if (data?.token && data?.channel_name) {
                setActiveCall({
                    callId: data.call_id,
                    channelName: data.channel_name,
                    token: data.token,
                });
                return data;
            }
            return data;
        },
        [incomingCall, token]
    );

    const reject = useCallback(async () => {
        if (!incomingCall?.callId || !token) return;
        await API.rejectCall(incomingCall.callId, token);
        setIncomingCall(null);
    }, [incomingCall, token]);

    const end = useCallback(
        async () => {
            if (!activeCall?.callId || !token) return;
            await API.endCall(activeCall.callId, token);
            setActiveCall(null);
            setPendingCallAsCaller(null);
        },
        [activeCall, token]
    );

    const clearIncomingCall = useCallback(() => setIncomingCall(null), []);
    const clearActiveCall = useCallback(() => setActiveCall(null), []);

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
