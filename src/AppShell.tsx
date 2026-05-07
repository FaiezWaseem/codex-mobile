import { useAppConfig } from './config/AppConfigProvider';
import { AppNavigator } from './navigation/AppNavigator';
import { useAppTheme } from './theme/ThemeProvider';
import type { AppTheme } from './theme/tokens';

export function AppShell({ theme }: { theme: AppTheme }) {
  const { mode, setMode } = useAppTheme();
  const { config, hasConfig, isReady, saveConfig } = useAppConfig();

  return (
    <AppNavigator
      theme={theme}
      mode={mode}
      setMode={setMode}
      config={config}
      hasConfig={hasConfig}
      isReady={isReady}
      saveConfig={saveConfig}
    />
  );
}
