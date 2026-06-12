import Svg, { Path } from 'react-native-svg';

/**
 * Single drawing-stroke overlay. Renders a smoothed path through the
 * normalized points stored in `overlay.points`.
 *
 * Drawings differ from text/sticker overlays in that they're spatial
 * (a whole stroke), not point-anchored. So x/y/scale/rotation are ignored.
 *
 * Props:
 *   overlay        – { id, type:'drawing', points: [[x,y],...], color, stroke_width }
 *   containerSize  – { width, height }
 */
export default function DrawingOverlay({ overlay, containerSize }) {
  if (!overlay || !containerSize || containerSize.width <= 0) return null;
  const pts = Array.isArray(overlay.points) ? overlay.points : [];
  if (pts.length < 2) return null;

  const d = buildSmoothPath(pts, containerSize.width, containerSize.height);
  const color = overlay.color || '#ffffff';
  const width = Math.max(1, overlay.stroke_width || 6);

  return (
    <Svg
      width={containerSize.width}
      height={containerSize.height}
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
    >
      <Path
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Catmull-Rom-ish smoothed cubic Bezier path through the given points.
 * Falls back to a straight polyline for very short strokes.
 */
function buildSmoothPath(normPoints, w, h) {
  const pts = normPoints.map(([x, y]) => [x * w, y * h]);
  if (pts.length === 2) {
    const [a, b] = pts;
    return `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]} ${pts[i][1]}, ${xc} ${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}
