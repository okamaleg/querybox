import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt } from "../crypto.js";
import type {
  StoredConnection,
  ConnectionConfig,
  Chat,
  ChatMessage,
  AppSettings,
} from "../schemas.js";

let db: Database.Database | null = null;

function getDbPath(): string {
  const dir =
    process.env.QUERYBOX_USER_DATA ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || ".",
      ".querybox"
    );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return path.join(dir, "querybox.db");
}

export function getAppDb(): Database.Database {
  if (db) return db;

  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('postgresql', 'mysql', 'sqlite', 'mongodb')),
      config_encrypted TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      tool_invocations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('safety_mode', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
  `);

  return db;
}

// ── Connections ──────────────────────────────────────────────────────

export function createConnection(
  name: string,
  config: ConnectionConfig
): StoredConnection {
  const d = getAppDb();
  const id = uuidv4();
  const configEncrypted = encrypt(JSON.stringify(config));

  d.prepare(
    `INSERT INTO connections (id, name, type, config_encrypted) VALUES (?, ?, ?, ?)`
  ).run(id, name, config.type, configEncrypted);

  return d
    .prepare(`SELECT * FROM connections WHERE id = ?`)
    .get(id) as StoredConnection;
}

export function getConnections(): StoredConnection[] {
  const d = getAppDb();
  return d
    .prepare(`SELECT * FROM connections ORDER BY updated_at DESC`)
    .all() as StoredConnection[];
}

export function getConnection(id: string): StoredConnection | undefined {
  const d = getAppDb();
  return d
    .prepare(`SELECT * FROM connections WHERE id = ?`)
    .get(id) as StoredConnection | undefined;
}

export function getConnectionConfig(id: string): ConnectionConfig | null {
  const conn = getConnection(id);
  if (!conn) return null;
  return JSON.parse(decrypt(conn.config_encrypted)) as ConnectionConfig;
}

export function updateConnection(
  id: string,
  name: string,
  config: ConnectionConfig
): StoredConnection | null {
  const d = getAppDb();
  const configEncrypted = encrypt(JSON.stringify(config));

  const result = d
    .prepare(
      `UPDATE connections SET name = ?, type = ?, config_encrypted = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(name, config.type, configEncrypted, id);

  if (result.changes === 0) return null;
  return getConnection(id) || null;
}

export function deleteConnection(id: string): boolean {
  const d = getAppDb();
  const result = d.prepare(`DELETE FROM connections WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ── Chats ────────────────────────────────────────────────────────────

export function createChat(connectionId: string, title = "New Chat"): Chat {
  const d = getAppDb();
  const id = uuidv4();

  d.prepare(
    `INSERT INTO chats (id, connection_id, title) VALUES (?, ?, ?)`
  ).run(id, connectionId, title);

  return d.prepare(`SELECT * FROM chats WHERE id = ?`).get(id) as Chat;
}

export function getChats(connectionId: string): Chat[] {
  const d = getAppDb();
  return d
    .prepare(
      `SELECT * FROM chats WHERE connection_id = ? ORDER BY updated_at DESC`
    )
    .all(connectionId) as Chat[];
}

export function getChat(id: string): Chat | undefined {
  const d = getAppDb();
  return d.prepare(`SELECT * FROM chats WHERE id = ?`).get(id) as
    | Chat
    | undefined;
}

export function updateChatTitle(id: string, title: string): void {
  const d = getAppDb();
  d.prepare(
    `UPDATE chats SET title = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, id);
}

export function deleteChat(id: string): boolean {
  const d = getAppDb();
  const result = d.prepare(`DELETE FROM chats WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ── Messages ─────────────────────────────────────────────────────────

export function addMessage(
  chatId: string,
  role: "user" | "assistant" | "system",
  content: string,
  toolInvocations?: unknown
): ChatMessage {
  const d = getAppDb();
  const id = uuidv4();

  d.prepare(
    `INSERT INTO messages (id, chat_id, role, content, tool_invocations) VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    chatId,
    role,
    content,
    toolInvocations ? JSON.stringify(toolInvocations) : null
  );

  d.prepare(
    `UPDATE chats SET updated_at = datetime('now') WHERE id = ?`
  ).run(chatId);

  return d
    .prepare(`SELECT * FROM messages WHERE id = ?`)
    .get(id) as ChatMessage;
}

export function getMessages(chatId: string): ChatMessage[] {
  const d = getAppDb();
  return d
    .prepare(
      `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`
    )
    .all(chatId) as ChatMessage[];
}

// ── Settings ─────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const d = getAppDb();
  const row = d
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const d = getAppDb();
  d.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`
  ).run(key, value, value);
}

export function getAppSettings(): AppSettings {
  return {
    api_key_encrypted: getSetting("api_key"),
    safety_mode: getSetting("safety_mode") !== "false",
    theme: (getSetting("theme") as AppSettings["theme"]) || "dark",
  };
}

export function getApiKey(): string | null {
  const encrypted = getSetting("api_key");
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  setSetting("api_key", encrypt(key));
}
