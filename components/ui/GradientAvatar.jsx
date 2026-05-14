import { View, Image, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

/**
 * Avatar with a soft gradient ring around it — Instagram-style.
 *
 * Props:
 *   uri      – image URL (optional, falls back to an initial)
 *   name     – used to derive the fallback initial
 *   size     – outer ring diameter (defaults to 36)
 *   ringWidth – stroke width of the ring (defaults to 2)
 *   colors   – array of gradient stops, top → bottom (defaults to the brand
 *              yellow-to-orange spectrum)
 *   active   – render the ring; if false, only the avatar is shown
 */
export default function GradientAvatar({
  uri,
  name = '',
  size = 36,
  ringWidth = 2,
  colors = ['#ffc801', '#ff8a00', '#ff2d55'],
  active = true,
}) {
  const innerSize = size - ringWidth * 2;
  const radius = (size - ringWidth) / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {active ? (
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              {colors.map((c, i) => (
                <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} stopOpacity="1" />
              ))}
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ring)"
            strokeWidth={ringWidth}
            fill="none"
          />
        </Svg>
      ) : null}

      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: active ? 1.5 : 0,
          borderColor: '#000',
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{
            color: '#fff', fontWeight: '700',
            fontSize: innerSize * 0.42,
          }}>
            {(name || 'U').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}
