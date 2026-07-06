# AGENTS.md

Qualia — local personal AI companion. SvelteKit full-stack app (Node.js + browser, single process).

## CRITICAL: Sync before check/build

Root `src/` is the source of truth. `packages/*/src/` are snapshots for npm publishing. **Never edit them directly.**

`npm run dev`, `npm run check`, and `npm run build` all run inside `packages/web/`, which uses the snapshot. After editing root `src/`, you **must** run `npm run sync` (or `npm run sync:web` / `npm run sync:core`) first — it copies root → packages with import rewriting.

Note: `svelte-kit sync` (in `packages/web/package.json` prepare) generates `.svelte-kit/` and is unrelated.

## Monorepo structure

| Layer | Dev (root) | Published |
|-------|-----------|-----------|
| Engine | `src/lib/agent/`, `src/lib/ai/`, `src/lib/storage/`... | `packages/core/src/` → `@gatanot/qualia_core` |
| Web | `src/routes/`, `src/lib/components/`... | `packages/web/src/` → `@gatanot/qualia_web` |
| CLI | — | `packages/cli/src/` → `@gatanot/qualia` |

## Commands

```sh
npm run dev            # dev server → http://localhost:5173 (runs in packages/web)
npm run sync           # copy root src/ → packages/*/src/ with import rewriting
npm run sync:web       # sync only packages/web
npm run sync:core      # sync only packages/core
npm run check          # svelte-kit sync + svelte-check (packages/web)
npm run check:watch    # check in watch mode (packages/web)
npm run check:core     # tsc --noEmit (packages/core)
npm run test           # vitest run via packages/core (uses packages/core/vitest.config.ts)
npx vitest run         # vitest run via root vitest.config.ts → src/**/*.test.ts
npx vitest             # vitest watch mode (root config)
npm run build          # vite build (packages/web only, not core/cli)
npm run release -- <version>   # bump → sync → build → pack
```

Always run `npm run sync && npm run check` before committing.

### Two test configurations

Root `vitest.config.ts` includes `src/**/*.test.ts` (root source of truth). `packages/core/vitest.config.ts` does the same for the snapshot. Both run the same tests, just from different directories. `npm run test` uses the package one; `npx vitest` uses the root one.

## Stack

- SvelteKit 2 + Svelte 5 (runes mode forced via `svelte.config.js`) + TypeScript 6 + Vite 8
- `better-sqlite3` — sync, native, requires node-gyp + Python + C++ build tools
- `packages/web/vite.config.ts` must keep `ssr.external: ['@gatanot/qualia_core', 'better-sqlite3']` — the native module cannot be bundled
- Imports: use `$lib/xxx` exclusively (SvelteKit built-in alias, not in tsconfig)
- Config: `~/.qualia/config.json`. No `.env` file.
- Root uses `@sveltejs/adapter-auto`; `packages/web/` uses `@sveltejs/adapter-node`
- `.npmrc`: `engine-strict=true`
- Extensionless imports (`'./types'`, not `'./types.js'`)

## Architecture

```
src/lib/
├── agent/       # AgentLoop, ContextBuilder, summarizer, diary, message-sanitizer
├── ai/          # Provider implementations + models.ts (OpenAI, DeepSeek, Xiaomi, Ollama)
├── components/  # Svelte UI + settings/
├── config/      # AppConfig + ProviderConfig
├── concurrency/ # SessionLock, FileMutex, BackgroundWorker
├── gateway/     # GatewayDispatcher + email/telegram adapters
├── storage/     # MemoryStorage + SQLiteStorage (storageEnabled: true by default)
├── task/        # Scheduled task system
├── tool/        # ToolRegistry + 11 tools + safeguard.ts
├── chat-confirm.ts / chat-steering.ts  # Shared maps for confirm/steer
├── markdown.ts  # marked + highlight.js + KaTeX
├── paths.ts     # ~/.qualia path resolution
├── session-store.ts          # Client-side session list (exception: runs in browser)
├── model-picker-state.svelte.ts  # Client-side model picker (exception: runs in browser)
└── theme.ts     # Light/dark (localStorage + media query)
```

Server-side unless imported by `.svelte`. Only exceptions: `session-store.ts`, `model-picker-state.svelte.ts`.

`src/lib/index.ts` is a SvelteKit placeholder (not a barrel). Do not add exports to it.

Real design documentation is in `design.md`, not `README.md` (which is Svelte scaffolding).

