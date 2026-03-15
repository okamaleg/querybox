---
name: ux-patterns
description: UX best practices for AI chat interfaces, database exploration, streaming responses, error recovery, onboarding, and interaction design. Use when designing user flows, handling edge cases, creating feedback mechanisms, or building conversational interfaces.
---

# UX Patterns Best Practices

## AI Chat Interface UX

### First Impressions (The 5-Second Rule)
Users decide within 5 seconds if the interface is worth engaging. On first load:
- Show a crisp welcome message, not a wall of text
- Provide 3-4 suggested starter questions as clickable chips:
  ```
  "What tables do I have?"
  "Show me the top 10 rows from [largest table]"
  "Describe the relationships between my tables"
  "How many records are in each table?"
  ```
- Pre-populate suggestions based on the actual schema (use real table names)

### Streaming Response UX
- **Show text word-by-word** as it arrives — feels responsive and natural
- **Blinking cursor** at the end of streaming text
- **Auto-scroll** to bottom as new content arrives, BUT stop if user scrolls up
- **Show SQL blocks** as they're generated (before execution)
- **Show "Executing query..."** indicator while SQL runs
- **Render result tables inline** as soon as results return
- Never show a blank loading spinner for > 1 second — show progressive content

```typescript
// Auto-scroll that respects user intent
const isUserScrolledUp = useRef(false);
const containerRef = useRef<HTMLDivElement>(null);

function onScroll() {
  const el = containerRef.current;
  if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  isUserScrolledUp.current = !atBottom;
}

function scrollToBottom() {
  if (!isUserScrolledUp.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}
```

### Message Structure
Each assistant message can contain multiple parts:
1. **Thinking/explanation** — Markdown text explaining the approach
2. **SQL block** — Syntax-highlighted SQL with "Copy" button
3. **Result table** — Expandable/collapsible table of results
4. **Summary** — Natural language interpretation of results
5. **Follow-up suggestions** — Clickable next-step prompts

### Input Area
- Use `Textarea` that auto-resizes (1-5 rows)
- Submit on `Cmd/Ctrl + Enter` (not plain Enter — allow multiline input)
- Show character count if approaching limits
- Disable input while streaming (show "AI is thinking..." in placeholder)
- Clear input on successful send

## Safety Mode UX

### Visual Indicators
- **Safety ON** (default): Green shield icon + "Read Only" badge in header
- **Safety OFF**: Amber unlocked icon + "Read & Write" badge
- The toggle should be prominent but not accidentally clickable

### Confirmation Flow for Disabling Safety
```
User clicks toggle OFF
→ Dialog appears:
  "Turn off Safety Mode?"
  "The AI will be able to execute write operations on your database,
   including INSERT, UPDATE, DELETE, and schema changes."
  [Cancel] [Turn Off Safety Mode]
```

### Write Operation Warnings
Even with safety OFF, show inline warnings before destructive operations:
```
⚠️ This will DELETE 1,523 rows from the orders table.
   [Cancel] [Execute]
```

## Connection Management UX

### Add Connection Flow
1. Select database type (PostgreSQL / MySQL / SQLite) — show as large, visual cards
2. Form adapts to selected type:
   - PostgreSQL/MySQL: host, port (pre-filled default), database, username, password, SSL toggle
   - SQLite: file path picker only
3. **"Test Connection"** button — runs test before saving
4. Show test result inline: green checkmark + latency, or red X + error message
5. Only enable "Save" after successful test (or allow saving untested with warning)

### Connection States
- **Connected** (green dot) — successfully tested
- **Untested** (gray dot) — saved but never tested
- **Failed** (red dot) — last test failed, show error on hover

### Connection Cards
- Click card → navigate to chat
- Three-dot menu → Edit, Delete, Test Connection
- Show database type icon prominently (PostgreSQL elephant, MySQL dolphin, SQLite feather)
- Show last connected time: "Connected 2 hours ago"

## Schema Browser UX

### Tree Navigation
```
Tables (12)
├── users (45,230 rows)
│   ├── id (integer, PK)
│   ├── email (varchar(255), unique)
│   ├── name (varchar(100))
│   ├── created_at (timestamp)
│   └── FK → profiles.user_id
├── orders (128,450 rows)
│   ├── id (integer, PK)
│   ├── user_id (integer, FK → users.id)
│   └── ...
```

### Interactions
- Click table name → insert table reference into chat input
- Hover on column → show full type details in tooltip
- FK indicators are clickable → jump to referenced table
- Collapse/expand tables individually
- "Collapse All" / "Expand All" buttons
- Search/filter tables by name

## Error Handling UX

### Connection Errors
```
❌ Connection Failed
   Could not connect to PostgreSQL at localhost:5432
   Error: ECONNREFUSED — is the database server running?

   [Try Again] [Edit Connection]
```

### Query Errors
Show errors inline in the chat, not as modals:
```
🔴 Query Error
   ERROR: column "emaul" does not exist
   Hint: Perhaps you meant to reference the column "email"

   SQL: SELECT emaul FROM users LIMIT 10
```
The AI should automatically notice the error and suggest a fix.

### AI Errors
- Rate limit hit → "AI is busy, please try again in a moment" + auto-retry countdown
- Network error → "Connection lost. Retrying..." + retry button
- Stream interrupted → Show partial response + "Response interrupted" + retry button

### Empty Results
```
The query returned no results.
This could mean:
- The table is empty
- The WHERE conditions don't match any rows
- Try broadening your search criteria
```

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send message |
| `Cmd/Ctrl + K` | Focus search / command palette |
| `Cmd/Ctrl + B` | Toggle schema sidebar |
| `Cmd/Ctrl + Shift + S` | Toggle safety mode |
| `Escape` | Cancel current streaming response |

## Onboarding Flow (First Visit)
1. Welcome screen with brief explanation (3 bullet points max)
2. "Add Your First Database" CTA
3. After first successful connection + test: auto-navigate to chat
4. First chat shows contextual suggestions based on schema
5. Celebrate first successful query: subtle animation/confetti (optional)

## Accessibility Requirements
- All interactive elements reachable via keyboard
- Focus visible indicators on all focusable elements (2px ring)
- ARIA labels on icon-only buttons
- Screen reader announcements for: streaming status, query results, errors
- Color contrast ratio: 4.5:1 minimum for text, 3:1 for large text
- Never convey information through color alone (always pair with icon/text)
- Support `prefers-reduced-motion` — disable animations
- Support `prefers-contrast: high` — increase border and text contrast
