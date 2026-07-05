# AGENTS.md

## Project

Qualia — local personal AI companion. SvelteKit full-stack app (Node.js + browser, single process).

## Monorepo structure

Root `src/` is the source of truth. `packages/*/src/` are stale snapshots for npm publishing. Never edit them directly.

| Layer | Dev (root) | Published |
|-------|-----------|-----------|
| Engine | `src/lib/agent/`, `src/lib/ai/`, `src/lib/storage/`... | `packages/core/src/` → `@gatanot/qualia_core` |
| Web | `src/routes/`, `src/lib/components/`... | `packages/web/src/` → `@gatanot/qualia_web` |
| CLI | — | `packages/cli/src/` → `@gatanot/qualia` |

## Commands

```sh
npm run dev            # dev server → http://localhost:5173 (delegates to packages/web)
npm run check          # primary verification: svelte-kit sync + svelte-check (packages/web)
npm run check:watch    # check in watch mode (packages/web)
npm run check:core     # tsc --noEmit on packages/core
npm run test           # vitest on packages/core/src (NOT root)
npx vitest run         # run tests against root src/**/*.test.ts
npx vitest             # TDD mode (watch, root src/**/*.test.ts)
```

Always run `npm run check` after changes. `svelte-kit sync` runs on `npm install` via `prepare` in packages/web.
`npm run build` delegates to packages/web only (not core/cli).

## Stack

- SvelteKit 2 + Svelte 5 (runes mode forced) + TypeScript 6 + Vite 8
- `better-sqlite3` (sync, native)
- Imports: use `$lib/xxx` exclusively (SvelteKit built-in alias, not in tsconfig)
- Config: `~/.qualia/config.json`, no `.env` file
- Storage: `storageEnabled: true` by default (SQLite)
- AI providers: OpenAI, DeepSeek, Xiaomi, Ollama. Models in `src/lib/ai/models.ts`.

## Architecture

```
src/lib/
├── agent/       # AgentLoop, ContextBuilder, summarizer, diary, message-sanitizer
├── ai/          # Provider implementations + factory
├── components/  # Svelte UI + settings/
├── config/      # AppConfig + ProviderConfig
├── concurrency/ # SessionLock, FileMutex
├── gateway/     # GatewayDispatcher + email/telegram adapters
├── storage/     # MemoryStorage + SQLiteStorage
├── task/        # Scheduled task system
├── tool/        # ToolRegistry + 11 tools + safeguard.ts
├── chat-confirm.ts / chat-steering.ts  # Shared maps for confirm/steer
├── markdown.ts  # marked + highlight.js + KaTeX
├── paths.ts     # ~/.qualia path resolution
├── session-store.ts          # Client-side session list
├── model-picker-state.svelte.ts  # Client-side model picker
└── theme.ts     # Light/dark (localStorage + media query)
```

Server-side unless imported by `.svelte`. Exceptions: `session-store.ts`, `model-picker-state.svelte.ts`.

API routes under `src/routes/api/`: `chat` (SSE), `confirm`, `steer`, `config`, `models`, `sessions`, `messages`, `summarize`, `tasks`, `brand-icon`, `browse`, `theme`.

## Code style

- No defensive programming. Throw on unexpected state.
- `+server.ts` exports only HTTP method names or `_`-prefixed. Any other export breaks with 500.
- **No regex for text matching/parsing.** Use hand-written character-level DFA instead. Exceptions: route patterns in `+server.ts`, framework config files, command classification in `safeguard.ts`, and Unicode surrogate replacement in `message-sanitizer.ts`.

## Tool confirmation & steering

- **Confirm**: agent emits `confirm_required` → Promise in `chat-confirm.ts` Map → UI dialog → POST `/api/confirm` resolves. `args.__confirmed` skips re-confirm.
- **Steer**: inject via `/api/steer` → loop drains `pendingSteering` from `chat-steering.ts` before each LLM call.

## AgentLoop FSM

`INIT → PRE_LLM → LLM_STREAMING → POST_LLM → (PRE_TOOL → TOOL_EXECUTING → AWAIT_CONFIRM → POST_TOOL)* → PERSIST_TURN → DONE`. LLM failure: `POST_LLM → LLM_RETRY_WAIT → LLM_STREAMING` (5 retries, 1s base backoff). `MAX_TOOL_ITERATIONS = 50`, summarizer uses 10.

