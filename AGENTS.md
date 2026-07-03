# AGENTS.md

## Project identity

Qualia — a local personal AI companion. SvelteKit full-stack app (Node.js backend + browser frontend in one process). Chinese-language UI, Material Design style.

## Monorepo dual-mode structure

The repo has two views of the same code:

| Layer | Dev workspace (root) | Published package |
|-------|---------------------|-------------------|
| Engine | `src/lib/agent/`, `src/lib/ai/`, `src/lib/storage/`, etc. | `packages/core/src/` → `@gatanot/qualia_core` |
| Web UI | `src/routes/`, `src/lib/components/`, `src/lib/session-store.ts`, etc. | `packages/web/src/` → `@gatanot/qualia_web` |
| CLI | — | `packages/cli/src/` → `@gatanot/qualia` |

**Root `src/` is the primary development source of truth.** `packages/core/src/` and `packages/web/src/` are snapshots for npm publishing only — they drift stale between publishes. All code changes go in root `src/`. Before publishing, sync root → packages.

Root `npm run` scripts delegate to workspaces via `-w`:
```sh
npm run dev            # → @gatanot/qualia_web (starts dev server at http://localhost:5173)
npm run check          # → @gatanot/qualia_web (svelte-kit sync + svelte-check)
npm run check:watch    # → @gatanot/qualia_web
npm run test           # → @gatanot/qualia_core (vitest run on packages/core/src, NOT root src/)
npm run check:core     # → @gatanot/qualia_core (tsc --noEmit)
npm run docs           # → @gatanot/qualia_web (TypeDoc → docs/)
```

To run tests against root `src/` (the dev workspace), use `npx vitest run` at root. For TDD: `npx vitest`. File pattern: `src/**/*.test.ts`.

- **`npm run check` is the primary verification** — always run it after changes.
- `npm run prepare` runs `svelte-kit sync || echo ''` (auto-runs on `npm install`).

## Stack & constraints

| Concern | Detail |
|---------|--------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript 6 + Vite 8 |
| Runes mode | **Forced** project-wide (except node_modules). Use `$state()`, `$props()`, `$effect()`, never legacy Svelte 4 syntax |
| Imports | `$lib` → `src/lib/`. Use `$lib/xxx` paths exclusively (alias is SvelteKit-managed, not in tsconfig) |
| DB | `better-sqlite3` (sync, native). Install after clone: `npm install` |
| Config | `~/.qualia/config.json` (auto-created; gitignored). Defaults in `src/lib/config/store.ts`. No `.env` file — all config is in-app. |
| Storage | `storageEnabled: false` by default (memory-only). Toggle in `/settings` |
| Providers | OpenAI (GPT-4o, GPT-4o Mini), DeepSeek (V4 Pro, V4 Flash), Xiaomi (MiMo V2.5, MiMo V2.5 Pro), Ollama (local). DeepSeek & Xiaomi models have `supportsReasoning: true`. MiMo V2.5 has `supportsVision: true`. Ollama gets a dynamic `ModelDef`. Model definitions in `src/lib/ai/models.ts`. |
| Config fields | `ProviderConfig` has optional `timeout` and `maxRetries`. `AppConfig`: `searchEnabled`, `searchProvider` (`searxng`|`tavily`), `searxngURL`, `tavilyApiKey`. `compressionMode` (`auto`|`custom`), `compressionThreshold` (default 256k). |

## Architecture

```
src/lib/
├── agent/           # AgentLoop, ContextBuilder, summarizer, diary, logger, prompts, types, message-sanitizer, summarize-worker
├── ai/              # AI providers (OpenAI, DeepSeek, Xiaomi, Ollama) + factory + types + utils
│   └── models.ts    # ModelDef per provider (contextWindow, reasoningEffortValues, supportsVision)
├── components/      # Svelte UI components + settings/ subdirectory + types.ts (UIMessage/ContentBlock)
├── concurrency/     # SessionLock, FileMutex, BackgroundWorker
├── config/          # AppConfig JSON read/write + ProviderConfig types
├── gateway/         # GatewayDispatcher + adapters (email, telegram, telegram-sessions)
├── storage/         # Storage interface + MemoryStorage + SQLiteStorage
├── task/            # Scheduled task system (store + scheduler + executor)
├── tool/            # ToolRegistry + 11 tools + safeguard.ts + types.ts
│   └── tools/       # Tool implementations + file-utils.ts
├── chat-confirm.ts              # Shared Map for pending confirmations
├── chat-steering.ts             # Shared Map for real-time intervention
├── markdown.ts                  # Markdown renderer (marked + highlight.js + KaTeX)
├── model-picker-state.svelte.ts # Client-side $state runes for model picker
├── paths.ts                     # ~/.qualia path resolution
├── session-store.ts             # Client-side writable stores for session list + CRUD
└── theme.ts                     # Light/dark theme (localStorage + media query)
```

