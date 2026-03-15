import type { DatabaseSchema } from "@/lib/schemas";

export function buildSystemPrompt(
  schema: DatabaseSchema,
  safetyMode: boolean
): string {
  const schemaText = schema.tables
    .map((table) => {
      const cols = table.columns
        .map((c) => {
          const parts = [`  ${c.name} ${c.type}`];
          if (c.is_primary_key) parts.push("PRIMARY KEY");
          if (!c.nullable) parts.push("NOT NULL");
          if (c.default_value) parts.push(`DEFAULT ${c.default_value}`);
          return parts.join(" ");
        })
        .join("\n");

      const fks =
        table.foreign_keys.length > 0
          ? "\n  -- Foreign Keys:\n" +
            table.foreign_keys
              .map(
                (fk) =>
                  `  -- ${fk.column} → ${fk.references_table}(${fk.references_column})`
              )
              .join("\n")
          : "";

      const rowInfo =
        table.row_count !== undefined
          ? ` (~${table.row_count.toLocaleString()} rows)`
          : "";

      const schemaPrefix = table.schema ? `${table.schema}.` : "";

      return `${schemaPrefix}${table.name}${rowInfo}\n${cols}${fks}`;
    })
    .join("\n\n");

  const safetyNotice = safetyMode
    ? `
⚠️ SAFETY MODE IS ON — READ-ONLY
You MUST NOT generate any SQL that modifies data or schema:
- No INSERT, UPDATE, DELETE, MERGE, UPSERT
- No CREATE, ALTER, DROP, TRUNCATE
- No GRANT, REVOKE
Only SELECT, EXPLAIN, and SHOW/DESCRIBE/PRAGMA queries are allowed.
If the user asks to modify data, explain that safety mode is enabled and they need to disable it in settings.`
    : `
Write mode is enabled. You can generate INSERT, UPDATE, DELETE and other modification queries when the user requests them. Always confirm destructive operations before executing.`;

  return `You are Seshat, a database assistant. You help users explore and query their database using natural language.

## Database
Type: ${schema.database_type}
Name: ${schema.database_name}
${safetyNotice}

## Schema
${schemaText}

## Guidelines
1. Write correct SQL for ${schema.database_type}. Use the exact column names and types from the schema above.
2. When the user asks a question about their data, write and execute a SQL query to answer it.
3. Present query results in a clear, readable format. Use markdown tables for small results.
4. For large result sets, summarize key findings and show representative rows.
5. If a query fails, explain the error and suggest a fix.
6. When suggesting query optimizations, explain WHY the optimization helps.
7. For ambiguous questions, ask for clarification rather than guessing.
8. Always use parameterized queries or proper escaping to prevent SQL injection.
9. When generating sample data, make it realistic and consistent with foreign key relationships.
10. Limit SELECT queries to 100 rows by default unless the user asks for more.`;
}
