---
name: backend-patterns
description: Backend architecture best practices for Next.js 15 API routes, server actions, database operations, error handling, and data access layer patterns. Use when building API endpoints, server-side logic, or database interactions.
---

# Backend Architecture Best Practices

## API Routes vs Server Actions

### When to Use API Routes
- Reusable RESTful endpoints serving multiple consumers (web, mobile, external)
- Streaming responses (SSE, WebSockets)
- Complex multi-step workflows
- Webhook receivers
- Public API surface

### When to Use Server Actions
- Form submissions tightly coupled to UI
- Simple mutations (create, update, delete) from React components
- When you want automatic type safety between client and server

### Data Access Layer Pattern
**Always** separate core business logic from the transport layer:

```typescript
// lib/data-access/connections.ts — Core logic (reusable)
export async function createConnection(input: ConnectionInput): Promise<Connection> {
  const validated = connectionSchema.parse(input);
  const encrypted = await encryptCredentials(validated);
  return db.insert(connections).values(encrypted).returning();
}

// app/api/connections/route.ts — API route (thin wrapper)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await createConnection(body);
  return NextResponse.json(result, { status: 201 });
}

// app/actions/connections.ts — Server action (thin wrapper)
"use server";
export async function createConnectionAction(formData: FormData) {
  const input = Object.fromEntries(formData);
  return createConnection(input);
}
```

## Error Handling

### Standardized API Response Pattern
```typescript
// lib/api-response.ts
import { ZodError } from "zod";

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  details?: Record<string, string[]>;
};

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({
      success: false,
      error: "Validation failed",
      details: error.flatten().fieldErrors,
    }, { status: 400 });
  }

  if (error instanceof AppError) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: error.statusCode });
  }

  console.error("Unhandled error:", error);
  return NextResponse.json({
    success: false,
    error: "Internal server error",
  }, { status: 500 });
}
```

### Route Handler Pattern
```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    const result = await businessLogic(validated);
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
```

## Zod Validation

### Schema Definition Best Practices
```typescript
// Define schemas that serve as BOTH validation AND TypeScript types
const connectionSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(["postgresql", "mysql", "sqlite"]),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
});

// Derive type from schema — single source of truth
type ConnectionInput = z.infer<typeof connectionSchema>;

// Partial schema for updates
const connectionUpdateSchema = connectionSchema.partial().omit({ type: true });
```

### Validation Middleware Pattern
```typescript
function withValidation<T>(schema: z.ZodSchema<T>, handler: (data: T, req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      const body = await req.json();
      const data = schema.parse(body);
      return handler(data, req);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
```

## Database Operations

### Connection Lifecycle
- Create connections per-request, not pooled across serverless invocations
- Always disconnect in `finally` blocks
- Set reasonable timeouts on all database connections

```typescript
export async function withDatabase<T>(
  config: ConnectionConfig,
  operation: (driver: DatabaseDriver) => Promise<T>
): Promise<T> {
  const driver = createDriver(config.type);
  try {
    await driver.connect(config);
    return await operation(driver);
  } finally {
    await driver.disconnect();
  }
}
```

### Query Result Limits
- Default to 100 rows per query
- Maximum 1,000 rows
- Always indicate if results were truncated
- For count queries, return exact count separately

### Transaction Safety
- Wrap multi-step write operations in transactions
- Use savepoints for nested operations
- Always rollback on error

## Streaming Responses (SSE)

### Pattern for AI Chat Streaming
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt({ ... }),
    messages: history,
    tools: { execute_sql },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

### Key Rules
- Always set proper headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- Clean up resources (database connections, abort controllers) when stream ends
- Handle client disconnection gracefully
- Implement timeout for long-running streams

## Environment Variables
- Never hardcode secrets — use `.env.local`
- Validate env vars at startup with Zod:
```typescript
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
});
export const env = envSchema.parse(process.env);
```
- Never expose server-only vars to client (no `NEXT_PUBLIC_` prefix for secrets)
