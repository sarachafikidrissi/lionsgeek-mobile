import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Audio } from "expo-av";
import { useCallContext } from "@/context/CallContext";
import { useAppContext } from "@/context";
import API from "@/api";

/**
 * In-call screen.
 *
 * Voice audio is delivered by a custom WebRTC peer connection running
 * inside a WebView. Ably is used as the signaling channel (offer/answer/ICE
 * exchange). This avoids all third-party meeting providers (Jitsi/Daily etc.)
 * and works in Expo Go without any native build.
 *
 * Both the caller and the callee load the same HTML page. The caller creates
 * the RTCPeerConnection offer, the callee answers. Audio flows P2P.
 */

type ActiveCall = {
  callId: number;
  channelName: string;
  token: string;
  isCaller?: boolean;
} | null;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function buildCallHtml(opts: {
  channelName: string;
  userId: string | number;
  ablyToken: string;
  isCaller: boolean;
}): string {
  // Embed config as a JSON string for safety.
  const cfg = JSON.stringify({
    channelName: String(opts.channelName),
    userId: String(opts.userId),
    ablyToken: String(opts.ablyToken),
    isCaller: !!opts.isCaller,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
<title>Call</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; color: #fff;
               font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { display: flex; align-items: center; justify-content: center; height: 100vh;
          flex-direction: column; padding: 24px; text-align: center; }
  #status { font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase;
            color: rgba(255,255,255,0.65); margin: 0; }
  #remote { width: 1px; height: 1px; position: absolute; bottom: 0; opacity: 0.01; }
  .dots { margin-top: 18px; display: flex; gap: 6px; }
  .dots span { width: 8px; height: 8px; background: rgba(255,255,255,0.5);
               border-radius: 50%; animation: pulse 1.4s infinite ease-in-out; }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                     40% { opacity: 1; transform: scale(1.1); } }
</style>
</head>
<body>
  <div class="wrap">
    <p id="status">Initializing…</p>
    <div class="dots"><span></span><span></span><span></span></div>
  </div>
  <!-- Audio element is kept on-page (not display:none) because some WebViews
       refuse to play audio from a hidden element. We make it ~invisible
       instead. -->
  <audio id="remote" autoplay playsinline controls></audio>

  <script src="https://cdn.jsdelivr.net/npm/ably@2/browser/static/ably.min.js"></script>
  <script>
  (function() {
    var CONFIG = ${cfg};
    var localStream = null;
    var pc = null;
    var signaling = null;
    var ably = null;
    var muted = false;
    var pendingIce = [];
    var remoteSet = false;

    function rn(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (_) {}
    }
    function setStatus(text) {
      var el = document.getElementById('status');
      if (el) el.textContent = text;
      rn({ type: 'status', text: text });
    }
    function logInfo(msg, extra) {
      var s = extra == null ? '' : (' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)));
      console.log('[CALL]', msg + s);
      rn({ type: 'log', text: msg + s });
    }
    function logErr(msg, err) {
      var s = (err && (err.message || err.name)) || String(err || '');
      console.error('[CALL]', msg, s);
      rn({ type: 'log', text: msg + ': ' + s });
    }

    // -- Native-controlled actions ----------------------------------------
    window.__call_toggleMute = function() {
      if (!localStream) return;
      muted = !muted;
      var tracks = localStream.getAudioTracks();
      for (var i = 0; i < tracks.length; i++) tracks[i].enabled = !muted;
      rn({ type: 'mute', muted: muted });
    };

    window.__call_hangup = function() {
      try { if (pc) pc.close(); } catch (_) {}
      try { if (signaling) { signaling.unsubscribe(); signaling.detach(); } } catch (_) {}
      try { if (ably) ably.close(); } catch (_) {}
      try {
        if (localStream) localStream.getTracks().forEach(function(t){ try { t.stop(); } catch(_){} });
      } catch (_) {}
      rn({ type: 'ended' });
    };

    // -- Main flow --------------------------------------------------------
    function attachRemoteStream(stream) {
      var el = document.getElementById('remote');
      if (!el) { logErr('attachRemoteStream', 'audio element missing'); return; }
      try {
        el.srcObject = stream;
      } catch (e) {
        // Fallback for older WebViews that don't accept MediaStream as srcObject.
        try { el.src = URL.createObjectURL(stream); } catch (e2) { logErr('attach srcObject', e); }
      }
      el.muted = false;
      el.volume = 1.0;
      var tries = 0;
      function tryPlay() {
        tries++;
        var p = el.play();
        if (p && p.then) {
          p.then(function() {
            logInfo('remote audio playing', { tracks: stream.getAudioTracks().length });
            rn({ type: 'connected' });
            setStatus('Connected');
          }).catch(function(err) {
            logErr('remote audio play() ' + tries, err);
            if (tries < 5) setTimeout(tryPlay, 400);
          });
        } else {
          logInfo('remote audio play returned undefined');
          rn({ type: 'connected' });
          setStatus('Connected');
        }
      }
      tryPlay();
    }

    function makePc() {
      var p = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          // Free public TURN servers (Open Relay) – needed when both clients are
          // behind symmetric NATs (cellular networks especially). Without TURN
          // the audio will silently fail to flow even though signaling
          // succeeded.
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
      });
      p.ontrack = function(ev) {
        try {
          logInfo('ontrack received', { streams: ev.streams && ev.streams.length });
          attachRemoteStream(ev.streams[0]);
        } catch (e) { logErr('ontrack', e); }
      };
      p.onicecandidate = function(ev) {
        if (ev.candidate && signaling) {
          signaling.publish('ice', { from: CONFIG.userId, candidate: ev.candidate.toJSON() })
            .catch(function(e){ logErr('publish ice', e); });
        }
      };
      p.oniceconnectionstatechange = function() {
        logInfo('ice state', p.iceConnectionState);
        rn({ type: 'ice', state: p.iceConnectionState });
        if (p.iceConnectionState === 'failed') {
          setStatus('Connection failed');
        }
        if (p.iceConnectionState === 'disconnected') {
          setStatus('Reconnecting');
        }
        if (p.iceConnectionState === 'connected' || p.iceConnectionState === 'completed') {
          // Try to re-play the audio in case it was suspended.
          var el = document.getElementById('remote');
          if (el && el.paused && el.srcObject) {
            el.play().catch(function(err){ logErr('post-connect play', err); });
          }
        }
      };
      p.onconnectionstatechange = function() {
        logInfo('pc state', p.connectionState);
        rn({ type: 'pc', state: p.connectionState });
      };
      return p;
    }

    async function flushPendingIce() {
      while (pendingIce.length) {
        var c = pendingIce.shift();
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { logErr('addIce', e); }
      }
    }

    async function start() {
      try {
        setStatus('Requesting microphone');

        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatus('WebRTC not available');
          rn({ type: 'error', message: 'navigator.mediaDevices.getUserMedia is undefined in this WebView. Try a newer device/WebView.' });
          return;
        }

        try {
          // Race against a 8s timeout so we never hang the UI forever if
          // the WebView eats the permission prompt silently.
          localStream = await Promise.race([
            navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
            new Promise(function(_, reject){
              setTimeout(function(){ reject(new Error('getUserMedia timeout')); }, 8000);
            }),
          ]);
        } catch (e) {
          logErr('getUserMedia', e);
          setStatus('Microphone error');
          rn({ type: 'error', message: 'Microphone access failed: ' + (e && (e.name + ': ' + e.message)) });
          return;
        }

        setStatus('Connecting');
        ably = new Ably.Realtime({ token: CONFIG.ablyToken });
        await new Promise(function(resolve, reject) {
          ably.connection.once('connected', resolve);
          ably.connection.once('failed', function(){ reject(new Error('Ably failed')); });
          setTimeout(function(){ reject(new Error('Ably timeout')); }, 12000);
        });

        signaling = ably.channels.get('webrtc:' + CONFIG.channelName);

        pc = makePc();
        localStream.getTracks().forEach(function(t){ pc.addTrack(t, localStream); });

        // Incoming offer (we are callee or peer arrived after us)
        signaling.subscribe('offer', async function(msg) {
          try {
            if (String(msg.data.from) === String(CONFIG.userId)) return;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
            remoteSet = true;
            await flushPendingIce();
            var ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            await signaling.publish('answer', { from: CONFIG.userId, sdp: ans });
            setStatus('Ringing');
          } catch (e) { logErr('handle offer', e); }
        });

        signaling.subscribe('answer', async function(msg) {
          try {
            if (String(msg.data.from) === String(CONFIG.userId)) return;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
            remoteSet = true;
            await flushPendingIce();
          } catch (e) { logErr('handle answer', e); }
        });

        signaling.subscribe('ice', async function(msg) {
          try {
            if (String(msg.data.from) === String(CONFIG.userId)) return;
            if (!remoteSet) {
              pendingIce.push(msg.data.candidate);
              return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
          } catch (e) { logErr('handle ice', e); }
        });

        signaling.subscribe('hangup', function(){
          try { window.__call_hangup(); } catch(_) {}
        });

        if (CONFIG.isCaller) {
          setStatus('Calling');
          var offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          await signaling.publish('offer', { from: CONFIG.userId, sdp: offer });
        } else {
          setStatus('Ringing');
          // Announce presence so the caller can resend offer if they joined first
          signaling.publish('ready', { from: CONFIG.userId }).catch(function(){});
        }

        // Caller listens for callee "ready" → resend offer (handles late-joiners)
        if (CONFIG.isCaller) {
          signaling.subscribe('ready', async function(msg) {
            try {
              if (String(msg.data.from) === String(CONFIG.userId)) return;
              if (pc.signalingState === 'stable' && !remoteSet) {
                var offer2 = await pc.createOffer({ offerToReceiveAudio: true });
                await pc.setLocalDescription(offer2);
                await signaling.publish('offer', { from: CONFIG.userId, sdp: offer2 });
              }
            } catch (e) { logErr('handle ready', e); }
          });
        }
      } catch (e) {
        logErr('start', e);
        setStatus('Error');
      }
    }

    start();
  })();
  </script>
