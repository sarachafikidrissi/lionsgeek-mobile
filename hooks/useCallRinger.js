import { useEffect, useRef } from 'react';
import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';

/**
 * useCallRinger – plays a looped ringtone and vibrates the device while
 * the supplied `enabled` flag is true. Designed for the incoming call
 * (loud, repeating ring + buzz) and outgoing call (subtle dial tone)
 * screens.
 *
 * Usage:
 *   useCallRinger({ enabled: true, mode: 'incoming' });
 *   useCallRinger({ enabled: true, mode: 'outgoing' });
 *
 * The hook automatically stops sound + vibration on:
 *   - the `enabled` flag flipping to false
 *   - the component unmounting
 *
 * In Expo Go on iOS the ringtone plays through the EARPIECE by default
 * unless playsInSilentModeIOS is true – we configure the audio mode here
 * so the ring is loud and audible even when the silent switch is on.
 */
export function useCallRinger({ enabled, mode = 'incoming' }) {
    const soundRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;

        // Vibration pattern that mimics a real phone ring.
        // Android: accepts [wait, vibrate, wait, vibrate, ...].
        // iOS: pattern ignored, just vibrates each entry. We still want
        // the periodic feel so we manually re-trigger below.
        const pattern =
            mode === 'incoming'
                ? [0, 1000, 500, 1000, 1500] // BUZZ-(pause)-BUZZ-(longer pause)
                : [0, 400, 1200];            // softer, dial-tone feel
        try {
            Vibration.vibrate(pattern, true /* repeat */);
        } catch (_) {}

        let iosVibrateInterval = null;
        if (Platform.OS === 'ios') {
            // iOS ignores the repeat flag for patterns – set up our own loop.
            iosVibrateInterval = setInterval(
                () => {
                    try { Vibration.vibrate(); } catch (_) {}
                },
                mode === 'incoming' ? 2500 : 3500
            );
        }

        (async () => {
            try {
                // Make sure the ringtone is loud even with silent switch on.
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                });

                const asset =
                    mode === 'incoming'
                        ? require('../assets/sounds/ringtone.mp3')
                        : require('../assets/sounds/calling.mp3');

                const { sound } = await Audio.Sound.createAsync(
                    asset,
                    {
                        shouldPlay: true,
                        isLooping: true,
                        volume: mode === 'incoming' ? 1.0 : 0.6,
                    }
                );

                if (cancelled || !isMountedRef.current) {
                    // The hook was torn down while the sound was loading.
                    try { await sound.unloadAsync(); } catch (_) {}
                    return;
                }

                soundRef.current = sound;
                try { await sound.playAsync(); } catch (_) {}
            } catch (e) {
                // Sound loading failed (file missing, codec issue, etc.) –
                // fall back to vibration-only. We log so a dev can see it.
                console.warn('[useCallRinger] Failed to play ringtone:', e?.message);
            }
        })();

        return () => {
            cancelled = true;
            try { Vibration.cancel(); } catch (_) {}
            if (iosVibrateInterval) {
                clearInterval(iosVibrateInterval);
                iosVibrateInterval = null;
            }
            const s = soundRef.current;
            soundRef.current = null;
            if (s) {
                (async () => {
                    try { await s.stopAsync(); } catch (_) {}
                    try { await s.unloadAsync(); } catch (_) {}
                })();
            }
        };
    }, [enabled, mode]);
}

export default useCallRinger;
