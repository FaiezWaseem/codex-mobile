import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskRow } from '../components';
import { profile, tasks } from '../data/mock';
import type { AppTheme } from '../theme/tokens';

export function TasksScreen({
  theme,
  onOpenTask,
  onOpenHome,
  onOpenSettings,
}: {
  theme: AppTheme;
  onOpenTask: (taskId: string) => void;
  onOpenHome: () => void;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return tasks;
    }

    return tasks.filter((task) =>
      [task.title, task.category, task.workspace].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [query]);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              theme={theme}
              title={task.title}
              category={task.category}
              updatedAt={task.updatedAt}
              onPress={() => onOpenTask(task.id)}
            />
          ))}
          {filteredTasks.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No tasks match your search.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={onOpenHome}
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
