import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, isValid, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';

const ACCENT = '#ffcc00';
const BG_TOP = '#12110f';
const BG_BOTTOM = '#0f0e0c';
const CARD = '#1c1b17';
const CARD_BORDER = '#2d2c28';
const STAT_LABEL = 'rgba(255,255,255,0.45)';
const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      }
    : { elevation: 5 };

function formatDayHeader(raw) {
  const s = String(raw).slice(0, 10);
  const d = parseISO(s);
  if (!isValid(d)) return String(raw || '');
  return format(d, 'EEE, d MMM yyyy');
}

function formatDayCell(raw) {
  const s = String(raw).slice(0, 10);
  const d = parseISO(s);
  if (!isValid(d)) return { line1: String(raw || ''), line2: '' };
  return { line1: format(d, 'EEE'), line2: format(d, 'd MMM yyyy') };
}

function TableSlotCell({ status }) {
  const s = status || 'present';
  const size = 20;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor:
            s === 'absent' ? '#dc2626' : s === 'late' ? '#92400e' : s === 'excused' ? '#4c1d95' : '#14532d',
        }}
      />
    </View>
  );
}

function humanizeIssue(issue) {
  const [slot, stat] = String(issue).split('_');
  const slotName = slot === 'morning' ? 'Morning' : slot === 'lunch' ? 'Lunch' : slot === 'evening' ? 'Evening' : slot;
  const statWord =
    stat === 'absent' ? 'absent' : stat === 'late' ? 'late' : stat === 'excused' ? 'excused' : stat || '';
  return `${slotName} ${statWord}`.trim();
}

function summaryLine(item) {
  if (item.summary === 'full_day') {
    return 'Full day present · All sessions confirmed';
  }
  if (Array.isArray(item.issues) && item.issues.length > 0) {
    return item.issues.map(humanizeIssue).join(' · ');
  }
  return 'Partial day';
}

function TableHeaderRow() {
  return (
    <View
      className="flex-row items-center border-b px-2 py-3"
      style={{ borderBottomColor: CARD_BORDER, backgroundColor: 'rgba(0,0,0,0.25)' }}
    >
      <View style={{ flex: 2, paddingRight: 8 }}>
        <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">Day</Text>
      </View>
      {['M', 'L', 'E'].map((h) => (
        <View key={h} style={{ flex: 1, alignItems: 'center' }}>
          <Text className="text-[12px] font-bold text-[#ffcc00]">{h}</Text>
        </View>
      ))}
    </View>
  );
}

function TableDataRow({ item, isEven, isLast, onMenu }) {
  const line = summaryLine(item);
  const { line1, line2 } = formatDayCell(item.date);
  const morning = item.morning || 'present';
  const lunch = item.lunch || 'present';
  const evening = item.evening || 'present';

  return (
    <Pressable
      onPress={() => onMenu?.(item, line)}
      className="flex-row items-center px-2 active:opacity-90"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: CARD_BORDER,
        backgroundColor: isEven ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
    >
      <View style={{ flex: 2, paddingVertical: 12, paddingRight: 8 }}>
        <Text className="text-[13px] font-bold uppercase tracking-wide text-white" numberOfLines={1}>
          {line1}
        </Text>
        {line2 ? (
          <Text className="mt-0.5 text-[11px] font-medium leading-4 text-white/45" numberOfLines={2}>
            {line2}
          </Text>
        ) : null}
      </View>
      <TableSlotCell status={morning} />
      <TableSlotCell status={lunch} />
      <TableSlotCell status={evening} />
    </Pressable>
  );
}

function AttendanceTable({ days, onRowPress }) {
  if (!days.length) return null;
  return (
    <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor: CARD_BORDER, backgroundColor: CARD }}>
      <TableHeaderRow />
      {days.map((item, index) => (
        <TableDataRow
          key={`${item.date}-${index}`}
          item={item}
          isEven={index % 2 === 1}
          isLast={index === days.length - 1}
          onMenu={onRowPress}
        />
      ))}
    </View>
  );
}

