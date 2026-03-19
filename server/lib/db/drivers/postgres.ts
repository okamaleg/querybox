import { Pool } from "pg";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
} from "../../schemas.js";
import type { DatabaseDriver } from "./index.js";

type PostgresConfig = Extract<ConnectionConfig, { type: "postgresql" }>;

export function createPostgresDriver(config: PostgresConfig): DatabaseDriver {
  let pool: Pool | null = null;

  return {
    async connect() {
      pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
      });
    },

    async disconnect() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
      if (!pool) await this.connect();
      const start = Date.now();
      const result = await pool!.query(sql, params);
      const executionTime = Date.now() - start;

      const rows = result.rows || [];
      const columns = result.fields?.map((f) => f.name) || [];

      return {
        columns,
        rows,
        row_count: rows.length,
        execution_time_ms: executionTime,
        affected_rows: result.rowCount ?? undefined,
      };
    },

    async testConnection() {
      try {
        await this.connect();
        await pool!.query("SELECT 1");
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
      if (!pool) await this.connect();

      const tablesResult = await pool!.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

      const tables: TableInfo[] = [];

      for (const row of tablesResult.rows) {
        const colsResult = await pool!.query(
          `
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
              AND tc.table_schema = ku.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = $1
              AND tc.table_schema = $2
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_name = $1 AND c.table_schema = $2
          ORDER BY c.ordinal_position
          `,
          [row.table_name, row.table_schema]
        );

        const columns: ColumnInfo[] = colsResult.rows.map((c) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === "YES",
          default_value: c.column_default ?? null,
          is_primary_key: c.is_primary_key === true,
        }));

        const fkResult = await pool!.query(
          `
          SELECT
            kcu.column_name,
            ccu.table_name AS references_table,
            ccu.column_name AS references_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
            AND tc.table_schema = $2
          `,
          [row.table_name, row.table_schema]
        );

        const foreign_keys: ForeignKeyInfo[] = fkResult.rows.map((fk) => ({
          column: fk.column_name,
          references_table: fk.references_table,
          references_column: fk.references_column,
        }));

        const countResult = await pool!.query(
          `SELECT COUNT(*) as count FROM "${row.table_schema}"."${row.table_name}"`
        );
        const row_count = parseInt(countResult.rows[0]?.count ?? "0", 10);

        tables.push({
          name: row.table_name,
          schema: row.table_schema !== "public" ? row.table_schema : undefined,
          columns,
          foreign_keys,
          row_count,
        });
      }

      return {
        tables,
        database_name: config.database,
        database_type: "postgresql",
      };
    },
  };
}
