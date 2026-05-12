import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function VoiceMessage({ audioUrl, duration, isCurrentUser, onPlayStateChange }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const soundRef = useRef(null);
    const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlayback = async () => {
        try {
            if (!soundRef.current) {
                const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded) {
                        setCurrentTime(status.positionMillis / 1000);
                        setIsPlaying(status.isPlaying);

                        if (status.didJustFinish) {
                            setIsPlaying(false);
                            setCurrentTime(0);
                            onPlayStateChange?.(false);
                        }
                    }
                });

                setIsPlaying(true);
                onPlayStateChange?.(true);
            } else {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (status.isPlaying) {
                        await soundRef.current.pauseAsync();
                        setIsPlaying(false);
                        onPlayStateChange?.(false);
                    } else {
                        await soundRef.current.playAsync();
                        setIsPlaying(true);
                        onPlayStateChange?.(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    useEffect(() => {
        return async () => {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }
        };
    }, []);

    const safeDuration = Math.max(duration || 0, 1);
    const progress = Math.min((currentTime || 0) / safeDuration, 1);
    const activeBars = Math.max(1, Math.round(progress * bars.length));

    const playBg = isCurrentUser ? 'bg-black/90' : 'bg-alpha';
    const playIcon = isCurrentUser ? '#ffc801' : '#000';
    const barPlayed = isCurrentUser ? 'bg-alpha' : 'bg-alpha';
    const barIdle = isCurrentUser ? 'bg-white/35' : 'bg-black/20 dark:bg-white/25';
    const textMain = isCurrentUser ? 'text-white' : 'text-black dark:text-white';
    const textSub = isCurrentUser ? 'text-white/70' : 'text-black/55 dark:text-white/55';
    const trackBg = isCurrentUser ? 'bg-white/20' : 'bg-black/10 dark:bg-white/15';
    const trackFill = isCurrentUser ? 'bg-alpha' : 'bg-alpha';

    return (
        <View className="flex-row items-center gap-3 px-3 py-2.5">
            <Pressable
                onPress={togglePlayback}
                className={`h-11 w-11 rounded-full items-center justify-center shadow-sm ${playBg}`}
            >
                {isPlaying ? (
                    <Ionicons name="pause" size={20} color={playIcon} />
                ) : (
                    <Ionicons name="play" size={20} color={playIcon} style={{ marginLeft: 2 }} />
                )}
            </Pressable>

            <View className="flex-1 min-w-0">
                <View className="flex-row items-end justify-between gap-1 h-9 px-0.5">
                    {bars.map((bar) => {
                        const h = Math.round(5 + (bar % 6) * 2.5);
                        const active = bar < activeBars;
                        return (
                            <View
                                key={bar}
                                className={`rounded-full ${active ? barPlayed : barIdle}`}
                                style={{
                                    width: 3,
                                    height: isPlaying && active ? h + 3 : h,
                                    opacity: active ? 1 : 0.45,
                                }}
                            />
                        );
                    })}
                </View>
                <View className={`h-1 rounded-full mt-2 overflow-hidden ${trackBg}`}>
                    <View className={`h-full ${trackFill}`} style={{ width: `${Math.round(progress * 100)}%` }} />
                </View>
                <Text className={`text-[11px] font-semibold tabular-nums mt-1.5 ${textMain}`}>
                    {formatTime(currentTime || 0)} <Text className={textSub}>/ {formatTime(duration || 0)}</Text>
                </Text>
            </View>
        </View>
    );
}
