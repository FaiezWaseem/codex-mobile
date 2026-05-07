import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskRow } from '../components';
import { profile } from '../data/mock';
import { listTaskSessions } from '../storage/chatDb';
import type { AppTheme } from '../theme/tokens';
import type { ChatSessionSummary } from '../types';

export function TasksScreen({
  theme,
  onOpenTask,
  onOpenHome,
  onStartNewChat,
  onOpenSettings,
}: {
  theme: AppTheme;
  onOpenTask: (taskId: string) => void;
  onOpenHome: (sessionId?: string) => void;
  onStartNewChat: () => void | Promise<void>;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
});
