import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Platform, PermissionsAndroid } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "@/context/CallContext";
import { useAppContext } from "@/context";

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || "";

type ActiveCall = { callId: number; channelName: string; token: string } | null;

export default function CallScreen() {
  const router = useRouter();
  const { user } = useAppContext();
  const { activeCall, end, clearActiveCall } = useCallContext() as {
    activeCall: ActiveCall;
    end: () => Promise<void>;
    clearActiveCall: () => void;
  };
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [duration, setDuration] = useState(0);
  const [agoraReady, setAgoraReady] = useState(false);
  const [agoraError, setAgoraError] = useState<Error | null>(null);
  const engineRef = useRef<ReturnType<typeof import("react-native-agora").createAgoraRtcEngine> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy-load react-native-agora so the app can start in Expo Go (no top-level import)
  useEffect(() => {
    try {
      require("react-native-agora");
      setAgoraReady(true);
    } catch (e) {
      setAgoraError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  useEffect(() => {
    if (!activeCall?.channelName || !activeCall?.token || !user?.id) {
      router.replace("/(tabs)");
      return;
    }
    if (!agoraReady || agoraError) return;

    const Agora = require("react-native-agora");
    const {
      createAgoraRtcEngine,
      ChannelMediaOptions,
      RtcEngineContext,
      ClientRoleType,
    } = Agora;

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;
    const appId = AGORA_APP_ID;
    if (!appId) {
      console.warn("EXPO_PUBLIC_AGORA_APP_ID not set");
    }

    const init = async () => {
      try {
        if (Platform.OS === "android") {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            { title: "Microphone", message: "This app needs microphone access for voice calls.", buttonPositive: "OK" }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn("Microphone permission denied");
            return;
          }
        }
        engine.initialize(new RtcEngineContext({ appId }));
        const options = new ChannelMediaOptions();
        options.publishMicrophoneTrack = true;
        options.publishCameraTrack = false;
        options.clientRoleType = ClientRoleType.ClientRoleBroadcaster;
        engine.joinChannelWithUserAccount(
          activeCall.token,
          activeCall.channelName,
          String(user.id),
          options
        );
        engine.setEnableSpeakerphone(speaker);
        durationIntervalRef.current = setInterval(() => {
          setDuration((s) => s + 1);
        }, 1000);
      } catch (e) {
        console.error("Agora join error:", e);
      }
    };
    init();

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      try {
        engine.leaveChannel();
      } catch (_) {}
      engineRef.current = null;
    };
  }, [activeCall?.channelName, activeCall?.token, user?.id, agoraReady, agoraError]);

  useEffect(() => {
    if (!activeCall) {
      router.replace("/(tabs)");
      return;
    }
  }, [activeCall]);

  const handleEnd = async () => {
    try {
      await end();
    } finally {
      clearActiveCall();
      router.replace("/(tabs)");
    }
  };

  const toggleMute = () => {
    const engine = engineRef.current;
    if (engine) {
      try {
        engine.muteLocalAudioStream(!muted);
        setMuted(!muted);
      } catch (_) {}
    }
  };

  const toggleSpeaker = () => {
    const engine = engineRef.current;
    if (engine) {
      try {
        engine.setEnableSpeakerphone(!speaker);
        setSpeaker(!speaker);
      } catch (_) {}
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!activeCall) {
    return null;
  }

  // Agora not available (e.g. Expo Go) – show message and go back
  if (agoraError) {
    return (
      <View className="flex-1 bg-dark justify-center items-center px-8">
        <Ionicons name="call" size={64} color="rgba(255,255,255,0.5)" />
        <Text className="text-white text-center text-lg mt-4">
          Voice calls require a development build.
        </Text>
        <Text className="text-white/70 text-center mt-2">
          Use a dev build (expo run:android / EAS build) instead of Expo Go.
        </Text>
        <TouchableOpacity
          onPress={() => {
            clearActiveCall();
            router.replace("/(tabs)");
          }}
          className="mt-8 px-6 py-3 bg-white/20 rounded-full"
        >
          <Text className="text-white font-medium">Back to app</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!agoraReady) {
    return (
      <View className="flex-1 bg-dark justify-center items-center">
        <Text className="text-white">Starting call...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark justify-end pb-16 px-8">
      <Text className="text-white text-center text-4xl font-light mb-4">
        {formatTime(duration)}
      </Text>
      <Text className="text-white/70 text-center text-lg mb-12">
        Voice call
      </Text>

      <View className="flex-row justify-center gap-10 mb-8">
        <TouchableOpacity
          onPress={toggleMute}
          className="items-center"
          activeOpacity={0.8}
        >
          <View
            className={`w-16 h-16 rounded-full items-center justify-center ${
              muted ? "bg-red-500/80" : "bg-white/20"
            }`}
          >
            <Ionicons
              name={muted ? "mic-off" : "mic"}
              size={28}
              color="#fff"
            />
          </View>
          <Text className="text-white mt-2 text-sm">
            {muted ? "Unmute" : "Mute"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleSpeaker}
          className="items-center"
          activeOpacity={0.8}
        >
          <View
            className={`w-16 h-16 rounded-full items-center justify-center ${
              speaker ? "bg-green-500/80" : "bg-white/20"
            }`}
          >
            <Ionicons
              name={speaker ? "volume-high" : "volume-mute"}
              size={28}
              color="#fff"
            />
          </View>
          <Text className="text-white mt-2 text-sm">
            {speaker ? "Speaker" : "Earpiece"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleEnd}
        className="self-center w-20 h-20 rounded-full bg-red-500 items-center justify-center"
        activeOpacity={0.8}
      >
        <Ionicons name="call" size={36} color="#fff" />
      </TouchableOpacity>
      <Text className="text-white text-center mt-2 font-medium">End</Text>
    </View>
  );
}
