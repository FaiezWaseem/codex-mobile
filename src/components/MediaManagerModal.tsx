import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AppTheme } from '../theme/tokens';

type RelayMediaItem = {
  id?: string;
  fileName?: string;
  name?: string;
  contentType?: string;
  mimeType?: string;
  downloadUrl?: string;
  fileUrl?: string;
  uri?: string;
  previewUrl?: string;
  createdAt?: string;
};

type RelayDirectoryResponse<T> = {
  items?: T[];
  data?: T[];
  media?: T[];
};

function buildRelayUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const relayBaseUrl = normalizedBaseUrl.endsWith('/v1')
    ? normalizedBaseUrl.slice(0, -3)
    : normalizedBaseUrl;

  return `${relayBaseUrl}${path}`;
}

function getRelayItems<T>(payload: RelayDirectoryResponse<T> | T[] | null | undefined): T[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.media || payload.items || payload.data || [];
}

export function MediaManagerModal({
  visible,
  theme,
  baseUrl,
  bearerToken,
  onClose,
  onSelectMedia,
  onUploadNew,
}: {
  visible: boolean;
  theme: AppTheme;
  baseUrl: string;
  bearerToken: string;
  onClose: () => void;
  onSelectMedia: (media: RelayMediaItem) => void;
  onUploadNew: () => void | Promise<void>;
}) {
  const [mediaItems, setMediaItems] = useState<RelayMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMediaItems = useCallback(async () => {
    if (!visible) {
      return;
    }

    if (!baseUrl.trim() || !bearerToken.trim()) {
      setError('Relay is not configured.');
      setMediaItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestUrl = buildRelayUrl(baseUrl, '/v1/media');
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Media request failed (${response.status})`);
      }

      const payload = (await response.json()) as RelayDirectoryResponse<RelayMediaItem> | RelayMediaItem[];
      setMediaItems(getRelayItems(payload));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load media right now.');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, bearerToken, visible]);

  useEffect(() => {
    if (visible) {
      void loadMediaItems();
    }
  }, [loadMediaItems, visible]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadMediaItems();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMediaItems]);

  const handleDelete = useCallback(async (mediaId: string) => {
    setDeletingId(mediaId);

    try {
      const response = await fetch(buildRelayUrl(baseUrl, `/v1/media/${encodeURIComponent(mediaId)}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Delete request failed (${response.status})`);
      }

      setMediaItems((current) => current.filter((item) => item.id !== mediaId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to delete media right now.');
    } finally {
      setDeletingId(null);
    }
  }, [baseUrl, bearerToken]);

  const sortedMedia = useMemo(
    () =>
      [...mediaItems].sort((left, right) =>
        String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
      ),
    [mediaItems],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.colors.text }]}>Media</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Select an existing file or upload a new one
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
            >
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => void onUploadNew()}
            style={[
              styles.uploadButton,
              {
                backgroundColor: theme.colors.primary,
              },
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Upload New</Text>
          </Pressable>

          {error ? (
            <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>{error}</Text>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          >
            {isLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
                  Loading media...
                </Text>
              </View>
            ) : sortedMedia.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No media found</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  Upload a new file or refresh to check again.
                </Text>
              </View>
            ) : (
              sortedMedia.map((media) => {
                const mediaId = media.id || media.fileName || media.name || '';
                const mediaUri =
                  media.downloadUrl ||
                  media.uri ||
                  buildRelayUrl(baseUrl, `/v1/media/${encodeURIComponent(mediaId)}/file`);
                const isImage = (media.contentType || media.mimeType || '').startsWith('image/');

                return (
                  <View
                    key={mediaId}
                    style={[
                      styles.mediaCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.mediaCardMain}
                      onPress={() => {
                        onSelectMedia(media);
                        onClose();
                      }}
                    >
                      {isImage ? (
                        <Image
                          source={{
                            uri: mediaUri,
                            headers: {
                              Authorization: `Bearer ${bearerToken}`,
                            },
                          }}
                          style={styles.mediaPreview}
                        />
                      ) : (
                        <View
                          style={[
                            styles.mediaPreviewFallback,
                            { backgroundColor: theme.colors.surfaceMuted },
                          ]}
                        >
                          <Ionicons name="document-outline" size={20} color={theme.colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.mediaMeta}>
                        <Text numberOfLines={1} style={[styles.mediaName, { color: theme.colors.text }]}>
                          {media.fileName || media.name || media.id || 'Untitled media'}
                        </Text>
                        <Text style={[styles.mediaInfo, { color: theme.colors.textMuted }]}>
                          {media.contentType || media.mimeType || 'Unknown type'}
                        </Text>
                        {media.id ? (
                          <Text numberOfLines={1} style={[styles.mediaInfo, { color: theme.colors.primary }]}>
                            {media.id}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {media.id ? (
                      <Pressable
                        onPress={() => void handleDelete(media.id!)}
                        style={[
                          styles.deleteButton,
                          { backgroundColor: theme.colors.surfaceMuted },
                        ]}
                      >
                        {deletingId === media.id ? (
                          <ActivityIndicator size="small" color={theme.colors.textMuted} />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    minHeight: '62%',
    maxHeight: '82%',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  centerState: {
    alignItems: 'center',
    paddingTop: 28,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  mediaCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediaCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mediaPreview: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#00000010',
  },
  mediaPreviewFallback: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMeta: {
    flex: 1,
    gap: 4,
  },
  mediaName: {
    fontSize: 15,
    fontWeight: '700',
  },
  mediaInfo: {
    fontSize: 12,
    lineHeight: 16,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
