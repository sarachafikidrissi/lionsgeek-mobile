import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, Modal } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import { Colors } from '@/constants/Colors';
import { format, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfWeek, endOfWeek, addDays } from 'date-fns';
import NewReservation from './reserve';
import NewCoworkReservation from './reserveCowork';
import Skeleton from '@/components/ui/Skeleton';

export default function DayView() {
  const { date, tab, reservations: reservationsParam, reservationsCowork: reservationsCoworkParam, place: placeParam } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { token } = useAppContext();
  const isDark = colorScheme === 'dark';

  // Parse place from params
  const selectedPlace = useMemo(() => {
    if (!placeParam) return null;
    try {
      return typeof placeParam === 'string' ? JSON.parse(placeParam) : placeParam;
    } catch (e) {
      console.error('[DAY VIEW] Error parsing place:', e);
      return null;
    }
  }, [placeParam]);

  // ---- Parse received reservations ----
  const [reservations, setReservations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [day, setDay] = useState(
    typeof date === 'string' && date.length >= 10
      ? date
      : new Date().toISOString().split('T')[0]
  );

  // ---- Date helpers - Use exact reservation date and time ----
  const toDateOnlyFromSpace = (datetime) => {
    if (!datetime) return '';
    const parts = String(datetime).split(' ');
    return parts[0] || '';
  };
  
  // Get exact reservation date - prioritize day field (actual reservation date)
  const getReservationDate = (r) => {
    // First try the actual reservation day field
    if (r?.day) {
      // If day is already in YYYY-MM-DD format, return it
      if (typeof r.day === 'string' && r.day.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.day;
      }
      // If day is a date string, extract YYYY-MM-DD
      const dayDate = new Date(r.day);
      if (!isNaN(dayDate.getTime())) {
        return format(dayDate, 'yyyy-MM-dd');
      }
    }
    // Fallback to date field
    if (r?.date) {
      if (typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.date;
      }
      const dateDate = new Date(r.date);
      if (!isNaN(dateDate.getTime())) {
        return format(dateDate, 'yyyy-MM-dd');
      }
    }
    // Last resort: use created_at (but this should be avoided)
    return toDateOnlyFromSpace(r?.created_at);
  };

  // ---- UI states ----
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(day));
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState(null);
  const [pressY, setPressY] = useState(null);

  // Update day when date param changes
  useEffect(() => {
    if (date && typeof date === 'string' && date.length >= 10) {
      setDay(date);
      setCurrentMonthDate(new Date(date));
    }
  }, [date]);

  // Optimized parsing - parse reservations from params
  useEffect(() => {
    setIsLoading(true);
    try {
      let parsed = null;
      if (reservationsParam) {
        parsed = typeof reservationsParam === 'string' ? JSON.parse(reservationsParam) : reservationsParam;
      } else if (reservationsCoworkParam) {
        parsed = typeof reservationsCoworkParam === 'string' ? JSON.parse(reservationsCoworkParam) : reservationsCoworkParam;
      }
      if (parsed) {
        setReservations(Array.isArray(parsed) ? parsed : []);
      }
      // Small delay to show loading state
      setTimeout(() => setIsLoading(false), 300);
    } catch (e) {
      console.warn('Error parsing reservations param', e);
      setReservations([]);
      setIsLoading(false);
    }
  }, [reservationsParam, reservationsCoworkParam]);

  // ---- Helpers - Exact time parsing ----
  const toDateTimeFromDateAndTime = (dateStr, timeStr) => {
    if (!dateStr) return '';
    // Parse time exactly as provided, ensuring proper format
    if (!timeStr) return `${dateStr} 00:00`;
    
    const timeStrClean = String(timeStr).trim();
    // Handle various time formats: "HH:MM", "HH:MM:SS", etc.
    const timeMatch = timeStrClean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const h = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(timeMatch[2], 10)).padStart(2, '0');
      return `${dateStr} ${h}:${m}`;
    }
    // Fallback to original logic
    const [h = '00', m = '00'] = timeStrClean.split(':');
    return `${dateStr} ${String(parseInt(h, 10) || 0).padStart(2, '0')}:${String(parseInt(m, 10) || 0).padStart(2, '0')}`;
  };

  // ---- Events ----
  const events = useMemo(() => {
    return reservations
      .filter((r) => getReservationDate(r) === day)
      .map((r) => ({
        id: r.id,
        start: toDateTimeFromDateAndTime(day, r.start),
        end: toDateTimeFromDateAndTime(day, r.end || r.start),
        title: r.title || 'Reservation',
        summary: r.location || '',
        type: r.type,
        color: r.canceled ? Colors.dark_gray : Colors.alpha,
        rawStart: r.start,
        rawEnd: r.end || r.start,
        canceled: !!r.canceled,
      }));
  }, [reservations, day, isDark]);

  // ---- Layout Constants ----
  const HOUR_HEIGHT = 80;
  const START_MINUTES = 7 * 60 + 30; // Start from 7:30 AM
  const END_MINUTES = 17 * 60 + 30; // End at 18:30 (6:30 PM)
  const TOTAL_HEIGHT = ((END_MINUTES - START_MINUTES) * HOUR_HEIGHT) / 60;

  // Parse time exactly - ensure precise time matching
  const parseHm = (hm) => {
    if (!hm) return START_MINUTES;
    const timeStr = String(hm).trim();
    // Handle exact time format: "HH:MM" or "H:MM"
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10) || 0;
      const m = parseInt(timeMatch[2], 10) || 0;
      return h * 60 + m;
    }
    // Fallback
    const [h = '0', m = '0'] = timeStr.split(':');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const toY = useCallback((minutes) => ((minutes - START_MINUTES) * HOUR_HEIGHT) / 60, []);

  // Position events and detect overlaps for side-by-side display
  const positioned = useMemo(() => {
    return events.map((e) => {
      const s = clamp(parseHm(e.rawStart), START_MINUTES, END_MINUTES);
      const en = clamp(parseHm(e.rawEnd), START_MINUTES, END_MINUTES);
      const top = toY(s);
      const height = Math.max(36, toY(en) - toY(s));
      return { ...e, top, height, startMin: s, endMin: en };
    });
  }, [events]);

  const timelineScrollRef = useRef(null);
  const dateSelectorScrollRef = useRef(null);

  // Auto-scroll date selector to show selected day
  useEffect(() => {
    if (dateSelectorScrollRef.current && day && daysInMonth.length > 0) {
      const selectedDate = new Date(day);
      const selectedDayNum = selectedDate.getDate();
      
      // Find the index of the selected day in the current month
      const dayIndex = daysInMonth.findIndex(d => d.getDate() === selectedDayNum);
      
      if (dayIndex >= 0) {
        const dayWidth = 40; // width of each day button
        const gap = 8; // gap between days
        const scrollPosition = Math.max(0, (dayIndex * (dayWidth + gap)) - 150); // Offset to center the day
        
        setTimeout(() => {
          dateSelectorScrollRef.current?.scrollTo({ 
            x: scrollPosition, 
            animated: true 
          });
        }, 150);
      }
    }
  }, [day, daysInMonth]);

  // Auto-scroll to show all reservations (from earliest to latest)
  useEffect(() => {
    if (positioned.length > 0 && timelineScrollRef.current) {
      const earliestStart = Math.min(...positioned.map(e => e.startMin));

      // Calculate scroll position to show all reservations
      const startY = Math.max(0, toY(earliestStart) - 100); // Offset by 100px to show context above

      // Scroll to show the earliest reservation
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ y: startY, animated: true });
      }, 200);
    } else if (timelineScrollRef.current) {
      // Default to 7:30 if no reservations
      const defaultY = toY(7 * 60 + 30);
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ y: defaultY, animated: true });
      }, 200);
    }
  }, [positioned, toY, day]);

  // ---- Fetch reservations from API ----
  const fetchReservations = useCallback(async () => {
    if (!token) return;
    try {
      if (tab === 'cowork') {
        const response = await API.getWithAuth('mobile/reservationsCowork', token);
        if (response?.data) {
          const data = response.data.reservations || [];
          setReservations(Array.isArray(data) ? data : []);
        }
      } else {
        const response = await API.getWithAuth('mobile/reservations', token);
        if (response?.data) {
          const data = response.data.reservations || [];
          setReservations(Array.isArray(data) ? data : []);
        }
      }
    } catch (error) {
      console.error('[DAY VIEW] Fetch Error:', error);
      // Keep existing reservations on error
    }
  }, [token, tab]);

  // ---- Refresh ----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReservations();
    setRefreshing(false);
  }, [fetchReservations]);

  // ---- Calendar Header ----
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonthDate);
    const end = endOfMonth(currentMonthDate);
    return eachDayOfInterval({ start, end });
  }, [currentMonthDate]);

  // Get current week days
  const currentWeekDays = useMemo(() => {
    const selectedDayDate = new Date(day);
    const weekStart = startOfWeek(selectedDayDate, { weekStartsOn: 1 }); // Monday as start
    const weekEnd = endOfWeek(selectedDayDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [day]);

  const goToPrevMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, -1));
  const goToNextMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, 1));
  const currentMonth = format(currentMonthDate, 'LLLL yyyy');
  const selectedDate = new Date(day);

  // Optimized navigation data
  const navigationData = useMemo(() => JSON.stringify(reservations), [reservations]);

  // ---- Navigation handler (optimized) ----
  const goToDayView = useCallback((dayObj) => {
    if (tab === 'studios') {
      router.push({
        pathname: '/reservations/day',
        params: { date: dayObj.dateString, tab, reservations: navigationData },
      });
    } else {
      router.push({
        pathname: '/reservations/day',
        params: { date: dayObj.dateString, tab, reservationsCowork: navigationData },
      });
    }
  }, [tab, navigationData, router]);

  // Show loading state while parsing reservations
  if (isLoading) {
    return (
      <AppLayout>
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: isDark ? Colors.dark : Colors.light,
        }}>
          <Skeleton width={26} height={26} borderRadius={13} isDark={false} />
          <View style={{ height: 14 }} />
          <Skeleton width={220} height={14} borderRadius={12} isDark={isDark} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ===== Month Navigation Bar ===== */}
      <View style={{ 
        paddingHorizontal: 20, 
        paddingVertical: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
        backgroundColor: isDark ? Colors.dark_gray : Colors.light,
        shadowColor: Colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}>
        <View className="flex-row items-center justify-between">
          {/* <Pressable
            onPress={goToPrevMonth}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? Colors.light : Colors.beta }}>‹</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? Colors.light : Colors.beta }}>
              {format(addMonths(currentMonthDate, -1), 'LLLL')}
            </Text>
          </Pressable> */}

          {/* Current Month Display with Add Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => {
                // Reset to current month
                setCurrentMonthDate(new Date());
              }}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: isDark ? Colors.dark : Colors.light,
                borderWidth: 1,
                borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                shadowColor: Colors.dark,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Text style={{ 
                fontSize: 17, 
                fontWeight: '700', 
                color: isDark ? Colors.light : Colors.beta,
                letterSpacing: 0.3,
              }}>
                {format(currentMonthDate, 'LLLL yyyy')}
              </Text>
            </Pressable>


          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {/* <Pressable
              onPress={goToNextMonth}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? Colors.light : Colors.beta }}>
                {format(addMonths(currentMonthDate, 1), 'LLLL')}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? Colors.light : Colors.beta }}>›</Text>
            </Pressable> */}

            <Pressable
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: isDark ? Colors.dark : Colors.light,
                borderWidth: 1,
                borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                shadowColor: Colors.dark,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 18, color: isDark ? Colors.light : Colors.beta }}>🔍</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowNewReservation(true)}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: Colors.alpha,
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
                elevation: 5,
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.dark }}>＋</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ===== Date Selector ===== */}
      <View style={{ 
        paddingHorizontal: 20, 
        paddingTop: 20, 
        paddingBottom: 16,
        backgroundColor: isDark ? Colors.dark : Colors.light,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
      }}>
        {/* Weekday Labels */}
        <View className="flex-row justify-between" style={{ marginBottom: 8, paddingHorizontal: 4 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '600',
                color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
              }}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* Scrollable Days - Show current month days */}
        <ScrollView
          ref={dateSelectorScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          {daysInMonth.map((dateObj) => {
            const num = dateObj.getDate();
            const dateString = format(dateObj, 'yyyy-MM-dd');
            const isSelected = dateString === day;
            const isToday = dateString === format(new Date(), 'yyyy-MM-dd');
            const hasReservations = reservations.some(r => getReservationDate(r) === dateString);

            return (
              <Pressable
                key={dateString}
                onPress={() => {
                  setDay(dateString);
                  setCurrentMonthDate(new Date(dateString));
                  if (tab) {
                    goToDayView({ dateString });
                  }
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? Colors.alpha : 'transparent',
                  borderWidth: isToday && !isSelected ? 2 : 0,
                  borderColor: Colors.alpha,
                  shadowColor: isSelected ? Colors.alpha : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isSelected ? 0.25 : 0,
                  shadowRadius: 4,
                  elevation: isSelected ? 3 : 0,
                }}
              >
                <Text style={{
                  fontWeight: isSelected ? '800' : (isToday ? '700' : '600'),
                  fontSize: 15,
                  color: isSelected ? Colors.dark : (isDark ? Colors.light : Colors.beta)
                }}>
                  {num}
                </Text>
                {hasReservations && !isSelected && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 5,
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: Colors.alpha,
                      shadowColor: Colors.alpha,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.5,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Full Date Display */}
        {/* <View style={{ marginTop: 16, marginBottom: 12 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '600',
            color: isDark ? '#fafafa' : '#212529',
            marginBottom: 4
          }}>
            {format(new Date(day), 'EEE - d MMM yyyy')}
          </Text>
        </View> */}
      </View>

      {/* ===== Timeline Scroll ===== */}
      <View className="flex-1" style={{ backgroundColor: isDark ? Colors.dark : Colors.light }}>
        <ScrollView
          ref={timelineScrollRef}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.alpha} />}
          showsVerticalScrollIndicator
          contentContainerStyle={{
            // paddingBottom: 5, // Increased padding to ensure all reservations are accessible
            minHeight: TOTAL_HEIGHT + 100, // Increased minHeight to ensure full scrollability
          }}
        >
          <View style={{ height: TOTAL_HEIGHT, flexDirection: 'row', minHeight: TOTAL_HEIGHT }}>
            {/* Hour Labels - From 7:30 to 18:30 */}
            <View style={{ width: 60, paddingRight: 8, paddingLeft: 8 }}>
              {Array.from({ length: Math.ceil(END_MINUTES / 60) - Math.floor(START_MINUTES / 60) + 1 }).map((_, idx) => {
                const hr = Math.floor(START_MINUTES / 60) + idx;
                const top = toY(hr * 60);
                return (
                  <View key={hr} style={{ position: 'absolute', top: top - 10, height: 20, width: '100%', alignItems: 'flex-end' }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC'
                    }}>
                      {String(hr).padStart(2, '0')}:00
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Events */}
            <View style={{ flex: 1, position: 'relative' }}>
              {pressY !== null && (
                <View
                  style={{
                    position: 'absolute',
                    top: pressY - 15,
                    left: 0,
                    right: 0,
                    height: 30,
                    backgroundColor: Colors.alpha + '4D',
                    borderRadius: 4,
                    zIndex: 3,
                  }}
                />
              )}

              <Pressable
                onLongPress={(event) => {
                  const y = event.nativeEvent.locationY;
                  setPressY(y);

                  const totalMinutes = START_MINUTES + (y / TOTAL_HEIGHT) * (END_MINUTES - START_MINUTES);
                  const roundedMinutes = Math.round(totalMinutes / 30) * 30;

                  const startHour = Math.floor(roundedMinutes / 60);
                  const startMin = roundedMinutes % 60;
                  const endMinutes = roundedMinutes + 30;
                  const endHour = Math.floor(endMinutes / 60);
                  const endMin = endMinutes % 60;

                  const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
                  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

                  setSelectedTimeRange({ start: startTime, end: endTime });
                  setTimeout(() => setPressY(null), 2000);
                  setTimeout(() => setShowNewReservation(true), 500);
                }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOTAL_HEIGHT, zIndex: 1 }}
              />

              {/* Hour lines - From 7:30 to 18:30 */}
              {Array.from({ length: Math.ceil(END_MINUTES / 60) - Math.floor(START_MINUTES / 60) + 1 }).map((_, idx) => {
                const hr = Math.floor(START_MINUTES / 60) + idx;
                const top = toY(hr * 60);
                return (
                  <View key={hr} style={{ 
                    position: 'absolute', 
                    top, 
                    left: 52, 
                    right: 0, 
                    height: 1, 
                    backgroundColor: isDark ? Colors.dark_gray : Colors.dark_gray + '40'
                  }} />
                );
              })}

              {positioned.map((e, i) => {
                // Event color - orange-brown like the reference
                const eventColor = e.canceled ? Colors.dark_gray : Colors.alpha;

                // Display all events as lines - they can overlap
                return (
                  <Pressable
                    key={e.id || i}
                    onPress={() => e.id && router.push({ pathname: '/reservations/[id]', params: { id: e.id } })}
                    style={{
                      position: 'absolute',
                      top: e.top,
                      left: 52,
                      right: 12,
                      height: Math.max(e.height, 36), // Minimum height for better visibility
                      flexDirection: 'row',
                      alignItems: 'center',
                      zIndex: 2,
                    }}
                  >
                    {/* Vertical line on left edge */}
                    <View style={{
                      width: 4,
                      height: '100%',
                      backgroundColor: eventColor,
                      borderRadius: 2,
                    }} />

                    {/* Icon on left edge */}
                    <View style={{
                      marginLeft: 10,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: eventColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'absolute',
                      left: 2,
                      shadowColor: Colors.dark,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3,
                      elevation: 3,
                    }}>
                      <Text style={{ fontSize: 12, color: Colors.light }}>🕐</Text>
                    </View>

                    {/* Event content */}
                    <View style={{
                      flex: 1,
                      marginLeft: 36,
                      paddingVertical: 6,
                      paddingRight: 8,
                    }}>
                    <Text style={{
                      fontWeight: '700',
                      fontSize: 14,
                      color: Colors.light,
                      lineHeight: 20,
                      letterSpacing: 0.2,
                    }} numberOfLines={2}>
                      {e.title}
                    </Text>
                    <Text style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: Colors.light + 'E6',
                      fontWeight: '600',
                      letterSpacing: 0.3,
                    }} numberOfLines={1}>
                      {e.rawStart} - {e.rawEnd}
                    </Text>
                    </View>

                    {/* Background bar */}
                    <View style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: eventColor,
                      opacity: e.canceled ? 0.5 : 0.98,
                      borderRadius: 8,
                      zIndex: -1,
                      shadowColor: Colors.dark,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Modal New Reservation - Show different modal based on tab */}
      {showNewReservation && (
        <Modal visible={showNewReservation} animationType="slide" transparent onRequestClose={() => setShowNewReservation(false)}>
          <View className="flex-1 justify-center" style={{ backgroundColor: isDark ? Colors.dark + 'E6' : Colors.dark + '80', padding: 16 }}>
            <View style={{ 
              flex: 1, 
              maxHeight: '90%', 
              borderRadius: 20, 
              overflow: 'hidden', 
              backgroundColor: isDark ? Colors.dark : Colors.light,
              shadowColor: Colors.dark, 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: 0.3, 
              shadowRadius: 12, 
              elevation: 8 
            }}>
              {tab === 'cowork' ? (
                <NewCoworkReservation 
                  selectedDate={day} 
                  prefillTime={selectedTimeRange} 
                  onClose={() => setShowNewReservation(false)}
                  placeId={selectedPlace?.id === 'cowork-all' ? undefined : selectedPlace?.id}
                />
              ) : (
                <NewReservation 
                  selectedDate={day} 
                  prefillTime={selectedTimeRange} 
                  onClose={() => setShowNewReservation(false)}
                  placeId={selectedPlace?.id}
                />
              )}
            </View>

            <Pressable
              onPress={() => setShowNewReservation(false)}
              style={{ 
                position: 'absolute', 
                top: 50, 
                right: 20, 
                padding: 14, 
                borderRadius: 28, 
                minWidth: 52, 
                minHeight: 52,
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: Colors.alpha,
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 3 }, 
                shadowOpacity: 0.35, 
                shadowRadius: 6, 
                elevation: 6 
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 20, color: Colors.dark }}>✕</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </AppLayout>
  );
}
