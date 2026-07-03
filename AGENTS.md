# AGENTS.md

## Project identity

Qualia — a local personal AI companion. SvelteKit full-stack app (Node.js backend + browser frontend in one process). Chinese-language UI, Material Design style.

## Key commands

```sh
npm run dev          # start dev server (http://localhost:5173)
npm run check        # type-check everything (svelte-kit sync + svelte-check)
npm run check:watch  # type-check on file change
npm run docs         # regenerate TypeDoc HTML to docs/
```

- `npm run check` is the **primary verification** — always run it after changes. It syncs SvelteKit types first, then type-checks.
- `npm run docs` outputs to `docs/`; entry points defined in `typedoc.json`.
- `npm run test` runs vitest (`src/**/*.test.ts`); `npm run test:watch` for TDD.
- `npm run prepare` runs `svelte-kit sync || echo ''` (the `|| echo ''` prevents failure on brand-new installs where `.svelte-kit` doesn't exist yet). It auto-runs on every `npm install`.

## Stack & constraints

| Concern | Detail |
|---------|--------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript 6 + Vite 8 |
| Runes mode | **Forced** project-wide (except node_modules). Always use `$state()`, `$props()`, `$effect()`, not legacy Svelte 4 syntax |
| Imports | `$lib` → `src/lib/`. Use `$lib/xxx` paths exclusively (alias is SvelteKit-managed, not in tsconfig) |
| DB | `better-sqlite3` (sync, native). Install after clone: `npm install` |
| Config | `~/.qualia/config.json` (auto-created; gitignored). Defaults in `src/lib/config/store.ts`. No `.env` file — all config is in-app. |
| Storage | `storageEnabled: false` by default (memory-only). Toggle in `/settings` |
| Providers | OpenAI (GPT-4o, GPT-4o Mini), DeepSeek (V4 Pro, V4 Flash), Xiaomi (MiMo V2.5, MiMo V2.5 Pro), Ollama (local, extends OpenAI compat). DeepSeek & Xiaomi models have `supportsReasoning: true`. `ProviderConfig.reasoningEffort` enables reasoning; per-model UI options come from `ModelDef.reasoningEffortValues`. MiMo V2.5 has `supportsVision: true` — can process image inputs. Ollama models get a dynamic `ModelDef` with 128k default context window. |
| Config fields | `ProviderConfig` has optional `timeout` and `maxRetries` fields. `AppConfig` has web search settings: `searchEnabled`, `searchProvider` (`searxng`|`tavily`), `searxngURL`, `tavilyApiKey`. Compression: `compressionMode` (`auto`|`custom`) and `compressionThreshold` (default 256k). |

## Architecture

```
src/lib/
├── agent/           # index.ts barrel + ContextBuilder + AgentLoop + summarizer + diary + background + prompts + types + message-sanitizer + logger
├── assets/          # Static assets (favicon.svg)
├── components/      # Svelte UI components + settings/ subdirectory
│   └── types.ts     # UIMessage/ContentBlock types
├── concurrency/     # SessionLock (per-session serialization), FileMutex (per-file), BackgroundWorker (interval scheduling)
├── config/          # AppConfig JSON read/write + ProviderConfig types
├── gateway/          # Gateway abstraction + adapters (email, telegram)
│   ├── index.ts      # Barrel: GatewayDispatcher, all adapters, types
│   ├── types.ts      # GatewayAdapter interface, capabilities flags, notification types
│   ├── dispatcher.ts # GatewayDispatcher — adapter lifecycle, event routing, notify()
│   └── adapters/     # Platform adapters (email.ts, telegram.ts, telegram-sessions.ts)
├── ai/              # AI providers (OpenAI, DeepSeek, Xiaomi, Ollama) + index.ts barrel + factory + types + utils
│   ├── models.ts    # ModelDef list per provider (contextWindow, reasoningEffortValues, supportsVision)
├── storage/         # Storage interface + MemoryStorage + SQLiteStorage
├── task/            # Scheduled task system (store + scheduler + executor)
├── tool/            # ToolRegistry + 11 tools
│   ├── tools/       # Tool implementations (read-file, write-file, delete-file, edit, exec, write-memory, read-memory, web-search, search-history, schedule-task, read-tasks) + file-utils.ts shared helpers
│   ├── safeguard.ts # Command safety classifier (safe | confirm | reject)
│   └── types.ts     # ToolDef, ToolResult, PendingConfirmation, CommandClassification
├── chat-confirm.ts              # Shared Map<string, Promise> for pending confirmations
├── chat-steering.ts             # Shared Map<string, SteeringMessage[]> for real-time intervention
├── markdown.ts                  # Markdown renderer (marked) with highlight.js code blocks + KaTeX math
├── model-picker-state.svelte.ts # Client-side $state runes for model picker UI
├── paths.ts                     # Resolves ~/.qualia paths (config, data dir, memory.md, tasks.json, db.sqlite)
├── session-store.ts             # Client-side Svelte stores for session list + CRUD helpers
└── theme.ts                     # Light/dark theme management (localStorage + media query)
```

`src/lib/` code is server-side **unless** imported by a `.svelte` component.
`session-store.ts` and `model-picker-state.svelte.ts` are exceptions — they're client-side only (use `writable` stores / `$state()` runes).

API routes:
- `api/brand-icon/+server.ts` — `GET`/`POST`/`DELETE` custom brand icon (uploaded to `data/brand-icon` in `~/.qualia/data/`)
- `api/steer/+server.ts` — `POST` inject steering messages into an active AgentLoop
- `api/chat/+server.ts` — `POST` → SSE streaming (AgentLoop)
- `api/confirm/+server.ts` — `POST` → resolve tool confirmation
- `api/models/+server.ts` — `GET` list all available models across configured providers
- `api/config/+server.ts` — `GET`/`PUT` config CRUD
- `api/tasks/+server.ts` — `GET` list tasks / `POST` pause, resume, delete a task
- `api/sessions/+server.ts` — `GET` list / `POST` create, setTitle, delete, getMessages
- `api/messages/+server.ts` — `POST` deleteFrom a given messageId
- `api/summarize/+server.ts` — `POST` trigger summarization job (force or automatic)

Pages: `/` (new chat), `/chat/[sessionId]`, `/records` (summarized diary entries), `/settings`.
Root layout (`+layout.svelte`) loads Material Symbols + Noto Sans SC fonts, renders SessionSidebar.

## Code style

- **不要防御性编程**。开发阶段暴露错误优于静默处理。对不应发生的状态（如 double-release、无效参数）直接 throw Error，不要用 if-guard 或 fallback 吞掉。错误暴露得越早，调试成本越低。

- **`+server.ts` can ONLY export** `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`, `HEAD`, `fallback`, `prerender`, `trailingSlash`, `config`, `entries`, or `_`-prefixed names. Any other export causes a 500 error.
- Do NOT export helper functions from `+server.ts`. If two endpoints need shared state, put it in `src/lib/`.

## Tool confirmation flow

1. Agent yields `confirm_required` SSE event (with `confirmId`)
2. API handler stores a Promise in `src/lib/chat-confirm.ts` Map
3. Frontend shows dialog, on answer POSTs to `/api/confirm` with `{ confirmId, approved }`
4. Confirm endpoint resolves the stored Promise → AgentLoop continues

## Steering (real-time intervention)

Users can inject messages into a running AgentLoop via `/api/steer`. The loop drains `pendingSteering` (from `src/lib/chat-steering.ts`) before each LLM call, injecting steering text as a system message. Consumed steering emits `steering_consumed` SSE events so the frontend can clean them from the input queue.

## AgentLoop FSM architecture

`AgentLoop` implements a formal state machine (`AgentState` enum in `src/lib/agent/types.ts`): `INIT → PRE_LLM → LLM_STREAMING → POST_LLM → (PRE_TOOL → TOOL_EXECUTING → AWAIT_CONFIRM → POST_TOOL)* → PERSIST_TURN → DONE`. `ERROR` state exists for unrecoverable failures (exhausted retries, caps exceeded). On LLM call failure: `POST_LLM → LLM_RETRY_WAIT → LLM_STREAMING` (up to 5 retries, exponential backoff).  
`LoopHooks` interface exposes lifecycle hooks (`beforeLlmCall`, `afterLlmCall`, `beforeToolExecution`, `afterToolExecution`, etc.) for extension modules to intercept the loop.

## AgentLoop error handling

LLM calls have built-in retry: 5 attempts, exponential backoff (1s base). The loop yields `retrying` and `retry_exhausted` events. On `retry_exhausted`, the chat ends with partial content.

**Hard caps**: `MAX_TOOL_ITERATIONS = 50` — the loop will error out if tool calls exceed this limit. `MAX_LLM_RETRIES = 5` for LLM API calls.

## Message sanitizer

`sanitizeMessages` in `src/lib/agent/message-sanitizer.ts` is a pipeline that cleans messages before every LLM call. It runs in 4 stages:
1. Strips empty messages (no content and no tool_calls, except tool role)
2. Replaces Unicode surrogates (`\uD800-\uDFFF`) with `\uFFFD`
3. Merges consecutive same-role messages (user→user, assistant→assistant without tool_calls)
4. Removes orphan tool results (tool messages whose `tool_call_id` doesn't match any preceding `assistant.tool_calls[]`)

It returns a new array without mutating the input. Do NOT bypass this pipeline.

## Auto-summarize background system

`hooks.server.ts` starts a `BackgroundWorker` (`src/lib/concurrency/background-worker.ts`) at server boot, which runs `runSummarizeJob` on a configurable interval (with HMR dispose handler for clean timer teardown). Controlled by config fields:

| Field | Purpose |
|-------|---------|
| `autoSummarize` | Master toggle |
| `summaryMode` | `'idle'` (after N hours) or `'scheduled'` (at a fixed hour daily) |
| `summaryIdleHours` | Idle threshold in hours (default 8) |
| `summaryScheduleHour` | Hour of day for scheduled runs (default 2) |
| `summaryIntervalMin` | Polling interval in minutes (default 30) |

The summarize job calls `generateSummary` (consolidates chat history) then `generateDiary` (generates a diary entry). Both require `storageEnabled: true` and a configured provider.  
On completion, if `emailNotifications` is enabled, the Gateway sends a summary via EmailAdapter.

## Gateway

`src/lib/gateway/` provides an extensible adapter framework for external platform integration:

- **`GatewayAdapter` interface** — `connect/disconnect/send` lifecycle + `capabilities` flags (`receive`, `notify`)
- **`GatewayDispatcher`** — registry of adapters, `start/stop/notify/send` methods. Notifications fan out to all adapters with `capabilities.notify`.
- **`EmailAdapter`** — SMTP-only (no IMAP polling). Declares `{ receive: false, notify: true }`. Used for task completion notifications from `hooks.server.ts`.
- **`TelegramAdapter`** — long-polling `getUpdates`, registers `{ receive: true, notify: true }`. Inbound messages route through `GatewayDispatcher.onInbound()` → AgentLoop. Uses `~/.qualia/data/telegram-sessions.json` to bind each `chatId` to the most recent session (main session model). On agent fork, the binding is updated to the new `[延续]` session.
- **Config fields**: `emailNotifications`, `emailSmtpHost/Port/Secure/User/Pass`, `emailFrom`, `emailTo`. `telegramBotToken`, `telegramAllowedUsers`.

`hooks.server.ts` initializes the Gateway at startup and routes summarize-job results through `gateway.notify()`.

## Scheduled tasks

`src/lib/task/` implements a background task system that lets the AI schedule one-shot tasks for future execution:

- **`schedule_task` tool** — creates a task with a future ISO timestamp. The model must use `exec` to read the current system time before setting the schedule.
- **`read_tasks` tool** — queries task list and results. The AI is NOT automatically notified of completions; it must check manually.
- **Task execution** — each task runs in an isolated `AgentLoop` with no conversation history, no memory writes, auto-deny for tool confirmations, and a 10-minute timeout. Result saved to `~/.qualia/data/tasks.json`.
- **Retention** — FIFO, last 100 tasks or last 7 days, whichever comes first. Archived results persist in `~/.qualia/data/tasks.json`.
- **Settings page** — `/settings` → 任务 tab: list tasks with pause/resume/delete per-task.
- **Notification** — on completion or failure, the scheduler calls `gateway.notify()` which delivers via Email (or future Telegram).

## Tool safety

Tools use `args.__confirmed` to skip re-confirm on retry. `safeguard.ts` classifies commands as `safe | confirm | reject`:

- `safe`: execute immediately
- `confirm`: throw `PendingConfirmation`, wait for user
- `reject`: refuse (format, diskpart)

## Context window & auto-continue (压缩)

`ContextBuilder` loads **all** messages from history. When `contextWindow - token_count < 20000` after a reply, the AgentLoop forks:

1. An LLM call generates a conversation compression (temporary, for context continuation)
2. A new session `[延续] xxx` is created with the compression injected as a system message
3. The current exchange is copied into the new session
4. A `forked` SSE event tells the frontend to navigate to the new session

The compression is **not** a persistent summary — it only serves context continuation.  
**摘要** (summary) is a separate system: the background `runSummarizeJob` in `hooks.server.ts` generates persistent session summaries used for diary/records. The two are independent.

## Git conventions

- Branch naming: `feature/<name>` for new work, `fix/<name>` for bug fixes discovered outside active feature development.
- **All development must be done on a feature/fix branch.** Never commit directly to `main`.
- **Do NOT merge to `main` unless the user explicitly asks.** Wait for a clear instruction like "合并到 main" before merging.

- Commit messages in Chinese, short format: `prefix: 简要描述`.
- Run `npm run check` before committing.

## tsconfig

- `tsconfig.json` extends `.svelte-kit/tsconfig.json` (auto-generated by `svelte-kit sync`). The generated config manages all path aliases.
- `rewriteRelativeImportExtensions: true` is set but not enforced by existing code — the codebase uses extensionless relative imports (e.g. `'./types'`). Both styles work; prefer extensionless to match existing convention.

## Notable quirks

- `data/` and `docs/` directories are gitignored. Runtime data lives at `~/.qualia/data/` — paths are resolved by `src/lib/paths.ts`.
- `~/.qualia/data/memory.md` is the persistent memory file written by `write_memory`. Content is read at session creation and snapshotted into `session.memory_snapshot`, so memory changes only affect new sessions.
- `opencode.json` is gitignored — local-only OpenCode agent config.
- `.svelte-kit/` contains auto-generated types — never edit manually
- `.npmrc` sets `engine-strict=true` — npm will reject incompatible Node/npm versions
- `process.cwd()` is used as the workspace root for tool path safety checks
- `hooks.server.ts` has module-level side effects: `initGateway()`, `runBackgroundTasks()`, and `startScheduler()` all auto-start on import. It also exports `gateway` for use by API routes.
- `svelte.config.js` forces runes mode via `compilerOptions.runes` — returns `true` for project files, `undefined` for `node_modules`.
- `src/lib/index.ts` is a SvelteKit scaffold placeholder with no meaningful exports — do not treat it as a barrel file
- Model definitions (IDs, context windows, reasoning support) live in `src/lib/ai/models.ts`. Add new models there if extending provider support.
- 消息编辑重生成功能**不需要**单独实现。已有的「回退到此」功能（双击 undo 按钮）会删除该消息及后续所有内容并将原文放入输入框，用户在输入框中修改后重新发送即可达到相同效果。
