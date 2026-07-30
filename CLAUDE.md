# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Start development servers
bun run dev:server    # Hono API server on port 3000 (hot reload)
bun run dev:cli       # TUI app (watch mode)

# Code quality
bun run lint          # ESLint (zero warnings policy)
bun run lint:fix      # ESLint with auto-fix
bun run typecheck     # TypeScript check (CLI package)
bun run check         # lint + typecheck together
bun run format        # Prettier

# Database
cd packages/database && bunx prisma migrate dev    # Run migrations
cd packages/database && bunx prisma generate       # Regenerate Prisma client
```

There are no automated tests in this project.

## Architecture

Sora is a terminal-based AI coding assistant with three runtime pieces:

1. **`packages/cli`** — TUI (terminal UI) built with React via `@opentui/react`. Uses `react-router` with a `createMemoryRouter` for screen navigation (`/`, `/sessions/new`, `/sessions/:id`). Communicates with the server via `hono/client` (typed RPC).

2. **`packages/server`** — Hono API server running on port 3000. Streams LLM responses using the Vercel AI SDK (`streamText`). Auth is Clerk OAuth tokens validated per-request. Billing is Polar credits ($0.01 USD/credit, charged via `ingestAiUsage` after each response).

3. **`packages/database`** — Prisma client for PostgreSQL. One model: `Session` (stores full `UIMessage[]` array as JSON). Generated client lives in `packages/database/generated/prisma/`.

4. **`packages/shared`** — Shared types, tool definitions, and model registry imported by both CLI and server. The canonical source for tool schemas (`toolInputSchema`), mode logic (`Mode.ASK` / `Mode.AGENT`), and supported models (`SUPPORTED_CHAT_MODELS`).

### Request flow

```
CLI (useChat hook)
  → DefaultChatTransport (prepareSendMessagesRequest)
  → POST /chat (server)
    → requireAuth middleware (Clerk OAuth token → userId)
    → requireCreditsBalance middleware
    → streamText (Vercel AI SDK) with tool approval gating
    → toUIMessageStreamResponse (streamed back to CLI)
  → onToolCall (CLI executes tool locally via executeLocalTool)
  → Tool output sent back → server continues generation
  → onFinish: session.messages persisted + Polar usage ingested
```

### Tool execution model

Tools are defined as contracts in `packages/shared/src/schemas.ts` and **executed client-side** in `packages/cli/src/lib/local-tools.ts`. The server only defines the tool signatures for the LLM; the CLI runs the actual filesystem/shell operations in the user's working directory.

- `readFile`, `listDirectory`, `glob`, `grep` — available in both Ask and Agent modes, no approval
- `writeFile`, `editFile`, `bash` — Agent mode only, require explicit user approval before the CLI executes them
- All path resolution is sandboxed to `process.cwd()` — paths outside cwd throw

### Auth flow

CLI stores OAuth token at `~/.sora/auth.json` (permissions: 600). Token is passed as `Authorization: Bearer <token>` on every request. A 401 response clears the stored token. Server validates via Clerk's `authenticateRequest` with `acceptsToken: 'oauth_token'`.

### MCP (Model Context Protocol) servers

Users configure MCP servers in `~/.sora/mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "remote-api": {
      "url": "https://example.com/mcp",
      "type": "http",
      "headers": { "Authorization": "Bearer token" }
    }
  }
}
```

**Flow**: CLI reads the config and connects to MCP servers at session start (`mcpManager.initialize()` in `use-chat.ts`). Tool schemas are discovered via `client.listTools()` and sent to the server in each chat request as `mcpTools`. The server converts them to tool contracts (using `jsonSchema()` from `@ai-sdk/provider-utils`) and passes them to `streamText` alongside built-in tools. MCP tools never require user approval. When the LLM calls an MCP tool, the CLI routes it to `mcpManager.executeTool()` which calls the correct client via `client.callTool()`.

**Naming**: MCP tools are namespaced as `serverName__toolName` to avoid conflicts with built-in tools.

**Key files**: `packages/cli/src/lib/mcp-config.ts` (config loading), `packages/cli/src/lib/mcp-manager.ts` (client lifecycle + execution), `packages/cli/src/hooks/use-chat.ts` (initialization + request injection), `packages/server/src/routes/chat.ts` (`buildMcpToolContracts`).

### Adding a new model

1. Add the model definition (id, provider, pricing) to `SUPPORTED_CHAT_MODELS` in `packages/shared/src/models.ts`
2. Add the provider resolution in `packages/server/src/lib/models.ts` (`resolveChatModel`)

### Environment variables

The server reads from a `.env` in `packages/server/` (or root). Required: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID`, `POLAR_CREDITS_METER_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`. Optional: `POLAR_SERVER` (default `sandbox`), `TOOL_APPROVAL_SECRET`. CLI reads `API_URL` (defaults to `http://localhost:3000`).
