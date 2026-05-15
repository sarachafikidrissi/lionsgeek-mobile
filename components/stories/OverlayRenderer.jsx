import { useState, useCallback } from 'react';
import { View } from 'react-native';
import TextOverlay from '@/components/stories/overlays/TextOverlay';
import StickerOverlay from '@/components/stories/overlays/StickerOverlay';
import DrawingOverlay from '@/components/stories/overlays/DrawingOverlay';
import MentionOverlay from '@/components/stories/overlays/MentionOverlay';
import MusicOverlay from '@/components/stories/overlays/MusicOverlay';

/**
 * Read-only overlay layer. Drops in on top of the story media in the viewer
 * and the highlight viewer. Measures its own bounds via onLayout so the
 * normalized coordinates of each overlay get scaled to the actual viewport.
 *
 * The wrapper is `pointerEvents="box-none"` so taps fall through to the
 * underlying tap zones (prev/next) UNLESS they hit a mention chip — those
 * absorb the tap so they can route to a profile.
 *
 * Props:
 *   overlays         – array from the API (see StoryController::mapStory)
 *   onMentionPress   – called with the mention overlay when a chip is tapped
 *   musicAnimated    – whether the music sticker's bouncing bars animate
 *                      (false while the story is paused)
 *   style            – optional extra style
 */
export default function OverlayRenderer({ overlays, onMentionPress, musicAnimated = true, style }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const list = Array.isArray(overlays) ? overlays : [];

  return (
    <View
      onLayout={onLayout}
      pointerEvents="box-none"
      style={[{ position: 'absolute', inset: 0 }, style]}
    >
      {size.width > 0 && size.height > 0 ? list.map((o) => {
        if (!o || typeof o !== 'object') return null;
        if (o.type === 'drawing') {
          return <DrawingOverlay key={o.id} overlay={o} containerSize={size} />;
        }
        if (o.type === 'text') {
          return <TextOverlay key={o.id} overlay={o} containerSize={size} />;
        }
        if (o.type === 'sticker') {
          return <StickerOverlay key={o.id} overlay={o} containerSize={size} />;
        }
        if (o.type === 'mention') {
          return (
            <MentionOverlay
              key={o.id}
              overlay={o}
              containerSize={size}
              onPress={onMentionPress ? () => onMentionPress(o) : undefined}
            />
          );
        }
        if (o.type === 'music') {
          return (
            <MusicOverlay
              key={o.id}
              overlay={o}
              containerSize={size}
              animated={musicAnimated}
            />
          );
        }
        return null;
      }) : null}
    </View>
  );
}