## Code style

- No defensive programming. Throw on unexpected state.
- `+server.ts` exports only HTTP method names or `_`-prefixed. Any other export breaks with 500.
- **No regex for text matching/parsing.** Use hand-written character-level DFA instead. Exceptions: route patterns in `+server.ts`, framework config files, command classification in `safeguard.ts`, Unicode surrogate replacement in `message-sanitizer.ts`, and the release sync script (`scripts/release.mjs`) for import path rewriting.

## AgentLoop FSM

`INIT → PRE_LLM → LLM_STREAMING → POST_LLM → (PRE_TOOL → TOOL_EXECUTING → AWAIT_CONFIRM → POST_TOOL)* → PERSIST_TURN → DONE`. LLM failure: `POST_LLM → LLM_RETRY_WAIT → LLM_STREAMING` (5 retries, 1s base backoff). `MAX_TOOL_ITERATIONS = 50`, summarizer uses 10.

## Message sanitizer

`sanitizeMessages` runs before every LLM call: strips empty messages, replaces Unicode surrogates, merges consecutive same-role messages, removes orphan tool results. Returns new array. Do not bypass.

## Tool confirmation & steering

- **Confirm**: agent emits `confirm_required` → Promise in `chat-confirm.ts` Map → UI dialog → POST `/api/confirm` resolves. `args.__confirmed` skips re-confirm.
- **Steer**: inject via `/api/steer` → loop drains `pendingSteering` from `chat-steering.ts` before each LLM call.

## Tool safety

`safeguard.ts`: `safe` (execute), `confirm` (wait for user), `reject` (deny). `args.__confirmed` skips re-confirm. `ToolContext.root` defaults to `process.cwd()`, overridden by `session.workspace` when set on the session.

## Context auto-continue

When `contextWindow - token_count < 20000` after reply: LLM compresses conversation → new session `[延续] xxx` with compression as system message → current exchange copied in → `forked` SSE event → frontend navigates to new session. Config `compressionMode`: `auto` (uses threshold above) or `custom` (uses `compressionThreshold`, default 256000). Compression is context-continuation; Summary (摘要) is a separate background system for diary/records.

## Auto-summarize

Worker starts in `hooks.server.ts`. Config: `autoSummarize`, `summaryMode` (`idle`/`scheduled`), `summaryIdleHours` (8), `summaryScheduleHour` (2), `summaryIntervalMin` (30). Requires `storageEnabled`.

## Gateway

`GatewayDispatcher` + adapters: `EmailAdapter` (SMTP, notify-only), `TelegramAdapter` (long-polling, receive+notify). Config: email SMTP settings, `telegramBotToken`, `telegramAllowedUsers`.

## Scheduled tasks

AI schedules one-shot tasks. `schedule_task` requires reading current time via `exec` first. Tasks run in isolated AgentLoop (no history, no memory, auto-deny confirm, 10min timeout). Retention: 100 tasks / 7 days. Notification via `gateway.notify()`.

## Unified theme

`src/lib/theme/default-theme.json` defines all colors as `{ "color-key": { light, dark } }`. Web generates CSS variables from it. CLI reads `~/.qualia/theme.json`'s `colors` dark values via `KEY_MAP`. API: `GET/PUT /api/theme`.

## Additional quirks

- `hooks.server.ts` auto-starts gateway, summarizer, and scheduler on import.
- `.svelte-kit/` is auto-generated; never edit.
- `~/.qualia/data/memory.md` is read fresh each time a session is entered (no snapshot). Workspace root `AGENTS.md` (if present) is auto-loaded as project context.
- `data/`, `docs/`, `opencode.json` are gitignored.
- The existing "rollback to here" feature (double-click undo button) deletes the message and subsequent content, placing the original text in the input box. Do not implement a separate "message editing" feature.

## Git

- Branch: `feature/<name>`, `fix/<name>`, `release/<version>`. Never commit to `main`.
- Feature/fix branches merged to `main` after stable. Release branches are **not** merged to `main` (immutable publishing snapshots).
- Commit messages: `prefix: short description`.
- Run `npm run check` before committing.

## Publishing

- `npm run release -- <version>`: bump → sync → build → pack
- Publish order: core → web → cli. Test with `npm link` or `npm pack` first.
- Old `.tgz` files can be deleted after publish.

## tsconfig

Root excludes `packages/`. `packages/web/` extends `.svelte-kit/tsconfig.json`.
