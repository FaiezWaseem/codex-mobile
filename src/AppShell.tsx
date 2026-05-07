import { AppNavigator } from './navigation/AppNavigator';
import { useAppTheme } from './theme/ThemeProvider';
import type { AppTheme } from './theme/tokens';

export function AppShell({ theme }: { theme: AppTheme }) {
  const { mode, setMode } = useAppTheme();

  return <AppNavigator theme={theme} mode={mode} setMode={setMode} />;
}
