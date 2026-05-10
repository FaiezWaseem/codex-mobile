export type ThemeMode = 'system' | 'light' | 'dark';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type AgentConfig = {
  baseUrl: string;
  bearerToken: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

export type WorkspaceMode = 'MTC' | 'Code';

export type Capability = {
  id: string;
  label: string;
  icon: string;
};

export type ChatRole = 'user' | 'assistant';

export type ChatAttachment = {
  id: string;
  type: 'image';
  uri: string;
  relayUrl?: string;
  previewUri?: string;
  mimeType?: string;
  fileName?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  streaming?: boolean;
  error?: boolean;
};

export type ChatSessionSummary = {
  sessionId: string;
  title: string;
  updatedAt: string;
  category: string;
};

export type ChatSessionBackup = {
  sessionId: string;
  pendingJobId: string | null;
  messages: ChatMessage[];
};

export type ChatExportBundle = {
  version: 1;
  exportedAt: string;
  app: 'codex-mobile';
  sessions: ChatSessionBackup[];
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
