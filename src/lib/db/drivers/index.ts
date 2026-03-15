import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
} from "@/lib/schemas";
import { createPostgresDriver } from "./postgres";
import { createMysqlDriver } from "./mysql";
import { createSqliteDriver } from "./sqlite";

export interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  introspect(): Promise<DatabaseSchema>;
  testConnection(): Promise<{ success: boolean; error?: string }>;
}

export function createDriver(config: ConnectionConfig): DatabaseDriver {
  switch (config.type) {
    case "postgresql":
      return createPostgresDriver(config);
    case "mysql":
      return createMysqlDriver(config);
    case "sqlite":
      return createSqliteDriver(config);
  }
}
