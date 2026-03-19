# Querybox — Build Plan (v2)

> Desktop app (Electron + Fastify + Vite/React) — query your database with natural language.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Electron                       │
│                                                  │
│  Main Process                                    │
│  └── Spawns Fastify server (port 3099)           │
│      ├── POST /api/connections                   │
│      ├── GET  /api/connections                   │
│      ├── POST /api/connections/:id/test          │
│      ├── GET  /api/connections/:id/schema        │
│      ├── PUT/DELETE /api/connections/:id          │
│      ├── POST /api/chat  (SSE streaming)         │
│      ├── GET/PUT /api/settings                   │
│      │                                           │
│      ├── better-sqlite3 (app storage)            │
│      ├── pg / mysql2 / mongodb (user DBs)        │
│      ├── Anthropic SDK (Claude API)              │
│      └── AES-256-GCM encryption                  │
│                                                  │
│  Renderer Process                                │
│  └── Vite + React + Tailwind + shadcn            │
│      └── localhost:5173 (dev) / file:// (prod)   │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 34 |
| Backend | Fastify 5 + TypeScript |
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| AI | @anthropic-ai/sdk (direct, not Vercel AI SDK) |
| App Storage | better-sqlite3 (~/.querybox/querybox.db) |
| DB Drivers | pg, mysql2, better-sqlite3, mongodb |
| Encryption | AES-256-GCM (Node.js crypto) |
| Packaging | electron-builder |

## Project Structure

```
db-chat/
├── server/
│   ├── index.ts              # Fastify server entry
│   ├── routes/
│   │   ├── connections.ts    # CRUD + test + schema
│   │   ├── chat.ts           # SSE streaming chat
│   │   └── settings.ts       # App settings
│   ├── lib/
│   │   ├── db/
│   │   │   ├── app-db.ts     # App SQLite storage
│   │   │   └── drivers/      # PG, MySQL, SQLite, MongoDB
│   │   ├── ai/
│   │   │   ├── chat.ts       # Anthropic streaming + tool use
│   │   │   ├── system-prompt.ts
│   │   │   └── tools.ts      # Tool definitions + execution
│   │   ├── crypto.ts
│   │   ├── schemas.ts
│   │   └── validator.ts
│   └── tsconfig.json
├── src/                       # Vite React app
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── ui/               # shadcn
│   │   ├── chat/
│   │   ├── connections/
│   │   └── layout/
│   ├── hooks/
│   ├── lib/
│   └── index.css
├── electron/
│   ├── main.ts
│   └── preload.ts
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── electron-builder.yml
└── PLAN.md
```

## Key Changes from v1

1. **No Next.js** — eliminates all Turbopack/webpack + native module issues
2. **Fastify backend** — plain Node.js, native modules just work
3. **Anthropic SDK directly** — no Vercel AI SDK v6 message format issues
4. **Vite for frontend** — instant HMR, fast builds
5. **SSE for chat streaming** — simple, standard, no framework magic

## Supported Databases

PostgreSQL · MySQL · SQLite · MongoDB
