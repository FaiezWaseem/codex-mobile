import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function IconButton({
  theme,
  icon,
  onPress,
}: {
  theme: AppTheme;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <Ionicons name={icon} size={26} color={theme.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
});