`src/lib/` code is server-side **unless** imported by a `.svelte` component.
`session-store.ts` and `model-picker-state.svelte.ts` are client-side exceptions.

API routes under `src/routes/api/`:
- `chat/+server.ts` — POST → SSE streaming (AgentLoop)
- `confirm/+server.ts` — POST resolve tool confirmation
- `steer/+server.ts` — POST inject steering messages
- `config/+server.ts` — GET/PUT config CRUD
- `models/+server.ts` — GET list all models across configured providers
- `sessions/+server.ts` — GET list / POST create, setTitle, delete, getMessages
- `messages/+server.ts` — POST deleteFrom a given messageId
- `summarize/+server.ts` — POST trigger summarization
- `tasks/+server.ts` — GET list / POST pause, resume, delete
- `brand-icon/+server.ts` — GET/POST/DELETE custom brand icon

Pages: `/` (new chat), `/chat/[sessionId]`, `/records` (diary entries), `/settings`.
Root layout loads Material Symbols + Noto Sans SC fonts, renders SessionSidebar.

## Code style

- **不要防御性编程**。对不应发生的状态直接 throw Error，不要用 if-guard 吞掉。
- **`+server.ts` can ONLY export** `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`, `HEAD`, `fallback`, `prerender`, `trailingSlash`, `config`, `entries`, or `_`-prefixed names. Any other export causes a 500 error. Do NOT export helpers from `+server.ts` — put shared state in `src/lib/`.

## Tool confirmation flow

1. Agent yields `confirm_required` SSE event (with `confirmId`)
2. API handler stores a Promise in `src/lib/chat-confirm.ts` Map
3. Frontend shows dialog, POSTs to `/api/confirm` with `{ confirmId, approved }`
4. Confirm endpoint resolves the stored Promise → AgentLoop continues

## Steering (real-time intervention)

Inject messages into a running AgentLoop via `/api/steer`. The loop drains `pendingSteering` (from `src/lib/chat-steering.ts`) before each LLM call. Consumed steering emits `steering_consumed` SSE events.

## AgentLoop FSM

`AgentState` enum in `src/lib/agent/types.ts`: `INIT → PRE_LLM → LLM_STREAMING → POST_LLM → (PRE_TOOL → TOOL_EXECUTING → AWAIT_CONFIRM → POST_TOOL)* → PERSIST_TURN → DONE`. On LLM failure: `POST_LLM → LLM_RETRY_WAIT → LLM_STREAMING` (up to 5 retries, exponential backoff 1s base). `ERROR` state for unrecoverable failures. `LoopHooks` interface for lifecycle interception.

Hard caps: `MAX_TOOL_ITERATIONS = 50`, `MAX_LLM_RETRIES = 5`.

## Message sanitizer

`sanitizeMessages` in `src/lib/agent/message-sanitizer.ts` runs before every LLM call (4 stages):
1. Strips empty messages (except tool role)
2. Replaces Unicode surrogates with `\uFFFD`
3. Merges consecutive same-role messages
4. Removes orphan tool results (no matching `assistant.tool_calls[]`)

Returns new array without mutating input. Do NOT bypass this pipeline.

## Auto-summarize

`src/hooks.server.ts` starts `createSummarizeWorker` at server boot (with HMR dispose handler). Config fields:

| Field | Purpose |
|-------|---------|
| `autoSummarize` | Master toggle |
| `summaryMode` | `'idle'` (after N hours) or `'scheduled'` (at fixed hour daily) |
| `summaryIdleHours` | Idle threshold (default 8) |
| `summaryScheduleHour` | Hour of day (default 2) |
| `summaryIntervalMin` | Polling interval (default 30) |

Calls `generateSummary` → `generateDiary`. Both require `storageEnabled: true`.

## Gateway

`src/lib/gateway/` adapter framework:
- **`GatewayAdapter`** interface — `connect/disconnect/send` + `capabilities` (`receive`, `notify`)
- **`GatewayDispatcher`** — registry, `start/stop/notify/send`. Notifications fan out to all `capabilities.notify` adapters.
- **`EmailAdapter`** — SMTP only, `{ receive: false, notify: true }`.
- **`TelegramAdapter`** — long-polling, `{ receive: true, notify: true }`. Inbound → AgentLoop. Session bindings in `~/.qualia/data/telegram-sessions.json`.
- Config: `emailNotifications`, `emailSmtpHost/Port/Secure/User/Pass`, `emailFrom`, `emailTo`. `telegramBotToken`, `telegramAllowedUsers`.

