import API from '@/api';

function isAbsoluteUrl(value) {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

function normalizeStoragePath(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// Resolves a user avatar/image value to an absolute URL.
export function resolveAvatarUrl(avatarOrImage) {
  if (!avatarOrImage || typeof avatarOrImage !== 'string') return null;

  const value = avatarOrImage.trim();
  if (!value) return null;
  if (isAbsoluteUrl(value)) return value;

  // Accept values like "/storage/..." or "storage/..."
  if (value.includes('storage/')) {
    return `${API.APP_URL}${normalizeStoragePath(value)}`;
  }

  // Default mobile convention: public storage profile folder
  return `${API.APP_URL}/storage/img/profile/${value}`;
}

// Resolves a user's cover image to an absolute URL.
export function resolveCoverUrl(coverValue) {
  if (!coverValue || typeof coverValue !== 'string') return null;
  const value = coverValue.trim();
  if (!value) return null;

  if (isAbsoluteUrl(value)) return value;

  // Accept values like "/storage/..." or "storage/..."
  if (value.includes('/storage/') || value.startsWith('storage/')) {
    return `${API.APP_URL}${normalizeStoragePath(value)}`;
  }

  // If backend stores only the filename, assume the default cover folder.
  // (Backend convention: /storage/img/cover/<filename>)
  if (!value.includes('/')) {
    return `${API.APP_URL}/storage/img/cover/${value}`;
  }

  // Otherwise treat as "public storage relative path" (Laravel: /storage/<path>)
  const cleanRelative = value.replace(/^\/+/, '');
  return `${API.APP_URL}/storage/${cleanRelative}`;
}

// Resolves a post media/image value (or post object) to an absolute URL.
export function resolvePostMediaUrl(postOrValue) {
  const candidate =
    typeof postOrValue === 'string'
      ? postOrValue
      : postOrValue?.image ||
        postOrValue?.image_url ||
        postOrValue?.postImage ||
        postOrValue?.media?.url ||
        (Array.isArray(postOrValue?.images) ? postOrValue.images[0] : null);

  if (!candidate || typeof candidate !== 'string') return null;
  const value = candidate.trim();
  if (!value) return null;

  if (isAbsoluteUrl(value)) return value;

  if (value.includes('storage/')) {
    return `${API.APP_URL}${normalizeStoragePath(value)}`;
  }

  // Default mobile convention: public storage posts folder
  return `${API.APP_URL}/storage/img/posts/${value}`;
}

// Normalizes a user's roles to lowercase strings (handles array or single string).
export function getUserRolesNormalized(user) {
  if (!user?.roles) return [];
  if (Array.isArray(user.roles)) {
    return user.roles.map((r) =>
      typeof r === 'string' ? r.toLowerCase() : String(r).toLowerCase()
    );
  }
  const single = user.roles;
  return [typeof single === 'string' ? single.toLowerCase() : String(single).toLowerCase()];
}

// True when the viewer may see other users' email addresses (admin only).
export function userHasAdminRole(user) {
  return getUserRolesNormalized(user).includes('admin');
}

/** Raw array from GET mobile/posts/saved (or similar) response */
export function parseSavedPostsFromApiResponse(res) {
  const raw =
    res?.data?.posts ??
    res?.data?.data ??
    res?.data ??
    [];
  return Array.isArray(raw) ? raw : [];
}

/** Normalize one saved post for feed UI (matches profile saved-posts tab). */
export function normalizeSavedPost(post) {
  if (!post || typeof post !== 'object') return null;

  const body =
    post?.body ??
    post?.content ??
    post?.text ??
    post?.caption ??
    post?.description ??
    post?.message ??
    post?.post_body ??
    post?.postBody ??
    null;

  const author = post?.user ?? post?.author ?? null;
  const authorAvatar = author?.avatar || post?.user_avatar || post?.author_avatar;
  const authorImage = author?.image || post?.user_image || post?.author_image;

  const avatarUrl = resolveAvatarUrl(authorAvatar || authorImage);
  const mediaUrl = resolvePostMediaUrl(post);

  return {
    ...post,
    body,
    user: author
      ? {
          ...author,
          avatar: avatarUrl,
          image: authorImage ?? author?.image ?? null,
        }
      : post?.user,
    userAvatar: avatarUrl,
    postImage: mediaUrl,
    image: mediaUrl,
    is_saved_by_user: post?.is_saved_by_user ?? true,
  };
}

export function normalizeSavedPostsList(list) {
  return (Array.isArray(list) ? list : [])
    .filter(Boolean)
    .map(normalizeSavedPost)
    .filter(Boolean);
}

