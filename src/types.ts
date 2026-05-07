export type ThemeMode = 'system' | 'light' | 'dark';

export type AgentConfig = {
  baseUrl: string;
  bearerToken: string;
  model?: string;
};

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
  error?: boolean;
};

export type ChatSessionSummary = {
  sessionId: string;
  title: string;
  updatedAt: string;
  category: string;
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
