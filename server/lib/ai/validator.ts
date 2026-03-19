const WRITE_PATTERNS = [
  /^\s*INSERT\s/i,
  /^\s*UPDATE\s/i,
  /^\s*DELETE\s/i,
  /^\s*DROP\s/i,
  /^\s*CREATE\s/i,
  /^\s*ALTER\s/i,
  /^\s*TRUNCATE\s/i,
  /^\s*GRANT\s/i,
  /^\s*REVOKE\s/i,
  /^\s*MERGE\s/i,
  /^\s*REPLACE\s/i,
  /^\s*UPSERT\s/i,
];

const DANGEROUS_PATTERNS = [
  /;\s*(DROP|DELETE|TRUNCATE|ALTER)\s/i,
  /--.*$/m,
  /\/\*[\s\S]*?\*\//m,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /\bxp_/i,
  /\bLOAD_FILE\b/i,
  /\bINTO\s+(OUT|DUMP)FILE\b/i,
];

const MONGO_WRITE_OPERATIONS = [
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "drop",
  "createIndex",
  "dropIndex",
];

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  is_write: boolean;
  is_dangerous: boolean;
}

export function validateSQL(
  sql: string,
  safetyMode: boolean
): ValidationResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return {
      allowed: false,
      reason: "Empty query",
      is_write: false,
      is_dangerous: false,
    };
  }

  // MongoDB JSON query validation
  if (trimmed.startsWith("{")) {
    try {
      const cmd = JSON.parse(trimmed) as { operation?: string };
      const isWrite = MONGO_WRITE_OPERATIONS.includes(cmd.operation ?? "");

      if (safetyMode && isWrite) {
        return {
          allowed: false,
          reason:
            "Safety mode is enabled. Write operations are blocked. Disable safety mode in settings to allow writes.",
          is_write: true,
          is_dangerous: false,
        };
      }

      return {
        allowed: true,
        is_write: isWrite,
        is_dangerous: false,
      };
    } catch {
      return {
        allowed: false,
        reason: "Invalid JSON query",
        is_write: false,
        is_dangerous: false,
      };
    }
  }

  // SQL validation
  const isDangerous = DANGEROUS_PATTERNS.some((p) => p.test(trimmed));
  const isWrite = WRITE_PATTERNS.some((p) => p.test(trimmed));

  const statements = trimmed
    .split(";")
    .filter((s) => s.trim().length > 0);
  if (statements.length > 1) {
    return {
      allowed: false,
      reason:
        "Multiple SQL statements are not allowed. Please execute one query at a time.",
      is_write: isWrite,
      is_dangerous: true,
    };
  }

  if (isDangerous) {
    return {
      allowed: false,
      reason:
        "Query contains potentially dangerous patterns. Please review and simplify.",
      is_write: isWrite,
      is_dangerous: true,
    };
  }

  if (safetyMode && isWrite) {
    return {
      allowed: false,
      reason:
        "Safety mode is enabled. Write operations are blocked. Disable safety mode in settings to allow writes.",
      is_write: true,
      is_dangerous: false,
    };
  }

  return {
    allowed: true,
    is_write: isWrite,
    is_dangerous: false,
  };
}
