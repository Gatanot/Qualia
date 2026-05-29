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
├── provider/     # LLM API client (OpenAI-compatible). AIProvider interface
├── config/       # AppConfig JSON file read/write
├── tool/         # ToolRegistry + 4 built-in tools (read/write/delete file, exec)
├── storage/      # Storage interface + MemoryStorage + SQLiteStorage
├── agent/        # ContextBuilder (messages assembly) + AgentLoop (AsyncGenerator)
└── chat-confirm.ts  # Shared Map for pending confirmations across API routes
```

`src/lib/` code is server-side unless imported by a `.svelte` component.

API routes:
- `api/chat/+server.ts` — `POST` → SSE streaming (AgentLoop)
- `api/confirm/+server.ts` — `POST` → resolve tool confirmation
- `api/config/+server.ts` — `GET`/`PUT` config CRUD

## SvelteKit route file rules

- **`+server.ts` can ONLY export** `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`, `HEAD`, `fallback`, `prerender`, `trailingSlash`, `config`, `entries`, or `_`-prefixed names. Any other export causes a 500 error.
- Do NOT export helper functions from `+server.ts`. If two endpoints need shared state, put it in `src/lib/`.

## Tool confirmation flow

1. Agent yields `confirm_required` SSE event (with `confirmId`)
2. API handler stores a Promise in `src/lib/chat-confirm.ts` Map
3. Frontend shows dialog, on answer POSTs to `/api/confirm` with `{ confirmId, approved }`
4. Confirm endpoint resolves the stored Promise → AgentLoop continues

## Tool safety

Tools use `args.__confirmed` to skip re-confirm on retry. `safeguard.ts` classifies commands as `safe | confirm | reject`:

- `safe`: execute immediately
- `confirm`: throw `PendingConfirmation`, wait for user
- `reject`: refuse (format, diskpart)

## Context window & forking

When `contextWindow - token_count < 20000`, ContextBuilder triggers `forkSession()`. Summary generation is not yet implemented (placeholder text).

## Git conventions

- Branch naming: `feature/<name>` for new work, `fix/<name>` for bug fixes discovered outside active feature development.
- Merge to `main` when done, then delete the branch.
- Commit messages in Chinese, short format: `prefix: 简要描述`.
- No `develop` branch; `main` is the integration target.
- Run `npm run check` before committing.

## Notable quirks

- `data/` and `docs/` directories are gitignored, auto-created at runtime
- `.svelte-kit/` contains auto-generated types — never edit manually
- `.npmrc` sets `engine-strict=true` — npm will reject incompatible Node/npm versions
- `better-sqlite3` has a warning on install about `prebuild-install` — safe to ignore
- `process.cwd()` is used as the workspace root for tool path safety checks
