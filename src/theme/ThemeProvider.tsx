import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode } from '../types';
import { darkTheme, lightTheme } from './tokens';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedScheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  theme: typeof lightTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const resolvedScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const theme = resolvedScheme === 'dark' ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({
      mode,
      resolvedScheme,
      setMode,
      theme,
    }),
    [mode, resolvedScheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }

  return context;
}
