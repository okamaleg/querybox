---
name: performance-optimization
description: Performance optimization best practices for Next.js 15 apps — bundle size, Core Web Vitals, rendering strategies, lazy loading, database query performance, streaming, and caching. Use when optimizing load times, reducing bundle size, or improving runtime performance.
---

# Performance Optimization Best Practices

## Core Web Vitals Targets
- **LCP** (Largest Contentful Paint): < 2.5s
- **INP** (Interaction to Next Paint): < 200ms — replaced FID in 2024
- **CLS** (Cumulative Layout Shift): < 0.1

## Next.js Rendering Strategy

### Server Components by Default
- Keep most UI as Server Components — zero client-side JS
- Push `"use client"` as far DOWN the component tree as possible
- Only mark components as client when they need: useState, useEffect, event handlers, browser APIs

```typescript
// GOOD: Server component page with small client islands
// app/chat/[connectionId]/page.tsx (Server Component)
export default async function ChatPage({ params }: Props) {
  const connection = await getConnection(params.connectionId);
  const schema = await introspectSchema(connection);

  return (
    <div className="flex h-screen">
      <SchemaSidebar schema={schema} />        {/* Server Component */}
      <ChatContainer connectionId={connection.id} />  {/* Client Component - interactive */}
    </div>
  );
}
```

### Streaming & Suspense
```typescript
// Wrap slow data fetches in Suspense for instant page loads
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage() {
  return (
    <>
      <Suspense fallback={<SchemaSkeleton />}>
        <SchemaSidebar connectionId={id} />
      </Suspense>
      <ChatContainer connectionId={id} />
    </>
  );
}
```

## Bundle Size Optimization

### Dynamic Imports for Heavy Libraries
```typescript
// DON'T: Import heavy libraries statically in client components
import ReactSyntaxHighlighter from "react-syntax-highlighter";

// DO: Dynamic import — loaded only when needed
import dynamic from "next/dynamic";
const SqlHighlighter = dynamic(() => import("@/components/sql-code-block"), {
  loading: () => <pre className="animate-pulse bg-muted rounded p-4 h-20" />,
});
```

### Tree-Shake Imports
```typescript
// DON'T: Import entire library
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";

// DO: Import only what you need
import sql from "react-syntax-highlighter/dist/esm/languages/hljs/sql";
```

### Optimize Package Imports
```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      "react-syntax-highlighter",
      "recharts",
      "lucide-react",
    ],
  },
};
```

### Bundle Analysis
```bash
# Install and use bundle analyzer to find bloat
npm install -D @next/bundle-analyzer
# Add to next.config.ts and run: ANALYZE=true npm run build
```

## Streaming AI Responses

### Client-Side Performance
```typescript
// Buffer streaming updates with requestAnimationFrame to prevent re-render chaos
const bufferRef = useRef("");
const rafRef = useRef<number>();

function onStreamChunk(chunk: string) {
  bufferRef.current += chunk;

  if (!rafRef.current) {
    rafRef.current = requestAnimationFrame(() => {
      setContent(prev => prev + bufferRef.current);
      bufferRef.current = "";
      rafRef.current = undefined;
    });
  }
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
}, []);
```

### Auto-Scroll Performance
```typescript
// Use ref-based scrolling — avoid re-renders from scroll state
const messagesEndRef = useRef<HTMLDivElement>(null);
const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
};
// Call scrollToBottom when new content arrives, not on every render
```

## Database Query Performance

### Schema Caching
- Cache introspected schemas in the app database
- Invalidate after write operations that could change schema (CREATE, ALTER, DROP)
- Add "Refresh Schema" button for manual invalidation

### Query Optimization Guidance for AI
Include in system prompt:
- Table row counts so AI can make informed decisions about LIMIT
- Available indexes so AI can write queries that use them
- For tables > 100k rows, always use WHERE clauses

### Connection Optimization
```typescript
// Set timeouts to prevent hanging connections
// PostgreSQL
const pool = new Pool({
  connectionTimeoutMillis: 5000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

// MySQL
const conn = await mysql.createConnection({
  connectTimeout: 5000,
  // No built-in query timeout — use SET max_execution_time
});
```

### Result Set Management
- Default LIMIT 100 rows — prevents accidental full table scans
- Stream large result sets instead of buffering in memory
- Truncate long text fields in results (show first 200 chars)

## Image & Font Optimization

### Fonts
```typescript
// Use next/font for zero-layout-shift font loading
import { DM_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
```

### Icons
- Use `lucide-react` with tree-shaking — import individual icons
- Never import the entire icon library

## Caching Strategy

### Static Data
```typescript
// Cache schema introspection results (revalidate every 5 minutes)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Use in-memory cache or app DB cache for schemas
  const cached = getSchemaCache(params.id);
  if (cached && !isStale(cached)) return NextResponse.json(cached);

  const schema = await introspectSchema(params.id);
  setSchemaCache(params.id, schema);
  return NextResponse.json(schema);
}
```

### Client-Side
- Use SWR or React Query with `staleWhileRevalidate` for connection lists
- Deduplicate requests — multiple components reading the same data should share one fetch
- Prefetch schema data when hovering over a connection card

## Performance Budget
- First Load JS: < 100KB (compressed)
- Time to Interactive: < 3s
- API response time (non-AI): < 200ms
- AI first token: < 1s (depends on Claude API)
