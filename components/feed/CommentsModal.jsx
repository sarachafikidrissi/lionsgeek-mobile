import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}

function sortByNewestFirst(items) {
  if (!Array.isArray(items)) return [];
  const safeTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  return [...items]
    .sort((a, b) => safeTime(b?.created_at) - safeTime(a?.created_at))
    .map((comment) => ({
      ...comment,
      replies: sortByNewestFirst(comment?.replies || []),
    }));
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ value, name, size = 36, isDark }) {
  const url = resolveAvatarUrl(value);
  const initial = (name || 'U').charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          defaultSource={require('@/assets/images/icon.png')}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={{ fontWeight: '800', fontSize: size * 0.38, color: isDark ? '#fff' : '#111' }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

// ─── CommentRow ──────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  isReply = false,
  isDark,
  textColor,
  mutedColor,
  token,
  onReply,
  currentUserId,
  onOpenMenu,
}) {
  const [liked, setLiked]       = useState(Boolean(comment.is_liked_by_user));
  const [likeCount, setLikeCount] = useState(comment.likes_count ?? 0);
  const [showReplies, setShowReplies] = useState(false);

  const bubbleBg = isDark ? '#2a2a2a' : '#f3f2ef';
  const isMyComment =
    currentUserId != null &&
    comment?.user?.id != null &&
    Number(comment.user.id) === Number(currentUserId);

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    try {
      const res = await API.post(`mobile/comments/${comment.id}/like`, {}, token);
      if (res?.data) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likes_count);
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    }
  };

  return (
    <View style={{ marginLeft: isReply ? 44 : 0 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
        {/* Avatar */}
        <View style={{ marginRight: 10 }}>
          <Avatar
            value={comment.user?.avatar}
            name={comment.user?.name}
            size={isReply ? 30 : 36}
            isDark={isDark}
          />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Bubble */}
          <Pressable
            onLongPress={() => {
              if (isMyComment) onOpenMenu(comment);
            }}
            delayLongPress={350}
            android_ripple={isMyComment ? { color: isDark ? '#3a3a3a' : '#e7e4df' } : undefined}
            style={({ pressed }) => ([
              {
                backgroundColor: bubbleBg,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: pressed && isMyComment ? 0.92 : 1,
              },
            ])}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: textColor, marginBottom: 2, flex: 1 }} numberOfLines={1}>
                {comment.user?.name || 'User'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: textColor, lineHeight: 20 }}>
              {comment.body}
            </Text>
          </Pressable>

          {/* Meta row: time · Like · Reply */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginLeft: 4, gap: 14 }}>
            <Text style={{ fontSize: 11, color: mutedColor }}>{formatTime(comment.created_at)}</Text>

            {/* Like action */}
            <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={13}
                color={liked ? '#ffc801' : mutedColor}
              />
              {likeCount > 0 && (
                <Text style={{ fontSize: 11, color: liked ? '#ffc801' : mutedColor, fontWeight: '600' }}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>

            {/* Reply action — only on top-level comments */}
            {!isReply && (
              <TouchableOpacity onPress={() => onReply(comment)}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: mutedColor }}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Nested replies */}
      {!isReply && comment.replies?.length > 0 && (
        <View>
          {/* Toggle replies */}
          <TouchableOpacity
            onPress={() => setShowReplies(p => !p)}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 62, marginBottom: 4 }}
          >
            <View style={{ width: 24, height: 0.5, backgroundColor: mutedColor, marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: mutedColor }}>
              {showReplies
                ? 'Hide replies'
                : `View ${comment.replies.length} repl${comment.replies.length > 1 ? 'ies' : 'y'}`}
            </Text>
          </TouchableOpacity>

          {showReplies && comment.replies.map(reply => (
            <CommentRow
              key={String(reply.id)}
              comment={reply}
              isReply
              isDark={isDark}
              textColor={textColor}
              mutedColor={mutedColor}
              token={token}
              onReply={() => {}}
              currentUserId={currentUserId}
              onOpenMenu={onOpenMenu}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── CommentsModal ────────────────────────────────────────────────────────────

export default function CommentsModal({ visible, postId, onClose, onCommentCountChange }) {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [comments, setComments]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending]     = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, name }
  const [editingComment, setEditingComment] = useState(null); // { id, parent_id }
  const [menuComment, setMenuComment] = useState(null); // comment object

  const flatListRef = useRef(null);
  const inputRef    = useRef(null);

  const bgColor     = isDark ? '#1c1c1c' : '#ffffff';
  const handleColor = isDark ? '#444'    : '#d0cdc8';
  const borderColor = isDark ? '#2e2e2e' : '#e8e5e0';
  const textColor   = isDark ? '#f5f5f5' : '#111111';
  const mutedColor  = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const inputBg     = isDark ? '#2a2a2a' : '#f3f2ef';

  const myAvatarUrl = resolveAvatarUrl(user?.avatar || user?.image || user?.profile_picture);
  const myInitial   = (user?.name || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    if (visible && postId) fetchComments();
  }, [visible, postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await API.get(`mobile/posts/${postId}/comments`, token);
      if (res?.data?.comments) setComments(sortByNewestFirst(res.data.comments));
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  };

  const syncRealCount = async () => {
    if (!onCommentCountChange) return;
    try {
      const res = await API.get(`mobile/posts/${postId}/comments-count`, token);
      const real = res?.data?.comments_count;
      if (typeof real === 'number' && !Number.isNaN(real)) {
        // Send as an absolute set by using a special payload object
        onCommentCountChange({ set: real });
      }
    } catch {
      // ignore — we keep optimistic count
    }
  };

  const handleReply = (comment) => {
    setReplyingTo({ id: comment.id, name: comment.user?.name || 'User' });
    inputRef.current?.focus();
  };

  const cancelReply = () => setReplyingTo(null);
  const cancelEdit = () => {
    setEditingComment(null);
    setInputText('');
  };

  const openMenu = (comment) => setMenuComment(comment);
  const closeMenu = () => setMenuComment(null);

  const startEdit = () => {
    if (!menuComment) return;
    setEditingComment({ id: menuComment.id, parent_id: menuComment.parent_id ?? null });
    setReplyingTo(null);
    setInputText(menuComment.body || '');
    closeMenu();
    inputRef.current?.focus();
  };

  const deleteFromState = (commentId, parentId) => {
    if (parentId) {
      setComments(prev =>
        prev.map(c =>
          c.id === parentId
            ? { ...c, replies: (c.replies || []).filter(r => r.id !== commentId) }
            : c
        )
      );
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  const handleDelete = async () => {
    if (!menuComment) return;
    const commentId = menuComment.id;
    const parentId = menuComment.parent_id ?? null;
    const deletedCount = parentId ? 1 : (1 + (menuComment.replies?.length || 0));
    closeMenu();

    // Optimistic remove
    deleteFromState(commentId, parentId);
    if (onCommentCountChange) onCommentCountChange(-deletedCount);

    try {
      await API.remove(`mobile/comments/${commentId}`, token);
      await syncRealCount();
    } catch {
      if (onCommentCountChange) onCommentCountChange(deletedCount);
      // Re-fetch on failure to restore correct state
      fetchComments();
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    // Editing flow
    if (editingComment) {
      const editId = editingComment.id;
      const editParentId = editingComment.parent_id ?? null;
      setEditingComment(null);

      // Optimistic update in state
      if (editParentId) {
        setComments(prev =>
          prev.map(c =>
            c.id === editParentId
              ? { ...c, replies: (c.replies || []).map(r => r.id === editId ? { ...r, body: text } : r) }
              : c
          )
        );
      } else {
        setComments(prev => prev.map(c => c.id === editId ? { ...c, body: text } : c));
      }

      try {
        const res = await API.put(`mobile/comments/${editId}`, token, { comment: text });
        if (res?.data?.comment) {
          const saved = res.data.comment;
          const pid = saved.parent_id ?? null;
          if (pid) {
            setComments(prev =>
              prev.map(c =>
                c.id === pid
                  ? { ...c, replies: (c.replies || []).map(r => r.id === saved.id ? saved : r) }
                  : c
              )
            );
          } else {
            setComments(prev => prev.map(c => c.id === saved.id ? saved : c));
          }
        }
      } catch {
        fetchComments();
      } finally {
        setSending(false);
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      parent_id: replyingTo?.id ?? null,
      body: text,
      created_at: new Date().toISOString(),
      likes_count: 0,
      is_liked_by_user: false,
      replies: [],
      user: { id: user?.id, name: user?.name || 'You', avatar: user?.avatar || user?.image || null },
    };

    if (replyingTo) {
      // Append reply optimistically inside the parent
      setComments(prev =>
        prev.map(c =>
          c.id === replyingTo.id
            ? { ...c, replies: [tempComment, ...(c.replies || [])] }
            : c
        )
      );
    } else {
      setComments(prev => [tempComment, ...prev]);
    }

    const parentId = replyingTo?.id ?? null;
    setReplyingTo(null);

    try {
      const res = await API.post(
        `mobile/posts/${postId}/comments`,
        { comment: text, parent_id: parentId },
        token
      );
      if (res?.data?.comment) {
        const saved = res.data.comment;
        if (parentId) {
          setComments(prev =>
            prev.map(c =>
              c.id === parentId
                ? {
                  ...c,
                  replies: sortByNewestFirst(
                    (c.replies || []).map(r => r.id === tempId ? saved : r)
                  ),
                }
                : c
            )
          );
        } else {
          setComments(prev => sortByNewestFirst(prev.map(c => c.id === tempId ? saved : c)));
        }
        if (onCommentCountChange) onCommentCountChange(1);
        await syncRealCount();
      }
    } catch {
      // Revert
      if (parentId) {
        setComments(prev =>
          prev.map(c =>
            c.id === parentId
              ? { ...c, replies: (c.replies || []).filter(r => r.id !== tempId) }
              : c
          )
        );
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setComments([]);
    setInputText('');
    setReplyingTo(null);
    setEditingComment(null);
    setMenuComment(null);
    onClose();
  };

  const canSend = inputText.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        {/* Dim overlay */}
        <Pressable
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 1,
          }}
          onPress={handleClose}
        />

        {/* Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '78%',
            backgroundColor: bgColor,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
            zIndex: 2,
            elevation: 2,
          }}
        >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: handleColor }} />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 0.5, borderBottomColor: borderColor,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>Comments</Text>
          <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={mutedColor} />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        {loading ? (
          <View style={{ flex: 1, paddingTop: 10 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View key={idx} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
                <Skeleton width={36} height={36} borderRadius={18} isDark={isDark} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                    <Skeleton width="100%" height={54} borderRadius={14} isDark={isDark} />
                  </View>
                  <View style={{ height: 10 }} />
                  <Skeleton width={120} height={10} borderRadius={10} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                isDark={isDark}
                textColor={textColor}
                mutedColor={mutedColor}
                token={token}
                onReply={handleReply}
                currentUserId={user?.id}
                onOpenMenu={openMenu}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={mutedColor} />
                <Text style={{ color: mutedColor, marginTop: 10, fontSize: 14 }}>
                  No comments yet. Be the first!
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          />
        )}

        {/* Editing / Replying banner */}
        {editingComment ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingVertical: 7,
              backgroundColor: isDark ? '#252525' : '#f7f5f1',
              borderTopWidth: 0.5, borderTopColor: borderColor,
            }}
          >
            <Text style={{ fontSize: 12, color: mutedColor }}>
              Editing comment
            </Text>
            <TouchableOpacity onPress={cancelEdit}>
              <Ionicons name="close-circle" size={18} color={mutedColor} />
            </TouchableOpacity>
          </View>
        ) : replyingTo ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingVertical: 7,
              backgroundColor: isDark ? '#252525' : '#f7f5f1',
              borderTopWidth: 0.5, borderTopColor: borderColor,
            }}
          >
            <Text style={{ fontSize: 12, color: mutedColor }}>
              Replying to{' '}
              <Text style={{ fontWeight: '700', color: '#ffc801' }}>{replyingTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close-circle" size={18} color={mutedColor} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Comment menu (Edit/Delete) */}
        {menuComment ? (
          <Modal transparent animationType="fade" visible={!!menuComment} onRequestClose={closeMenu}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={closeMenu} />
            <View
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 24,
                backgroundColor: bgColor,
                borderRadius: 16,
                borderWidth: 0.5,
                borderColor,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={startEdit}
                style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Ionicons name="pencil" size={18} color={textColor} />
                <Text style={{ color: textColor, fontWeight: '700' }}>Edit</Text>
              </Pressable>
              <View style={{ height: 0.5, backgroundColor: borderColor }} />
              <Pressable
                onPress={handleDelete}
                style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Ionicons name="trash" size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '800' }}>Delete</Text>
              </Pressable>
              <View style={{ height: 8, backgroundColor: 'transparent' }} />
              <Pressable onPress={closeMenu} style={{ paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' }}>
                <Text style={{ color: mutedColor, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
            </View>
          </Modal>
        ) : null}

        {/* Input bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 10,
            borderTopWidth: replyingTo ? 0 : 0.5,
            borderTopColor: borderColor,
            gap: 10,
          }}
        >
          {/* My avatar */}
          <View
            style={{
              width: 36, height: 36, borderRadius: 18,
              borderWidth: 1.5, borderColor: '#ffc801',
              overflow: 'hidden', flexShrink: 0,
              backgroundColor: isDark ? '#2a2a2a' : '#e9e5df',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {myAvatarUrl ? (
              <Image
                source={{ uri: myAvatarUrl }}
                defaultSource={require('@/assets/images/icon.png')}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : (
              <Text style={{ fontWeight: '800', fontSize: 14, color: isDark ? '#fff' : '#111' }}>
                {myInitial}
              </Text>
            )}
          </View>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              replyingTo ? `Reply to ${replyingTo.name}…` : `Comment as ${user?.name || 'you'}…`
            }
            placeholderTextColor={mutedColor}
            style={{
              flex: 1,
              backgroundColor: inputBg,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === 'ios' ? 9 : 7,
              fontSize: 14,
              color: textColor,
              maxHeight: 100,
            }}
            multiline
            returnKeyType="default"
          />

          {/* Send button (use touch-down to avoid "first tap dismisses keyboard") */}
          <Pressable
            onTouchStart={() => {
              if (canSend && !sending) handleSend();
            }}
            disabled={!canSend || sending}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: canSend ? '#ffc801' : (isDark ? '#2a2a2a' : '#e5e5e5'),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {sending ? (
              <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
            ) : (
              <Ionicons name="send" size={16} color={canSend ? '#000' : mutedColor} />
            )}
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
