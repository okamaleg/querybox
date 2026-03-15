import { tool } from "ai";
import { z } from "zod";
import { createDriver } from "@/lib/db/drivers";
import { validateSQL } from "./validator";
import type { ConnectionConfig } from "@/lib/schemas";

export function createDatabaseTools(
  config: ConnectionConfig,
  safetyMode: boolean
) {
  const driver = createDriver(config);

  return {
    run_sql_query: tool({
      description:
        "Execute a SQL query against the connected database and return the results. Use this to answer questions about the user's data.",
      parameters: z.object({
        sql: z.string().describe("The SQL query to execute"),
        explanation: z
          .string()
          .describe(
            "Brief explanation of what this query does and why you're running it"
          ),
      }),
      execute: async ({ sql, explanation }) => {
        const validation = validateSQL(sql, safetyMode);

        if (!validation.allowed) {
          return {
            success: false,
            error: validation.reason,
            sql,
            explanation,
          };
        }

        try {
          await driver.connect();
          const result = await driver.query(sql);
          await driver.disconnect();

          return {
            success: true,
            sql,
            explanation,
            columns: result.columns,
            rows: result.rows.slice(0, 200), // Cap at 200 rows for context
            row_count: result.row_count,
            execution_time_ms: result.execution_time_ms,
            affected_rows: result.affected_rows,
            truncated: result.row_count > 200,
          };
        } catch (e) {
          await driver.disconnect().catch(() => {});
          return {
            success: false,
            error: e instanceof Error ? e.message : "Query execution failed",
            sql,
            explanation,
          };
        }
      },
    }),

    explain_query: tool({
      description:
        "Get the execution plan for a SQL query using EXPLAIN/EXPLAIN ANALYZE. Use this to help the user understand or optimize their queries.",
      parameters: z.object({
        sql: z.string().describe("The SQL query to explain"),
      }),
      execute: async ({ sql }) => {
        try {
          await driver.connect();

          let explainSQL: string;
          switch (config.type) {
            case "postgresql":
              explainSQL = `EXPLAIN (FORMAT TEXT, ANALYZE false) ${sql}`;
              break;
            case "mysql":
              explainSQL = `EXPLAIN ${sql}`;
              break;
            case "sqlite":
              explainSQL = `EXPLAIN QUERY PLAN ${sql}`;
              break;
          }

          const result = await driver.query(explainSQL);
          await driver.disconnect();

          return {
            success: true,
            plan: result.rows,
            original_sql: sql,
          };
        } catch (e) {
          await driver.disconnect().catch(() => {});
          return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to explain query",
            original_sql: sql,
          };
        }
      },
    }),

    get_table_sample: tool({
      description:
        "Get a sample of rows from a specific table. Useful to understand data patterns and content before writing more complex queries.",
      parameters: z.object({
        table_name: z
          .string()
          .describe("The table to sample from"),
        limit: z
          .number()
          .default(5)
          .describe("Number of sample rows (default 5)"),
      }),
      execute: async ({ table_name, limit }) => {
        // Basic table name validation (alphanumeric, underscores, dots for schema-qualified)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(table_name)) {
          return {
            success: false,
            error: "Invalid table name",
          };
        }

        try {
          await driver.connect();
          const safeLimit = Math.min(Math.max(1, limit), 50);
          const result = await driver.query(
            `SELECT * FROM ${table_name} LIMIT ${safeLimit}`
          );
          await driver.disconnect();

          return {
            success: true,
            table: table_name,
            columns: result.columns,
            rows: result.rows,
            row_count: result.row_count,
          };
        } catch (e) {
          await driver.disconnect().catch(() => {});
          return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to sample table",
            table: table_name,
          };
        }
      },
    }),
  };
}
