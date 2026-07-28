# Sora

A terminal-based AI coding assistant that lets you chat with LLMs to read and modify your codebase, with an Agent mode that executes file and shell tools with approval prompts.

## Overview

Sora is a full-stack application with two packages:

- **`packages/cli`** — a TUI (terminal UI) app built with React via [`@opentui/react`](https://github.com/nicholasgasior/opentui), providing a chat interface that runs directly in your terminal
- **`packages/server`** — a [Hono](https://hono.dev) API server that streams LLM responses using the [Vercel AI SDK](https://sdk.vercel.ai), backed by PostgreSQL via Prisma

## Features

- **Two chat modes**
  - **Ask** — read-only analysis; the AI can explore your codebase but cannot make changes
  - **Agent** — full implementation mode with file read/write, edit, and shell execution tools
- **Tool approval prompts** — destructive tools (`writeFile`, `editFile`, `bash`) require explicit user approval before running in Agent mode
- **Multi-model support** — choose from Anthropic, OpenAI, and Google models per session
- **Persistent sessions** — chat history is stored in PostgreSQL and restored across restarts
- **Credit-based billing** — usage is metered via [Polar](https://polar.sh) and billed per token
- **OAuth authentication** — powered by [Clerk](https://clerk.com)

## Supported Models

| Model | Provider | Input (per M tokens) | Output (per M tokens) |
|---|---|---|---|
| `gpt-5.5` | OpenAI | $2.50 | $15.00 |
| `gpt-5.4-mini` | OpenAI | $0.75 | $4.50 |
| `gpt-oss-20b` | OpenAI | $0.20 | $1.25 |
| `claude-opus-4-6` | Anthropic | $5.00 | $25.00 |
| `claude-sonnet-4-6` | Anthropic | $3.00 | $15.00 |
| `claude-haiku-4-5` | Anthropic | $1.00 | $5.00 |
| `gemini-3.5-flash` | Google | $0.20 | $1.00 |

## Project Structure

```
packages/
  cli/        # Terminal UI app (React + @opentui)
  server/     # Hono API server
  database/   # Prisma schema and client
  shared/     # Shared types, tool definitions, model registry
  solutions/  # (reserved)
src/          # Root-level shared components and hooks
scripts/      # Utility scripts
```

## Prerequisites

- [Bun](https://bun.sh) v1.x
- PostgreSQL database

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure the server

Create a `.env` file in `packages/server/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sora

# Clerk (authentication)
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...

# Polar (billing)
POLAR_ACCESS_TOKEN=...
POLAR_PRODUCT_ID=...
POLAR_CREDITS_METER_ID=...
POLAR_SERVER=sandbox   # or "production"

# AI providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Optional: tool approval signature secret
TOOL_APPROVAL_SECRET=...
```

### 3. Run database migrations

```bash
cd packages/database && bunx prisma migrate dev
```

### 4. Start the development servers

```bash
# API server (with hot reload)
bun run dev:server

# CLI app (with watch mode)
bun run dev:cli
```

## Architecture

```mermaid
flowchart TD
    CLI["CLI (TUI)\nReact + @opentui/react\nSessions / Chat UI"]
    Server["Hono Server\nVercel AI SDK · Clerk Auth · Polar Billing"]
    DB[(PostgreSQL\nPrisma)]
    LLM["LLM APIs\nOpenAI · Anthropic · Google"]

    CLI -->|"HTTP streaming (hono/client)"| Server
    Server --> DB
    Server --> LLM
```

The CLI authenticates via OAuth (token stored in `~/.sora/auth.json`) and streams chat responses from the server over HTTP. The server persists full message history as JSON in PostgreSQL and tracks token usage for credit billing.

## Agent Tools

| Tool | Mode | Approval Required |
|---|---|---|
| `readFile` | Ask + Agent | No |
| `listDirectory` | Ask + Agent | No |
| `glob` | Ask + Agent | No |
| `grep` | Ask + Agent | No |
| `writeFile` | Agent only | Yes |
| `editFile` | Agent only | Yes |
| `bash` | Agent only | Yes |

## Billing

Credits are pegged at **$0.01 USD per credit**. Each request converts token usage to a cost in USD, then rounds up to the nearest whole credit (minimum 1 credit per request). Credits are metered through Polar.
