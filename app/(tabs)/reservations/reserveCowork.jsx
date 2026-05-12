import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Modal
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppContext } from '@/context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Colors } from '@/constants/Colors';
import { format } from 'date-fns';
import * as CalendarAPI from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';

export default function NewCoworkReservation({ selectedDate: propSelectedDate, prefillTime, onClose }) {
  const { user, token } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const routePlaceId = params.placeId;
  const routeSelectedDate = params.selectedDate || propSelectedDate;

  const [table, setTable] = useState(routePlaceId || '');
  const [seats, setSeats] = useState('');
  const [day, setDay] = useState(routeSelectedDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [createdReservation, setCreatedReservation] = useState(null);

  useEffect(() => {
    if (prefillTime) {
      const toDate = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h);
        d.setMinutes(m);
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d;
      };
      setStartTime(toDate(prefillTime.start));
      setEndTime(toDate(prefillTime.end));
    }
  }, [prefillTime]);

  useEffect(() => {
    if (routeSelectedDate) {
      setDay(routeSelectedDate);
    }
  }, [routeSelectedDate]);

  useEffect(() => {
    if (routePlaceId) {
      setTable(routePlaceId);
    }
  }, [routePlaceId]);

  useEffect(() => {
    if (!token) return;
    setLoadingTables(true);
    API.getWithAuth('places', token)
      .then(res => {
        const placesData = res.data || {};
        const tablesData = placesData.coworks;
        setTables(Array.isArray(tablesData) ? tablesData : []);
      })
      .catch(err => {
        console.error('Tables fetch error', err);
        Alert.alert('Error', 'Failed to load tables. Please try again.');
      })
      .finally(() => setLoadingTables(false));
  }, [token]);

  const validateForm = () => {
    if (!table) {
      Alert.alert('Validation Error', 'Please select a table');
      return false;
    }
    if (!seats || parseInt(seats) < 1) {
      Alert.alert('Validation Error', 'Please enter at least 1 seat');
      return false;
    }
    if (!day) {
      Alert.alert('Validation Error', 'Please select a date');
      return false;
    }
    if (!startTime || !endTime) {
      Alert.alert('Validation Error', 'Please select start and end times');
      return false;
    }
    if (startTime >= endTime) {
      Alert.alert('Validation Error', 'End time must be after start time');
      return false;
    }
    return true;
  };

  const submitReservation = async () => {
    if (!validateForm()) return;
    if (!token) return;

    setSubmitting(true);
    const payload = {
      table: parseInt(table),
      seats: parseInt(seats),
      day: day,
      start: format(startTime, 'HH:mm'),
      end: format(endTime, 'HH:mm'),
    };

    try {
      const response = await API.postWithAuth('cowork/reserve', payload, token);
      const selectedTable = tables.find(t => t.id === parseInt(table));
      setCreatedReservation({
        title: `Cowork Reservation - ${selectedTable?.name || `Table ${table}`}`,
        day: day,
        start: format(startTime, 'HH:mm'),
        end: format(endTime, 'HH:mm'),
        location: selectedTable?.name || `Table ${table}`,
        seats: seats,
        ...(response.data?.reservation || {}),
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error creating cowork reservation:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to create reservation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  const ensureCalendarExists = async () => {
    const { status } = await CalendarAPI.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant calendar access to add events.');
      return null;
    }
    const calendars = await CalendarAPI.getCalendarsAsync(CalendarAPI.EntityTypes.EVENT);
    const modifiable = calendars.filter((cal) => cal.allowsModifications);
    if (modifiable.length === 0) {
      Alert.alert('No Calendar', 'No modifiable calendar found.');
      return null;
    }
    const defaultCalendar = modifiable.find(cal =>
      cal.isPrimary ||
      cal.source?.type === 'local' ||
      cal.source?.title?.toLowerCase().includes('default')
    ) || modifiable[0];
    return defaultCalendar.id;
  };

  const addToDeviceCalendar = async () => {
    if (!createdReservation) return;
    try {
      const calendarId = await ensureCalendarExists();
      if (!calendarId) return;
      const startDateTime = new Date(`${createdReservation.day} ${createdReservation.start}`);
      const endDateTime = new Date(`${createdReservation.day} ${createdReservation.end}`);
      const event = {
        title: createdReservation.title || 'Cowork Reservation',
        startDate: startDateTime,
        endDate: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: createdReservation.location || '',
        notes: `Seats: ${createdReservation.seats || 'N/A'}`,
        alarms: [{ relativeOffset: -15, method: CalendarAPI.AlarmMethod.ALERT }],
      };
      const eventId = await CalendarAPI.createEventAsync(calendarId, event);
      Alert.alert('✅ Added', 'Event added to your calendar successfully!');
    } catch (err) {
      console.error('Add to calendar error:', err);
      Alert.alert('Error', 'Failed to add to calendar.');
    }
  };

  return (
    <View className={`${isDark ? 'bg-dark' : 'bg-light'}`} style={{ flex: 1 }}>
      {/* Modern Header */}
      <View style={{
        backgroundColor: isDark ? Colors.dark_gray : Colors.light,
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? Colors.dark : Colors.dark_gray + '20',
        shadowColor: Colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={handleCancel}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark ? Colors.dark : Colors.light,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
            }}
          >
            <Ionicons name="close" size={22} color={isDark ? Colors.light : Colors.beta} />
          </Pressable>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{
              fontSize: 22,
              fontWeight: '800',
              color: isDark ? Colors.light : Colors.beta,
              letterSpacing: 0.5,
            }}>
              Cowork Reservation
            </Text>
          </View>

          <Pressable
            onPress={submitReservation}
            disabled={submitting || !table || !seats || !day}
            style={{
              minWidth: 80,
              height: 40,
              borderRadius: 20,
              backgroundColor: Colors.alpha,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              opacity: (submitting || !table || !seats || !day) ? 0.5 : 1,
              shadowColor: Colors.alpha,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            {submitting ? (
              <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
            ) : (
              <Text style={{ color: Colors.dark, fontWeight: '700', fontSize: 14 }}>
                Submit
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Form Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 20 }}>
          {/* Table Selection Card */}
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: Colors.alpha + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="grid-outline" size={20} color={Colors.alpha} />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Select Table *
              </Text>
            </View>
            {loadingTables ? (
              <Skeleton width={26} height={26} borderRadius={13} isDark={false} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 4 }}>
                  {tables.length === 0 ? (
                    <View style={{
                      padding: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                    }}>
                      <Ionicons name="alert-circle-outline" size={32} color={Colors.dark_gray + '80'} />
                      <Text style={{
                        fontSize: 14,
                        color: isDark ? Colors.light + '80' : Colors.beta + '80',
                        marginTop: 8,
                      }}>
                        No tables available
                      </Text>
                    </View>
                  ) : (
                    tables.map((tbl) => {
                      const isSelected = table === tbl.id?.toString() || table === tbl.id;
                      return (
                        <Pressable
                          key={tbl.id}
                          onPress={() => setTable(tbl.id?.toString() || tbl.id)}
                          style={{
                            minWidth: 120,
                            paddingHorizontal: 24,
                            paddingVertical: 16,
                            borderRadius: 16,
                            borderWidth: isSelected ? 3 : 1,
                            borderColor: isSelected ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '40'),
                            backgroundColor: isSelected ? (Colors.alpha + '15') : (isDark ? Colors.dark : Colors.light),
                            shadowColor: isSelected ? Colors.alpha : 'transparent',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: isSelected ? 0.3 : 0,
                            shadowRadius: 8,
                            elevation: isSelected ? 6 : 2,
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons
                            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                            size={24}
                            color={isSelected ? Colors.alpha : (isDark ? Colors.light + '60' : Colors.beta + '60')}
                            style={{ marginBottom: 8 }}
                          />
                          <Text style={{
                            color: isSelected ? Colors.alpha : (isDark ? Colors.light : Colors.beta),
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 16,
                          }}>
                            {tbl.name || `Table ${tbl.id}`}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Seats Card */}
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: Colors.alpha + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="people-outline" size={20} color={Colors.alpha} />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Number of Seats *
              </Text>
            </View>
            <TextInput
              value={seats}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9]/g, '');
                setSeats(numericValue);
              }}
              placeholder="Enter number of seats..."
              placeholderTextColor={Colors.dark_gray + '80'}
              keyboardType="number-pad"
              style={{
                backgroundColor: isDark ? Colors.dark : Colors.light,
                borderRadius: 16,
                padding: 18,
                fontSize: 18,
                fontWeight: '600',
                color: isDark ? Colors.light : Colors.beta,
                borderWidth: 2,
                borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                textAlign: 'center',
              }}
            />
          </View>

          {/* Date & Time Card */}
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: Colors.alpha + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="calendar-outline" size={20} color={Colors.alpha} />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Date & Time
              </Text>
            </View>

            {/* Date Picker */}
            <Pressable
              onPress={() => setShowDayPicker(true)}
              style={{
                backgroundColor: isDark ? Colors.dark : Colors.light,
                borderRadius: 16,
                padding: 18,
                borderWidth: 2,
                borderColor: showDayPicker ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '40'),
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: showDayPicker ? Colors.alpha : 'transparent',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: showDayPicker ? 0.2 : 0,
                shadowRadius: 8,
                elevation: showDayPicker ? 4 : 0,
              }}
            >
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                backgroundColor: Colors.alpha + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <Ionicons name="calendar" size={24} color={Colors.alpha} />
              </View>
              <View style={{ flex: 1 }}>
                {day ? (
                  <>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: isDark ? Colors.light : Colors.beta,
                      marginBottom: 4,
                    }}>
                      {format(new Date(day), 'EEEE')}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
                    }}>
                      {format(new Date(day), 'MMMM d, yyyy')}
                    </Text>
                  </>
                ) : (
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: isDark ? Colors.light + '80' : Colors.beta + '80'
                  }}>
                    Select date
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? Colors.light + '60' : Colors.beta + '60'} />
            </Pressable>

            {/* Time Pickers Row */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Start Time */}
              <Pressable
                onPress={() => setShowStartPicker(true)}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? Colors.dark : Colors.light,
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 2,
                  borderColor: showStartPicker ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '40'),
                  alignItems: 'center',
                  shadowColor: showStartPicker ? Colors.alpha : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: showStartPicker ? 0.2 : 0,
                  shadowRadius: 8,
                  elevation: showStartPicker ? 4 : 0,
                }}
              >
                <Ionicons name="time-outline" size={24} color={Colors.alpha} style={{ marginBottom: 8 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isDark ? Colors.light + '80' : Colors.beta + '80',
                  marginBottom: 4,
                }}>
                  Start
                </Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                  letterSpacing: 1,
                }}>
                  {startTime ? format(startTime, 'HH:mm') : '--:--'}
                </Text>
              </Pressable>

              {/* End Time */}
              <Pressable
                onPress={() => setShowEndPicker(true)}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? Colors.dark : Colors.light,
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 2,
                  borderColor: showEndPicker ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '40'),
                  alignItems: 'center',
                  shadowColor: showEndPicker ? Colors.alpha : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: showEndPicker ? 0.2 : 0,
                  shadowRadius: 8,
                  elevation: showEndPicker ? 4 : 0,
                }}
              >
                <Ionicons name="time" size={24} color={Colors.alpha} style={{ marginBottom: 8 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isDark ? Colors.light + '80' : Colors.beta + '80',
                  marginBottom: 4,
                }}>
                  End
                </Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                  letterSpacing: 1,
                }}>
                  {endTime ? format(endTime, 'HH:mm') : '--:--'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderRadius: 24,
            padding: 28,
            width: '100%',
            maxWidth: 400,
            alignItems: 'center',
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 10,
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: Colors.alpha + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="checkmark-circle" size={60} color={Colors.alpha} />
            </View>
            <Text style={{
              fontSize: 24,
              fontWeight: '800',
              color: isDark ? Colors.light : Colors.beta,
              marginBottom: 12,
              textAlign: 'center',
            }}>
              Success!
            </Text>
            <Text style={{
              fontSize: 16,
              color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
              marginBottom: 28,
              textAlign: 'center',
            }}>
              Cowork reservation created successfully
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={addToDeviceCalendar}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: isDark ? Colors.dark : Colors.light,
                  borderWidth: 2,
                  borderColor: Colors.alpha,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: Colors.alpha,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                  📅 Add to Calendar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowModal(false);
                  if (onClose) onClose();
                }}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: Colors.alpha,
                  alignItems: 'center',
                  shadowColor: Colors.alpha,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text style={{
                  color: Colors.dark,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: isDark ? Colors.dark + 'E6' : Colors.dark + '80',
          justifyContent: 'flex-end',
        }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowDayPicker(false)}
          />
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingBottom: 40,
            paddingHorizontal: 24,
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 22,
                fontWeight: '800',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Select Date
              </Text>
              <Pressable
                onPress={() => setShowDayPicker(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? Colors.dark : Colors.dark_gray + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? Colors.light : Colors.beta} />
              </Pressable>
            </View>
            <DateTimePicker
              value={new Date(day || new Date())}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(event, selected) => {
                if (event.type === 'set' && selected) {
                  setDay(format(selected, 'yyyy-MM-dd'));
                }
                if (event.type === 'dismissed') {
                  setShowDayPicker(false);
                }
              }}
              style={{ width: '100%' }}
              textColor={isDark ? Colors.light : Colors.beta}
            />
            <Pressable
              onPress={() => setShowDayPicker(false)}
              style={{
                marginTop: 24,
                paddingVertical: 18,
                borderRadius: 16,
                backgroundColor: Colors.alpha,
                alignItems: 'center',
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text style={{
                color: Colors.dark,
                fontWeight: '700',
                fontSize: 16,
                letterSpacing: 0.5,
              }}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker Modal */}
      <Modal
        visible={showStartPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStartPicker(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: isDark ? Colors.dark + 'E6' : Colors.dark + '80',
          justifyContent: 'flex-end',
        }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowStartPicker(false)}
          />
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingBottom: 40,
            paddingHorizontal: 24,
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 22,
                fontWeight: '800',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Select Start Time
              </Text>
              <Pressable
                onPress={() => setShowStartPicker(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? Colors.dark : Colors.dark_gray + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? Colors.light : Colors.beta} />
              </Pressable>
            </View>
            <DateTimePicker
              value={startTime}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={(event, selected) => {
                if (event.type === 'set' && selected) {
                  setStartTime(selected);
                }
                if (event.type === 'dismissed') {
                  setShowStartPicker(false);
                }
              }}
              style={{ width: '100%' }}
              textColor={isDark ? Colors.light : Colors.beta}
            />
            <Pressable
              onPress={() => setShowStartPicker(false)}
              style={{
                marginTop: 24,
                paddingVertical: 18,
                borderRadius: 16,
                backgroundColor: Colors.alpha,
                alignItems: 'center',
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text style={{
                color: Colors.dark,
                fontWeight: '700',
                fontSize: 16,
                letterSpacing: 0.5,
              }}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        visible={showEndPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEndPicker(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: isDark ? Colors.dark + 'E6' : Colors.dark + '80',
          justifyContent: 'flex-end',
        }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowEndPicker(false)}
          />
          <View style={{
            backgroundColor: isDark ? Colors.dark_gray : Colors.light,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingBottom: 40,
            paddingHorizontal: 24,
            shadowColor: Colors.dark,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 22,
                fontWeight: '800',
                color: isDark ? Colors.light : Colors.beta,
              }}>
                Select End Time
              </Text>
              <Pressable
                onPress={() => setShowEndPicker(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? Colors.dark : Colors.dark_gray + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? Colors.light : Colors.beta} />
              </Pressable>
            </View>
            <DateTimePicker
              value={endTime}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={(event, selected) => {
                if (event.type === 'set' && selected) {
                  setEndTime(selected);
                }
                if (event.type === 'dismissed') {
                  setShowEndPicker(false);
                }
              }}
              style={{ width: '100%' }}
              textColor={isDark ? Colors.light : Colors.beta}
            />
            <Pressable
              onPress={() => setShowEndPicker(false)}
              style={{
                marginTop: 24,
                paddingVertical: 18,
                borderRadius: 16,
                backgroundColor: Colors.alpha,
                alignItems: 'center',
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text style={{
                color: Colors.dark,
                fontWeight: '700',
                fontSize: 16,
                letterSpacing: 0.5,
              }}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
