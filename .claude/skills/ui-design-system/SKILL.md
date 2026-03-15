---
name: ui-design-system
description: UI design system best practices for Seshat — dark theme, shadcn/ui component patterns, color system, typography, spacing, and visual hierarchy. Use when building or styling components, creating layouts, or making design decisions.
---

# UI Design System Best Practices

## Dark Theme Foundation

### Color System
**Never use pure black (#000000)** — it causes eye strain and halation effect.

```css
:root {
  /* Surface hierarchy (dark theme) */
  --background: 224 10% 8%;        /* #131518 — deepest background */
  --surface-1: 224 10% 11%;        /* #1a1c20 — cards, panels */
  --surface-2: 224 10% 14%;        /* #212428 — elevated elements */
  --surface-3: 224 10% 18%;        /* #2a2d32 — hover states */

  /* Text hierarchy */
  --foreground: 210 20% 95%;       /* Primary text — NOT pure white */
  --muted-foreground: 215 15% 55%; /* Secondary text */
  --faint: 215 10% 35%;            /* Tertiary/disabled text */

  /* Accent colors */
  --primary: 210 100% 60%;         /* Brand blue — actions, links */
  --destructive: 0 84% 60%;        /* Red — errors, delete */
  --warning: 38 92% 50%;           /* Amber — safety mode off */
  --success: 142 71% 45%;          /* Green — safety mode on, connected */

  /* Database type colors */
  --db-postgresql: 210 100% 60%;   /* Blue */
  --db-mysql: 200 80% 50%;         /* Teal */
  --db-sqlite: 280 70% 60%;        /* Purple */
}
```

### Visual Depth & Layering
Create clear three-tier hierarchy using surface colors:
1. **Background** — page background, deepest layer
2. **Surface-1** — cards, sidebars, panels
3. **Surface-2** — elevated elements (dialogs, dropdowns, tooltips)
4. **Surface-3** — interactive hover/focus states

Use subtle borders (`border: 1px solid hsl(var(--border))`) between layers, NOT shadows on dark backgrounds (shadows are invisible on dark).

## shadcn/ui Component Patterns

### Composition Over Configuration
```typescript
// GOOD: Compose from primitives
<Card className="bg-surface-1 border-border">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">{title}</CardTitle>
  </CardHeader>
  <CardContent>{children}</CardContent>
</Card>

// BAD: Overloading a single component with props
<CustomCard title={title} variant="dark" size="sm" bordered elevated />
```

### Consistent Component API Patterns
- Use `className` for style overrides (Tailwind merge with `cn()`)
- Use `variant` and `size` for predefined styles
- Forward refs on all interactive components
- Spread remaining props with `...rest`

```typescript
import { cn } from "@/lib/utils";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "connected" | "disconnected" | "testing";
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "connected" && "bg-success/15 text-success",
        status === "disconnected" && "bg-muted text-muted-foreground",
        status === "testing" && "bg-primary/15 text-primary animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
```

### Accessibility in shadcn Components
- Radix UI provides accessibility by default — **never break it**
- Always include proper ARIA labels on icon-only buttons
- Maintain focus trapping in Dialog and Sheet components
- Test keyboard navigation: Tab, Shift+Tab, Enter, Escape, Arrow keys

```typescript
// Icon-only button MUST have aria-label
<Button variant="ghost" size="icon" aria-label="Delete connection">
  <Trash2 className="h-4 w-4" />
</Button>
```

## Typography

### Font Pairing
- **Body text**: DM Sans, Outfit, or similar geometric sans-serif (NOT Inter/Roboto)
- **Code/SQL**: JetBrains Mono — designed for code readability
- **Headings**: Same as body, heavier weight

### Scale
```css
/* Consistent type scale */
--text-xs: 0.75rem;    /* 12px — labels, badges */
--text-sm: 0.875rem;   /* 14px — secondary text, table cells */
--text-base: 1rem;     /* 16px — body text, chat messages */
--text-lg: 1.125rem;   /* 18px — section headers */
--text-xl: 1.25rem;    /* 20px — page titles */
--text-2xl: 1.5rem;    /* 24px — hero text */
```

### Code & SQL Display
```typescript
// Use monospace font for ALL data display
<pre className="font-mono text-sm">
  {sqlQuery}
</pre>

// Use proportional font for explanations
<p className="font-sans text-base">
  {explanation}
</p>
```

## Layout Patterns

### Chat Page Layout
```
+--------------------------------------------------+
| Header (h-14, border-b, flex items-center)       |
|  [< Back] [Connection Name] [Safety] [Settings]  |
+--------------------------------------------------+
| Sidebar (w-72)  |  Main Content (flex-1)          |
| border-r        |                                  |
| overflow-y-auto |  Messages (flex-1 overflow-auto) |
|                 |                                  |
| Schema browser  |  [Message]                       |
| Tables tree     |  [Message with SQL + table]      |
|                 |  [Message]                       |
|                 |                                  |
|                 |  Input (border-t, p-4)           |
|                 |  [Textarea] [Send]               |
+--------------------------------------------------+
```

### Responsive Behavior
- **Desktop (>1024px)**: Full layout with sidebar visible
- **Tablet (768-1024px)**: Sidebar as collapsible Sheet
- **Mobile (<768px)**: Sidebar hidden, accessible via hamburger menu

## Data Display

### SQL Result Tables
- Use `font-mono text-sm` for all cell content
- Right-align numeric columns
- Display NULL as italic, muted text: `<span className="italic text-muted-foreground">NULL</span>`
- Alternate row backgrounds for readability: `even:bg-muted/50`
- Sticky header row
- Horizontal scroll for wide tables with `overflow-x-auto`
- Show row count: "42 rows" or "100 of 1,523 rows"

### Empty States
Always provide helpful empty states:
```typescript
<div className="flex flex-col items-center justify-center h-64 text-center">
  <DatabaseIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
  <h3 className="text-lg font-medium mb-1">No connections yet</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Connect your first database to start chatting
  </p>
  <Button>Add Connection</Button>
</div>
```

### Loading States
Use shadcn Skeleton components that match the final layout shape:
```typescript
// Skeleton that mirrors the actual card layout
function ConnectionCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}
```

## Animation Guidelines
- Use `transition-colors duration-150` for hover states
- Use `transition-all duration-200` for expanding/collapsing
- Use `animate-pulse` for loading states
- Use `animate-spin` for processing indicators
- Streaming text cursor: blinking `|` at end of streaming content
- **No page-level transitions** — keep navigation instant
