import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "@/context/CallContext";
import { useAppContext } from "@/context";
import API from "@/api";

export default function IncomingCallScreen() {
  const router = useRouter();
  const { callId: paramCallId } = useLocalSearchParams<{ callId?: string }>();
  const { user, token } = useAppContext();
  const { incomingCall, accept, reject, clearIncomingCall, setActiveCall } = useCallContext();
  const [fetchedCall, setFetchedCall] = useState<{
    callId: number;
    channel_name: string;
    caller: { id: number; name?: string; avatar?: string | null };
  } | null>(null);

  // When opened from push: we have callId param but no Ably incomingCall – fetch call details
  useEffect(() => {
    if (paramCallId && token && !incomingCall && !fetchedCall) {
      (async () => {
        try {
          const data = await API.getCall(Number(paramCallId), token);
          if (data?.call_id) {
            setFetchedCall({
              callId: data.call_id,
              channel_name: data.channel_name,
              caller: data.caller || {},
            });
          } else {
            router.replace("/(tabs)");
          }
        } catch {
          router.replace("/(tabs)");
        }
      })();
    }
  }, [paramCallId, token, incomingCall, fetchedCall]);

  useEffect(() => {
    if (!incomingCall && !fetchedCall && !paramCallId) {
      router.replace("/(tabs)");
    }
  }, [incomingCall, fetchedCall, paramCallId]);

  const displayCall = incomingCall || (fetchedCall ? {
    callId: fetchedCall.callId,
    channel_name: fetchedCall.channel_name,
    caller: fetchedCall.caller,
    caller_token: null,
  } : null);

  const handleAccept = async () => {
    try {
      if (incomingCall) {
        await accept();
      } else if (fetchedCall && token) {
        const data = await API.acceptCall(fetchedCall.callId, token);
        if (data?.token && data?.channel_name && setActiveCall) {
          setActiveCall({
            callId: data.call_id,
            channelName: data.channel_name,
            token: data.token,
          });
        }
      }
      router.replace("/call");
    } catch (e) {
      console.error("Accept call error:", e);
    }
  };

  const handleReject = async () => {
    if (incomingCall) {
      await reject();
      clearIncomingCall();
    } else if (fetchedCall && token) {
      await API.rejectCall(fetchedCall.callId, token);
      setFetchedCall(null);
    }
    router.replace("/(tabs)");
  };

  if (!displayCall) {
    return (
      <View className="flex-1 bg-dark justify-center items-center">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-white mt-4">Loading call...</Text>
      </View>
    );
  }

  const caller = displayCall.caller || {};
  const avatarUri = caller.avatar
    ? `${API.APP_URL}/storage/img/profile/${caller.avatar}`
    : null;

  return (
    <View className="flex-1 bg-dark justify-center items-center px-8">
      <Text className="text-white/70 text-lg mb-2">Incoming voice call</Text>
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          className="w-28 h-28 rounded-full mb-6 bg-white/20"
          resizeMode="cover"
        />
      ) : (
        <View className="w-28 h-28 rounded-full mb-6 bg-white/20 items-center justify-center">
          <Ionicons name="person" size={56} color="rgba(255,255,255,0.6)" />
        </View>
      )}
      <Text className="text-white text-2xl font-bold mb-12">
        {caller.name || "Unknown"}
      </Text>

      <View className="flex-row gap-12">
        <TouchableOpacity
          onPress={handleReject}
          className="items-center"
          activeOpacity={0.8}
        >
          <View className="w-20 h-20 rounded-full bg-red-500 items-center justify-center">
            <Ionicons name="call-reject" size={36} color="#fff" />
          </View>
          <Text className="text-white mt-2 font-medium">Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAccept}
          className="items-center"
          activeOpacity={0.8}
        >
          <View className="w-20 h-20 rounded-full bg-green-500 items-center justify-center">
            <Ionicons name="call" size={36} color="#fff" />
          </View>
          <Text className="text-white mt-2 font-medium">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
