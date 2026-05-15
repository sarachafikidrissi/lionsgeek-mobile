import { useEffect, useRef, useCallback } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Reports screenshot events to the API while viewing someone else's story.
 * Screen *recording* is not reliably detectable in JS on iOS; the same API
 * accepts kind "screen_recording" if you wire a native signal later.
 */
export function useStoryCaptureReport({ storyId, token, enabled, onReport }) {
  const report = useCallback(
    (sid, kind) => {
      if (sid && token && typeof onReport === 'function') {
        onReport(sid, kind, token);
      }
    },
    [onReport],
  );

  const lastAt = useRef(0);

  useEffect(() => {
    if (!enabled || !storyId || !token) return undefined;

    let subscription;

    (async () => {
      try {
        const perm = await ScreenCapture.getPermissionsAsync();
        if (!perm.granted) {
          await ScreenCapture.requestPermissionsAsync();
        }
      } catch (_) {
        /* Android may throw if module unavailable */
      }

      try {
        subscription = ScreenCapture.addScreenshotListener(() => {
          const now = Date.now();
          if (now - lastAt.current < 2500) return;
          lastAt.current = now;
          report(storyId, 'screenshot');
        });
      } catch (_) {
        /* no-op */
      }
    })();

    return () => {
      try {
        subscription?.remove?.();
      } catch (_) {
        /* no-op */
      }
    };
  }, [storyId, token, enabled, report]);
}
