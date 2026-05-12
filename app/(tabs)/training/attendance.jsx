import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Skeleton from '@/components/ui/Skeleton';

export default function Attendance() {
  const { id, date } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { token } = useAppContext();

  const [selectedDate, setSelectedDate] = useState(date || format(new Date(), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceEvents, setAttendanceEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch attendance events (marked dates)
  const fetchAttendanceEvents = useCallback(async () => {
    if (!token || !id) return;
    try {
      const response = await API.getWithAuth(`mobile/trainings/${id}/attendance-events`, token);
      if (response?.data?.events) {
        const marked = {};
        response.data.events.forEach((event) => {
          marked[event.date] = {
            marked: true,
            dotColor: event.color || '#FACC15',
            customStyles: {
              container: {
                backgroundColor: isDark ? Colors.alpha + '33' : Colors.alpha + '1A',
              },
            },
          };
        });
        setAttendanceEvents(marked);
      }
    } catch (error) {
      console.error('[ATTENDANCE] Events Error:', error);
    }
  }, [token, id, isDark]);

  // Fetch training students
  const fetchStudents = useCallback(async () => {
    if (!token || !id) return [];
    try {
      const response = await API.getWithAuth(`mobile/trainings/${id}`, token);
      if (response?.data?.training?.users) {
        return response.data.training.users;
      }
      return [];
    } catch (error) {
      console.error('[ATTENDANCE] Students Error:', error);
      return [];
    }
  }, [token, id]);

  // Fetch attendance for selected date
  const fetchAttendance = useCallback(async (studentsList) => {
    if (!token || !id || !selectedDate) return;
    setLoading(true);
    try {
      const response = await API.postWithAuth('mobile/attendances', {
        formation_id: parseInt(id),
        attendance_day: selectedDate,
      }, token);

      if (response?.data) {
        setAttendanceData(response.data);
        
        // Create a map of existing attendance by user_id
        const attendanceMap = {};
        if (response.data.lists) {
          response.data.lists.forEach((item) => {
            attendanceMap[item.user_id] = {
              attendance_id: response.data.attendance_id,
              user_id: item.user_id,
              attendance_day: item.attendance_day,
              morning: item.morning || 'present',
              lunch: item.lunch || 'present',
              evening: item.evening || 'present',
              note: item.note || '',
            };
          });
        }

        // Merge with students to create full attendance list
        const fullAttendance = studentsList.map((student) => ({
          ...student,
          ...(attendanceMap[student.id] || {
            attendance_id: response.data.attendance_id,
            user_id: student.id,
            attendance_day: selectedDate,
            morning: 'present',
            lunch: 'present',
            evening: 'present',
            note: '',
          }),
        }));

        setStudents(fullAttendance);
      }
    } catch (error) {
      console.error('[ATTENDANCE] Fetch Error:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [token, id, selectedDate]);

  // Load initial data
  useEffect(() => {
    if (token && id) {
      fetchStudents().then((studentsList) => {
        if (studentsList.length > 0) {
          setStudents(studentsList);
        }
      });
      fetchAttendanceEvents();
    }
  }, [token, id, fetchStudents, fetchAttendanceEvents]);

  // Fetch attendance when date changes
  useEffect(() => {
    if (token && id && selectedDate) {
      fetchStudents().then((studentsList) => {
        if (studentsList.length > 0) {
          fetchAttendance(studentsList);
        }
      });
    }
  }, [selectedDate, token, id, fetchStudents, fetchAttendance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStudents(), fetchAttendanceEvents()]);
    if (selectedDate) {
      await fetchAttendance();
    }
    setRefreshing(false);
  }, [fetchStudents, fetchAttendanceEvents, fetchAttendance, selectedDate]);

  const updateAttendance = (userId, period, value) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === userId
          ? { ...student, [period]: value }
          : student
      )
    );
  };

  const updateNote = (userId, note) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === userId
          ? { ...student, note }
          : student
      )
    );
  };

  const saveAttendance = async () => {
    if (!attendanceData?.attendance_id) {
      Alert.alert('Error', 'No attendance record found');
      return;
    }

    setSaving(true);
    try {
      const attendancePayload = students.map((student) => ({
        attendance_id: student.attendance_id || attendanceData.attendance_id,
        user_id: student.id,
        attendance_day: selectedDate,
        morning: student.morning || 'present',
        lunch: student.lunch || 'present',
        evening: student.evening || 'present',
        note: student.note || '',
      }));

      await API.postWithAuth('mobile/attendance/save', {
        attendance: attendancePayload,
      }, token);

      Alert.alert('Success', 'Attendance saved successfully');
      await fetchAttendanceEvents();
    } catch (error) {
      console.error('[ATTENDANCE] Save Error:', error);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return Colors.good;
      case 'absent':
        return Colors.error;
      case 'late':
        return Colors.alpha;
      case 'excused':
        return Colors.dark_gray;
      default:
        return Colors.dark_gray;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return 'checkmark-circle';
      case 'absent':
        return 'close-circle';
      case 'late':
        return 'time';
      case 'excused':
        return 'medical';
      default:
        return 'help-circle';
    }
  };

  const calendarTheme = {
    backgroundColor: isDark ? Colors.dark : Colors.light,
    calendarBackground: isDark ? Colors.dark : Colors.light,
    dayTextColor: isDark ? Colors.light : Colors.beta,
    monthTextColor: isDark ? Colors.light : Colors.beta,
    arrowColor: Colors.alpha,
    todayTextColor: Colors.alpha,
    selectedDayBackgroundColor: Colors.alpha,
    selectedDayTextColor: isDark ? Colors.dark : Colors.light,
    textDisabledColor: isDark ? Colors.dark_gray : Colors.dark_gray + '80',
  };

  const markedDates = {
    ...attendanceEvents,
    [selectedDate]: {
      selected: true,
      selectedColor: Colors.alpha,
      selectedTextColor: isDark ? Colors.dark : Colors.light,
      ...(attendanceEvents[selectedDate] || {}),
    },
  };

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
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton(isDark)}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? Colors.light : Colors.beta} />
          </Pressable>
          <Text style={styles.headerTitle(isDark)}>Attendance</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer(isDark)}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={calendarTheme}
            markingType="multi-dot"
          />
        </View>

        {/* Selected Date Info */}
        <View style={styles.dateInfo(isDark)}>
          <Ionicons name="calendar-outline" size={20} color={Colors.alpha} />
          <Text style={styles.dateText(isDark)}>
            {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
          </Text>
          {attendanceData?.staff_name && (
            <Text style={styles.staffText(isDark)}>
              Last saved by: {attendanceData.staff_name}
            </Text>
          )}
        </View>

        {/* Attendance List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View
                key={idx}
                style={{
                  marginHorizontal: 20,
                  marginBottom: 16,
                  borderRadius: 16,
                  padding: 16,
                  backgroundColor: isDark ? Colors.dark_gray : Colors.light,
                }}
              >
                <Skeleton width={180} height={16} borderRadius={10} isDark={isDark} />
                <View style={{ height: 14 }} />
                <Skeleton width="100%" height={46} borderRadius={12} isDark={isDark} />
                <View style={{ height: 12 }} />
                <Skeleton width="100%" height={46} borderRadius={12} isDark={isDark} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.attendanceList}>
            {students.map((student) => (
              <View key={student.id} style={styles.studentCard(isDark)}>
                <View style={styles.studentHeader}>
                  <Text style={styles.studentName(isDark)}>{student.name}</Text>
                </View>

                {/* Periods */}
                <View style={styles.periodsContainer}>
                  {['morning', 'lunch', 'evening'].map((period) => (
                    <View key={period} style={styles.periodRow}>
                      <Text style={styles.periodLabel(isDark)}>
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </Text>
                      <View style={styles.statusButtons}>
                        {['present', 'absent', 'late', 'excused'].map((status) => (
                          <Pressable
                            key={status}
                            onPress={() => updateAttendance(student.id, period, status)}
                            style={[
                              styles.statusButton(isDark),
                              student[period] === status && {
                                backgroundColor: getStatusColor(status),
                                borderColor: getStatusColor(status),
                              },
                            ]}
                          >
                            <Ionicons
                              name={getStatusIcon(status)}
                              size={16}
                              color={
                                student[period] === status
                                  ? Colors.light
                                  : isDark
                                  ? Colors.light + 'CC'
                                  : Colors.beta + 'CC'
                              }
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Notes */}
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel(isDark)}>Notes:</Text>
                  <TextInput
                    style={styles.notesInput(isDark)}
                    value={student.note || ''}
                    onChangeText={(text) => updateNote(student.id, text)}
                    placeholder="Add notes..."
                    placeholderTextColor={isDark ? Colors.light + '66' : Colors.beta + '66'}
                    multiline
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Save Button */}
        {!loading && students.length > 0 && (
          <View style={styles.saveContainer(isDark)}>
            <Pressable
              onPress={saveAttendance}
              disabled={saving}
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            >
              {saving ? (
                <Skeleton width={18} height={18} borderRadius={9} isDark={false} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color={Colors.light} />
                  <Text style={styles.saveButtonText}>Save Attendance</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: (isDark) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
  }),
  headerTitle: (isDark) => ({
    fontSize: 24,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
  }),
  calendarContainer: (isDark) => ({
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  }),
  dateInfo: (isDark) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  }),
  dateText: (isDark) => ({
    fontSize: 16,
    fontWeight: '700',
    color: isDark ? Colors.light : Colors.beta,
    flex: 1,
  }),
  staffText: (isDark) => ({
    fontSize: 12,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
  }),
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  attendanceList: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 100,
  },
  studentCard: (isDark) => ({
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  }),
  studentHeader: {
    marginBottom: 16,
  },
  studentName: (isDark) => ({
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? Colors.light : Colors.beta,
  }),
  periodsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodLabel: (isDark) => ({
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    width: 80,
  }),
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: (isDark) => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: isDark ? Colors.dark : Colors.dark_gray,
    backgroundColor: isDark ? Colors.dark : Colors.light,
  }),
  notesContainer: {
    marginTop: 8,
  },
  notesLabel: (isDark) => ({
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    marginBottom: 8,
  }),
  notesInput: (isDark) => ({
    backgroundColor: isDark ? Colors.dark : Colors.light,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark : Colors.dark_gray,
    color: isDark ? Colors.light : Colors.beta,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  }),
  saveContainer: (isDark) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: isDark ? Colors.dark : Colors.light,
    borderTopWidth: 1,
    borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
  }),
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.alpha,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.light,
    fontSize: 16,
    fontWeight: '700',
  },
});
