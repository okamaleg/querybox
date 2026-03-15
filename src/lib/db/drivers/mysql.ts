import mysql from "mysql2/promise";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
} from "@/lib/schemas";
import type { DatabaseDriver } from "./index";

type MysqlConfig = Extract<ConnectionConfig, { type: "mysql" }>;

export function createMysqlDriver(config: MysqlConfig): DatabaseDriver {
  let connection: mysql.Connection | null = null;

  return {
    async connect() {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? {} : undefined,
      });
    },

    async disconnect() {
      if (connection) {
        await connection.end();
        connection = null;
      }
    },

    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
      if (!connection) await this.connect();
      const start = Date.now();
      const [rows, fields] = await connection!.query(sql, params);
      const executionTime = Date.now() - start;

      const resultRows = Array.isArray(rows) ? rows : [];
      const columns = Array.isArray(fields)
        ? fields.map((f) => f.name)
        : [];

      return {
        columns,
        rows: resultRows as Record<string, unknown>[],
        row_count: resultRows.length,
        execution_time_ms: executionTime,
        affected_rows:
          !Array.isArray(rows) && "affectedRows" in (rows as object)
            ? (rows as { affectedRows: number }).affectedRows
            : undefined,
      };
    },

    async testConnection() {
      try {
        await this.connect();
        await connection!.query("SELECT 1");
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
      if (!connection) await this.connect();

      const [tablesRows] = await connection!.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [config.database]
      );

      const tables: TableInfo[] = [];

      for (const tableRow of tablesRows as { table_name: string }[]) {
        const tableName = tableRow.table_name;

        // Get columns
        const [colRows] = await connection!.query(
          `SELECT
            column_name, data_type, is_nullable, column_default, column_key
           FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ?
           ORDER BY ordinal_position`,
          [config.database, tableName]
        );

        const columns: ColumnInfo[] = (
          colRows as {
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
            column_key: string;
          }[]
        ).map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === "YES",
          default_value: col.column_default,
          is_primary_key: col.column_key === "PRI",
        }));

        // Get foreign keys
        const [fkRows] = await connection!.query(
          `SELECT
            column_name,
            referenced_table_name AS references_table,
            referenced_column_name AS references_column
           FROM information_schema.key_column_usage
           WHERE table_schema = ? AND table_name = ?
             AND referenced_table_name IS NOT NULL`,
          [config.database, tableName]
        );

        const foreignKeys: ForeignKeyInfo[] = (
          fkRows as {
            column_name: string;
            references_table: string;
            references_column: string;
          }[]
        ).map((fk) => ({
          column: fk.column_name,
          references_table: fk.references_table,
          references_column: fk.references_column,
        }));

        // Get row count
        const [countRows] = await connection!.query(
          `SELECT table_rows AS count FROM information_schema.tables
           WHERE table_schema = ? AND table_name = ?`,
          [config.database, tableName]
        );

        tables.push({
          name: tableName,
          columns,
          foreign_keys: foreignKeys,
          row_count: Number(
            (countRows as { count: number }[])[0]?.count
          ) || 0,
        });
      }

      return {
        tables,
        database_name: config.database,
        database_type: "mysql",
      };
    },
  };
}
