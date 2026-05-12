import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // expo-image-picker is optional in this repo
}

function resolvePostImageUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.includes('storage/')) {
    const cleanPath = value.startsWith('/') ? value : `/${value}`;
    return `${API.APP_URL}${cleanPath}`;
  }
  // If it already contains img/posts/, don't double-prefix it
  if (value.includes('img/posts/')) {
    const cleanPath = value.startsWith('/') ? value : `/${value}`;
    // value might be "img/posts/file.jpg" (without storage/)
    return `${API.APP_URL}/storage/${cleanPath.replace(/^\//, '')}`;
  }
  return `${API.APP_URL}/storage/img/posts/${value}`;
}

export default function EditPostScreen() {
  const { id } = useLocalSearchParams();
  const postId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [existingImages, setExistingImages] = useState([]); // filenames from DB
  const [removedImages, setRemovedImages] = useState([]);   // filenames to remove
  const [newImages, setNewImages] = useState([]);           // picked assets: { uri, name, type }

  // Same avatar resolver used in CreatePost
  const getProfileImageUrl = () => {
    if (!user) return null;

    const avatar = user?.avatar;
    const image = user?.image;
    const avatarValue = avatar || image;
    if (!avatarValue) return null;

    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      if (avatarValue.includes('/storage/') && !avatarValue.includes('/storage/img/profile/')) {
        const filename = avatarValue.split('/').pop();
        if (filename) return `${API.APP_URL}/storage/img/profile/${filename}`;
      }
      return avatarValue;
    }

    if (typeof avatarValue === 'string') {
      if (avatarValue.includes('storage/') && !avatarValue.includes('img/profile/')) {
        const parts = avatarValue.split('/');
        const filename = parts[parts.length - 1];
        if (filename) return `${API.APP_URL}/storage/img/profile/${filename}`;
      }
      if (avatarValue.includes('img/profile/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      }
      return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
    }

    return null;
  };

  // Match Create Post modal styling
  const bg = isDark ? '#171717' : '#fafafa';
  const card = isDark ? '#1c1c1c' : '#ffffff';
  const border = isDark ? '#2e2e2e' : '#ddd8d0';
  const text = isDark ? '#ffffff' : '#111111';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';

  useEffect(() => {
    fetchPost();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPost = async () => {
    if (!token || !postId) {
      setLoading(false);
      Alert.alert('Error', 'Invalid post id.');
      router.back();
      return;
    }
    setLoading(true);
    try {
      const res = await API.get(`mobile/posts/${postId}`, token);
      const post = res?.data?.post;
      setDescription(post?.description || '');
      setExistingImages(Array.isArray(post?.images) ? post.images : []);
      setRemovedImages([]);
      setNewImages([]);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data === 'string' ? error.response.data : null) ||
        error?.message ||
        'Failed to load post.';
      Alert.alert('Error', String(msg));
      router.back();
    } finally {
      setLoading(false);
    }
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

  const toggleRemoveExisting = (filename) => {
    if (!filename) return;
    setRemovedImages((prev) =>
      prev.includes(filename) ? prev.filter((x) => x !== filename) : [...prev, filename]
    );
  };

  const removeNewImageAt = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!token) return;
    if (saving) return;

    setSaving(true);
    try {
      const keepImages = existingImages.filter((img) => !removedImages.includes(img));

      const form = new FormData();
      form.append('description', description);
      keepImages.forEach((img) => form.append('keep_images[]', img));
      removedImages.forEach((img) => form.append('removed_images[]', img));
      newImages.forEach((img) => {
        form.append('new_images[]', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        });
      });

      await API.post(`mobile/posts/${postId}`, form, token);
      Alert.alert('Saved', 'Your post has been updated.');
      router.back();
    } catch (error) {
      const data = error?.response?.data;
      const msg =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' ? data : null) ||
        error?.message ||
        'Failed to save changes.';
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  };

  const totalAfterSave = (existingImages.length - removedImages.length) + newImages.length;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header (same as Create Post) */}
        <View
          style={{
            backgroundColor: card,
            borderBottomWidth: 0.5,
            borderBottomColor: border,
          }}
        >
          
          <View style={{ paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={22} color={text} />
            </TouchableOpacity>
            <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
              Edit post
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: saving ? (isDark ? '#2a2a2a' : '#e5e5e5') : '#ffc801',
              }}
            >
              {saving ? (
                <Skeleton width={18} height={18} borderRadius={9} isDark={isDark} />
              ) : (
                <Text style={{ fontWeight: '900', color: '#000' }}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Profile row (same as CreatePost) */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 14,
              paddingTop: 14,
              borderTopWidth: 0.5,
              borderTopColor: border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(() => {
                const profileImageUrl = getProfileImageUrl();

                return profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, borderWidth: 2, borderColor: 'rgba(255,200,1,0.3)' }}
                    defaultSource={require('@/assets/images/icon.png')}
                  />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: isDark ? 'rgba(33,37,41,0.4)' : 'rgba(33,37,41,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>
                  {user?.name || 'User'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
                  />
                  <Text style={{ fontSize: 12, color: muted, marginLeft: 6 }}>
                    Editing your post
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: 16 }}>
            <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: 0.5, borderColor: border, padding: 14 }}>
              <Skeleton width={110} height={12} borderRadius={10} isDark={isDark} />
              <View style={{ height: 12 }} />
              <Skeleton width="100%" height={90} borderRadius={14} isDark={isDark} />
            </View>

            <View style={{ marginTop: 12, backgroundColor: card, borderRadius: 16, borderWidth: 0.5, borderColor: border, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Skeleton width={120} height={12} borderRadius={10} isDark={isDark} />
                <Skeleton width={70} height={28} borderRadius={999} isDark={isDark} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} width="31%" height={110} borderRadius={12} isDark={isDark} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Description */}
            <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: 0.5, borderColor: border, padding: 14 }}>
              <Text style={{ color: muted, fontWeight: '800', fontSize: 12, marginBottom: 8 }}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Write something…"
                placeholderTextColor={muted}
                multiline
                style={{ minHeight: 120, color: text, fontSize: 15, lineHeight: 22 }}
              />
            </View>

            {/* Images */}
            <View style={{ marginTop: 12, backgroundColor: card, borderRadius: 16, borderWidth: 0.5, borderColor: border, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: muted, fontWeight: '800', fontSize: 12 }}>
                  Images ({totalAfterSave}/16)
                </Text>
                <TouchableOpacity onPress={pickImages} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="add-circle-outline" size={18} color="#ffc801" />
                  <Text style={{ color: '#ffc801', fontWeight: '900' }}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Existing images */}
              {existingImages.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {existingImages.map((filename) => {
                    const removed = removedImages.includes(filename);
                    const uri = resolvePostImageUrl(filename);
                    return (
                      <Pressable
                        key={filename}
                        onPress={() => toggleRemoveExisting(filename)}
                        style={{
                          width: '31%',
                          aspectRatio: 1,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: removed ? 2 : 0.5,
                          borderColor: removed ? '#ef4444' : border,
                          opacity: removed ? 0.5 : 1,
                          backgroundColor: isDark ? '#2a2a2a' : '#f3f2ef',
                        }}
                      >
                        {uri ? (
                          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                        ) : null}
                        {removed ? (
                          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#ef4444', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>Remove</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: muted }}>No existing images.</Text>
              )}

              {/* New images */}
              {newImages.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: muted, fontWeight: '800', fontSize: 12, marginBottom: 8 }}>New images</Text>
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
                          borderColor: border,
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
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

