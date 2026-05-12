import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

function LikeRow({ item, isDark, textColor, mutedColor, token, onFollowed }) {
  const avatarUrl = resolveAvatarUrl(item.avatar);
  const initial = (item.name || 'U').charAt(0).toUpperCase();

  const handleFollow = async () => {
    try {
      await API.post(`mobile/users/${item.id}/follow`, {}, token);
      onFollowed(item.id);
    } catch {
      // ignore for now (could show toast later)
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
      <View
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
          overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            defaultSource={require('@/assets/images/icon.png')}
            style={{ width: 44, height: 44, borderRadius: 22 }}
          />
        ) : (
          <Text style={{ fontWeight: '800', fontSize: 16, color: isDark ? '#fff' : '#111' }}>
            {initial}
          </Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
          {item.name}
        </Text>
      </View>

      {/* Follow button only if not following and not self */}
      {!item.is_me && !item.is_following ? (
        <TouchableOpacity
          onPress={handleFollow}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: '#ffc801',
          }}
        >
          <Text style={{ fontWeight: '900', color: '#000', fontSize: 12 }}>
            Follow
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function LikesModal({ visible, postId, onClose }) {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(false);
  const [likes, setLikes] = useState([]);

  const listRef = useRef(null);

  const bgColor = isDark ? '#1c1c1c' : '#ffffff';
  const handleColor = isDark ? '#444' : '#d0cdc8';
  const borderColor = isDark ? '#2e2e2e' : '#e8e5e0';
  const textColor = isDark ? '#f5f5f5' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  useEffect(() => {
    if (visible && postId) fetchLikes();
  }, [visible, postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLikes = async () => {
    setLoading(true);
    try {
      const res = await API.get(`mobile/posts/${postId}/likes`, token);
      setLikes(res?.data?.likes || []);
    } catch {
      setLikes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLikes([]);
    onClose();
  };

  const markFollowed = (userId) => {
    setLikes(prev => prev.map(l => (l.id === userId ? { ...l, is_following: true } : l)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* overlay */}
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60%',
          backgroundColor: bgColor,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
        }}
      >
        {/* handle */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: handleColor }} />
        </View>

        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: borderColor,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: textColor }}>
            Likes
          </Text>
          <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={mutedColor} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, paddingTop: 10 }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Skeleton width={44} height={44} borderRadius={22} isDark={isDark} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Skeleton width={160} height={12} borderRadius={10} isDark={isDark} />
                </View>
                <Skeleton width={72} height={28} borderRadius={999} isDark={isDark} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={likes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <LikeRow
                item={item}
                isDark={isDark}
                textColor={textColor}
                mutedColor={mutedColor}
                token={token}
                onFollowed={markFollowed}
              />
            )}
            ItemSeparatorComponent={() => (
              <View style={{ height: 0.5, backgroundColor: borderColor, marginLeft: 72 }} />
            )}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="heart-outline" size={36} color={mutedColor} />
                <Text style={{ color: mutedColor, marginTop: 10, fontSize: 14 }}>
                  No likes yet.
                </Text>
              </View>
            )}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