## Message sanitizer

`sanitizeMessages` runs before every LLM call: strips empty messages, replaces Unicode surrogates, merges consecutive same-role messages, removes orphan tool results. Returns new array. Do not bypass.

## Auto-summarize

Worker starts in `hooks.server.ts`. Config: `autoSummarize`, `summaryMode` (`idle`/`scheduled`), `summaryIdleHours` (8), `summaryScheduleHour` (2), `summaryIntervalMin` (30). Requires `storageEnabled`.

## Gateway

`GatewayDispatcher` + adapters: `EmailAdapter` (SMTP, notify-only), `TelegramAdapter` (long-polling, receive+notify). Config: email SMTP settings, `telegramBotToken`, `telegramAllowedUsers`.

## Scheduled tasks

AI schedules one-shot tasks. `schedule_task` requires reading current time via `exec` first. Tasks run in isolated AgentLoop (no history, no memory, auto-deny confirm, 10min timeout). Retention: 100 tasks / 7 days. Notification via `gateway.notify()`.

## Tool safety

`safeguard.ts`: `safe` (execute), `confirm` (wait for user), `reject` (deny). `args.__confirmed` skips re-confirm. `ToolContext.root` defaults to `process.cwd()`, overridden by `session.workspace` when set on the session.

## Context auto-continue

When `contextWindow - token_count < 20000` after reply: LLM compresses conversation → new session `[延续] xxx` with compression as system message → current exchange copied in → `forked` SSE event → frontend navigates to new session. Config `compressionMode`: `auto` (uses threshold above) or `custom` (uses `compressionThreshold`, default 256000).

Compression is a temporary context-continuation mechanism. Summary（摘要）is a separate background system for diary/records.

## Unified theme

`src/lib/theme/default-theme.json` defines all colors as `{ "color-key": { light, dark } }`. Web generates CSS variables from it. CLI reads `~/.qualia/theme.json`'s `colors` dark values via `KEY_MAP`. API: `GET/PUT /api/theme`.

## Git

- Branch: `feature/<name>`, `fix/<name>`, `release/<version>`. Never commit to `main`.
- Feature/fix branches merged to `main` after the task is complete and stable.
- Release branches (`release/x.y.z`) are **not** merged to `main`. They serve as immutable publishing snapshots.
- Commit messages: `prefix: short description`.
- Run `npm run check` before committing.

## Publishing

- `npm run release <version>` — full pipeline: bump → sync → build → pack
- Publish order: core → web → cli. Test with `npm link` or `npm pack` first.
- Old `.tgz` files can be deleted after publish; only the current version matters.

## tsconfig

Root excludes `packages/`. `packages/web/` extends `.svelte-kit/tsconfig.json`. Extensionless imports (`'./types'`, not `'./types.js'`).

## Quirks

- `hooks.server.ts` auto-starts gateway, summarizer, and scheduler on import.
- `svelte.config.js` forces runes for project files (not `node_modules`).
- `packages/web/vite.config.ts` has `ssr.external: ['@gatanot/qualia_core', 'better-sqlite3']` — required because `better-sqlite3` is a native module that cannot be bundled, and `@gatanot/qualia_core` depends on it.
- Root uses `@sveltejs/adapter-auto`; `packages/web/` uses `@sveltejs/adapter-node`.
- `src/lib/index.ts` is a SvelteKit placeholder, not a barrel.
- `~/.qualia/data/memory.md` read fresh each time a session is entered; no snapshot. Workspace root `AGENTS.md` (if present) auto-loaded as project context.
- `process.cwd()` is the default workspace root for tool path safety; `session.workspace` overrides it.
- `.svelte-kit/` is auto-generated; never edit.
- `.npmrc`: `engine-strict=true`.
- `data/`, `docs/`, `opencode.json` are gitignored.
- `README.md` is scaffolding, not real docs.
- Message editing: the existing "rollback to here" feature (double-click undo button) already deletes the message and subsequent content, placing the original text in the input box. Do not implement a separate "message editing" feature.
