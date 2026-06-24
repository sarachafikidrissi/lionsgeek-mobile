import { View, Text } from 'react-native';

const ACCENT = '#F5C518';

function formatStat(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function xpForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return 500 + (lv - 1) * 250;
}

export default function GamerProfileStats({ profile, isDark }) {
  const level = Math.max(0, Number(profile?.level ?? 0));
  const xp = Math.max(0, Number(profile?.XP ?? profile?.xp ?? 0));
  const coins = Math.max(0, Number(profile?.GP ?? profile?.gp ?? profile?.coins ?? 0));
  const need = xpForLevel(level || 1);
  const inLevel = need > 0 ? xp % need : 0;
  const progress = need > 0 ? Math.min(1, inLevel / need) : 0;
  const displayLevel = level > 0 ? level : 1;

  const border = isDark ? 'border-white/[0.08]' : 'border-black/[0.06]';
  const surface = isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]';
  const muted = isDark ? 'text-white/40' : 'text-black/45';
  const value = 'text-beta dark:text-white';

  return (
    <View className="mt-4 w-full max-w-[340px]">
      <View className={`w-full rounded-2xl border px-4 py-3.5 ${border} ${surface}`}>
        <View className="flex-row items-baseline justify-between">
          <Text className={`text-sm font-bold ${value}`}>Level {displayLevel}</Text>
          <Text className={`text-sm font-semibold ${value}`}>{formatStat(xp)} XP</Text>
        </View>

        <View className={`mt-2.5 h-[3px] w-full overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-black/8'}`}>
          <View className="h-full rounded-full bg-alpha" style={{ width: `${Math.round(progress * 100)}%` }} />
        </View>

        <View className={`mt-3 w-full flex-row items-center justify-between border-t pt-3 ${isDark ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
          <Text className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Coins</Text>
          <Text className={`text-base font-bold ${value}`}>{formatStat(coins)}</Text>
        </View>
      </View>
    </View>
  );
}
