---
name: security-hardening
description: Security best practices for Next.js apps handling database credentials, SQL execution, and sensitive data. Covers OWASP Top 10, credential encryption, SQL injection prevention, XSS, CSP, and input validation. Use when writing code that handles user input, database operations, credentials, or authentication.
---

# Security Hardening Best Practices

## OWASP Top 10 Prevention

### 1. SQL Injection Prevention
Since this app executes AI-generated SQL, defense-in-depth is critical:

**Layer 1 — AI System Prompt**: Instruct Claude to generate safe SQL
**Layer 2 — Server-Side Validation**: Parse and validate SQL before execution
**Layer 3 — Database-Level Restrictions**: Use read-only transactions in safety mode

```typescript
// SQL Validator — strip comments, detect hidden write operations
function validateSql(sql: string, readOnly: boolean): ValidationResult {
  // Remove all comments (block and line)
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();

  if (!readOnly) return { valid: true };

  // Whitelist approach — only allow known safe keywords to start
  const firstKeyword = stripped.split(/\s+/)[0].toUpperCase();
  const SAFE_STARTS = ["SELECT", "EXPLAIN", "SHOW", "DESCRIBE", "PRAGMA", "WITH"];

  if (!SAFE_STARTS.includes(firstKeyword)) {
    return { valid: false, reason: `Blocked: ${firstKeyword} not allowed in safety mode` };
  }

  // Deep scan for write operations hidden in CTEs or subqueries
  const WRITE_OPS = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"];
  for (const op of WRITE_OPS) {
    if (new RegExp(`\\b${op}\\b`, "i").test(stripped)) {
      return { valid: false, reason: `Blocked: ${op} found in query` };
    }
  }

  return { valid: true };
}
```

**Driver-Level Read-Only Enforcement:**
```typescript
// PostgreSQL
await client.query("SET default_transaction_read_only = ON");

// MySQL
await connection.query("SET SESSION TRANSACTION READ ONLY");

// SQLite
const db = new Database(path, { readonly: true });
```

### 2. XSS Prevention
- Next.js/React auto-escapes JSX output — never bypass with `dangerouslySetInnerHTML`
- Sanitize any user-generated content rendered as HTML with DOMPurify
- Use `react-markdown` for rendering AI responses (it sanitizes by default)
- Never render raw SQL results as HTML — always use text content

### 3. Content Security Policy
```typescript
// next.config.ts
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",  // Required for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
```

## Credential Security

### Encryption at Rest (AES-256-GCM)
```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encrypt(plaintext: string): string {
  const key = deriveKey(process.env.ENCRYPTION_KEY!);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "seshat-salt", 32);
}
```

### Credential Handling Rules
- **Never** send passwords to the client — strip from all API responses
- **Never** include credentials in AI context — system prompt contains schema only
- **Never** log credentials — redact in error messages
- **Never** commit `.env.local` or `seshat.db`
- Use `ENCRYPTION_KEY` from env vars, minimum 32 characters
- Consider key rotation strategy for production

### API Response Sanitization
```typescript
function sanitizeConnection(conn: ConnectionConfig): Omit<ConnectionConfig, "password"> {
  const { password, ...safe } = conn;
  return safe;
}
```

## Input Validation

### Validate ALL External Input with Zod
```typescript
// Every API route must validate input before processing
const createConnectionSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(["postgresql", "mysql", "sqlite"]),
  host: z.string().max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).max(500),
  username: z.string().max(255).optional(),
  password: z.string().max(500).optional(),
  ssl: z.boolean().default(false),
});
```

### Path Traversal Prevention for SQLite
```typescript
// Validate SQLite file paths — prevent accessing system files
function validateSqlitePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  // Block paths outside allowed directories
  // Block access to system files
  if (resolved.startsWith("/etc/") || resolved.startsWith("/var/") || resolved.includes("..")) {
    return false;
  }
  // Ensure file has .db, .sqlite, or .sqlite3 extension
  const ext = path.extname(resolved).toLowerCase();
  return [".db", ".sqlite", ".sqlite3"].includes(ext);
}
```

## Rate Limiting
- Implement rate limiting on AI chat endpoint to prevent API cost abuse
- Use sliding window pattern: max 20 messages per minute per session
- Return 429 status with Retry-After header

## Dependency Security
- Run `npm audit` regularly
- Use Dependabot or Snyk for automated vulnerability scanning
- Pin dependency versions in package.json for reproducible builds
- Audit `better-sqlite3` native module builds

## Query Execution Safety
- Set statement timeouts to prevent runaway queries:
  ```sql
  -- PostgreSQL
  SET statement_timeout = '30s';

  -- MySQL
  SET max_execution_time = 30000;
  ```
- Limit result set size server-side (never trust LIMIT from AI-generated SQL alone)
- Log all executed queries for audit trail (without sensitive data)
