# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup (first time)
npm run setup          # Install deps + Prisma generate + migrate

# Development
npm run dev            # Start dev server with Turbopack (http://localhost:3000)
npm run dev:daemon     # Run in background, logs to logs.txt

# Build & Production
npm run build
npm run start

# Code Quality
npm lint               # ESLint (extends Next.js config)

# Testing
npm test               # Vitest (run all tests)
npm test -- path/to/test.ts  # Run a single test file

# Database
npm run db:reset       # Reset database (destructive)
```

## Environment

- `ANTHROPIC_API_KEY` — Claude API key. If absent, a `MockLanguageModel` is used automatically (returns static code, useful for UI dev without a key).
- `JWT_SECRET` — Session signing key (defaults to an insecure dev value if unset).

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe components in chat; Claude generates/edits files in a virtual file system; an iframe renders the result in real time.

### Data Flow

```
User Chat Input
  → /api/chat/route.ts (streaming, Vercel AI SDK)
      → Claude claude-haiku-4-5 + system prompt (lib/prompts/generation.tsx)
      → Tool calls: str_replace_editor / file_manager
  → ChatContext (lib/contexts/chat-context.tsx)
      → FileSystemContext (lib/contexts/file-system-context.tsx)
  → PreviewFrame (components/preview/PreviewFrame.tsx)
      → Babel transpiles JSX (lib/transform/jsx-transformer.ts)
      → Creates blob URL import map → renders in iframe
```

### Key Directories

- `src/app/` — Next.js App Router pages and `/api/chat` route (the streaming LLM endpoint)
- `src/components/chat/` — Chat UI (ChatInterface, MessageList, MessageInput)
- `src/components/editor/` — Monaco code editor + FileTree (virtual FS navigator)
- `src/components/preview/` — iframe-based preview renderer
- `src/lib/contexts/` — `FileSystemContext` and `ChatContext` (global state)
- `src/lib/tools/` — `str-replace.ts` and `file-manager.ts` (LLM tool implementations)
- `src/lib/file-system.ts` — `VirtualFileSystem` class (in-memory, no disk writes)
- `src/actions/` — Next.js server actions for auth and project CRUD
- `prisma/schema.prisma` — source of truth for all database models; reference it whenever you need to understand stored data structure

### Virtual File System

All generated files live in a `VirtualFileSystem` instance (never written to disk). Paths always start with `/`. The serialized FS is stored in the `Project.data` JSON column for authenticated users, or in `localStorage` for anonymous users (`lib/anon-work-tracker.ts`).

### LLM Integration

The chat API route (`app/api/chat/route.ts`) uses Vercel AI SDK's `streamText` with two tools:
- `str_replace_editor` — create or edit file contents via string replacement
- `file_manager` — rename or delete files

The provider is selected in `lib/provider.ts`: real Anthropic when `ANTHROPIC_API_KEY` is set, otherwise a mock.

### Auth

JWT sessions (7-day), stored in httpOnly cookies. `middleware.ts` protects project routes. Server actions in `src/actions/index.ts` handle sign-up/sign-in (bcrypt) and `getUser()`.

### UI Layout

Two resizable panels: left (35%) = chat, right (65%) = Preview/Code tabs. Code tab has a nested split: FileTree (30%) + Monaco editor (70%).

### Path Aliases

`@/` maps to `src/` throughout the codebase (`tsconfig.json`).

## Code Style

- Comments: only on complex or non-obvious logic. Skip self-evident comments.
