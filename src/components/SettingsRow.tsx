import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function SettingsRow({
  theme,
  label,
  value,
}: {
  theme: AppTheme;
  label: string;
  value?: string;
}) {
  return (
    <View
      style={[
        styles.settingsRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.settingsValue}>
        {value ? (
          <Text style={[styles.settingsHint, { color: theme.colors.textMuted }]}>{value}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 20,
    marginBottom: 12,
    
  },
  settingsLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  settingsValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsHint: {
    fontSize: 18,
  },
});
