import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  FlatList
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppContext } from '@/context';
import { Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Colors } from '@/constants/Colors';
import { format } from 'date-fns';
import * as CalendarAPI from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';

export default function NewReservation({ selectedDate: propSelectedDate, prefillTime, onClose, placeId: propPlaceId }) {
  const { user, token } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Get placeId and selectedDate from route params or props (props take priority)
  const routePlaceId = propPlaceId || params.placeId;
  const routeSelectedDate = params.selectedDate || propSelectedDate;
  
  const [step, setStep] = useState(1);
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
      setStudio(String(routePlaceId));
    }
  }, [routePlaceId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [studio, setStudio] = useState('');
  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [day, setDay] = useState(routeSelectedDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (places.length === 0) {
      setLoadingPlaces(true);
      API.getWithAuth('places', token)
        .then(res => setPlaces(res.data?.studios || []))
        .catch(err => console.error('Places fetch error', err))
        .finally(() => setLoadingPlaces(false));
    }
    if (step === 2 && users.length === 0) {
      setLoadingUsers(true);
      API.getWithAuth('users', token)
        .then(res => setUsers(res.data || []))
        .catch(err => console.error('Users fetch error', err))
        .finally(() => setLoadingUsers(false));
    }
    if (step === 3 && equipment.length === 0) {
      setLoadingEquipment(true);
      API.getWithAuth('equipment', token)
        .then(res => setEquipment(res.data || []))
        .catch(err => console.error('Equipment fetch error', err))
        .finally(() => setLoadingEquipment(false));
    }
  }, [step, token]);

  const toggleUser = (id) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleEquipment = (id) =>
    setSelectedEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const submitReservation = async () => {
    if (!token) return;
    if (!name || !name.trim()) {
      Alert.alert('Validation Error', 'Please enter a reservation name');
      return;
    }
    if (!studio) {
      Alert.alert('Validation Error', 'Please select a studio');
      return;
    }
    if (!day) {
      Alert.alert('Validation Error', 'Please select a date');
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert('Validation Error', 'Please select start and end times');
      return;
    }

    const payload = {
      title: name.trim(),
      description: description?.trim() || '',
      studio_id: studio,
      day: day,
      start: startTime.toTimeString().slice(0, 5),
      end: endTime.toTimeString().slice(0, 5),
      user_id: user.id,
      team_members: selectedUsers,
      equipment: selectedEquipment,
    };

    try {
      const response = await API.postWithAuth('reservations/store', payload, token);
      setCreatedReservation({
        title: `Studio Reservation - ${name}`,
        description,
        day: day,
        start: startTime.toTimeString().slice(0, 5),
        end: endTime.toTimeString().slice(0, 5),
        location: places.find(p => p.id === studio)?.name || 'Studio',
        ...(response.data?.reservation || {}),
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      prevStep();
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
        title: createdReservation.title || 'Reservation',
        startDate: startDateTime,
        endDate: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: createdReservation.location || '',
        notes: createdReservation.description || '',
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
      {/* Modern Header with Gradient Effect */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Pressable
            onPress={step > 1 ? prevStep : handleCancel}
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
            <Ionicons name={step > 1 ? "arrow-back" : "close"} size={22} color={isDark ? Colors.light : Colors.beta} />
          </Pressable>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{
              fontSize: 22,
              fontWeight: '800',
              color: isDark ? Colors.light : Colors.beta,
              letterSpacing: 0.5,
            }}>
              New Reservation
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDark ? Colors.light + '80' : Colors.beta + '80',
              marginTop: 4,
            }}>
              Step {step} of 3
            </Text>
          </View>

          <Pressable
            onPress={step === 3 ? submitReservation : nextStep}
            disabled={step === 3 && (!name || !studio || !day)}
            style={{
              minWidth: 80,
              height: 40,
              borderRadius: 20,
              backgroundColor: Colors.alpha,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              opacity: (step === 3 && (!name || !studio || !day)) ? 0.5 : 1,
              shadowColor: Colors.alpha,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text style={{ color: Colors.dark, fontWeight: '700', fontSize: 14 }}>
              {step === 3 ? 'Submit' : 'Next'}
            </Text>
          </Pressable>
        </View>

        {/* Modern Step Indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: step >= n ? 32 : 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: step >= n ? Colors.alpha : (isDark ? Colors.dark : Colors.dark_gray + '40'),
                transition: 'width 0.3s',
              }} />
              {n < 3 && (
                <View style={{
                  width: 24,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: step > n ? Colors.alpha : (isDark ? Colors.dark : Colors.dark_gray + '40'),
                  marginHorizontal: 6,
                }} />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={{ gap: 20 }}>
            {/* Name Card */}
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
                  <Ionicons name="create-outline" size={20} color={Colors.alpha} />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                }}>
                  Reservation Name
                </Text>
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter reservation name..."
                placeholderTextColor={Colors.dark_gray + '80'}
                style={{
                  backgroundColor: isDark ? Colors.dark : Colors.light,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: isDark ? Colors.light : Colors.beta,
                  borderWidth: 1,
                  borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                }}
              />
            </View>

            {/* Description Card */}
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
                  <Ionicons name="document-text-outline" size={20} color={Colors.alpha} />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                }}>
                  Description
                </Text>
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add a description (optional)..."
                placeholderTextColor={Colors.dark_gray + '80'}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: isDark ? Colors.dark : Colors.light,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: isDark ? Colors.light : Colors.beta,
                  borderWidth: 1,
                  borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
                  textAlignVertical: 'top',
                  minHeight: 100,
                }}
              />
            </View>

            {/* Studio Selection Card */}
            {!routePlaceId && (
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
                    <Ionicons name="business-outline" size={20} color={Colors.alpha} />
                  </View>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isDark ? Colors.light : Colors.beta,
                  }}>
                    Select Studio
                  </Text>
                </View>
                {loadingPlaces ? (
                  <Skeleton width={26} height={26} borderRadius={13} isDark={false} />
                ) : (
                  <FlatList
                    data={places}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                      const isSelected = String(studio) === String(item.id);
                      return (
                        <Pressable
                          onPress={() => setStudio(String(item.id))}
                          style={{
                            width: 140,
                            borderRadius: 16,
                            overflow: 'hidden',
                            borderWidth: isSelected ? 3 : 1,
                            borderColor: isSelected ? Colors.alpha : (isDark ? Colors.dark : Colors.dark_gray + '40'),
                            backgroundColor: isDark ? Colors.dark : Colors.light,
                            shadowColor: isSelected ? Colors.alpha : 'transparent',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: isSelected ? 0.3 : 0,
                            shadowRadius: 8,
                            elevation: isSelected ? 6 : 2,
                          }}
                        >
                          {item.image ? (
                            <Image
                              source={{ uri: item.image }}
                              style={{ width: '100%', height: 100, resizeMode: 'cover' }}
                            />
                          ) : (
                            <View style={{
                              width: '100%',
                              height: 100,
                              backgroundColor: Colors.dark_gray + '40',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Ionicons name="business" size={40} color={Colors.alpha} />
                            </View>
                          )}
                          <View style={{ padding: 12 }}>
                            <Text style={{
                              color: isSelected ? Colors.alpha : (isDark ? Colors.light : Colors.beta),
                              fontWeight: isSelected ? '700' : '600',
                              fontSize: 14,
                              textAlign: 'center',
                            }}>
                              {item.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                )}
              </View>
            )}

            {/* Selected Studio Display */}
            {routePlaceId && studio && (
              <View style={{
                backgroundColor: Colors.alpha + '15',
                borderRadius: 20,
                padding: 20,
                borderWidth: 2,
                borderColor: Colors.alpha,
                borderStyle: 'dashed',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: Colors.alpha + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}>
                    <Ionicons name="checkmark-circle" size={28} color={Colors.alpha} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 12,
                      color: Colors.alpha,
                      fontWeight: '600',
                      marginBottom: 4,
                    }}>
                      SELECTED STUDIO
                    </Text>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: isDark ? Colors.light : Colors.beta,
                    }}>
                      {places.find(p => String(p.id) === String(studio))?.name || 'Selected Studio'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

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
        )}

        {step === 2 && (
          <View style={{ gap: 16 }}>
            <View style={{
              backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
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
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                }}>
                  Select Team Members
                </Text>
              </View>
              {loadingUsers && <Skeleton width={26} height={26} borderRadius={13} isDark={false} />}
              {!loadingUsers && users.map((user) => {
                const hasCustomImage = user.image && !user.image.includes('pdp.png');
                const initials = user.name
                  ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  : '?';
                const isSelected = selectedUsers.includes(user.id);

                return (
                  <Pressable
                    key={user.id}
                    onPress={() => toggleUser(user.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      marginBottom: 12,
                      backgroundColor: isDark ? Colors.dark : Colors.light,
                      borderRadius: 16,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '20'),
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {hasCustomImage ? (
                        <Image
                          source={{
                            uri: user.image.startsWith('http')
                              ? user.image
                              : `${API.APP_URL}/${user.image}`,
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: Colors.alpha + '20',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Text style={{
                            color: Colors.alpha,
                            fontWeight: '700',
                            fontSize: 18,
                          }}>
                            {initials}
                          </Text>
                        </View>
                      )}
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isDark ? Colors.light : Colors.beta,
                      }}>
                        {user.name || user.username}
                      </Text>
                    </View>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: Colors.alpha,
                      backgroundColor: isSelected ? Colors.alpha : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color={Colors.dark} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <View style={{
              backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: Colors.alpha + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="hardware-chip-outline" size={20} color={Colors.alpha} />
                </View>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? Colors.light : Colors.beta,
                }}>
                  Select Equipment
                </Text>
              </View>
              {loadingEquipment && <Skeleton width={26} height={26} borderRadius={13} isDark={false} />}
              {!loadingEquipment && equipment.map((item) => {
                const isSelected = selectedEquipment.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleEquipment(item.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      marginBottom: 12,
                      backgroundColor: isDark ? Colors.dark : Colors.light,
                      borderRadius: 16,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? Colors.alpha : (isDark ? Colors.dark_gray : Colors.dark_gray + '20'),
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: Colors.alpha + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Ionicons name="cube-outline" size={24} color={Colors.alpha} />
                        </View>
                      )}
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isDark ? Colors.light : Colors.beta,
                        flex: 1,
                      }}>
                        {item.mark}
                      </Text>
                    </View>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: Colors.alpha,
                      backgroundColor: isSelected ? Colors.alpha : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color={Colors.dark} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
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
              Reservation created successfully
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
