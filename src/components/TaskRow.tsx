import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function TaskRow({
  theme,
  title,
  meta,
  updatedAt,
  onPress,
}: {
  theme: AppTheme;
  title: string;
  meta: string;
  updatedAt: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.taskRow}>
      <View style={[styles.taskIcon, { backgroundColor: theme.colors.surfaceElevated }]}>
        <Ionicons name="code-slash-outline" size={24} color={theme.colors.text} />
      </View>
      <View style={styles.taskInfo}>
        <Text numberOfLines={1} style={[styles.taskTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.taskMeta, { color: theme.colors.textMuted }]}>
          {meta}
        </Text>
      </View>
      <Text style={[styles.taskTime, { color: theme.colors.textMuted }]}>{updatedAt}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D7D3CD',
  },
  taskIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 3,
  },
  taskMeta: {
    fontSize: 13,
  },
  taskTime: {
    fontSize: 13,
    marginLeft: 10,
  },
});