function TableLoadingSkeleton() {
  return (
    <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor: CARD_BORDER, backgroundColor: CARD }}>
      <TableHeaderRow />
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={i}
          className="flex-row items-center px-2 py-2"
          style={{
            borderBottomWidth: i === 7 ? 0 : 1,
            borderBottomColor: CARD_BORDER,
            backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}
        >
          <View style={{ flex: 2, paddingVertical: 8, paddingRight: 8 }}>
            <Skeleton width="45%" height={10} borderRadius={4} isDark />
            <View className="h-1.5" />
            <Skeleton width="70%" height={10} borderRadius={4} isDark />
          </View>
          {[0, 1, 2].map((j) => (
            <View key={j} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
              <Skeleton width={34} height={34} borderRadius={17} isDark />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function computeAttendanceStats(days) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let total = 0;
  for (const d of days) {
    for (const slot of ['morning', 'lunch', 'evening']) {
      const s = d?.[slot] || 'present';
      total += 1;
      if (s === 'present') present += 1;
      else if (s === 'late') late += 1;
      else if (s === 'absent') absent += 1;
    }
  }
  const rate = total > 0 ? Math.round((100 * present) / total) : 0;
  return { rate, lates: late, absences: absent, present, total };
}

function StatCard({ label, value, valueColor }) {
  return (
    <View
      className="flex-1 overflow-hidden rounded-2xl"
      style={[cardShadow, { backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER }]}
    >
      <View className="px-1 pb-4 pt-4">
        <Text className="text-center text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: STAT_LABEL }}>
          {label}
        </Text>
        <Text className={`mt-2 text-center text-[28px] font-bold tracking-tight ${valueColor}`}>{value}</Text>
      </View>
    </View>
  );
}

function ScreenCanvas({ children }) {
  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} locations={[0, 1]} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}

function parsePositiveId(raw) {
  if (raw == null || raw === '') return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function filterTrainingsForUser(trainings, userId, formationIdFromProfile) {
  if (!Array.isArray(trainings)) return [];
  const uid = userId != null ? Number(userId) : null;
  const fid = formationIdFromProfile != null ? Number(formationIdFromProfile) : null;
  const out = [];
  const seen = new Set();
  for (const t of trainings) {
    const id = t?.id != null ? Number(t.id) : null;
    if (!id || seen.has(id)) continue;
    const users = Array.isArray(t.users) ? t.users : [];
    const inRoster = uid != null && users.some((u) => Number(u?.id) === uid);
    const matchesProfile = fid != null && id === fid;
    if (inRoster || matchesProfile) {
      seen.add(id);
      out.push({ id, name: t.name || `Training ${id}` });
    }
  }
  return out;
}

export default function AttendanceHistoryScreen() {
  const { id } = useLocalSearchParams();
  const paramFormationId = useMemo(() => parsePositiveId(id), [id]);
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const { token, user } = useAppContext();

  const profileFormationId = useMemo(
    () => parsePositiveId(user?.formation_id ?? user?.formationId),
    [user?.formation_id, user?.formationId],
  );

  const [resolvedFormationId, setResolvedFormationId] = useState(null);
  const [trainingOptions, setTrainingOptions] = useState([]);
  const [resolveDone, setResolveDone] = useState(false);

  const [trainingName, setTrainingName] = useState('');
  const [trainingCategory, setTrainingCategory] = useState('');
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const stats = useMemo(() => computeAttendanceStats(days), [days]);

  const resolveFormation = useCallback(async () => {
    if (!token) {
      setResolveDone(true);
      setResolvedFormationId(null);
      setTrainingOptions([]);
      return;
    }

    if (paramFormationId) {
      setResolvedFormationId(paramFormationId);
      setTrainingOptions([]);
      setResolveDone(true);
      return;
    }

    if (profileFormationId) {
      setResolvedFormationId(profileFormationId);
      setTrainingOptions([]);
      setResolveDone(true);
      return;
    }

    try {
      const res = await API.getWithAuth('mobile/trainings', token);
      const list = res?.data?.trainings ?? [];
      const uid = user?.id;
      const opts = filterTrainingsForUser(list, uid, profileFormationId);
      setTrainingOptions(opts);
      if (opts.length === 1) {
        setResolvedFormationId(opts[0].id);
      } else {
        setResolvedFormationId(null);
      }
    } catch (e) {
      console.error('[ATTENDANCE_HISTORY] resolve', e);
      setTrainingOptions([]);
      setResolvedFormationId(null);
    } finally {
      setResolveDone(true);
    }
  }, [token, paramFormationId, profileFormationId, user?.id]);

  useEffect(() => {
    setResolveDone(false);
    resolveFormation();
  }, [resolveFormation]);

  const load = useCallback(async () => {
    if (!token || !resolvedFormationId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await API.getWithAuth(`mobile/trainings/${resolvedFormationId}/attendance-history`, token);
      const t = res?.data?.training ?? {};
      setTrainingName(t.name ?? '');
      setTrainingCategory(t.category ?? '');
      setDays(Array.isArray(res?.data?.days) ? res.data.days : []);
    } catch (e) {
      console.error('[ATTENDANCE_HISTORY]', e);
      setError('Could not load attendance history.');
      setDays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, resolvedFormationId]);

  useEffect(() => {
    if (!resolveDone) return;
    load();
  }, [resolveDone, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onDayMenu = useCallback((item, line) => {
    Alert.alert(formatDayHeader(item.date), line, [{ text: 'OK' }]);
  }, []);

  const listHeader = (
    <View className="border-b border-white/10 pb-2 pt-1">
      {error ? (
        <View className="mx-4 mb-3 rounded-2xl border border-rose-500/25 bg-rose-950/35 px-4 py-3">
          <Text className="text-center text-xs text-rose-200/95">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-3 px-4 pb-1 pt-2">
        <StatCard label="RATE" value={`${stats.rate}%`} valueColor="text-[#ffcc00]" />
        <StatCard label="LATES" value={String(stats.lates)} valueColor="text-[#ffcc00]" />
        <StatCard label="ABSENCES" value={String(stats.absences)} valueColor="text-[#fb7185]" />
      </View>

      <View className="px-4 pb-4 pt-3">
        <Text className="text-[13px] font-semibold leading-5" style={{ color: ACCENT }} numberOfLines={4}>
          {trainingName ? `Current course: ${trainingName}` : 'Current course'}
        </Text>
        {trainingCategory ? (
          <Text className="mt-2 text-[13px] leading-4 text-white/55" numberOfLines={2}>
            {trainingCategory}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!token) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <ScreenCanvas>
          <StatusBar style="light" />
          <View className="flex-1 items-center justify-center px-6">
            <View className="rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-10">
              <Ionicons name="clipboard-outline" size={36} color="rgba(255,204,0,0.55)" />
              <Text className="mt-4 text-center text-base font-semibold text-white">Sign in to continue</Text>
              <Text className="mt-2 max-w-[260px] text-center text-sm text-white/50">Your attendance ledger syncs to your account.</Text>
              <Pressable
                onPress={() => router.push('/auth/login')}
                className="mt-6 self-center rounded-2xl px-8 py-3.5"
                style={{ backgroundColor: ACCENT }}
              >
                <Text className="text-center text-sm font-bold text-black">Go to login</Text>
              </Pressable>
            </View>
          </View>
        </ScreenCanvas>
      </AppLayout>
    );
  }

  if (resolveDone && !paramFormationId && !profileFormationId && trainingOptions.length === 0) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <ScreenCanvas>
          <StatusBar style="light" />
          <View className="flex-1 items-center justify-center px-6">
            <View className="rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-10">
              <Ionicons name="school-outline" size={40} color="rgba(255,255,255,0.35)" />
              <Text className="mt-4 text-center text-base font-semibold text-white">No program linked</Text>
              <Text className="mt-2 max-w-[280px] text-center text-sm text-white/50">
                Once you are assigned to a cohort, your ledger will appear here.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/training')}
                className="mt-6 self-center rounded-2xl border border-amber-400/35 px-6 py-3.5"
              >
                <Text className="text-sm font-bold text-[#ffcc00]">Open training</Text>
              </Pressable>
            </View>
          </View>
        </ScreenCanvas>
      </AppLayout>
    );
  }

  if (resolveDone && trainingOptions.length > 1 && resolvedFormationId == null) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <ScreenCanvas>
          <StatusBar style="light" />
          <View className="flex-1 px-4 pt-2">
            <Text className="px-1 text-[13px] leading-5 text-white/55">Choose a program to open its ledger.</Text>
            <View className="mt-4 gap-3">
              {trainingOptions.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setResolvedFormationId(t.id)}
                  className="flex-row items-center justify-between overflow-hidden rounded-2xl px-5 py-4 active:opacity-90"
                  style={[{ backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER }, cardShadow]}
                >
                  <Text className="flex-1 pr-3 text-[16px] font-semibold text-white" numberOfLines={2}>
                    {t.name}
                  </Text>
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-white/8">
                    <Ionicons name="chevron-forward" size={18} color={ACCENT} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScreenCanvas>
      </AppLayout>
    );
  }

  if (!resolveDone || resolvedFormationId == null) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <ScreenCanvas>
          <StatusBar style="light" />
          <View className="flex-1 px-4 pt-4">
            <Skeleton width="55%" height={12} borderRadius={6} isDark />
            <View className="h-4" />
            <Skeleton width="85%" height={28} borderRadius={10} isDark />
            <View className="h-8" />
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className="mb-4 overflow-hidden rounded-2xl p-5" style={[{ backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER }, cardShadow]}>
                <Skeleton width={48} height={10} borderRadius={4} isDark />
                <View className="h-2" />
                <Skeleton width="70%" height={18} borderRadius={8} isDark />
                <View className="h-5" />
                <Skeleton width="100%" height={56} borderRadius={14} isDark />
              </View>
            ))}
          </View>
        </ScreenCanvas>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false} className="flex-1">
      <ScreenCanvas>
        <StatusBar style="light" />
        <ScrollView
          className="flex-1 bg-transparent"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />}
          contentContainerStyle={{
            paddingTop: 0,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
        >
          {listHeader}
          {loading ? (
            <View className="pt-2">
              <TableLoadingSkeleton />
            </View>
          ) : null}
          {!loading && days.length > 0 ? (
            <View className="pt-2">
              <AttendanceTable days={days} onRowPress={onDayMenu} />
            </View>
          ) : null}
          {!loading && days.length === 0 ? (
            <View className="mx-4 mt-2 items-center rounded-2xl border border-dashed py-16 px-6" style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(28,27,23,0.5)' }}>
              <View className="rounded-full border border-white/10 bg-white/[0.04] p-4">
                <Ionicons name="layers-outline" size={32} color={ACCENT} />
              </View>
              <Text className="mt-5 text-center text-[16px] font-semibold text-white">No attendance yet</Text>
              <Text className="mt-2 max-w-[280px] text-center text-sm leading-5 text-white/50">
                Saved attendance will appear here as soon as your coach records a day.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </ScreenCanvas>
    </AppLayout>
  );
}
