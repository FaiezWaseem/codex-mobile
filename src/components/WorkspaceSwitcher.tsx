import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function WorkspaceSwitcher({
  theme,
  active,
  onChange,
}: {
  theme: AppTheme;
  active: 'MTC' | 'Code';
  onChange: (value: 'MTC' | 'Code') => void;
}) {
  return (
    <View style={[styles.switcherShell, { backgroundColor: theme.colors.surfaceMuted }]}>
      {(['MTC', 'Code'] as const).map((item) => {
        const selected = active === item;

        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[
              styles.switcherItem,
              selected && {
                backgroundColor: theme.colors.surface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Text
              style={[
                styles.switcherLabel,
                { color: selected ? theme.colors.text : theme.colors.textMuted },
              ]}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switcherShell: {
    flexDirection: 'row',
    alignSelf: 'center',
    padding: 6,
    borderRadius: 999,
    width: 282,
  },
  switcherItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 14,
  },
  switcherLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
});
