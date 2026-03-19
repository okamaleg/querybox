import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
} from "../../schemas.js";
import { createPostgresDriver } from "./postgres.js";
import { createMysqlDriver } from "./mysql.js";
import { createSqliteDriver } from "./sqlite.js";
import { createMongoDriver } from "./mongodb.js";

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
    case "mongodb":
      return createMongoDriver(config);
  }
}