</body>
</html>`;
}

export default function CallScreen() {
  const router = useRouter();
  const { user, token } = useAppContext();
  const { activeCall, end, clearActiveCall } = useCallContext() as {
    activeCall: ActiveCall;
    end: () => Promise<void>;
    clearActiveCall: () => void;
  };

  const webViewRef = useRef<WebView | null>(null);
  const [duration, setDuration] = useState(0);
  const [ending, setEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [statusText, setStatusText] = useState("Connecting");
  const [callConnected, setCallConnected] = useState(false);
  const [ablyToken, setAblyToken] = useState<string | null>(null);
  const [ablyTokenError, setAblyTokenError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const handleEnd = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    // Tell the WebView to hang up first so it can release mic + close pc.
    try {
      webViewRef.current?.injectJavaScript(`window.__call_hangup && window.__call_hangup(); true;`);
    } catch (_) {}
    try {
      await end();
    } catch (_) {
      // even if backend fails, still leave the screen
    } finally {
      clearActiveCall();
      router.replace("/(tabs)");
    }
  }, [end, clearActiveCall, router, ending]);

  // Bail-out (grace period) – iOS state-vs-navigation race protection.
  useEffect(() => {
    if (activeCall) return;
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, 400);
    return () => clearTimeout(timer);
  }, [activeCall, router]);

  // Duration timer (counts up regardless of WebRTC state)
  useEffect(() => {
    if (!activeCall) return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  // Hardware back: confirm before ending the call.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert(
        "End call?",
        "Do you want to end this call?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "End", style: "destructive", onPress: handleEnd },
        ],
        { cancelable: true }
      );
      return true;
    });
    return () => sub.remove();
  }, [handleEnd]);

  // Fetch a fresh Ably token for WebRTC signaling.
  useEffect(() => {
    if (!token || !activeCall) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await API.getCallAblyToken(token);
        if (cancelled) return;
        if (data?.token) {
          setAblyToken(data.token);
        } else {
          setAblyTokenError("Could not get signaling token.");
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Could not get signaling token.";
        setAblyTokenError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeCall]);

  // Pre-request native microphone permission BEFORE mounting the WebView.
  // If we let the WebView ask via getUserMedia, the prompt is often eaten
  // silently (especially on Android), leaving the call stuck on
  // "Requesting microphone" forever.
  useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === "android") {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: "Microphone",
              message: "Allow microphone access so the other person can hear you.",
              buttonPositive: "Allow",
              buttonNegative: "Deny",
            }
          );
          if (cancelled) return;
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            setMicError("Microphone permission denied. Enable it in Settings to make calls.");
            return;
          }
        } else {
          // iOS – use expo-av to trigger the system mic prompt.
          const { status } = await Audio.requestPermissionsAsync();
          if (cancelled) return;
          if (status !== "granted") {
            setMicError("Microphone permission denied. Enable it in Settings to make calls.");
            return;
          }
        }
        // Configure audio session on BOTH platforms so the WebView's <audio>
        // element actually plays through the loudspeaker and is not ducked /
        // routed through the earpiece.
        //  - playsInSilentModeIOS: critical, otherwise the silent switch
        //    mutes the remote audio entirely.
        //  - allowsRecordingIOS: required while we have the mic open; we
        //    accept that this routes through the receiver by default and
        //    rely on the WebView's audio element to route to the speaker.
        //  - shouldDuckAndroid: false so the music stays paused, not ducked.
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            interruptionModeIOS: 1, // DoNotMix
            interruptionModeAndroid: 1, // DoNotMix
          } as any);
        } catch (e) {
          console.warn("[call] Audio.setAudioModeAsync failed", e);
        }
        if (!cancelled) setMicReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setMicError(e?.message || "Could not request microphone permission.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCall]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "status" && typeof data.text === "string") {
          setStatusText(data.text);
        } else if (data?.type === "connected") {
          setCallConnected(true);
          setStatusText("Connected");
        } else if (data?.type === "mute") {
          setMuted(!!data.muted);
        } else if (data?.type === "ended") {
          handleEnd();
        } else if (data?.type === "error") {
          console.warn("[CallWebView error]", data.message);
          setMicError(data.message || "Call error");
        } else if (data?.type === "ice") {
          console.log("[CallWebView] ice state:", data.state);
          if (data.state === "failed") {
            setStatusText("Connection failed – check network");
          }
        } else if (data?.type === "pc") {
          console.log("[CallWebView] pc state:", data.state);
        } else if (data?.type === "log") {
          console.log("[CallWebView]", data.text);
        }
      } catch (_) {}
    },
    [handleEnd]
  );

  const toggleMute = () => {
    webViewRef.current?.injectJavaScript(
      `window.__call_toggleMute && window.__call_toggleMute(); true;`
    );
  };

  if (!activeCall) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 16 }}>
          Connecting…
        </Text>
      </View>
    );
  }

  // Mic permission denied → show actionable error and exit.
  if (micError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Ionicons name="mic-off" size={48} color="rgba(255,255,255,0.7)" />
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "600",
            marginTop: 18,
            textAlign: "center",
          }}
        >
          Microphone is required
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            marginTop: 8,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {micError}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{
              backgroundColor: "rgba(255,255,255,0.15)",
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEnd}
            style={{
              backgroundColor: "#ef4444",
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading the Ably token / mic permission… or token fetch failed.
  if (!ablyToken || !micReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {ablyTokenError ?? (!micReady ? "Requesting microphone…" : "Preparing call…")}
        </Text>
        {ablyTokenError ? (
          <TouchableOpacity
            onPress={handleEnd}
            style={{
              marginTop: 24,
              backgroundColor: "#ef4444",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const html = buildCallHtml({
    channelName: activeCall.channelName,
    userId: user?.id ?? "anon",
    ablyToken,
    isCaller: !!activeCall.isCaller,
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        // baseUrl=https://localhost gives the WebView a secure origin so
        // navigator.mediaDevices.getUserMedia is available.
        source={{ html, baseUrl: "https://localhost" }}
        style={{ flex: 1, backgroundColor: "#0a0a0a" }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        // Android: allow autoplay + give the WebView access to mic & camera.
        allowsProtectedMedia
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        onMessage={onMessage}
        // Surface inner WebView console logs in Metro so we can debug
        // WebRTC issues from the phone.
        onError={(e) => console.warn("[CallWebView onError]", e?.nativeEvent)}
        onHttpError={(e) => console.warn("[CallWebView onHttpError]", e?.nativeEvent)}
      />

      {/* Top overlay: status + duration */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: Platform.OS === "ios" ? 56 : 40,
          paddingBottom: 14,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {callConnected ? "Voice call" : statusText}
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "700",
            marginTop: 4,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Bottom controls */}
      <View
        style={{
          position: "absolute",
          bottom: 36,
          left: 0,
          right: 0,
          paddingHorizontal: 28,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <TouchableOpacity
          onPress={toggleMute}
          activeOpacity={0.85}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: muted
              ? "rgba(239,68,68,0.85)"
              : "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={muted ? "mic-off" : "mic"}
            size={26}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleEnd}
          disabled={ending}
          activeOpacity={0.85}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: "#ef4444",
            alignItems: "center",
            justifyContent: "center",
            opacity: ending ? 0.6 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons
            name="call"
            size={32}
            color="#fff"
            style={{ transform: [{ rotate: "135deg" }] }}
          />
        </TouchableOpacity>

        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "rgba(255,255,255,0.05)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={callConnected ? "volume-high" : "ellipsis-horizontal"}
            size={22}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      </View>
    </View>
  );
}
