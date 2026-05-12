import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, Image } from 'react-native';
import { Calendar } from 'react-native-calendars';
import * as CalendarAPI from 'expo-calendar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';


// Memoized Place Grid Card Component
const PlaceGridCard = memo(({ place, onPress, isDark }) => {
  const getImageUrl = () => {
    if (place.image) {
      if (place.image.startsWith('http')) return place.image;
      return `${API.APP_URL || ''}/storage/${place.image}`;
    }
    return null;
  };

  // Generate mini description if not provided
  const getDescription = () => {
    if (place.description) return place.description;
    // Generate based on place name or type
    if (place.name?.toLowerCase().includes('studio')) {
      return 'Professional recording space';
    }
    if (place.name?.toLowerCase().includes('cowork')) {
      return 'Collaborative workspace';
    }
    if (place.name?.toLowerCase().includes('meeting')) {
      return 'Private meeting room';
    }
    return 'Available space for booking';
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.placeGridCard(isDark),
        pressed && styles.placeGridCardPressed,
      ]}
    >
      {/* Image Section */}
      <View style={styles.placeGridImageContainer}>
        {getImageUrl() ? (
          <Image
            source={{ uri: getImageUrl() }}
            style={styles.placeGridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeGridImagePlaceholder}>
            <Ionicons name="business-outline" size={40} color={Colors.alpha} />
          </View>
        )}
        {/* Overlay gradient */}
        <View style={styles.placeGridOverlay} />
      </View>

      {/* Content Section */}
      <View style={styles.placeGridContent}>
        <Text style={styles.placeGridName(isDark)} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.placeGridDescription(isDark)} numberOfLines={2}>
          {getDescription()}
        </Text>
        <View style={styles.placeGridFooter}>
          <View style={styles.placeGridBadge(isDark)}>
            <Ionicons name="calendar-outline" size={14} color={Colors.alpha} />
            <Text style={styles.placeGridBadgeText(isDark)}>View Calendar</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

PlaceGridCard.displayName = 'PlaceGridCard';


