import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useMockChat } from '../hooks/useMockChat';
import { tasks } from '../data/mock';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TasksScreen } from '../screens/TasksScreen';
import type { ThemeMode } from '../types';
import type { AppTheme } from '../theme/tokens';
import { createNavigationTheme } from './navigationTheme';
import { appRoutes, navigateTo, routeNames } from './routes';
import type { RootScreenProps, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigatorProps = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

function HomeRoute({
  navigation,
  theme,
}: RootScreenProps<'Home'> & {
  theme: AppTheme;
}) {
  const chat = useMockChat({
    assistantName: 'Codex',
    systemPrompt: 'the mobile assistant home screen',
  });

  return (
    <HomeScreen
      theme={theme}
      onOpenTasks={() => navigateTo(navigation, appRoutes.tasks())}
      onOpenSettings={() => navigateTo(navigation, appRoutes.settings())}
      input={chat.input}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      onChangeInput={chat.setInput}
      onSendMessage={chat.sendMessage}
    />
  );
}

function TasksRoute({
  navigation,
  theme,
}: RootScreenProps<'Tasks'> & {
  theme: AppTheme;
}) {
  return (
    <TasksScreen
      theme={theme}
      onOpenTask={(taskId) => navigateTo(navigation, appRoutes.taskDetail(taskId))}
      onOpenHome={() => navigateTo(navigation, appRoutes.home())}
      onOpenSettings={() => navigateTo(navigation, appRoutes.settings())}
    />
  );
}

function TaskDetailRoute({
  navigation,
  route,
  theme,
}: RootScreenProps<'TaskDetail'> & {
  theme: AppTheme;
}) {
  const activeTask = tasks.find((item) => item.id === route.params.taskId) ?? tasks[0];
  const chat = useMockChat({
    assistantName: 'Codex',
    systemPrompt: activeTask.title,
    initialMessages: [
      {
        id: `assistant-seed-${activeTask.id}`,
        role: 'assistant',
        content: `I am ready to continue "${activeTask.title}". Ask for a plan, revision, or implementation detail and I will stream back a dummy reply.`,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  return (
    <TaskDetailScreen
      theme={theme}
      task={activeTask}
      onBack={() => navigation.goBack()}
      input={chat.input}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      onChangeInput={chat.setInput}
      onSendMessage={chat.sendMessage}
    />
  );
}

function SettingsRoute({
  navigation,
  theme,
  mode,
  setMode,
}: RootScreenProps<'Settings'> & NavigatorProps) {
  return (
    <SettingsScreen
      theme={theme}
      mode={mode}
      onSetMode={setMode}
      onClose={() => navigation.goBack()}
    />
  );
}

export function AppNavigator({ theme, mode, setMode }: NavigatorProps) {
  const navigationTheme = useMemo(() => createNavigationTheme(theme), [theme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={routeNames.home}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name={routeNames.home}>
          {(props) => <HomeRoute {...props} theme={theme} />}
        </Stack.Screen>
        <Stack.Screen name={routeNames.tasks}>
          {(props) => <TasksRoute {...props} theme={theme} />}
        </Stack.Screen>
        <Stack.Screen name={routeNames.taskDetail}>
          {(props) => <TaskDetailRoute {...props} theme={theme} />}
        </Stack.Screen>
        <Stack.Screen
          name={routeNames.settings}
          options={{
            presentation: 'transparentModal',
            animation: 'fade_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          {(props) => (
            <SettingsRoute
              {...props}
              theme={theme}
              mode={mode}
              setMode={setMode}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
