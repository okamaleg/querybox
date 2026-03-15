import Database from "better-sqlite3";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
} from "@/lib/schemas";
import type { DatabaseDriver } from "./index";

type SqliteConfig = Extract<ConnectionConfig, { type: "sqlite" }>;

export function createSqliteDriver(config: SqliteConfig): DatabaseDriver {
  let db: Database.Database | null = null;

  return {
    async connect() {
      db = new Database(config.path, { readonly: false });
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
    },

    async disconnect() {
      if (db) {
        db.close();
        db = null;
      }
    },

    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
      if (!db) await this.connect();
      const start = Date.now();

      const trimmed = sql.trim().toUpperCase();
      const isSelect =
        trimmed.startsWith("SELECT") ||
        trimmed.startsWith("PRAGMA") ||
        trimmed.startsWith("EXPLAIN") ||
        trimmed.startsWith("WITH");

      if (isSelect) {
        const rows = db!.prepare(sql).all(...(params || [])) as Record<
          string,
          unknown
        >[];
        const executionTime = Date.now() - start;
        const columns =
          rows.length > 0 ? Object.keys(rows[0]) : [];

        return {
          columns,
          rows,
          row_count: rows.length,
          execution_time_ms: executionTime,
        };
      } else {
        const result = db!.prepare(sql).run(...(params || []));
        const executionTime = Date.now() - start;

        return {
          columns: [],
          rows: [],
          row_count: 0,
          execution_time_ms: executionTime,
          affected_rows: result.changes,
        };
      }
    },

    async testConnection() {
      try {
        await this.connect();
        db!.prepare("SELECT 1").get();
        await this.disconnect();
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    },

    async introspect(): Promise<DatabaseSchema> {
      if (!db) await this.connect();

      const tablesRows = db!
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`
        )
        .all() as { name: string }[];

      const tables: TableInfo[] = [];

      for (const tableRow of tablesRows) {
        const tableName = tableRow.name;

        // Get columns via PRAGMA
        const colRows = db!
          .prepare(`PRAGMA table_info("${tableName}")`)
          .all() as {
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }[];

        const columns: ColumnInfo[] = colRows.map((col) => ({
          name: col.name,
          type: col.type || "TEXT",
          nullable: col.notnull === 0,
          default_value: col.dflt_value,
          is_primary_key: col.pk > 0,
        }));

        // Get foreign keys
        const fkRows = db!
          .prepare(`PRAGMA foreign_key_list("${tableName}")`)
          .all() as {
          table: string;
          from: string;
          to: string;
        }[];

        const foreignKeys: ForeignKeyInfo[] = fkRows.map((fk) => ({
          column: fk.from,
          references_table: fk.table,
          references_column: fk.to,
        }));

        // Get row count
        const countRow = db!
          .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
          .get() as { count: number };

        tables.push({
          name: tableName,
          columns,
          foreign_keys: foreignKeys,
          row_count: countRow.count,
        });
      }

      // Extract database name from path
      const dbName = config.path.split("/").pop()?.replace(/\.db$/, "") || "sqlite";

      return {
        tables,
        database_name: dbName,
        database_type: "sqlite",
      };
    },
  };
}
