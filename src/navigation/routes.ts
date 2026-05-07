import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const routeNames = {
  config: 'Config',
  home: 'Home',
  tasks: 'Tasks',
  taskDetail: 'TaskDetail',
  settings: 'Settings',
} as const;

type RouteTuple<T extends keyof RootStackParamList> = RootStackParamList[T] extends undefined
  ? readonly [T]
  : readonly [T, RootStackParamList[T]];

export const appRoutes = {
  config: (required = false): RouteTuple<'Config'> => [routeNames.config, { required }],
  home: (sessionId?: string): RouteTuple<'Home'> =>
    [routeNames.home, sessionId === undefined ? undefined : { sessionId }],
  tasks: (): RouteTuple<'Tasks'> => [routeNames.tasks],
  taskDetail: (taskId: string): RouteTuple<'TaskDetail'> => [
    routeNames.taskDetail,
    { taskId },
  ],
  settings: (): RouteTuple<'Settings'> => [routeNames.settings],
};

export function navigateTo<T extends keyof RootStackParamList>(
  navigation: NavigationProp<RootStackParamList>,
  route: RouteTuple<T>,
) {
  (navigation.navigate as (...args: readonly unknown[]) => void)(...route);
}
