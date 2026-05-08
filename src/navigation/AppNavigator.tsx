import { NavigationContainer, type NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { ConfigScreen } from '../screens/ConfigScreen';
import { useMemo } from 'react';
import { useRelayChat } from '../hooks/useRelayChat';
import { tasks } from '../data/mock';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TasksScreen } from '../screens/TasksScreen';
import type { AgentConfig, ThemeMode } from '../types';
import type { AppTheme } from '../theme/tokens';
import { createNavigationTheme } from './navigationTheme';
import { appRoutes, navigateTo, routeNames } from './routes';
import type { RootScreenProps, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigatorProps = {
  config: AgentConfig | null;
  hasConfig: boolean;
  isReady: boolean;
  saveConfig: (config: AgentConfig) => Promise<void>;
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

function safeGoBack(navigation: NavigationProp<RootStackParamList>) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  navigateTo(navigation, appRoutes.home());
}

function ConfigRoute({
  navigation,
  route,
  theme,
  config,
  saveConfig,
}: RootScreenProps<'Config'> &
  Pick<NavigatorProps, 'theme' | 'config' | 'saveConfig'>) {
  const required = route.params?.required ?? false;

  return (
    <ConfigScreen
      theme={theme}
      required={required}
      initialConfig={config}
      onSave={async (draft) => {
        await saveConfig(draft);

        if (required) {
          navigateTo(navigation, appRoutes.home());
          return;
        }

        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }

        navigateTo(navigation, appRoutes.home());
      }}
      onClose={required ? undefined : () => safeGoBack(navigation)}
    />
  );
}

function HomeRoute({
  navigation,
  route,
  config,
  saveConfig,
  theme,
}: RootScreenProps<'Home'> &
  Pick<NavigatorProps, 'theme' | 'config' | 'saveConfig'>) {
  const sessionId = route.params?.sessionId ?? 'home-chat';
  const chat = useRelayChat({
    assistantName: 'Codex',
    config: config!,
    sessionId,
    systemPrompt: 'the mobile assistant home screen',
  });

  return (
    <HomeScreen
      theme={theme}
      onOpenTasks={() => navigateTo(navigation, appRoutes.tasks())}
      onOpenSettings={() => navigateTo(navigation, appRoutes.settings())}
      input={chat.input}
      pendingAttachments={chat.pendingAttachments}
      bearerToken={config?.bearerToken || ''}
      selectedModel={config?.model || 'gpt-5.4-mini'}
      selectedReasoningEffort={config?.reasoningEffort || 'medium'}
      isRecordingAudio={chat.isRecordingAudio}
      isStreaming={chat.isStreaming}
      isTranscribingAudio={chat.isTranscribingAudio}
      messages={chat.messages}
      onChangeInput={chat.setInput}
      onSelectModel={(model) => void saveConfig({ ...config!, model })}
      onSelectReasoningEffort={(reasoningEffort) => void saveConfig({ ...config!, reasoningEffort })}
      onAddAttachment={chat.addImageAttachment}
      onRemoveAttachment={chat.removeAttachment}
      onToggleVoiceInput={chat.toggleVoiceInput}
      onSendMessage={chat.sendMessage}
      voiceDurationMillis={chat.voiceDurationMillis}
    />
  );
}

function TasksRoute({
  navigation,
  config,
  theme,
}: RootScreenProps<'Tasks'> & {
  config: AgentConfig | null;
  theme: AppTheme;
}) {
  return (
    <TasksScreen
      baseUrl={config?.baseUrl || ''}
      bearerToken={config?.bearerToken || ''}
      theme={theme}
      onOpenTask={(taskId) => navigateTo(navigation, appRoutes.taskDetail(taskId))}
      onOpenHome={(sessionId) => navigateTo(navigation, appRoutes.home(sessionId))}
      onStartNewChat={() => navigateTo(navigation, appRoutes.home(`home-chat-${Date.now()}`))}
      onOpenSettings={() => navigateTo(navigation, appRoutes.settings())}
    />
  );
}

function TaskDetailRoute({
  navigation,
  route,
  config,
  saveConfig,
  theme,
}: RootScreenProps<'TaskDetail'> &
  Pick<NavigatorProps, 'theme' | 'config' | 'saveConfig'>) {
  const activeTask = tasks.find((item) => item.id === route.params.taskId) ?? tasks[0];
  const chat = useRelayChat({
    assistantName: 'Codex',
    config: config!,
    systemPrompt: activeTask.title,
    sessionId: `task-${activeTask.id}`,
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
      pendingAttachments={chat.pendingAttachments}
      bearerToken={config?.bearerToken || ''}
      selectedModel={config?.model || 'gpt-5.4-mini'}
      selectedReasoningEffort={config?.reasoningEffort || 'medium'}
      isRecordingAudio={chat.isRecordingAudio}
      isStreaming={chat.isStreaming}
      isTranscribingAudio={chat.isTranscribingAudio}
      messages={chat.messages}
      onChangeInput={chat.setInput}
      onSelectModel={(model) => void saveConfig({ ...config!, model })}
      onSelectReasoningEffort={(reasoningEffort) => void saveConfig({ ...config!, reasoningEffort })}
      onAddAttachment={chat.addImageAttachment}
      onRemoveAttachment={chat.removeAttachment}
      onToggleVoiceInput={chat.toggleVoiceInput}
      onSendMessage={chat.sendMessage}
      voiceDurationMillis={chat.voiceDurationMillis}
    />
  );
}

function SettingsRoute({
  navigation,
  config,
  theme,
  mode,
  setMode,
}: RootScreenProps<'Settings'> &
  Pick<NavigatorProps, 'config' | 'theme' | 'mode' | 'setMode'>) {
  return (
    <SettingsScreen
      baseUrl={config?.baseUrl || ''}
      bearerToken={config?.bearerToken || ''}
      theme={theme}
      mode={mode}
      onOpenConfig={() => navigateTo(navigation, appRoutes.config(false))}
      onSetMode={setMode}
      onClose={() => safeGoBack(navigation)}
    />
  );
}

export function AppNavigator({
  theme,
  mode,
  setMode,
  config,
  hasConfig,
  isReady,
  saveConfig,
}: NavigatorProps) {
  const navigationTheme = useMemo(() => createNavigationTheme(theme), [theme]);

  if (!isReady) {
    return <SplashScreen theme={theme} />;
  }

  if (!hasConfig) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name={routeNames.config}
            initialParams={{ required: true }}
          >
            {(props) => (
              <ConfigRoute
                {...props}
                theme={theme}
                config={config}
                saveConfig={saveConfig}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

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
        <Stack.Screen name={routeNames.config}>
          {(props) => (
            <ConfigRoute {...props} theme={theme} config={config} saveConfig={saveConfig} />
          )}
        </Stack.Screen>
        <Stack.Screen name={routeNames.home}>
          {(props) => (
            <HomeRoute {...props} theme={theme} config={config} saveConfig={saveConfig} />
          )}
        </Stack.Screen>
        <Stack.Screen name={routeNames.tasks}>
          {(props) => <TasksRoute {...props} theme={theme} config={config} />}
        </Stack.Screen>
        <Stack.Screen name={routeNames.taskDetail}>
          {(props) => (
            <TaskDetailRoute
              {...props}
              theme={theme}
              config={config}
              saveConfig={saveConfig}
            />
          )}
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
              config={config}
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

const styles = StyleSheet.create({});
