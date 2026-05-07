import * as SQLite from 'expo-sqlite';
import type { ChatMessage, ChatSessionSummary } from '../types';

const DATABASE_NAME = 'codex-chat.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

type ChatMessageRow = {
  id: string;
  role: ChatMessage['role'];
  content: string;
  attachments_json: string | null;
  created_at: string;
  streaming: number;
  error: number;
  position: number;
};

type SessionRow = {
  session_id: string;
  updated_at: string;
};

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  const db = await databasePromise;

  if (!initPromise) {
    initPromise = (async () => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          attachments_json TEXT,
          created_at TEXT NOT NULL,
          streaming INTEGER NOT NULL DEFAULT 0,
          error INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_position
        ON chat_messages (session_id, position);
      `);

      const columns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(chat_messages)`,
      );

      if (!columns.some((column) => column.name === 'attachments_json')) {
        await db.execAsync(`
          ALTER TABLE chat_messages
          ADD COLUMN attachments_json TEXT;
        `);
      }
    })();
  }

  await initPromise;
  return db;
}

export async function loadChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ChatMessageRow>(
    `
      SELECT id, role, content, attachments_json, created_at, streaming, error, position
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY position ASC
    `,
    sessionId,
  );

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    attachments: row.attachments_json
      ? (JSON.parse(row.attachments_json) as ChatMessage['attachments'])
      : undefined,
    createdAt: row.created_at,
    streaming: Boolean(row.streaming),
    error: Boolean(row.error),
  }));
}

export async function saveChatMessages(sessionId: string, messages: ChatMessage[]) {
  const db = await getDatabase();

  await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', sessionId);

  for (const [position, message] of messages.entries()) {
    await db.runAsync(
      `
        INSERT INTO chat_messages (
          id,
          session_id,
          role,
          content,
          attachments_json,
          created_at,
          streaming,
          error,
          position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      message.id,
      sessionId,
      message.role,
      message.content,
      message.attachments ? JSON.stringify(message.attachments) : null,
      message.createdAt,
      message.streaming ? 1 : 0,
      message.error ? 1 : 0,
      position,
    );
  }
}

export async function deleteChatSession(sessionId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', sessionId);
}

function normalizeSessionTitle(sessionId: string, messages: ChatMessage[]) {
  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim().length > 0,
  );
  const fallbackMessage = messages.find((message) => message.content.trim().length > 0);
  const rawTitle = (firstUserMessage?.content || fallbackMessage?.content || sessionId).trim();
  const singleLineTitle = rawTitle.replace(/\s+/g, ' ');

  if (singleLineTitle.length <= 44) {
    return singleLineTitle;
  }

  return `${singleLineTitle.slice(0, 41).trimEnd()}...`;
}

function formatSessionTimestamp(isoTimestamp: string) {
  const timestamp = new Date(isoTimestamp);

  if (Number.isNaN(timestamp.getTime())) {
    return 'Recently updated';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);
  const timeLabel = timestamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays <= 0) {
    return `Today ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `Yesterday ${timeLabel}`;
  }

  return timestamp.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export async function listTaskSessions(): Promise<ChatSessionSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `
      SELECT session_id, MAX(created_at) AS updated_at
      FROM chat_messages
      GROUP BY session_id
      ORDER BY updated_at DESC
    `,
  );

  const summaries = await Promise.all(
    rows.map(async (row) => {
      const messages = await loadChatMessages(row.session_id);

      return {
        sessionId: row.session_id,
        title: normalizeSessionTitle(row.session_id, messages),
        updatedAt: formatSessionTimestamp(row.updated_at),
        category: row.session_id.startsWith('task-') ? 'Task thread' : 'Home chat',
      };
    }),
  );

  return summaries;
}
