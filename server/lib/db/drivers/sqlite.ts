import Database from "better-sqlite3";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
} from "../../schemas.js";
import type { DatabaseDriver } from "./index.js";

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

    async query(sql: string, _params?: unknown[]): Promise<QueryResult> {
      if (!db) await this.connect();
      const start = Date.now();

      const stmt = db!.prepare(sql);
      let rows: Record<string, unknown>[] = [];
      let affected_rows: number | undefined;

      if (stmt.reader) {
        rows = stmt.all() as Record<string, unknown>[];
      } else {
        const info = stmt.run();
        affected_rows = info.changes;
      }

      const executionTime = Date.now() - start;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        columns,
        rows,
        row_count: rows.length,
        execution_time_ms: executionTime,
        affected_rows,
      };
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

        const colRows = db!
          .prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`)
          .all() as {
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          }[];

        const columns: ColumnInfo[] = colRows.map((c) => ({
          name: c.name,
          type: c.type || "TEXT",
          nullable: c.notnull === 0,
          default_value: c.dflt_value ?? null,
          is_primary_key: c.pk > 0,
        }));

        const fkRows = db!
          .prepare(`PRAGMA foreign_key_list(${JSON.stringify(tableName)})`)
          .all() as {
            id: number;
            seq: number;
            table: string;
            from: string;
            to: string;
          }[];

        const foreign_keys: ForeignKeyInfo[] = fkRows.map((fk) => ({
          column: fk.from,
          references_table: fk.table,
          references_column: fk.to,
        }));

        const countRow = db!
          .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
          .get() as { count: number };

        tables.push({
          name: tableName,
          columns,
          foreign_keys,
          row_count: countRow.count,
        });
      }

      const dbName =
        config.path.split("/").pop()?.replace(/\.db$/, "") || "sqlite";

      return {
        tables,
        database_name: dbName,
        database_type: "sqlite",
      };
    },
  };
}
