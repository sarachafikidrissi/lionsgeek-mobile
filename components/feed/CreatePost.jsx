import { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, Modal, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';

function getMentionCandidate(text, cursorIndex) {
  if (typeof text !== 'string') return null;
  if (typeof cursorIndex !== 'number' || Number.isNaN(cursorIndex)) return null;

  const beforeCursor = text.slice(0, cursorIndex);
  const lastAt = beforeCursor.lastIndexOf('@');
  if (lastAt === -1) return null;

  const charBeforeAt = lastAt === 0 ? ' ' : beforeCursor[lastAt - 1];
  if (!/\s/.test(charBeforeAt)) return null;

  const query = beforeCursor.slice(lastAt + 1);
  if (/\s/.test(query)) return null;

  return { startIndex: lastAt, query };
}

function getUserDisplayName(user) {
  const raw = user?.username || user?.name || '';
  if (!raw) return null;
  return String(raw).trim();
}

function getUserHandle(user) {
  const username = user?.username ? String(user.username).trim() : '';
  if (username) return username;

  const display = getUserDisplayName(user);
  if (!display) return null;
  return display.replace(/\s+/g, '');
}

const DESCRIPTION_LINE_HEIGHT = 22;
const DESCRIPTION_MIN_HEIGHT = 120;
const MENTION_ROW_HEIGHT_ESTIMATE = 54;
const MENTION_PANEL_MAX_HEIGHT = 220;

export default function CreatePost({ onPostPress, onPostCreated }) {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const postInputRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [mentionResults, setMentionResults] = useState([]);
  const [isSearchingMentions, setIsSearchingMentions] = useState(false);
  const mentionSearchTimeoutRef = useRef(null);
  const [newImages, setNewImages] = useState([]); // { uri, name, type }
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('post'); // post, video, photo, article
  const keyboardVerticalOffset = useMemo(() => (Platform.OS === 'ios' ? 0 : 24), []);

  let ImagePicker = null;
  try {
    ImagePicker = require('expo-image-picker');
  } catch {
    // optional
  }

  const handleCreatePost = () => {
    setShowModal(true);
  };

  const searchUsersForMentions = ({ query }) => {
    if (!token) return;

    if (mentionSearchTimeoutRef.current) clearTimeout(mentionSearchTimeoutRef.current);

    setIsSearchingMentions(true);
    mentionSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await API.getWithAuth(
          `mobile/search?q=${encodeURIComponent(query ?? '')}&type=students`,
          token
        );

        const users = response?.data?.results;
        const list = Array.isArray(users) ? users : [];

        const filtered = list.filter((u) => String(u?.id) !== String(user?.id));
        setMentionResults(filtered.slice(0, 12));
      } catch (_error) {
        setMentionResults([]);
      } finally {
        setIsSearchingMentions(false);
      }
    }, 250);
  };

  const pickImages = async () => {
    if (!ImagePicker) {
      Alert.alert('Not Available', 'This feature requires expo-image-picker.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to pick images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length) {
        const picked = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'photo.jpg',
          type: asset.mimeType || 'image/jpeg',
        }));
        setNewImages((prev) => [...prev, ...picked].slice(0, 16));
      }
    } catch {
      Alert.alert('Error', 'Failed to pick images.');
    }
  };

  const removeNewImageAt = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangePostContent = (nextText) => {
    setPostContent(nextText);

    const candidate = getMentionCandidate(nextText, cursorIndex);
    if (!candidate) {
      setMentionResults([]);
      setIsSearchingMentions(false);
      return;
    }

    searchUsersForMentions({ query: candidate.query });
  };

  const handleMentionSelect = (selectedUser) => {
    const candidate = getMentionCandidate(postContent, cursorIndex);
    const handle = getUserHandle(selectedUser);
    if (!candidate || !handle) return;

    // Keep keyboard open during insert
    postInputRef.current?.focus?.();

    const before = postContent.slice(0, candidate.startIndex);
    const after = postContent.slice(cursorIndex);
    const inserted = `@${handle} `;
    const next = `${before}${inserted}${after}`;

    const nextCursor = before.length + inserted.length;
    setPostContent(next);
    setCursorIndex(nextCursor);
    setMentionResults([]);

    // Keep keyboard open + keep input focused so selection feels instant
    requestAnimationFrame(() => postInputRef.current?.focus?.());
    setTimeout(() => postInputRef.current?.focus?.(), 0);
  };

  const showMentions =
    Boolean(getMentionCandidate(postContent, cursorIndex)) &&
    (mentionResults.length > 0 || isSearchingMentions);

  const handlePost = async () => {
    const text = postContent.trim();
    const hasImages = newImages.length > 0;

    if (!text && !hasImages) {
      Alert.alert('Error', 'Please add a description or at least one image.');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('description', text);
      newImages.forEach((img) => {
        form.append('images[]', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        });
      });

      const response = await API.post('mobile/posts', form, token);

      if (response?.data?.post) {
        Alert.alert('Success', 'Post created successfully!');
        setPostContent('');
        setNewImages([]);
        setShowModal(false);
        setSelectedType('post');
        if (onPostCreated) onPostCreated(response.data.post);
      }
    } catch (error) {
      const data = error?.response?.data;
      const msg =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' ? data : null) ||
        error?.message ||
        'Failed to create post. Please try again.';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get avatar URL - always use /storage/img/profile/
  const getImageUrl = () => {
    if (!user) return null;
    
    const avatar = user?.avatar;
    const image = user?.image;
    
    // First try avatar (might be full URL from API)
    const avatarValue = avatar || image;
    
    if (!avatarValue) return null;
    
    // If it's already a full URL, check if it needs to be corrected
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      // If it's a full URL but doesn't include img/profile/, extract filename and reconstruct
      if (avatarValue.includes('/storage/') && !avatarValue.includes('/storage/img/profile/')) {
        // Extract filename from URL (e.g., from http://.../storage/filename.jpg)
        const filename = avatarValue.split('/').pop();
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      return avatarValue;
    }
    
    if (typeof avatarValue === 'string') {
      // If it includes storage/ but not img/profile/, extract filename
      if (avatarValue.includes('storage/') && !avatarValue.includes('img/profile/')) {
        // Extract filename (handle both /storage/filename.jpg and storage/filename.jpg)
        const parts = avatarValue.split('/');
        const filename = parts[parts.length - 1];
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      // If it already includes img/profile/, use it as is
      if (avatarValue.includes('img/profile/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      }
      // If it's just a filename, use storage/img/profile/
      return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
    }
    
    return null;
  };

  return (
    <>
      {/* Composer row */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        {(() => {
          const profileImageUrl = getImageUrl();
          return profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              className="w-9 h-9 rounded-full"
              style={{ borderWidth: 1.5, borderColor: '#ffc801' }}
              defaultSource={require('@/assets/images/icon.png')}
            />
          ) : (
            <View
              className="w-9 h-9 rounded-full bg-beta/10 dark:bg-beta/40 items-center justify-center"
              style={{ borderWidth: 1.5, borderColor: '#ffc801' }}
            >
              <Text className="text-xs font-extrabold text-black/60 dark:text-white/60">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          );
        })()}

        <TouchableOpacity
          onPress={handleCreatePost}
          className="flex-1 py-2 px-4 rounded-full active:opacity-70"
          style={{
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)',
          }}
        >
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontWeight: '500' }}>
            What are you thinking about?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick-action row */}
      <View
        className="flex-row items-center mt-3 pt-3"
        style={{ borderTopWidth: 0.5, borderTopColor: isDark ? '#2a2a2a' : '#e0e0e0', gap: 4 }}
      >
        <TouchableOpacity
          onPress={() => { setSelectedType('photo'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="image-outline" size={20} color="#43b581" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Photo</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          onPress={() => { setSelectedType('video'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="videocam-outline" size={20} color="#5865f2" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Video</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          onPress={() => { setSelectedType('article'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="document-text-outline" size={20} color="#ffc801" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Article</Text>
        </TouchableOpacity> */}
      </View>

      {/* Create Post Modal - Full Screen */}
      <Modal
        visible={showModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          setPostContent('');
          setNewImages([]);
          setSelectedType('post');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          className="flex-1 bg-light dark:bg-dark"
        >
          {/* Header (like edit page) */}
          <View
            style={{
              backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? '#2e2e2e' : '#ddd8d0',
            }}
            className="pt-12 pb-3 px-4"
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  setPostContent('');
                  setNewImages([]);
                  setSelectedType('post');
                }}
                className="p-2"
              >
                <Ionicons name="chevron-back" size={22} color={isDark ? '#fff' : '#111'} />
              </TouchableOpacity>
              <Text style={{ color: isDark ? '#fff' : '#111' }} className="text-base font-extrabold">
                Create post
              </Text>
              <Pressable
                onPress={handlePost}
                disabled={loading || (!postContent.trim() && newImages.length === 0)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: (loading || (!postContent.trim() && newImages.length === 0))
                    ? (isDark ? '#2a2a2a' : '#e5e5e5')
                    : '#ffc801',
                }}
              >
                {loading ? (
                  <Skeleton width={18} height={18} borderRadius={9} isDark={isDark} />
                ) : (
                  <Text style={{ fontWeight: '900', color: '#000' }}>Post</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Content (redesign like edit page) */}
          <View className="flex-1 px-4 pt-4">
            <View className="flex-row items-center mb-6 pb-4 border-b border-light/20 dark:border-dark/20">
              {(() => {
                const profileImageUrl = getImageUrl();

                return profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    className="w-12 h-12 rounded-full mr-3 border-2 border-alpha/30"
                    defaultSource={require('@/assets/images/icon.png')}
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full mr-3 bg-beta/20 dark:bg-beta/40 items-center justify-center">
                    <Text className="text-sm font-bold text-black/60 dark:text-white/60">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
              <View className="flex-1">
                <Text className="text-base font-semibold text-black dark:text-white">
                  {user?.name || 'User'}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons 
                    name={selectedType === 'video' ? 'videocam' : selectedType === 'photo' ? 'image' : selectedType === 'article' ? 'document-text' : 'document'} 
                    size={14} 
                    color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                  />
                  <Text className="text-xs text-black/60 dark:text-white/60 ml-1 capitalize">
                    {selectedType}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              {/* Description card */}
              <View
                style={{
                  backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                  borderRadius: 16,
                  borderWidth: 0.5,
                  borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
                  padding: 14,
                }}
              >
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', fontWeight: '800', fontSize: 12, marginBottom: 8 }}>
                  Description
                </Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    ref={postInputRef}
                    value={postContent}
                    onChangeText={handleChangePostContent}
                    onSelectionChange={(e) => {
                      const nextCursor = e?.nativeEvent?.selection?.start ?? 0;
                      setCursorIndex(nextCursor);
                    }}
                    placeholder="Write something… (type @ to tag)"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'}
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: DESCRIPTION_MIN_HEIGHT,
                      paddingBottom: showMentions ? 12 : 0,
                      color: isDark ? '#f5f5f5' : '#111111',
                      fontSize: 15,
                      lineHeight: DESCRIPTION_LINE_HEIGHT,
                    }}
                  />

                  {(() => {
                    if (!showMentions) return null;

                    // Approximate cursor line using explicit newlines (doesn't account for word-wrapping)
                    const lineIndex = postContent.slice(0, cursorIndex).split('\n').length - 1;
                    const cursorLineBottomY = (lineIndex + 1) * DESCRIPTION_LINE_HEIGHT;

                    const headerHeightEstimate = 40;
                    const panelHeightEstimate = Math.min(
                      headerHeightEstimate + mentionResults.length * MENTION_ROW_HEIGHT_ESTIMATE,
                      MENTION_PANEL_MAX_HEIGHT
                    );

                    // Keep panel within the text area bounds
                    let top = cursorLineBottomY + 8;
                    if (top + panelHeightEstimate > DESCRIPTION_MIN_HEIGHT) {
                      top = Math.max(0, DESCRIPTION_MIN_HEIGHT - panelHeightEstimate);
                    }

                    return (
                      <View
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top,
                          borderRadius: 14,
                          borderWidth: 0.5,
                          borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
                          backgroundColor: isDark ? '#171717' : '#ffffff',
                          overflow: 'hidden',
                          zIndex: 50,
                          elevation: 6,
                          shadowColor: '#000',
                          shadowOpacity: 0.18,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 6 },
                        }}
                      >
                        <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', fontWeight: '800', fontSize: 12 }}>
                            Tag someone
                          </Text>
                          {isSearchingMentions ? (
                            <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontWeight: '700', fontSize: 12 }}>
                              searching…
                            </Text>
                          ) : null}
                        </View>

                        <View style={{ height: 0.5, backgroundColor: isDark ? '#2e2e2e' : '#eee8df' }} />

                        <ScrollView style={{ maxHeight: MENTION_PANEL_MAX_HEIGHT }} keyboardShouldPersistTaps="always">
                          {mentionResults.map((u) => {
                            const displayName = getUserDisplayName(u);
                            const handle = getUserHandle(u);
                            const avatar = u?.image || u?.avatar;

                            return (
                              <Pressable
                                key={String(u?.id ?? `${displayName}-${handle}`)}
                                onPressIn={() => {
                                  // Prevent keyboard dismiss on first tap
                                  postInputRef.current?.focus?.();
                                }}
                                onPress={() => handleMentionSelect(u)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                              >
                                {avatar ? (
                                  <Image
                                    source={{ uri: avatar.startsWith('http') ? avatar : `${API.APP_URL}/storage/img/profile/${avatar}` }}
                                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#2a2a2a' : '#f3f2ef' }}
                                    defaultSource={require('@/assets/images/icon.png')}
                                  />
                                ) : (
                                  <View
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 17,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: isDark ? '#2a2a2a' : '#f3f2ef',
                                    }}
                                  >
                                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontWeight: '900', fontSize: 12 }}>
                                      {(displayName || '?').charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}

                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }} numberOfLines={1}>
                                    {displayName || 'User'}
                                  </Text>
                                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
                                    @{handle || 'user'}
                                  </Text>
                                </View>

                                <Ionicons name="at" size={18} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} />
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Images card */}
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                  borderRadius: 16,
                  borderWidth: 0.5,
                  borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
                  padding: 14,
                }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', fontWeight: '800', fontSize: 12 }}>
                    Images ({newImages.length}/16)
                  </Text>
                  <TouchableOpacity onPress={pickImages} className="flex-row items-center">
                    <Ionicons name="add-circle-outline" size={18} color="#ffc801" />
                    <Text style={{ color: '#ffc801', fontWeight: '900', marginLeft: 6 }}>Add</Text>
                  </TouchableOpacity>
                </View>

                {newImages.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {newImages.map((img, index) => (
                      <View
                        key={`${img.uri}-${index}`}
                        style={{
                          width: '31%',
                          aspectRatio: 1,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: 0.5,
                          borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
                          backgroundColor: isDark ? '#2a2a2a' : '#f3f2ef',
                        }}
                      >
                        <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} />
                        <TouchableOpacity
                          onPress={() => removeNewImageAt(index)}
                          style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 4 }}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' }}>
                    No images selected.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
