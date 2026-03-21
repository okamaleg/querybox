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
        connectionTimeoutMillis: 5000,
        statement_timeout: 30000,
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

      // 1. Get all tables
      const tablesResult = await pool!.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

      if (tablesResult.rows.length === 0) {
        return { tables: [], database_name: config.database, database_type: "postgresql" };
      }

      // 2. Batch: all columns + primary key info in one query
      const allColumnsResult = await pool!.query(`
        SELECT
          c.table_name,
          c.table_schema,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.table_name, ku.table_schema, ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
            AND c.table_name = pk.table_name
            AND c.table_schema = pk.table_schema
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `);

      // 3. Batch: all foreign keys in one query
      const allFksResult = await pool!.query(`
        SELECT
          tc.table_name,
          tc.table_schema,
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
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      `);

      // 4. Approximate row counts from pg_stat (avoids COUNT(*) full scans)
      const countResult = await pool!.query(`
        SELECT schemaname, relname, n_live_tup::int as count
        FROM pg_stat_user_tables
      `);

      // Group results by table key
      const colsByTable = new Map<string, ColumnInfo[]>();
      for (const c of allColumnsResult.rows) {
        const key = `${c.table_schema}.${c.table_name}`;
        if (!colsByTable.has(key)) colsByTable.set(key, []);
        colsByTable.get(key)!.push({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === "YES",
          default_value: c.column_default ?? null,
          is_primary_key: c.is_primary_key === true,
        });
      }

      const fksByTable = new Map<string, ForeignKeyInfo[]>();
      for (const fk of allFksResult.rows) {
        const key = `${fk.table_schema}.${fk.table_name}`;
        if (!fksByTable.has(key)) fksByTable.set(key, []);
        fksByTable.get(key)!.push({
          column: fk.column_name,
          references_table: fk.references_table,
          references_column: fk.references_column,
        });
      }

      const countsByTable = new Map<string, number>();
      for (const row of countResult.rows) {
        countsByTable.set(`${row.schemaname}.${row.relname}`, row.count);
      }

      const tables: TableInfo[] = tablesResult.rows.map((row) => {
        const key = `${row.table_schema}.${row.table_name}`;
        return {
          name: row.table_name,
          schema: row.table_schema !== "public" ? row.table_schema : undefined,
          columns: colsByTable.get(key) ?? [],
          foreign_keys: fksByTable.get(key) ?? [],
          row_count: countsByTable.get(key) ?? 0,
        };
      });

      return {
        tables,
        database_name: config.database,
        database_type: "postgresql",
      };
    },
  };
}
