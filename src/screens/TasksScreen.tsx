import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskRow } from '../components';
import { profile } from '../data/mock';
import { deleteChatSession, listTaskSessions } from '../storage/chatDb';
import type { AppTheme } from '../theme/tokens';
import type { ChatSessionSummary } from '../types';

export function TasksScreen({
  baseUrl,
  bearerToken,
  theme,
  onOpenTask,
  onOpenHome,
  onStartNewChat,
  onOpenSettings,
}: {
  baseUrl: string;
  bearerToken: string;
  theme: AppTheme;
  onOpenTask: (taskId: string) => void;
  onOpenHome: (sessionId?: string) => void;
  onStartNewChat: () => void | Promise<void>;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const snapPoints = useMemo(() => ['34%'], []);

  const loadSessions = useCallback(async () => {
    const nextSessions = await listTaskSessions();
    setSessions(nextSessions);
    setHasLoaded(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadSessions();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSessions]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return sessions;
    }

    return sessions.filter((task) =>
      [task.title, task.category].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [query, sessions]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={0.48}
      />
    ),
    [],
  );

  const openDeleteSheet = useCallback((session: ChatSessionSummary) => {
    setSelectedSession(session);
    setDeleteError(null);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const closeDeleteSheet = useCallback(() => {
    if (isDeleting) {
      return;
    }

    bottomSheetRef.current?.close();
  }, [isDeleting]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1 && !isDeleting) {
      setSelectedSession(null);
      setDeleteError(null);
    }
  }, [isDeleting]);

  const deleteRemoteSession = useCallback(async (sessionId: string) => {
    if (!baseUrl.trim() || !bearerToken.trim()) {
      return;
    }

    async function runDelete() {
      return fetch(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });
    }

    let response = await runDelete();

    if (response.status === 404) {
      return;
    }

    if (response.status === 409) {
      const interruptResponse = await fetch(
        `${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/interrupt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      );

      if (!interruptResponse.ok) {
        throw new Error(`Interrupt request failed (${interruptResponse.status})`);
      }

      response = await runDelete();

      if (response.status === 404) {
        return;
      }
    }

    if (!response.ok) {
      throw new Error(`Delete request failed (${response.status})`);
    }
  }, [baseUrl, bearerToken]);

  const confirmDelete = useCallback(async () => {
    if (!selectedSession || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteRemoteSession(selectedSession.sessionId);
      await deleteChatSession(selectedSession.sessionId);
      await loadSessions();
      bottomSheetRef.current?.close();
      setSelectedSession(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Unable to delete this chat right now.',
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRemoteSession, isDeleting, loadSessions, selectedSession]);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressViewOffset={8}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.heading, { color: theme.colors.text }]}>All tasks</Text>
          </View>
          <Pressable onPress={onOpenSettings}>
            <Image source={{ uri: profile.avatar }} style={styles.headerAvatar} />
          </Pressable>
        </View>

        <View
          style={[
            styles.searchShell,
            {
              backgroundColor: theme.colors.input,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
        </View>

        <View style={styles.listWrap}>
          <Text style={[styles.refreshHint, { color: theme.colors.textMuted }]}>
            Pull down to refresh your saved threads
          </Text>
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.sessionId}
              theme={theme}
              title={task.title}
              meta={task.category}
              updatedAt={task.updatedAt}
              onLongPress={() => openDeleteSheet(task)}
              onPress={() =>
                !task.sessionId.startsWith('task-')
                  ? onOpenHome(task.sessionId)
                  : onOpenTask(task.sessionId.replace(/^task-/, ''))
              }
            />
          ))}
          {hasLoaded && filteredTasks.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {query.trim()
                ? 'No saved chats match your search.'
                : 'No saved chats yet. Start a conversation and it will appear here.'}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={onStartNewChat}
        style={[
          styles.fab,
          {
            backgroundColor: theme.colors.primary,
            shadowColor: theme.colors.shadow,
            bottom: Math.max(22, insets.bottom + 14),
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={21} color="#FFFFFF" />
      </Pressable>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        animateOnMount
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: theme.colors.border }]}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.background }]}
        bottomInset={insets.bottom}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Delete chat?</Text>
          <Text style={[styles.sheetBody, { color: theme.colors.textMuted }]}>
            {selectedSession
              ? `Delete "${selectedSession.title}" from saved chats? This removes the local thread and clears the relay session for this chat.`
              : 'Delete this saved chat?'}
          </Text>
          {deleteError ? (
            <Text style={[styles.sheetError, { color: theme.colors.primary }]}>
              {deleteError}
            </Text>
          ) : null}
          <View style={styles.sheetActions}>
            <Pressable
              onPress={closeDeleteSheet}
              disabled={isDeleting}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void confirmDelete()}
              disabled={isDeleting}
              style={[
                styles.deleteButton,
                { backgroundColor: isDeleting ? theme.colors.surfaceMuted : '#C94B4B' },
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  headerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  searchShell: {
    marginTop: 22,
    marginHorizontal: 30,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  listWrap: {
    paddingHorizontal: 30,
    paddingTop: 28,
  },
  refreshHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 18,
  },
  fab: {
    position: 'absolute',
    right: 22,
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5,
  },
  sheetHandle: {
    width: 72,
    height: 8,
    borderRadius: 999,
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  sheetBody: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  sheetError: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
