# Querybox

Chat with your database using natural language. Connect your DB, start chatting — the AI already knows your schema.

**Supports:** PostgreSQL · MySQL · MongoDB · SQLite

## Quick Start

```bash
git clone https://github.com/okamaleg/querybox.git
cd querybox
npm install
npm run dev
```

Open **http://localhost:5173**

## Setup

1. Go to **Settings** and enter your [Anthropic API key](https://console.anthropic.com/settings/keys)
2. Go to **Connections** → **New Connection** → pick your DB type and enter credentials
3. Click the connection in the sidebar → start chatting

## Features

- Natural language queries — ask in plain English, get SQL results
- Auto schema discovery — no copy-pasting your schema
- Safety mode — read-only by default, toggle writes in settings
- Query optimization — get EXPLAIN plans and suggestions
- 100% local — credentials encrypted on your machine, never sent anywhere
