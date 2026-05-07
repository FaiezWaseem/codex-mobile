export type ThemeMode = 'system' | 'light' | 'dark';

export type WorkspaceMode = 'MTC' | 'Code';

export type Capability = {
  id: string;
  label: string;
  icon: string;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
};

export type TaskStatus = 'draft' | 'in-progress' | 'done';

export type Task = {
  id: string;
  title: string;
  workspace: WorkspaceMode;
  category: string;
  status: TaskStatus;
  updatedAt: string;
  prompt: string;
  duration: string;
  summary: string[];
};
