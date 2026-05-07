import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const routeNames = {
  home: 'Home',
  tasks: 'Tasks',
  taskDetail: 'TaskDetail',
  settings: 'Settings',
} as const;

type RouteTuple<T extends keyof RootStackParamList> = RootStackParamList[T] extends undefined
  ? readonly [T]
  : readonly [T, RootStackParamList[T]];

export const appRoutes = {
  home: (): RouteTuple<'Home'> => [routeNames.home],
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