## Scheduled tasks

`src/lib/task/` — AI can schedule one-shot tasks for future execution:
- `schedule_task` tool: models must use `exec` to read current time first
- `read_tasks` tool: reports results; AI must check manually (no auto-notification)
- Tasks run in isolated `AgentLoop` (no history, no memory writes, auto-deny confirmations, 10min timeout)
- Retention: last 100 tasks or 7 days, FIFO
- Notification via `gateway.notify()` on completion/failure

## Tool safety

`safeguard.ts` classifies commands as `safe | confirm | reject`:
- `safe`: execute immediately
- `confirm`: throw `PendingConfirmation`, wait for user
- `reject`: refuse (format, diskpart)

Tools use `args.__confirmed` to skip re-confirm on retry.

## Context window & auto-continue (压缩)

`ContextBuilder` loads all history. When `contextWindow - token_count < 20000` after reply:
1. LLM generates compression of conversation
2. New session `[延续] xxx` with compression as system message
3. Current exchange copied into new session
4. `forked` SSE event → frontend navigates to new session

Compression is temporary (context continuation only). **摘要** (summary) is a separate background system for diary/records.

## Git conventions

- Branch naming: `feature/<name>`, `fix/<name>`. Always work on a branch, never commit to `main`.
- Do NOT merge to `main` unless explicitly asked.
- Commit messages in Chinese: `prefix: 简要描述`.
- Run `npm run check` before committing.

## npm publishing

Three packages: `@gatanot/qualia_core` (engine), `@gatanot/qualia_web` (SvelteKit app), `@gatanot/qualia` (CLI, bin: qualia).

Test locally first to avoid version inflation:

```sh
# 1. npm link for fast iteration
cd packages/cli && npm link && qualia serve

# 2. Simulate real install
npm run build -w @gatanot/qualia_core
npm run build -w @gatanot/qualia_web
npm run build -w @gatanot/qualia
npm pack -w @gatanot/qualia_core
npm pack -w @gatanot/qualia_web
npm pack -w @gatanot/qualia
npm install -g "./gatanot-qualia_core-*.tgz" "./gatanot-qualia_web-*.tgz" "./gatanot-qualia-*.tgz"
qualia serve

# 3. Publish (dependency order)
npm publish -w @gatanot/qualia_core --access public
npm publish -w @gatanot/qualia_web  --access public
npm publish -w @gatanot/qualia     --access public
```

**Before publishing**: sync root `src/lib/` → `packages/core/src/` and root `src/routes/` → `packages/web/src/routes/`. Ensure:
- `packages/web/vite.config.ts` has `ssr.external: ['@gatanot/qualia_core', 'better-sqlite3']`
- Package `description` fields contain no Unicode special chars
- `@gatanot/qualia` dependency versions match actual releases

## tsconfig

- Root `tsconfig.json` excludes `packages/` — minimum config for root `src/`.
- `packages/web/tsconfig.json` extends `.svelte-kit/tsconfig.json` (auto-generated by `svelte-kit sync`).
- `packages/core/tsconfig.json` and `packages/cli/tsconfig.json` are self-contained (`tsc` compilation).
- `rewriteRelativeImportExtensions: true` is set but the codebase uses extensionless imports (e.g. `'./types'`). Prefer extensionless.

## Notable quirks

- `src/hooks.server.ts` has module-level side effects: `initGateway()`, `summarize.start()`, `startScheduler()` all auto-start on import.
- `svelte.config.js` forces runes mode via `compilerOptions.runes` (returns `true` for project files, `undefined` for `node_modules`).
- `src/lib/index.ts` is a SvelteKit scaffold placeholder — not a barrel file.
- `~/.qualia/data/memory.md` is read at session creation and snapshotted into `session.memory_snapshot`. Memory changes only affect new sessions.
- `process.cwd()` is used as the workspace root for tool path safety checks.
- `.svelte-kit/` contains auto-generated types — never edit manually.
- `.npmrc` sets `engine-strict=true`.
- `data/`, `docs/`, `opencode.json` are gitignored.
- 消息编辑重生成：已有「回退到此」功能（双击 undo 按钮）删除该消息及后续内容并将原文放入输入框，不需要单独实现"消息编辑"功能。
- `packages/core/src/` is a stale snapshot of root `src/lib/` subdirectories. Sync before publishing. Do not edit `packages/core/src/` directly.
