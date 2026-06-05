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
- `npm run prepare` runs `svelte-kit sync` on every `npm install`, generating `.svelte-kit/tsconfig.json`.
- `npm run docs` outputs to `docs/`, entry points defined in `typedoc.json`.
- There is no test runner yet.

## Stack & constraints

| Concern | Detail |
|---------|--------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript 6 + Vite 8 |
| Runes mode | **Forced** project-wide (except node_modules). Always use `$state()`, `$props()`, `$effect()`, not legacy Svelte 4 syntax |
| Imports | `$lib` → `src/lib/`. Use `$lib/xxx` paths exclusively (alias is SvelteKit-managed, not in tsconfig) |
| DB | `better-sqlite3` (sync, native). Install after clone: `npm install` |
| Config | `data/config.json` (auto-created; gitignored). Defaults in `src/lib/config/store.ts`. No `.env` file — all config is in-app. |
| Storage | `storageEnabled: false` by default (memory-only). Toggle in `/settings` |
| Providers | OpenAI (GPT-4o, GPT-4o Mini), DeepSeek (V4 Pro, V4 Flash), Xiaomi (MiMo V2.5, MiMo V2.5 Pro). DeepSeek & Xiaomi models have `supportsReasoning: true`. `ProviderConfig.reasoningEffort` enables reasoning; per-model UI options come from `ModelDef.reasoningEffortValues`. |

## Architecture

```
src/lib/
├── agent/           # ContextBuilder + AgentLoop + summarizer + diary + background + prompts + types
├── assets/          # Static assets (favicon.svg)
├── components/      # Svelte UI components + settings/ subdirectory
│   └── types.ts     # UIMessage/ContentBlock types
├── config/          # AppConfig JSON read/write + ProviderConfig types
├── provider/        # OpenAI + DeepSeek + Xiaomi API clients; factory: createProvider({ type })
│   └── models.ts    # ModelDef list for each provider (with contextWindow)
├── storage/         # Storage interface + MemoryStorage + SQLiteStorage
├── tool/            # ToolRegistry + 5 tools
│   ├── tools/       # Tool implementations (read_file, write_file, delete_file, exec, write_memory)
│   ├── safeguard.ts # Command safety classifier (safe | confirm | reject)
│   └── types.ts     # ToolDef, ToolResult, PendingConfirmation, CommandClassification
├── chat-confirm.ts             # Shared Map<string, Promise> for pending confirmations
├── markdown.ts                 # Markdown renderer (marked) with highlight.js code blocks
├── model-picker-state.svelte.ts # Client-side $state runes for model picker UI
├── session-store.ts            # Client-side Svelte stores for session list + CRUD helpers
└── theme.ts                    # Light/dark theme management (localStorage + media query)
```

`src/lib/` code is server-side **unless** imported by a `.svelte` component.
`session-store.ts` and `model-picker-state.svelte.ts` are exceptions — they're client-side only (use `writable` stores / `$state()` runes).

API routes:
- `api/brand-icon/+server.ts` — `GET`/`POST`/`DELETE` custom brand icon (uploaded to `data/brand-icon`)
- `api/chat/+server.ts` — `POST` → SSE streaming (AgentLoop)
- `api/confirm/+server.ts` — `POST` → resolve tool confirmation
- `api/models/+server.ts` — `GET` list all available models across configured providers
- `api/config/+server.ts` — `GET`/`PUT` config CRUD
- `api/sessions/+server.ts` — `GET` list / `POST` create, setTitle, delete, getMessages
- `api/messages/+server.ts` — `POST` deleteFrom a given messageId
- `api/summarize/+server.ts` — `POST` trigger summarization job (force or automatic)

Pages: `/` (new chat), `/chat/[sessionId]`, `/records` (summarized diary entries), `/settings`.
Root layout (`+layout.svelte`) loads Material Symbols + Noto Sans SC fonts, renders SessionSidebar.

## SvelteKit route file rules

- **`+server.ts` can ONLY export** `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`, `HEAD`, `fallback`, `prerender`, `trailingSlash`, `config`, `entries`, or `_`-prefixed names. Any other export causes a 500 error.
- Do NOT export helper functions from `+server.ts`. If two endpoints need shared state, put it in `src/lib/`.

## Tool confirmation flow

1. Agent yields `confirm_required` SSE event (with `confirmId`)
2. API handler stores a Promise in `src/lib/chat-confirm.ts` Map
3. Frontend shows dialog, on answer POSTs to `/api/confirm` with `{ confirmId, approved }`
4. Confirm endpoint resolves the stored Promise → AgentLoop continues

## AgentLoop error handling

LLM calls have built-in retry: 5 attempts, exponential backoff (1s base). The loop yields `retrying` and `retry_exhausted` events. On `retry_exhausted`, the chat ends with partial content.

## Auto-summarize background system

`hooks.server.ts` starts a polling loop (`runBackgroundTasks`) at server boot (with HMR dispose handler for clean timer teardown). Controlled by config fields:

| Field | Purpose |
|-------|---------|
| `autoSummarize` | Master toggle |
| `summaryMode` | `'idle'` (after N hours) or `'scheduled'` (at a fixed hour daily) |
| `summaryIdleHours` | Idle threshold in hours (default 8) |
| `summaryScheduleHour` | Hour of day for scheduled runs (default 2) |
| `summaryIntervalMin` | Polling interval in minutes (default 30) |

The summarize job calls `generateSummary` (consolidates chat history) then `generateDiary` (generates a diary entry). Both require `storageEnabled: true` and a configured provider.

## Tool safety

Tools use `args.__confirmed` to skip re-confirm on retry. `safeguard.ts` classifies commands as `safe | confirm | reject`:

- `safe`: execute immediately
- `confirm`: throw `PendingConfirmation`, wait for user
- `reject`: refuse (format, diskpart)

## Context window & auto-continue

- `ContextBuilder` loads **all** messages from history (no artificial limit).
- After `AgentLoop` completes a reply, if `contextWindow - token_count < 20000`:
  1. An LLM call generates a concise summary of the conversation so far.
  2. A new continuation session is created (`[延续] xxx`) with the summary injected as a system message.
  3. The current exchange (user message + assistant reply + tool results) is copied into the new session.
  4. A `forked` SSE event tells the frontend to navigate to the new session.
  5. The original session's `summary` field is also updated (benefits the diary/records system).
- `ProviderConfig.contextWindow` is optional — the chat API route backfills it from the active model's `contextWindow` (via `getContextWindow()`) before passing to `ContextBuilder`.

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

- `data/` and `docs/` directories are gitignored, auto-created at runtime
- `.svelte-kit/` contains auto-generated types — never edit manually
- `.npmrc` sets `engine-strict=true` — npm will reject incompatible Node/npm versions
- `process.cwd()` is used as the workspace root for tool path safety checks
- `src/lib/index.ts` is a SvelteKit scaffold placeholder with no meaningful exports — do not treat it as a barrel file
- Model definitions (IDs, context windows, reasoning support) live in `src/lib/provider/models.ts`. Add new models there if extending provider support.
