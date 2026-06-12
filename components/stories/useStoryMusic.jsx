import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

/**
 * Loads, loops (within the trimmed start_ms..end_ms window) and plays a
 * story's music overlay using expo-av. Returns nothing — it's purely a side
 * effect tied to the story's lifecycle.
 *
 *  - Re-creates the Sound whenever the music overlay (preview_url / trim)
 *    changes, e.g. when navigating to the next story.
 *  - Mutes / unmutes (effectively pause/play) without unloading when
 *    `isPaused` toggles, so resuming feels instant.
 *  - Lowers and unloads everything on unmount or when the story has no
 *    music overlay.
 *
 * Usage:
 *   const overlay = currentStory?.overlays?.find(o => o.type === 'music');
 *   useStoryMusic(overlay, { isPaused });
 *
 * The story video's audio should be muted whenever a music overlay exists
 * (the caller is responsible for passing `isMuted` to its <Video>).
 */
export default function useStoryMusic(musicOverlay, { isPaused = false } = {}) {
  const soundRef  = useRef(null);
  const overlayId = musicOverlay?.id;
  const previewUrl = musicOverlay?.preview_url;
  const startMs    = musicOverlay?.start_ms ?? 0;
  const endMs      = musicOverlay?.end_ms   ?? 15000;

  // Configure audio mode once.
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (_) {}
    })();
  }, []);

  // Load / unload when the active music overlay changes.
  useEffect(() => {
    let cancelled = false;

    const unload = async () => {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch (_) {}
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }
    };

    (async () => {
      await unload();
      if (!previewUrl) return;

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: previewUrl },
          {
            shouldPlay: true,
            isLooping: false, // we loop the window manually
            volume: 1.0,
            positionMillis: startMs,
          },
        );
        if (cancelled) {
          try { await sound.unloadAsync(); } catch (_) {}
          return;
        }
        soundRef.current = sound;
        // Loop the [start_ms, end_ms] window.
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status?.isLoaded) return;
          if (status.didJustFinish || status.positionMillis >= endMs - 50) {
            sound.setPositionAsync(startMs).catch(() => {});
            sound.playAsync().catch(() => {});
          }
        });
      } catch (_) {
        // Best-effort — silently skip on failure.
      }
    })();

    return () => {
      cancelled = true;
      unload();
    };
    // Re-create when the *track* changes; the same track stays loaded
    // across simple pause toggles. Including startMs/endMs so retrimming
    // via remote-update (rare) is honoured.
  }, [overlayId, previewUrl, startMs, endMs]);

  // Pause / resume by toggling volume — instant, doesn't tear down audio.
  useEffect(() => {
    const s = soundRef.current;
    if (!s) return;
    (async () => {
      try {
        if (isPaused) {
          await s.pauseAsync();
        } else {
          await s.playAsync();
        }
      } catch (_) {}
    })();
  }, [isPaused, previewUrl]);
}