export default function Reservations() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [reservations, setReservations] = useState([]);
  const [reservationsCowork, setReservationsCowork] = useState([]);
  const [allPlaces, setAllPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDatesStudios, setMarkedDatesStudios] = useState({});
  const [markedDatesCowork, setMarkedDatesCowork] = useState({});
  const router = useRouter();

  // Memoized helper functions
  const toDateOnly = useCallback((iso) => (iso ? iso.split('T')[0] : ''), []);
  const toDateOnlyFromSpace = useCallback((datetime) => {
    if (!datetime) return '';
    const parts = String(datetime).split(' ');
    return parts[0] || '';
  }, []);

  const getReservationDate = useCallback((r) => {
    if (r?.day) {
      if (typeof r.day === 'string' && r.day.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.day;
      }
      try {
        const dayDate = new Date(r.day);
        if (!isNaN(dayDate.getTime())) {
          return dayDate.toISOString().split('T')[0];
        }
      } catch (e) {}
    }
    if (r?.date) {
      if (typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.date;
      }
      try {
        const dateDate = new Date(r.date);
        if (!isNaN(dateDate.getTime())) {
          return dateDate.toISOString().split('T')[0];
        }
      } catch (e) {}
    }
    return toDateOnlyFromSpace(r?.created_at);
  }, [toDateOnlyFromSpace]);

  // Memoized marked dates calculation
  const calculateMarkedDates = useCallback((data) => {
    const marked = {};
    data.forEach((r) => {
      const date = getReservationDate(r);
      if (date) {
        const color = r.canceled ? Colors.dark_gray : Colors.alpha;
        const current = marked[date];
        if (!current) {
          marked[date] = { marked: true, dotColor: color };
        } else if (current.dotColor !== Colors.alpha && color === Colors.alpha) {
          marked[date] = { marked: true, dotColor: color };
        }
      }
    });
    return marked;
  }, [getReservationDate]);

  // Fetch reservations with error handling
  const fetchReservations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await API.getWithAuth('mobile/reservations', token);
      if (response?.data) {
        const data = response.data.reservations || [];
        setReservations(data);
        setMarkedDatesStudios(calculateMarkedDates(data));
      }
    } catch (error) {
      console.error('[RESERVATIONS] Studios Error:', error);
    }
  }, [token, calculateMarkedDates]);

  const fetchReservationsCowork = useCallback(async () => {
    if (!token) return;
    try {
      const response = await API.getWithAuth('mobile/reservationsCowork', token);
      if (response?.data) {
        const data = response.data.reservations || [];
        setReservationsCowork(data);
        setMarkedDatesCowork(calculateMarkedDates(data));
      }
    } catch (error) {
      console.error('[RESERVATIONS] Cowork Error:', error);
    }
  }, [token, calculateMarkedDates]);

  // Fetch all places (studios, coworks, meeting rooms)
  const fetchPlaces = useCallback(async () => {
    if (!token) return;
    setLoadingPlaces(true);
    try {
      const response = await API.getWithAuth('places', token);
      if (response?.data) {
        const studios = (response.data?.studios || []).map(s => ({ ...s, type: 'studio' }));
        const coworks = response.data?.coworks || [];
        const meetingRooms = (response.data?.meeting_rooms || response.data?.meetingRooms || []).map(m => ({ ...m, type: 'meeting' }));
        
        // Create a single "Cowork" card if there are any cowork spaces
        const coworkCard = coworks.length > 0 ? [{
          id: 'cowork-all',
          name: 'Cowork',
          description: 'Collaborative workspace with multiple tables',
          type: 'cowork',
          image: coworks[0]?.image || null, // Use first cowork image if available
          allCoworks: coworks, // Store all coworks for later use
        }] : [];
        
        // Combine all places into one array (studios + 1 cowork card + meeting rooms)
        setAllPlaces([...studios, ...coworkCard, ...meetingRooms]);
      }
    } catch (error) {
      console.error('[RESERVATIONS] Places Error:', error);
    } finally {
      setLoadingPlaces(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([
        fetchReservations(),
        fetchReservationsCowork(),
        fetchPlaces(),
      ]).finally(() => setLoading(false));
    }
  }, [token, fetchReservations, fetchReservationsCowork, fetchPlaces]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchReservations(),
      fetchReservationsCowork(),
      fetchPlaces(),
    ]);
    setRefreshing(false);
  }, [fetchReservations, fetchReservationsCowork, fetchPlaces]);

  const toDateTimeFromDateAndTime = useCallback((dateStr, timeStr) => {
    if (!dateStr) return '';
    if (!timeStr) return `${dateStr} 00:00`;
    const timeStrClean = String(timeStr).trim();
    const timeMatch = timeStrClean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const h = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(timeMatch[2], 10)).padStart(2, '0');
      return `${dateStr} ${h}:${m}`;
    }
    const [h = '00', m = '00'] = timeStrClean.split(':');
    return `${dateStr} ${String(parseInt(h, 10) || 0).padStart(2, '0')}:${String(parseInt(m, 10) || 0).padStart(2, '0')}`;
  }, []);

  // Memoized calendar theme
  const calendarTheme = useMemo(() => ({
    backgroundColor: isDark ? Colors.dark : Colors.light,
    calendarBackground: isDark ? Colors.dark : Colors.light,
    dayTextColor: isDark ? Colors.light : Colors.beta,
    monthTextColor: isDark ? Colors.light : Colors.beta,
    arrowColor: Colors.alpha,
    todayTextColor: Colors.alpha,
    selectedDayBackgroundColor: Colors.alpha,
    selectedDayTextColor: isDark ? Colors.dark : Colors.light,
    textDisabledColor: isDark ? Colors.dark_gray : Colors.dark_gray + '80',
    textDayFontWeight: '600',
    textMonthFontWeight: '700',
    textDayHeaderFontWeight: '700',
    textDayHeaderFontColor: isDark ? Colors.light : Colors.beta,
    textMonthFontSize: 20,
    textDayHeaderFontSize: 13,
    'stylesheet.calendar.header': {
      monthText: {
        fontSize: 20,
        fontWeight: '700',
        color: isDark ? Colors.light : Colors.beta,
        marginTop: 6,
        marginBottom: 10,
      },
      week: {
        marginTop: 7,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 7,
      },
      dayHeader: {
        marginTop: 2,
        marginBottom: 7,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '700',
        color: isDark ? Colors.light : Colors.beta,
      },
    },
    'stylesheet.day.basic': {
      base: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? Colors.dark : 'transparent',
      },
      todayText: {
        color: Colors.alpha,
        fontWeight: '700',
        fontSize: 16,
      },
      selected: {
        backgroundColor: Colors.alpha,
      },
      selectedText: {
        color: isDark ? Colors.dark : Colors.light,
        fontWeight: '700',
        fontSize: 16,
      },
      text: {
        marginTop: 0,
        fontSize: 16,
        fontWeight: '600',
        color: isDark ? Colors.light : Colors.beta,
      },
      disabledText: {
        color: isDark ? Colors.dark_gray : Colors.dark_gray + '80',
        opacity: 0.5,
      },
    },
  }), [isDark]);

  // Memoized marked dates with selection (combined)
  const markedDatesWithSelection = useMemo(() => {
    const combined = { ...markedDatesStudios, ...markedDatesCowork };
    if (selectedDate) {
      combined[selectedDate] = {
        selected: true,
        selectedColor: Colors.alpha,
        selectedTextColor: isDark ? Colors.dark : Colors.light,
        ...(markedDatesStudios[selectedDate] || markedDatesCowork[selectedDate] || {}),
      };
    }
    return combined;
  }, [selectedDate, markedDatesStudios, markedDatesCowork, isDark]);

  // Optimized navigation data
  const navigationData = useMemo(() => {
    return JSON.stringify([...reservations, ...reservationsCowork]);
  }, [reservations, reservationsCowork]);

  // Optimized navigation handler
  const handleDayPress = useCallback((day) => {
    setSelectedDate(day.dateString);
    router.push({
      pathname: '/reservations/day',
      params: {
        date: day.dateString,
        reservations: JSON.stringify(reservations),
        reservationsCowork: JSON.stringify(reservationsCowork),
      },
    });
  }, [reservations, reservationsCowork, router]);

  // Handle place selection - navigate to calendar screen
  const handlePlacePress = useCallback((place) => {
    router.push({
      pathname: '/reservations/place-calendar',
      params: {
        place: JSON.stringify(place),
      },
    });
  }, [router]);


  if (loading && allPlaces.length === 0) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Skeleton width={220} height={28} borderRadius={12} isDark={isDark} />
          <View style={{ height: 10 }} />
          <Skeleton width={280} height={14} borderRadius={10} isDark={isDark} />
          <View style={{ height: 22 }} />

          {Array.from({ length: 3 }).map((_, idx) => (
            <View
              key={idx}
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
              }}
            >
              <Skeleton width="100%" height={120} borderRadius={0} isDark={isDark} />
              <View style={{ padding: 12 }}>
                <Skeleton width={160} height={16} borderRadius={10} isDark={isDark} />
                <View style={{ height: 10 }} />
                <Skeleton width="90%" height={12} borderRadius={10} isDark={isDark} />
                <View style={{ height: 10 }} />
                <Skeleton width={130} height={24} borderRadius={12} isDark={isDark} />
              </View>
            </View>
          ))}
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ScrollView
        className="flex-1 bg-light dark:bg-dark"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.alpha}
            colors={[Colors.alpha]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle(isDark)}>Reservations</Text>
            <Text style={styles.headerSubtitle(isDark)}>
              Book studios, coworks, and meeting rooms
            </Text>
          </View>
        </View>

        {/* Places List */}
        {loadingPlaces ? (
          <View style={styles.loadingContainer}>
            <View style={{ width: '100%', paddingTop: 10 }}>
              {Array.from({ length: 3 }).map((_, idx) => (
                <View
                  key={idx}
                  style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                  }}
                >
                  <Skeleton width="100%" height={120} borderRadius={0} isDark={isDark} />
                  <View style={{ padding: 12 }}>
                    <Skeleton width={160} height={16} borderRadius={10} isDark={isDark} />
                    <View style={{ height: 10 }} />
                    <Skeleton width="90%" height={12} borderRadius={10} isDark={isDark} />
                    <View style={{ height: 10 }} />
                    <Skeleton width={130} height={24} borderRadius={12} isDark={isDark} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* Show Places Grid */
          <>
            {/* <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle(isDark)}>
                Available Spaces
              </Text>
              <Text style={styles.sectionSubtitle(isDark)}>
                Tap on a place to view its calendar
              </Text>
            </View> */}

            {allPlaces.length === 0 ? (
              <View style={styles.emptyContainer(isDark)}>
                <Ionicons name="business-outline" size={48} color={isDark ? Colors.light + '50' : Colors.beta + '50'} />
                <Text style={styles.emptyText(isDark)}>
                  No places available
                </Text>
              </View>
            ) : (
              <View style={styles.placesGrid}>
                {allPlaces.map((place) => (
                  <PlaceGridCard
                    key={`${place.type}-${place.id}`}
                    place={place}
                    onPress={() => handlePlacePress(place)}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Quick Stats */}
        {/* <View style={styles.statsContainer(isDark)}>
          <View style={styles.statCard(isDark)}>
            <Ionicons name="calendar-outline" size={24} color={Colors.alpha} />
            <View style={styles.statContent}>
              <Text style={styles.statValue(isDark)}>
                {reservations.length + reservationsCowork.length}
              </Text>
              <Text style={styles.statLabel(isDark)}>Total Reservations</Text>
            </View>
          </View>
          <View style={styles.statCard(isDark)}>
            <Ionicons name="checkmark-circle-outline" size={24} color={Colors.good} />
            <View style={styles.statContent}>
              <Text style={styles.statValue(isDark)}>
                {[...reservations, ...reservationsCowork].filter(r => r.approved && !r.canceled).length}
              </Text>
              <Text style={styles.statLabel(isDark)}>Approved</Text>
            </View>
          </View>
        </View> */}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: (isDark) => ({
    fontSize: 34,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    letterSpacing: -0.8,
    marginBottom: 4,
  }),
  headerSubtitle: (isDark) => ({
    fontSize: 15,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
  }),
  addButton: (isDark) => ({
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.alpha,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.alpha,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  }),
  addButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  calendarCard: (isDark) => ({
    backgroundColor: isDark ? Colors.dark : Colors.light,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
  }),
  calendar: {
    borderRadius: 12,
  },
  statsContainer: (isDark) => ({
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  }),
  statCard: (isDark) => ({
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  }),
  statContent: {
    marginLeft: 12,
    flex: 1,
  },
  statValue: (isDark) => ({
    fontSize: 24,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    marginBottom: 2,
  }),
  statLabel: (isDark) => ({
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: (isDark) => ({
    fontSize: 22,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    marginBottom: 4,
  }),
  sectionSubtitle: (isDark) => ({
    fontSize: 14,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
  }),
  placesGrid: {
    flexDirection: 'column',
    marginTop: 8,
    width: '100%',
  },
  placeGridCard: (isDark) => ({
    width: '100%',
    height: 220,
    backgroundColor: isDark ? Colors.dark : Colors.light,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
  }),
  placeGridCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  placeGridImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  placeGridImage: {
    width: '100%',
    height: '100%',
  },
  placeGridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.alpha + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeGridContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  placeGridName: (isDark) => ({
    fontSize: 16,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    marginBottom: 6,
  }),
  placeGridDescription: (isDark) => ({
    fontSize: 12,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    lineHeight: 16,
    marginBottom: 10,
  }),
  placeGridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeGridBadge: (isDark) => ({
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? Colors.dark_gray : Colors.alpha + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  }),
  placeGridBadgeText: (isDark) => ({
    fontSize: 11,
    fontWeight: '700',
    color: Colors.alpha,
  }),
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: (isDark) => ({
    marginTop: 12,
    fontSize: 14,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
  }),
  emptyContainer: (isDark) => ({
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
  }),
  emptyText: (isDark) => ({
    marginTop: 16,
    fontSize: 16,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
  }),
});
