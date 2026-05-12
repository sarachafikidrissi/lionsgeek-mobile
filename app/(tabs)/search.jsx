import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, Pressable } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { router } from 'expo-router';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

export default function SearchScreen() {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('all'); // all, students, hashtags
  const [filter, setFilter] = useState(''); // student, admin, coach
  const debounceTimer = useRef(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // If query is empty, clear results immediately
    if (!searchQuery.trim()) {
      setResults([]);
      setIsTyping(false);
      return;
    }

    // Show typing indicator
    setIsTyping(true);

    // Set loading state after a short delay
    debounceTimer.current = setTimeout(() => {
      setIsTyping(false);
      handleSearch();
    }, 800); // Wait 800ms after user stops typing

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, searchType, filter]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !token) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: searchType,
        ...(filter && { filter }),
      }).toString();

      const response = await API.getWithAuth(`mobile/search?${params}`, token);
      if (response?.data) {
        setResults(response.data.results || []);
      }
    } catch (error) {
      console.error('[SEARCH] Error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId) => {
    router.push(`/(tabs)/profile?userId=${userId}`);
  };

  const filterButtons = [
    { value: '', label: 'All', icon: 'people-outline' },
    { value: 'student', label: 'Students', icon: 'school-outline' },
    { value: 'coach', label: 'Coaches', icon: 'person-outline' },
    { value: 'admin', label: 'Admins', icon: 'shield-outline' },
  ];

  const typeButtons = [
    { value: 'all', label: 'All', icon: 'search-outline' },
    { value: 'students', label: 'Students', icon: 'people-outline' },
    { value: 'hashtags', label: 'Hashtags', icon: 'pricetag-outline' },
  ];

  console.log();


  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pt-12 pb-4 px-6">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-black dark:text-white flex-1">Search</Text>
          </View>

          {/* Search Input */}
          <View className="flex-row items-center bg-light/50 dark:bg-dark/50 rounded-lg px-3 py-2 mb-3 border border-light/20 dark:border-dark/20">
            <Ionicons name="search" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
            <TextInput
              className="flex-1 ml-2 text-black dark:text-white"
              placeholder="Search students, hashtags..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
            />
            {(isTyping || loading) ? (
              <Skeleton width={16} height={16} borderRadius={8} isDark={isDark} />
            ) : null}
            {searchQuery.length > 0 && !isTyping && !loading && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row gap-2">
              {typeButtons.map((btn) => (
                <Pressable
                  key={btn.value}
                  onPress={() => setSearchType(btn.value)}
                  className={`px-4 py-2 rounded-full flex-row items-center ${searchType === btn.value
                    ? 'bg-alpha dark:bg-alpha'
                    : 'bg-light/50 dark:bg-dark/50'
                    }`}
                >
                  <Ionicons
                    name={btn.icon}
                    size={16}
                    color={searchType === btn.value ? (isDark ? '#000' : '#000') : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')}
                  />
                  <Text
                    className={`ml-2 text-sm font-medium ${searchType === btn.value
                      ? 'text-black'
                      : 'text-black/60 dark:text-white/60'
                      }`}
                  >
                    {btn.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Role Filter */}
          {searchType === 'all' || searchType === 'students' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {filterButtons.map((btn) => (
                  <Pressable
                    key={btn.value}
                    onPress={() => setFilter(btn.value)}
                    className={`px-4 py-2 rounded-full flex-row items-center ${filter === btn.value
                      ? 'bg-alpha dark:bg-alpha'
                      : 'bg-light/50 dark:bg-dark/50'
                      }`}
                  >
                    <Ionicons
                      name={btn.icon}
                      size={16}
                      color={filter === btn.value ? (isDark ? '#000' : '#000') : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')}
                    />
                    <Text
                      className={`ml-2 text-sm font-medium ${filter === btn.value
                        ? 'text-black'
                        : 'text-black/60 dark:text-white/60'
                        }`}
                    >
                      {btn.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>

        {/* Results */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-6 pt-4 pb-8">
            {isTyping ? (
              <View style={{ paddingTop: 10 }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Skeleton width={180} height={12} borderRadius={10} isDark={isDark} />
                      <View style={{ height: 8 }} />
                      <Skeleton width={220} height={10} borderRadius={10} isDark={isDark} />
                    </View>
                  </View>
                ))}
              </View>
            ) : loading ? (
              <View style={{ paddingTop: 10 }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Skeleton width={180} height={12} borderRadius={10} isDark={isDark} />
                      <View style={{ height: 8 }} />
                      <Skeleton width={220} height={10} borderRadius={10} isDark={isDark} />
                    </View>
                  </View>
                ))}
              </View>
            ) : results.length === 0 && searchQuery.length > 0 ? (
              <View className="py-8 items-center">
                <Ionicons name="search-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                <Text className="text-center text-black/60 dark:text-white/60 mt-4">
                  No results found
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View className="py-8 items-center">
                <Ionicons name="search-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                <Text className="text-center text-black/60 dark:text-white/60 mt-4">
                  Start typing to search
                </Text>
                <Text className="text-center text-sm text-black/50 dark:text-white/50 mt-2">
                  Search for students, or filter by type
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-sm text-black/60 dark:text-white/60 mb-3">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Text>
                {results.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => item.type === 'user' && handleUserPress(item.id)}
                    className="mb-3 bg-light dark:bg-dark rounded-lg p-4 border border-light/20 dark:border-dark/20 flex-row items-center active:opacity-70"
                  >
                    {item.type === 'user' ? (
                      <>
                        {
                          item.image ? (
                            <Image
                              source={{ uri: API.APP_URL + "/storage/img/profile/" + item.image }}
                              className="w-12 h-12 rounded-full mr-3"
                              defaultSource={require('@/assets/images/icon.png')}
                            />
                          ) : (
                            <View className="w-12 h-12 rounded-full mr-3 feed">
                              <Ionicons name="person-outline" size={24} color={isDark ? '#fff' : '#000'} />
                            </View>
                          )
                        }
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-black dark:text-white">
                            {item.name}
                          </Text>
                          {userHasAdminRole(user) && item.email ? (
                            <Text className="text-sm text-black/60 dark:text-white/60">
                              {item.email}
                            </Text>
                          ) : null}
                          <View className="flex-row items-center mt-1">
                            {item.promo && (
                              <Text className="text-xs text-black/50 dark:text-white/50 mr-2">
                                Promo {item.promo}
                              </Text>
                            )}
                            {/* {item.roles && item.roles.length > 0 && (
                              <View className="flex-row">
                                {item.roles.slice(0, 2).map((role, idx) => (
                                  <View key={idx} className="px-2 py-0.5 rounded-full bg-alpha/20 mr-1">
                                    <Text className="text-xs font-medium text-alpha capitalize">
                                      {role}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )} */}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                      </>
                    ) : (
                      <View className="flex-row items-center flex-1">
                        <Ionicons name="pricetag-outline" size={24} color={isDark ? '#fff' : '#000'} />
                        <Text className="text-base font-semibold text-black dark:text-white ml-3">
                          #{item.name}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </AppLayout>
  );
}
