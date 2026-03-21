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
        connectTimeout: 5000,
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

      // 1. Get all tables
      const [tablesRows] = await connection!.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [config.database]
      );

      const tableNames = (tablesRows as { table_name: string }[]).map(
        (r) => r.table_name
      );

      if (tableNames.length === 0) {
        return { tables: [], database_name: config.database, database_type: "mysql" };
      }

      // 2. Batch: all columns in one query
      const [allColRows] = await connection!.query(
        `SELECT
          c.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.COLUMN_KEY
        FROM information_schema.COLUMNS c
        WHERE c.TABLE_SCHEMA = ?
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`,
        [config.database]
      );

      // 3. Batch: all foreign keys in one query
      const [allFkRows] = await connection!.query(
        `SELECT
          kcu.TABLE_NAME,
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.TABLE_CONSTRAINTS tc
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND kcu.TABLE_SCHEMA = ?`,
        [config.database]
      );

      // 4. Approximate row counts from information_schema (avoids COUNT(*) per table)
      const [countRows] = await connection!.query(
        `SELECT TABLE_NAME, TABLE_ROWS
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
        [config.database]
      );

      // Group results by table
      const colsByTable = new Map<string, ColumnInfo[]>();
      for (const c of allColRows as {
        TABLE_NAME: string;
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
        COLUMN_KEY: string;
      }[]) {
        if (!colsByTable.has(c.TABLE_NAME)) colsByTable.set(c.TABLE_NAME, []);
        colsByTable.get(c.TABLE_NAME)!.push({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          default_value: c.COLUMN_DEFAULT ?? null,
          is_primary_key: c.COLUMN_KEY === "PRI",
        });
      }

      const fksByTable = new Map<string, ForeignKeyInfo[]>();
      for (const fk of allFkRows as {
        TABLE_NAME: string;
        COLUMN_NAME: string;
        REFERENCED_TABLE_NAME: string;
        REFERENCED_COLUMN_NAME: string;
      }[]) {
        if (!fksByTable.has(fk.TABLE_NAME)) fksByTable.set(fk.TABLE_NAME, []);
        fksByTable.get(fk.TABLE_NAME)!.push({
          column: fk.COLUMN_NAME,
          references_table: fk.REFERENCED_TABLE_NAME,
          references_column: fk.REFERENCED_COLUMN_NAME,
        });
      }

      const countsByTable = new Map<string, number>();
      for (const row of countRows as { TABLE_NAME: string; TABLE_ROWS: number }[]) {
        countsByTable.set(row.TABLE_NAME, parseInt(String(row.TABLE_ROWS ?? 0), 10));
      }

      const tables: TableInfo[] = tableNames.map((name) => ({
        name,
        columns: colsByTable.get(name) ?? [],
        foreign_keys: fksByTable.get(name) ?? [],
        row_count: countsByTable.get(name) ?? 0,
      }));

      return {
        tables,
        database_name: config.database,
        database_type: "mysql",
      };
    },
  };
}
