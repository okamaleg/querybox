import mysql from "mysql2/promise";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
} from "../../schemas.js";
import type { DatabaseDriver } from "./index.js";

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

      const rowsArr = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
      const columns = Array.isArray(fields)
        ? (fields as mysql.FieldPacket[]).map((f) => f.name)
        : [];

      return {
        columns,
        rows: rowsArr,
        row_count: rowsArr.length,
        execution_time_ms: executionTime,
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

        const [colRows] = await connection!.query(
          `SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            c.COLUMN_KEY
          FROM information_schema.COLUMNS c
          WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
          ORDER BY c.ORDINAL_POSITION`,
          [config.database, tableName]
        );

        const columns: ColumnInfo[] = (colRows as {
          COLUMN_NAME: string;
          DATA_TYPE: string;
          IS_NULLABLE: string;
          COLUMN_DEFAULT: string | null;
          COLUMN_KEY: string;
        }[]).map((c) => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          default_value: c.COLUMN_DEFAULT ?? null,
          is_primary_key: c.COLUMN_KEY === "PRI",
        }));

        const [fkRows] = await connection!.query(
          `SELECT
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE kcu
          JOIN information_schema.TABLE_CONSTRAINTS tc
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
            AND kcu.TABLE_SCHEMA = ?
            AND kcu.TABLE_NAME = ?`,
          [config.database, tableName]
        );

        const foreign_keys: ForeignKeyInfo[] = (fkRows as {
          COLUMN_NAME: string;
          REFERENCED_TABLE_NAME: string;
          REFERENCED_COLUMN_NAME: string;
        }[]).map((fk) => ({
          column: fk.COLUMN_NAME,
          references_table: fk.REFERENCED_TABLE_NAME,
          references_column: fk.REFERENCED_COLUMN_NAME,
        }));

        const [countRows] = await connection!.query(
          `SELECT COUNT(*) as count FROM \`${tableName}\``
        );
        const row_count = parseInt(
          String((countRows as { count: number }[])[0]?.count ?? 0),
          10
        );

        tables.push({
          name: tableName,
          columns,
          foreign_keys,
          row_count,
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
