import { z } from "zod";

// ── Database Connection ──────────────────────────────────────────────

export const dbTypeSchema = z.enum(["postgresql", "mysql", "sqlite", "mongodb"]);
export type DbType = z.infer<typeof dbTypeSchema>;

export const connectionConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("postgresql"),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(5432),
    database: z.string().min(1),
    user: z.string().default(""),
    password: z.string().default(""),
    ssl: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("mysql"),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(3306),
    database: z.string().min(1),
    user: z.string().default(""),
    password: z.string().default(""),
    ssl: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("sqlite"),
    path: z.string().min(1),
  }),
  z.object({
    type: z.literal("mongodb"),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(27017),
    database: z.string().min(1),
    user: z.string().default(""),
    password: z.string().default(""),
    authSource: z.string().default("admin"),
    ssl: z.boolean().default(false),
  }),
]);

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(100),
  config: connectionConfigSchema,
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

// ── Stored Connection ────────────────────────────────────────────────

export interface StoredConnection {
  id: string;
  name: string;
  type: DbType;
  config_encrypted: string;
  created_at: string;
  updated_at: string;
}

// ── Schema Introspection ─────────────────────────────────────────────

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
}

export interface ForeignKeyInfo {
  column: string;
  references_table: string;
  references_column: string;
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
  foreign_keys: ForeignKeyInfo[];
  row_count?: number;
}

export interface DatabaseSchema {
  tables: TableInfo[];
  database_name: string;
  database_type: DbType;
}

// ── Query ────────────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  execution_time_ms: number;
  affected_rows?: number;
}

// ── Chat ─────────────────────────────────────────────────────────────

export interface Chat {
  id: string;
  connection_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_invocations?: string; // JSON string of tool calls/results
  created_at: string;
}

// ── Settings ─────────────────────────────────────────────────────────

export interface AppSettings {
  api_key_encrypted: string | null;
  safety_mode: boolean;
  theme: "dark" | "light" | "system";
}

export const updateSettingsSchema = z.object({
  api_key: z.string().optional(),
  safety_mode: z.boolean().optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
