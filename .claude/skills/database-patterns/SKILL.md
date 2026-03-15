---
name: database-patterns
description: Database driver abstraction, schema introspection, query execution, and SQL optimization patterns for PostgreSQL, MySQL, and SQLite. Use when implementing database drivers, writing introspection queries, optimizing SQL, or handling cross-database compatibility.
---

# Database Patterns Best Practices

## Driver Abstraction Layer

### Unified Interface
```typescript
interface DatabaseDriver {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  introspectSchema(): Promise<DatabaseSchema>;
  executeQuery(sql: string): Promise<QueryResult>;
  isConnected(): boolean;
}
```

### Connection Lifecycle
- Create per-request, not pooled (serverless-friendly)
- Always disconnect in `finally` blocks
- Set connection timeout: 5 seconds max
- Set query timeout: 30 seconds max

```typescript
async function withDatabase<T>(
  config: ConnectionConfig,
  fn: (driver: DatabaseDriver) => Promise<T>
): Promise<T> {
  const driver = createDriver(config.type);
  try {
    await driver.connect(config);
    return await fn(driver);
  } finally {
    await driver.disconnect().catch(console.error);
  }
}
```

## Schema Introspection Queries

### PostgreSQL
```sql
-- Tables (exclude system schemas)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

-- Columns
SELECT column_name, data_type, udt_name, is_nullable,
       column_default, character_maximum_length, numeric_precision
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position;

-- Primary Keys
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = $1 AND tc.table_name = $2
  AND tc.constraint_type = 'PRIMARY KEY';

-- Foreign Keys
SELECT kcu.column_name, ccu.table_name AS ref_table,
       ccu.column_name AS ref_column, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = $1 AND tc.table_name = $2
  AND tc.constraint_type = 'FOREIGN KEY';

-- Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = $1 AND tablename = $2;

-- Row count estimate (fast, no full scan)
SELECT reltuples::bigint AS estimate
FROM pg_class WHERE relname = $1;
```

### MySQL
```sql
-- Tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';

-- Columns
SELECT column_name, column_type, is_nullable, column_default,
       column_key, extra, column_comment
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = ?
ORDER BY ordinal_position;

-- Primary Keys
SELECT column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND table_name = ?
  AND constraint_name = 'PRIMARY';

-- Foreign Keys
SELECT column_name, referenced_table_name, referenced_column_name,
       constraint_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND table_name = ?
  AND referenced_table_name IS NOT NULL;

-- Indexes: use SHOW INDEX FROM `table_name`
-- Group by Key_name, check Non_unique

-- Row count estimate
SELECT table_rows FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = ?;
```

### SQLite
```sql
-- Tables
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%';

-- Columns: PRAGMA table_info('table_name')
-- Returns: cid, name, type, notnull, dflt_value, pk

-- Foreign Keys: PRAGMA foreign_key_list('table_name')
-- Returns: id, seq, table, from, to, on_update, on_delete

-- Indexes: PRAGMA index_list('table_name')
-- Then: PRAGMA index_info('index_name') for columns

-- Row count: SELECT COUNT(*) FROM table_name
-- (SQLite has no stats estimate)
```

## Query Execution Best Practices

### Result Set Management
```typescript
async executeQuery(sql: string): Promise<QueryResult> {
  const start = performance.now();
  const result = await this.rawQuery(sql);
  const executionTimeMs = Math.round(performance.now() - start);

  const MAX_ROWS = 100;
  const truncated = result.rows.length > MAX_ROWS;
  const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;

  return {
    columns: result.fields.map(f => f.name),
    rows,
    rowCount: result.rows.length,
    executionTimeMs,
    truncated,
  };
}
```

### Type Handling Across Databases
Handle database-specific types consistently:

