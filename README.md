# Qualia

本地优先的个人 AI 伙伴 —— 一个后端，三种形态：Web UI、终端 TUI、非交互 CLI。

不是"带历史记录的聊天壳"：Qualia 有结构化长期记忆、定时任务、日记与自动摘要、Email/Telegram 网关，所有数据存在本地 `~/.qualia`，用户完全可控。

## 特性

- **Agent 循环**：状态机驱动（`INIT → LLM_STREAMING → TOOL → PERSIST → DONE`），支持流式输出、失败重试、运行中注入新指令（steering）
- **12 个内置工具**：`exec` / `read_file` / `write_file` / `edit` / `delete_file` / `web_search` / `search_history` / `read_diary` / `read_memory` / `propose_memory` / `schedule_task` / `read_tasks`
- **工具安全分级**：每次调用被分类为 `safe`（直接执行）/ `confirm`（对话流内联确认）/ `reject`（拒绝），危险操作永远先问你
- **结构化长期记忆**：模型通过 `propose_memory` 提议，用户内联批准后才写入 SQLite；每条记忆有类型（fact / preference / rule / event）、来源、置信度和修订历史，检索驱动注入上下文而非全量塞 prompt
- **上下文自动续接**:接近上下文窗口上限时自动压缩对话并无缝转入新会话
- **后台系统**：空闲/定时自动摘要、AI 日记、一次性定时任务（隔离沙箱运行，结果经网关通知）
- **网关**：Telegram（收发消息）、Email SMTP（通知）
- **多模型**：OpenAI、DeepSeek、小米 MiMo、Ollama（本地）
- **统一主题**：Web 与 CLI 共享一份颜色定义，亮/暗模式
- **跨进程单后端**：多个 CLI / Web 客户端自动复用同一个后端进程，数据不打架

## 架构

```
┌─────────┐  ┌─────────┐  ┌──────────────┐
│ Web UI  │  │ 终端 TUI │  │ qualia -p "…" │
└────┬────┘  └────┬────┘  └──────┬───────┘
     │  HTTP + SSE（共享确认协议） │
     └────────────┼──────────────┘
        ┌─────────▼──────────┐
        │   共享后端（单例锁）  │
        │  AgentLoop · 工具   │
        │  记忆 · 任务 · 网关  │
        └─────────┬──────────┘
              ~/.qualia
        （SQLite · 配置 · 日记）
```

| 包 | 内容 |
|----|------|
| `@gatanot/qualia` | CLI：终端 TUI + 非交互模式 + 后端启动器 |
| `@gatanot/qualia_web` | Web UI（SvelteKit 全栈应用） |
| `@gatanot/qualia_core` | 引擎：AgentLoop、工具、记忆、存储、网关 |

## 快速开始

需要 Node.js（`better-sqlite3` 为原生模块，安装时需要 node-gyp + Python + C++ 构建工具链）。

```sh
npm install -g @gatanot/qualia

qualia                  # 进入交互式 TUI（自动拉起共享后端）
qualia -p "帮我总结这个目录的代码结构"   # 非交互单次任务
qualia serve --port 5173                # 启动 Web UI + 后台服务
qualia doctor           # 检查本地环境
qualia model list       # 查看可用模型
```

首次使用在 TUI / Web 设置页配置模型提供商（API Key），配置写入 `~/.qualia/config.json`，无需 `.env`。

### CLI 常用选项

```
--workspace <path>   指定工具工作区
--model <modelId>    仅本次运行覆盖默认模型
--session <id>       续接已有会话
--json               输出 JSONL（适合脚本编排）
```

## 开发

```sh
git clone <repo> && cd Qualia
npm install
npm run dev             # http://localhost:5173
```

Monorepo 布局：根目录 `src/` 是唯一源码真相，`packages/*/src/` 是发布快照。**修改根 `src/` 后必须先 `npm run sync`** 再 check / build。

```sh
npm run sync            # 根 src/ → packages/*/src/（含 import 重写）
npm run check           # svelte-check（packages/web）
npm run check:core      # tsc --noEmit（packages/core）
npm run test            # vitest（agent loop、并发原语、存储、sanitizer 等单测）
npm run build           # vite build
```

详细开发约定见 [AGENTS.md](AGENTS.md)，记忆系统设计文档见 [design.md](design.md)。

## 数据与隐私

所有状态（对话、记忆、日记、任务、配置）存于本地 `~/.qualia/`。没有遥测，没有云端同步；LLM 请求只发往你自己配置的提供商。

## License

MIT
