import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function Screen({
  theme,
  children,
}: {
  theme: AppTheme;
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 36 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
