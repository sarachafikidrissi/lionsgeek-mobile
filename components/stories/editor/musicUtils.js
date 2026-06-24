export const PREVIEW_MAX_MS = 30_000;
export const STORY_MAX_MS = 60_000;

export function getClipDurationMs(track) {
  if (track?.story_clip_ms > 0) return track.story_clip_ms;
  const full = track?.duration_ms > 0 ? track.duration_ms : STORY_MAX_MS;
  return Math.min(full, STORY_MAX_MS);
}

export function getPreviewPlayableMs(track) {
  if (!track?.preview_url) return 0;
  return track?.preview_max_ms > 0 ? track.preview_max_ms : PREVIEW_MAX_MS;
}

export function getMaxStartMs(track) {
  return Math.max(0, getClipDurationMs(track) - getPreviewPlayableMs(track));
}

export function buildMusicOverlayPayload(track, { startMs = 0, display = 'none', source = null } = {}) {
  const clipEnd = getClipDurationMs(track);
  const maxStart = getMaxStartMs(track);
  const start = Math.max(0, Math.min(maxStart, startMs));

  return {
    type: 'music',
    track_id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    cover_url: track.cover_url,
    preview_url: track.preview_url || null,
    duration_ms: track.duration_ms || clipEnd,
    start_ms: start,
    end_ms: track.default_end_ms > 0 ? track.default_end_ms : clipEnd,
    display,
    source: track.source || source || 'spotify+itunes',
  };
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function formatMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export const CATEGORY_SECTIONS = {
  for_you: 'top_morocco',       // Top Spotify Morocco
  trending: 'trending',           // Viral / Hot Hits Morocco
  original: 'original',
  saved: 'saved',
};
