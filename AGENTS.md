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
- There is no test runner yet.

## Stack & constraints

| Concern | Detail |
|---------|--------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript 6 + Vite 8 |
| Runes mode | **Forced** project-wide (except node_modules). Always use `$state()`, `$props()`, `$effect()`, not legacy Svelte 4 syntax |
| Imports | `$lib` → `src/lib/`. Use `$lib/xxx` paths exclusively (alias is SvelteKit-managed, not in tsconfig) |
| DB | `better-sqlite3` (sync, native). Install after clone: `npm install` |
| Config | `data/config.json` (auto-created; gitignored). Defaults in `src/lib/config/store.ts` |
| Storage | `storageEnabled: false` by default (memory-only). Toggle in `/settings` |

## Architecture

```
src/lib/
├── agent/           # ContextBuilder + AgentLoop + prompts + types
├── assets/          # Static assets (favicon.svg)
├── components/      # Svelte UI components + settings/ subdirectory
│   └── types.ts     # UIMessage/ContentBlock types
├── config/          # AppConfig JSON read/write + ProviderConfig types
├── provider/        # OpenAI + DeepSeek API clients; factory: createProvider({ type })
│   └── models.ts    # ModelDef list for each provider (with contextWindow)
├── storage/         # Storage interface + MemoryStorage + SQLiteStorage
├── tool/            # ToolRegistry + 4 tools (read_file/write_file/delete_file/exec)
│   ├── safeguard.ts # Command safety classifier (safe | confirm | reject)
│   └── types.ts     # ToolDef, ToolResult, PendingConfirmation, CommandClassification
├── chat-confirm.ts  # Shared Map<string, Promise> for pending confirmations
├── markdown.ts      # Markdown renderer (marked) with highlight.js code blocks
├── session-store.ts # Client-side Svelte stores for session list + CRUD helpers
└── theme.ts         # Light/dark theme management (localStorage + media query)
```

`src/lib/` code is server-side **unless** imported by a `.svelte` component.
`session-store.ts` is the key exception — it's client-side only (uses `writable` stores).

API routes:
- `api/brand-icon/+server.ts` — `GET`/`POST`/`DELETE` custom brand icon (uploaded to `data/brand-icon`)
- `api/chat/+server.ts` — `POST` → SSE streaming (AgentLoop)
- `api/confirm/+server.ts` — `POST` → resolve tool confirmation
- `api/config/+server.ts` — `GET`/`PUT` config CRUD
- `api/sessions/+server.ts` — `GET` list / `POST` create, setTitle, delete, getMessages
- `api/messages/+server.ts` — `POST` deleteFrom a given messageId

Chat pages at `/` (new chat) and `/chat/[sessionId]`. Settings at `/settings`.
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

## Tool safety

Tools use `args.__confirmed` to skip re-confirm on retry. `safeguard.ts` classifies commands as `safe | confirm | reject`:

- `safe`: execute immediately
- `confirm`: throw `PendingConfirmation`, wait for user
- `reject`: refuse (format, diskpart)

## Context window & forking

- `ContextBuilder` loads **all** messages from history (no artificial limit — the token-based fork mechanism is the sole gatekeeper).
- When `contextWindow - token_count < 20000`, triggers `forkSession()` — creates a new session with `parent_id` pointing to the original. Summary generation is not yet implemented (placeholder text).
- `ProviderConfig.contextWindow` is optional — the chat API route backfills it from the active model's `contextWindow` (via `getContextWindow()`) before passing to `ContextBuilder`.

## Git conventions

- Branch naming: `feature/<name>` for new work, `fix/<name>` for bug fixes discovered outside active feature development.
- **All development must be done on a feature/fix branch.** Never commit directly to `main`.
- **Do NOT merge to `main` unless the user explicitly asks.** Wait for a clear instruction like "合并到 main" before merging.
- After merging, delete the feature branch.
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
