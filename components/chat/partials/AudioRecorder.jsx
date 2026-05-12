import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';

/** Inline recorder strip shown while composing a voice note (parent owns timer). */
export default function AudioRecorder({ onSend, onCancel, isRecording, recordingTime, isPaused, onPause, onResume }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [waveTick, setWaveTick] = useState(0);
    const bars = useMemo(() => Array.from({ length: 32 }, (_, i) => i), []);

    useEffect(() => {
        if (!isRecording || isPaused) return;
        const id = setInterval(() => setWaveTick((t) => t + 1), 120);
        return () => clearInterval(id);
    }, [isRecording, isPaused]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const seed = (recordingTime + waveTick) % 9;

    return (
        <View
            className={`flex-row items-center gap-2 p-2 rounded-2xl border ${
                isDark
                    ? 'bg-zinc-900/95 border-white/[0.1] shadow-lg shadow-black/40'
                    : 'bg-white border-black/[0.08] shadow-md shadow-black/10'
            }`}
        >
            <Pressable onPress={onCancel} className="h-9 w-9 rounded-xl bg-red-500/12 items-center justify-center active:opacity-80">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </Pressable>

            {isPaused ? (
                <Pressable onPress={onResume} className="h-9 w-9 rounded-xl bg-alpha/20 items-center justify-center active:opacity-80">
                    <Ionicons name="play" size={18} color="#ffc801" />
                </Pressable>
            ) : (
                <Pressable onPress={onPause} className="h-9 w-9 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center active:opacity-80">
                    <Ionicons name="pause" size={18} color={isDark ? '#fff' : '#111'} />
                </Pressable>
            )}

            <View className="flex-1 flex-row items-center gap-2 min-w-0">
                <View className={`h-2.5 w-2.5 rounded-full ${isPaused ? 'bg-neutral-400' : 'bg-red-500'}`} />
                <Text className={`text-sm font-bold tabular-nums min-w-[3.25rem] ${isDark ? 'text-white' : 'text-black'}`}>
                    {formatTime(recordingTime)}
                </Text>
                <View className="flex-1 flex-row items-end justify-center gap-[2px] h-9 overflow-hidden">
                    {bars.map((bar) => {
                        const h = 6 + ((bar + seed) % 8) * 3;
                        return (
                            <View
                                key={bar}
                                className={`w-[3px] rounded-full ${isPaused ? 'bg-black/15 dark:bg-white/15' : 'bg-alpha/90'}`}
                                style={{ height: h, opacity: isPaused ? 0.35 : 0.55 + (bar % 4) * 0.1 }}
                            />
                        );
                    })}
                </View>
            </View>

            <Pressable onPress={onSend} className="h-10 w-10 items-center justify-center bg-alpha rounded-2xl active:opacity-90 shadow-sm shadow-black/15">
                <Ionicons name="arrow-up" size={22} color="#000" />
            </Pressable>
        </View>
    );
}
