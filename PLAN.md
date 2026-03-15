# Seshat — Build Plan

> Desktop app (Electron + Next.js) that lets you query and explore your database through natural language chat.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Electron                    │
│  ┌───────────────────────────────────────┐  │
│  │           Next.js 15 (App Router)     │  │
│  │  ┌─────────┐  ┌───────────────────┐  │  │
│  │  │  React   │  │  API Routes       │  │  │
│  │  │  UI      │←→│  /api/chat        │  │  │
│  │  │  shadcn  │  │  /api/connections  │  │  │
│  │  │  Tailwind│  │  /api/schema      │  │  │
│  │  └─────────┘  └────────┬──────────┘  │  │
│  │                         │             │  │
│  │              ┌──────────┴──────────┐  │  │
│  │              │   Service Layer     │  │  │
│  │              │  • DB Drivers       │  │  │
│  │              │  • AI (Claude)      │  │  │
│  │              │  • App SQLite DB    │  │  │
│  │              │  • Crypto           │  │  │
│  │              └──────────┬──────────┘  │  │
│  │                         │             │  │
│  │         ┌───────────────┼──────────┐  │  │
│  │         ▼               ▼          ▼  │  │
│  │     PostgreSQL       MySQL      SQLite│  │
│  │     (user DB)      (user DB)  (user DB)│ │
│  └───────────────────────────────────────┘  │
│                                             │
│  App Data: ~/.seshat/app.db (SQLite)        │
│  Encrypted credentials (AES-256-GCM)       │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell | Electron 34 + electron-builder |
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| AI | Vercel AI SDK 5 + `@ai-sdk/anthropic` |
| App Storage | better-sqlite3 (local `~/.seshat/app.db`) |
| DB Drivers | `pg` (Postgres), `mysql2` (MySQL), `better-sqlite3` (SQLite) |
| Validation | Zod |
| Encryption | Node.js crypto (AES-256-GCM) |
| Packaging | electron-builder (dmg, exe, AppImage) |
| Auto-update | electron-updater (GitHub Releases) |

## Project Structure

```
db-chat/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Preload script (context bridge)
│   └── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout (dark theme)
│   │   ├── page.tsx         # Home → redirect to /chat or /connections
│   │   ├── connections/
│   │   │   ├── page.tsx     # Connection list
│   │   │   └── new/
│   │   │       └── page.tsx # Add/edit connection form
│   │   ├── chat/
│   │   │   └── page.tsx     # Main chat interface
│   │   ├── settings/
│   │   │   └── page.tsx     # API key, safety mode, preferences
│   │   └── api/
│   │       ├── connections/
│   │       │   ├── route.ts           # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET, PUT, DELETE single
│   │       │       ├── test/route.ts  # POST test connection
│   │       │       └── schema/route.ts# GET introspect schema
│   │       ├── chat/
│   │       │   └── route.ts           # POST streaming chat
│   │       └── settings/
│   │           └── route.ts           # GET/PUT app settings
│   ├── components/
│   │   ├── ui/              # shadcn primitives
│   │   ├── chat/
│   │   │   ├── chat-panel.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── sql-result-table.tsx
│   │   │   ├── query-explanation.tsx
│   │   │   └── streaming-indicator.tsx
│   │   ├── connections/
│   │   │   ├── connection-card.tsx
│   │   │   ├── connection-form.tsx
│   │   │   └── schema-viewer.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── header.tsx
│   │       └── theme-provider.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── app-db.ts        # App SQLite (connections, history)
│   │   │   ├── drivers/
│   │   │   │   ├── index.ts     # Driver factory
│   │   │   │   ├── postgres.ts
│   │   │   │   ├── mysql.ts
│   │   │   │   └── sqlite.ts
│   │   │   ├── introspect.ts    # Schema introspection
│   │   │   └── query-runner.ts  # Safe query execution
│   │   ├── ai/
│   │   │   ├── tools.ts         # AI tool definitions (run_query, etc.)
│   │   │   ├── system-prompt.ts # Dynamic prompt with schema
│   │   │   └── validator.ts     # SQL safety checks
│   │   ├── crypto.ts            # AES-256-GCM encrypt/decrypt
│   │   ├── schemas.ts           # Zod schemas
│   │   └── utils.ts
│   └── hooks/
│       ├── use-connections.ts
│       └── use-chat.ts
├── public/
│   └── icon.png
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── electron-builder.yml
└── PLAN.md
```

## Build Phases

### Phase 1: Project Scaffold
- [x] Create plan
- [ ] Init Next.js 15 + TypeScript + Tailwind
- [ ] Add Electron (main.ts, preload.ts, dev script)
- [ ] Configure electron-builder
- [ ] Install all dependencies
- [ ] Set up shadcn/ui (dark theme)

### Phase 2: Core Backend
- [ ] App SQLite database (connections table, chats table, messages table)
- [ ] Crypto module (AES-256-GCM for credentials)
- [ ] Database driver abstraction (connect, query, introspect)
- [ ] PostgreSQL driver
- [ ] MySQL driver
- [ ] SQLite driver
- [ ] Schema introspection (tables, columns, types, relationships)
- [ ] Query runner with safety mode (read-only toggle)

### Phase 3: AI Integration
- [ ] System prompt builder (injects schema context)
- [ ] AI tools: `run_sql_query`, `explain_query`, `suggest_optimization`
- [ ] SQL validator (block dangerous statements in safety mode)
- [ ] Streaming chat endpoint with tool execution loop
- [ ] Chat history persistence

### Phase 4: UI — Connection Management
- [ ] Sidebar layout with navigation
- [ ] Connection list page (cards with status)
- [ ] Add/edit connection form (type selector, fields, test button)
- [ ] Connection test with live feedback
- [ ] Schema browser (tree view of tables/columns)

### Phase 5: UI — Chat Interface
- [ ] Chat page with message history
- [ ] Message bubbles (user, assistant, system)
- [ ] SQL result rendering (tables with sorting)
- [ ] Query explanation blocks
- [ ] Streaming response with typing indicator
- [ ] Connection selector in chat header
- [ ] New chat / chat history sidebar

### Phase 6: Settings & Safety
- [ ] Settings page (API key input, safety mode toggle)
- [ ] Read-only mode enforcement across all layers
- [ ] API key storage (encrypted)

### Phase 7: Polish & Package
- [ ] Auto-updater (electron-updater + GitHub Releases)
- [ ] App icon and branding
- [ ] First-launch onboarding flow
- [ ] Error states and empty states
- [ ] Build for macOS (.dmg), Windows (.exe), Linux (.AppImage)

## Key Design Decisions

1. **Electron + Next.js**: Next.js runs as a local dev server inside Electron. In production, we use `next export` or `output: 'standalone'` and load it directly.
2. **Credentials never leave the machine**: All DB credentials encrypted with AES-256-GCM, stored in local SQLite. No cloud, no telemetry.
3. **User brings their own API key**: Claude API key stored locally (encrypted). No proxy server needed.
4. **Safety mode**: When enabled, SQL validator blocks INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE before they ever reach the database.
5. **Schema auto-discovery**: On connection, introspect all tables, columns, types, foreign keys. Inject into AI system prompt so Claude knows the schema without user copy-paste.
