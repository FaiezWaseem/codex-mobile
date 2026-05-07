import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Config: { required?: boolean } | undefined;
  Home: { resetToken?: number } | undefined;
  Tasks: undefined;
  TaskDetail: { taskId: string };
  Settings: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
