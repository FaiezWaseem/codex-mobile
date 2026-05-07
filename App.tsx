import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppConfigProvider } from './src/config/AppConfigProvider';
import { AppShell } from './src/AppShell';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

function Root() {
  const { theme, resolvedScheme } = useAppTheme();

  return (
    <>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <AppShell theme={theme} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppConfigProvider>
          <SafeAreaProvider>
            <Root />
          </SafeAreaProvider>
        </AppConfigProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
