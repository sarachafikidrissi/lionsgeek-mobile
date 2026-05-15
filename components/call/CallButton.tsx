import React, { useState } from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "@/context/CallContext";

type CallButtonProps = {
  calleeId: number;
  size?: number;
  color?: string;
  disabled?: boolean;
};

export default function CallButton({
  calleeId,
  size = 24,
  color = "#0ea5e9",
  disabled = false,
}: CallButtonProps) {
  const { initiate, pendingCallAsCaller } = useCallContext();
  const [loading, setLoading] = useState(false);

  const isCalling = pendingCallAsCaller?.calleeId === calleeId;

  const handlePress = async () => {
    if (disabled || loading || isCalling) return;
    setLoading(true);
    try {
      await initiate(calleeId);
    } catch (e) {
      console.error("Start call error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || isCalling) {
    return (
      <TouchableOpacity className="p-2" disabled>
        <ActivityIndicator size="small" color={color} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      className="p-2"
      accessibilityLabel="Start voice call"
    >
      <Ionicons name="call" size={size} color={disabled ? "#999" : color} />
    </TouchableOpacity>
  );
}
