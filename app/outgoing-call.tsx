import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "@/context/CallContext";
import API from "@/api";

export default function OutgoingCallScreen() {
  const router = useRouter();
  const { pendingCallAsCaller, cancelPendingCall } = useCallContext();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Redirect when no longer pending (call accepted → we're on /call; call rejected or cancelled → go to main app)
  useEffect(() => {
    if (!pendingCallAsCaller) {
      router.replace("/(tabs)");
    }
  }, [pendingCallAsCaller, router]);

  // Ringing pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleCancel = async () => {
    await cancelPendingCall();
  };

  if (!pendingCallAsCaller) {
    return null;
  }

  const callee = pendingCallAsCaller.callee || {};
  const avatarUri = callee.image
    ? `${API.APP_URL}/storage/img/profile/${callee.image}`
    : null;
  const displayName = callee.name || "User";

  return (
    <View className="flex-1 bg-dark justify-center items-center px-8">
      <Text className="text-white/70 text-lg mb-2">Calling...</Text>

      <Animated.View
        style={{ transform: [{ scale: pulseAnim }] }}
        className="mb-6"
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            className="w-28 h-28 rounded-full bg-white/20"
            resizeMode="cover"
          />
        ) : (
          <View className="w-28 h-28 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="person" size={56} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </Animated.View>

      <Text className="text-white text-2xl font-bold mb-2">{displayName}</Text>
      <Text className="text-white/60 text-base mb-12">Waiting for response</Text>

      <TouchableOpacity
        onPress={handleCancel}
        className="items-center"
        activeOpacity={0.8}
      >
        <View className="w-20 h-20 rounded-full bg-red-500 items-center justify-center">
          <Ionicons name="call" size={36} color="#fff" />
        </View>
        <Text className="text-white mt-2 font-medium">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
