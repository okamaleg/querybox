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
  /;\s*(DROP|DELETE|TRUNCATE|ALTER)\s/i, // Piggyback attacks
  /--.*$/m, // SQL comments (potential injection)
  /\/\*[\s\S]*?\*\//m, // Block comments
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /\bxp_/i, // SQL Server extended procs
  /\bLOAD_FILE\b/i,
  /\bINTO\s+(OUT|DUMP)FILE\b/i,
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

  // Check for empty queries
  if (!trimmed) {
    return {
      allowed: false,
      reason: "Empty query",
      is_write: false,
      is_dangerous: false,
    };
  }

  // Check for dangerous patterns
  const isDangerous = DANGEROUS_PATTERNS.some((p) => p.test(trimmed));
  const isWrite = WRITE_PATTERNS.some((p) => p.test(trimmed));

  // Check for multiple statements (basic check)
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