| Type | PostgreSQL | MySQL | SQLite | JS Output |
|------|-----------|-------|--------|-----------|
| Integer | int4, int8 | INT, BIGINT | INTEGER | `number` |
| Float | float8, numeric | DECIMAL, FLOAT | REAL | `number` |
| String | varchar, text | VARCHAR, TEXT | TEXT | `string` |
| Boolean | bool | TINYINT(1) | INTEGER | `boolean` |
| Date | date | DATE | TEXT | `string` (ISO) |
| DateTime | timestamp, timestamptz | DATETIME, TIMESTAMP | TEXT | `string` (ISO) |
| JSON | json, jsonb | JSON | TEXT | `object` (parsed) |
| NULL | NULL | NULL | NULL | `null` |

### BigInt Handling
PostgreSQL returns int8/bigint as strings to avoid JS precision loss:
```typescript
// Convert safely
function safeBigInt(value: string | number): number | string {
  const num = Number(value);
  if (Number.isSafeInteger(num)) return num;
  return value.toString(); // Keep as string if too large
}
```

## SQL Optimization Patterns for AI

### System Prompt Optimization Hints
Include in the AI system prompt:
```
When writing queries:
- Always use LIMIT (default 100) to prevent full table scans
- Use existing indexes — refer to the index list for each table
- For large tables (>100k rows), always filter with WHERE
- Prefer COUNT(*) over COUNT(column) unless checking for NULLs
- Use EXPLAIN before complex queries if the user asks about performance
- For PostgreSQL, use ILIKE for case-insensitive search
- For MySQL, use COLLATE for case-insensitive comparison
- For SQLite, use LIKE (case-insensitive by default for ASCII)
```

### Index Suggestion Pattern
```typescript
// AI tool for suggesting indexes
{
  name: "suggest_optimization",
  input_schema: {
    type: "object",
    properties: {
      original_sql: { type: "string" },
      optimized_sql: { type: "string" },
      explanation: { type: "string" },
      suggested_indexes: {
        type: "array",
        items: { type: "string" },
        description: "CREATE INDEX statements"
      }
    },
    required: ["original_sql", "optimized_sql", "explanation"]
  }
}
```

## Cross-Database Compatibility

### Dialect Differences to Handle
| Feature | PostgreSQL | MySQL | SQLite |
|---------|-----------|-------|--------|
| String concat | `\|\|` | `CONCAT()` | `\|\|` |
| LIMIT syntax | `LIMIT n OFFSET m` | `LIMIT m, n` or `LIMIT n OFFSET m` | `LIMIT n OFFSET m` |
| Boolean | `TRUE/FALSE` | `1/0` | `1/0` |
| Current time | `NOW()` | `NOW()` | `datetime('now')` |
| Auto increment | `SERIAL` / `GENERATED` | `AUTO_INCREMENT` | `AUTOINCREMENT` |
| Case sensitivity | Case-sensitive | Depends on collation | Case-insensitive for ASCII |
| JSON access | `->>` operator | `->>` or `JSON_EXTRACT` | `json_extract()` |

### The AI must know the dialect
Always pass `dbType` to the system prompt builder so Claude generates correct SQL for the target database.

## Error Recovery

### Common Errors and AI Handling
- **Column not found**: AI should check schema and suggest correct column name
- **Table not found**: AI should list available tables
- **Syntax error**: AI should fix and retry
- **Permission denied**: Show user-friendly message about database user privileges
- **Connection lost**: Auto-reconnect and retry once
- **Timeout**: Suggest adding LIMIT or WHERE to narrow results

### Retry Logic
```typescript
async function executeWithRetry(
  driver: DatabaseDriver,
  sql: string,
  maxRetries = 1
): Promise<QueryResult> {
  try {
    return await driver.executeQuery(sql);
  } catch (error) {
    if (maxRetries > 0 && isTransientError(error)) {
      await driver.disconnect();
      await driver.connect(config);
      return executeWithRetry(driver, sql, maxRetries - 1);
    }
    throw error;
  }
}

function isTransientError(error: unknown): boolean {
  const msg = String(error);
  return msg.includes("ECONNRESET") ||
         msg.includes("connection terminated") ||
         msg.includes("Connection lost");
}
```
