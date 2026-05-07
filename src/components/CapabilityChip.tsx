import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function CapabilityChip({
  theme,
  icon,
  label,
}: {
  theme: AppTheme;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View
      style={[
        styles.capabilityChip,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.colors.textMuted} />
      <Text style={[styles.capabilityText, { color: theme.colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  capabilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  capabilityText: {
    fontSize: 18,
    fontWeight: '500',
  },
});
