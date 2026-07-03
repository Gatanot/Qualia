# Qualia CLI/TUI 开发规划

## 目标

把 `@gatanot/qualia` 从“能启动 Web 服务和少量实验性 TUI”的状态，推进为一个可长期使用的本地 agent CLI/TUI：

- `qualia serve`：稳定启动已发布的 Web 应用。
- `qualia`：进入交互式 TUI，可完成多轮对话、工具调用、确认、打断、会话管理。
- `qualia -p/--prompt`：非交互单次任务，可用于脚本和 shell 管道。
- `qualia config/session/task/model/...`：提供必要的命令式管理入口。

CLI 不重新实现 agent 核心能力。模型、工具、存储、上下文构建、压缩、任务调度等能力必须复用 `@gatanot/qualia_core`。CLI 只负责参数解析、终端交互、渲染、进程生命周期和把用户意图映射到 core API。

## 当前问题判断

当前 `packages/cli/src/` 已经有基础代码，但还不能作为稳定产品继续叠功能：

- `cli.ts` 同时处理 Web server、prompt 占位、TUI 启动，缺少清晰命令架构。
- 多处中文字符串出现编码损坏，用户可见错误信息不可接受。
- `-p/--prompt` 只是占位，没有真正运行 AgentLoop。
- TUI 直接把很多运行时装配逻辑写在 `TUIApp.chatLoop` 中，难以复用给非交互模式和未来命令。
- TUI 编辑器只支持最小输入：缺少光标移动、多行输入、历史记录、粘贴处理、中文宽字符布局校正。
- 渲染层自己解析 ANSI 宽度，未系统处理 CJK、emoji、ANSI 截断和终端 resize。
- 确认流只有 y/n，缺少工具详情、风险等级、永久/本次批准策略、取消语义。
- 打断逻辑只覆盖当前 AbortController，工具子进程 PID 目前没有从工具执行链路可靠接入。
- 会话能力不足：不能选择历史会话、重命名、删除、恢复、分叉、查看摘要。
- 配置能力不足：仍依赖 Web `/settings` 完成大部分配置。
- CLI 依赖 `packages/core` 发布快照，而项目约定 root `src/` 才是源头；发布前必须解决同步和验证问题。

## 总体架构

### 包内结构

建议把 `packages/cli/src/` 调整为以下结构：

```text
packages/cli/src/
├── cli.ts                 # bin 入口，只做 bootstrap
├── commands/
│   ├── index.ts           # 命令注册与分发
│   ├── serve.ts
│   ├── chat.ts            # 默认 TUI
│   ├── prompt.ts          # 非交互单次任务
│   ├── config.ts
│   ├── session.ts
│   ├── task.ts
│   └── doctor.ts
├── runtime/
│   ├── agent-runner.ts    # 装配 provider/storage/tools/context/lock
│   ├── config-loader.ts   # CLI 友好的配置校验和错误输出
│   ├── events.ts          # AgentEvent 到 UI 事件的稳定转换
│   └── workspace.ts       # workspace 解析和安全检查
├── tui/
│   ├── app.ts
│   ├── terminal.ts
│   ├── input.ts
│   ├── layout.ts
│   ├── transcript.ts
│   ├── renderer.ts
│   ├── confirm.ts
│   ├── palette.ts
│   └── screens/
│       ├── chat-screen.ts
│       ├── command-palette.ts
│       ├── session-list.ts
│       ├── settings.ts
│       └── task-list.ts
├── output/
│   ├── plain.ts           # 非 TTY 输出
│   ├── jsonl.ts
│   └── markdown.ts
└── errors.ts
```

约束：

- `cli.ts` 不放业务逻辑，不直接创建 AgentLoop。
- `runtime/agent-runner.ts` 是唯一装配 AgentLoop 的地方，TUI 和 `--prompt` 共用。
- TUI 模块不能直接读写配置文件，必须通过 runtime 层。
- 不从 `+server.ts` 复制逻辑；需要共享的逻辑沉到 core 或 CLI runtime。
- 不编辑 `packages/core/src/` 作为开发源头；如发现 core API 缺口，先在 root `src/lib/` 设计，再同步发布包。

## 命令设计

### 顶层命令

```sh
qualia                         # 默认进入 TUI
qualia chat                    # 等价于默认 TUI
qualia -p "..."                # 单次任务，输出最终回答
qualia prompt "..."            # 等价命令式写法
qualia serve [--port 5173]     # 启动 Web 服务
qualia config ...              # 配置管理
qualia session ...             # 会话管理
qualia task ...                # 任务管理
qualia model ...               # 模型查看/选择
qualia doctor                  # 环境诊断
qualia --version
qualia --help
```

### 通用参数

```sh
--workspace <path>             # 工具执行和会话 workspace
--model <modelId>              # 覆盖 activeModel，仅本次运行
--storage on|off               # 覆盖 storageEnabled，仅本次运行
--session <id>                 # 使用已有会话
--new-session                  # 强制新建会话
--system <text>                # 本次追加/覆盖系统提示词，具体语义需固定
--json                         # 机器可读输出
--no-color                     # 禁用 ANSI
--debug                        # 输出诊断日志
```

规则：

- 非 TTY 环境默认走 plain/jsonl 输出，不进入 raw mode。
- TTY 环境默认启用 TUI，但 `-p` 永远是非交互。
- `--workspace` 必须解析为绝对路径，并写入 session.workspace，使工具安全边界与 Web 保持一致。
- 命令解析建议引入轻量库，例如 `commander` 或 `cac`。若不引入库，也必须集中实现 help、错误码和参数校验。

## AgentRunner 设计

新增 `AgentRunner`，统一 Web 以外的 CLI agent 运行方式。

职责：

- 读取并校验配置。
- 解析 active model、provider config、context window。
- 创建 provider、storage、tool registry、context builder。
- 创建或恢复 session。
- 处理 image/content 输入能力边界。
- 获取 session lock。
- 运行 AgentLoop 并转发 AgentEvent。
- 管理 AbortController。
- 提供确认回调注入点。

建议接口：

```ts
interface AgentRunOptions {
  workspace: string;
  message: string;
  sessionId?: string;
  modelId?: string;
  storageEnabled?: boolean;
  systemPrompt?: string;
  signal?: AbortSignal;
  onConfirm: ConfirmFn;
  onEvent(event: AgentEvent): Promise<void> | void;
}

interface AgentRunResult {
  sessionId: string;
  doneMessageId?: string;
  usage?: Usage;
  forkedSessionId?: string;
}
```

约束：

- TUI 不直接实例化 `ToolRegistry`、`ContextBuilder`、`AgentLoop`。
- `AgentRunner` 对配置错误抛出结构化错误，UI 层决定怎么显示。
- `AgentRunner` 不直接写终端，不依赖 TUI。
- `AgentRunner` 对 `retrying`、`retry_exhausted`、`forked`、`done` 等事件不吞掉，全部交给上层。

## TUI 功能规划

### 主界面

第一版主界面分为四个区域：

- 顶栏：应用名、模型、会话标题/ID、workspace、存储状态。
- transcript：消息、推理、工具调用、工具输出、错误、fork 提示。
- 状态栏：当前状态、token/usage、快捷键提示、重试/压缩状态。
- 输入栏：单行或多行编辑器。

最小可用快捷键：

```text
Enter              发送
Shift+Enter        换行
Ctrl+C             空闲时退出；运行时第一次打断，第二次退出
Esc                运行时打断当前回答/工具；空闲时关闭弹层
Ctrl+L             重绘屏幕
Ctrl+R             打开历史会话列表
Ctrl+P             打开命令面板
PageUp/PageDown    滚动 transcript
Ctrl+U             清空当前输入
```

实现约束：

- 所有 UI 状态必须有单一状态模型，避免渲染层直接修改业务状态。
- 输入、确认弹层、命令面板必须有焦点管理，同一时刻只能有一个组件消费按键。
- 终端退出必须恢复 raw mode、光标、alternate screen 和颜色。
- TUI 不能依赖浏览器能力，也不能复用 Svelte 组件。

### 输入编辑器

必须支持：

- 中文输入和宽字符显示。
- 光标左右移动、Home/End、Backspace/Delete。
- 多行输入。
- 粘贴大段文本。
- 输入历史上下切换。
- 非 TTY fallback：从 stdin 读取完整文本。

建议引入或实现 `string-width`、`slice-ansi`、`strip-ansi` 级别能力。不要继续用 `string.length` 判断终端宽度。

### Transcript 渲染

必须支持：

- Markdown 基础渲染：标题、列表、引用、代码块、行内代码、链接。
- 代码块语法高亮，失败时回退纯文本。
- CJK 自动换行。
- ANSI 安全截断。
- 工具调用折叠/展开。
- 长工具输出默认折叠，提供查看全部入口。
- 运行中增量更新，避免全屏闪烁。

约束：

- 渲染器输入是纯数据模型，不直接读取 AgentEvent。
- 所有截断必须按显示宽度，不按 UTF-16 长度。
- 错误、确认、工具输出需要固定视觉层级，不能和 assistant 普通文本混在一起。

### 工具确认

确认弹层需要展示：

- 工具名。
- 风险原因。
- 关键参数摘要。
- 可能修改的路径或将执行的命令。
- 选项：批准、拒绝、查看详情、复制命令/路径。

快捷键：

```text
y      批准本次
n      拒绝
d      查看详情
Esc    拒绝并关闭
```

约束：

- 默认焦点不能是批准。
- 被打断时必须 resolve `false`。
- 确认期间 transcript 仍能显示背景状态，但输入栏不可编辑。
- 不实现“永久批准”直到 safeguard 具备可审计的策略存储。

### 打断和进程生命周期

必须明确三类打断：

- 取消 LLM 流：AbortController abort。
- 取消确认：确认 Promise resolve false。
- 取消工具执行：需要 core 工具层暴露子进程取消能力或统一 signal 传入。

第一阶段若 core 还不能取消工具子进程，CLI 必须明确显示“正在等待工具结束”，不能假装已取消。

约束：

- Ctrl+C 行为必须一致：空闲退出；运行时先取消；取消后再次 Ctrl+C 强退。
- dispose 必须幂等。
- uncaughtException/unhandledRejection/SIGINT/SIGTERM 都要恢复终端。

## 非交互模式

`qualia -p "..."` 必须真正运行 agent。

默认行为：

- 输出 assistant 最终内容到 stdout。
- 工具调用、确认、重试、错误输出到 stderr。
- 如果工具需要确认，默认拒绝，除非传入明确参数。

建议参数：

```sh
qualia -p "总结 README"
qualia -p "运行测试" --yes
qualia -p "..." --json
qualia -p "..." --session <id>
qualia -p "..." --workspace .
```

确认策略：

- 默认：所有 confirm 自动拒绝。
- `--yes`：允许 confirm 级别操作，但 reject 仍由 safeguard 拒绝。
- 后续可加 `--confirm ask`，在 TTY 中逐项询问。

输出模式：

- plain：只输出最终回答。
- stream：边生成边输出内容。
- json：最终输出 `{ sessionId, messageId, content, usage }`。
- jsonl：每个 AgentEvent 一行，适合脚本。

错误码：

```text
0  成功
1  一般错误
2  参数错误
3  配置错误
4  模型/供应商不可用
5  用户取消或确认拒绝
6  Agent 运行失败
7  工具失败
```

## 会话管理

命令：

```sh
qualia session list
qualia session show <id>
qualia session open <id>       # 进入 TUI 并恢复该会话
qualia session rename <id> ...
qualia session delete <id>
qualia session export <id> --format markdown|json
```

TUI 内能力：

- 会话列表。
- 搜索标题和消息片段。
- 新建会话。
- 恢复会话。
- 删除前确认。
- fork 后自动切换到新 session，并显示明确提示。

约束：

- storage disabled 时仍允许当前内存会话运行，但会话列表功能应提示不可用。
- 删除会话必须走 storage API，不直接操作 SQLite 文件。

## 配置和模型管理

命令：

```sh
qualia model list
qualia model use <modelId>
qualia config get [key]
qualia config set <key> <value>
qualia config path
qualia doctor
```

第一阶段只支持低风险配置项：

- activeModel
- storageEnabled
- searchEnabled
- searchProvider
- searxngURL
- compressionMode
- compressionThreshold

API key、SMTP 密码、Telegram token 等敏感项可以后置；实现前必须规划输入隐藏、权限和避免 shell history 泄漏。

`doctor` 检查：

- Node 版本。
- `~/.qualia/config.json` 是否可读写。
- active model 是否存在。
- provider API key 是否配置。
- SQLite 是否可加载。
- 当前 workspace 是否可访问。
- 终端是否支持 TTY/raw mode/颜色。

## 任务管理

命令：

```sh
qualia task list
qualia task show <id>
qualia task pause <id>
qualia task resume <id>
qualia task delete <id>
```

TUI 内提供任务列表屏幕，至少显示：

- ID。
- 状态。
- 计划时间。
- 最近结果。
- 错误信息。

约束：

- 不在 CLI 内重新实现 scheduler。
- 如果任务系统依赖 server boot side effects，需要把启动逻辑沉到 core 的显式 API，然后 CLI/Web 都调用同一入口。

## Web serve

`qualia serve` 目标是稳定运行已发布 Web 包：

- 支持 `--port`。
- 支持 `--host`。
- 支持端口占用错误提示。
- SIGINT/SIGTERM 优雅关闭。
- 启动时打印配置路径和访问 URL。

约束：

- `serve` 不进入 TUI。
- `serve` 不修改配置。
- 如果 `@gatanot/qualia_web/handler` 加载失败，错误信息必须说明是否可能是包未构建或发布包缺文件。

## Core API 缺口

开发 CLI/TUI 时，优先把以下共用能力沉到 core：

- 创建标准 agent runtime 的 helper，减少 Web chat route 和 CLI 重复装配。
- 工具执行取消 signal 传递。
- 结构化工具风险摘要。
- session list/search/export 的稳定 storage API。
- scheduler 显式 start/stop API。
- `AgentLogger` 在 CLI 下的可配置输出。

约束：

- root `src/lib/` 是 core 开发源头。
- 只有发布同步时才更新 `packages/core/src/`。
- 不允许 CLI 通过访问 core 内部未导出的路径绕过 exports。

## 测试策略

### 单元测试

需要覆盖：

- 参数解析。
- AgentRunner 配置错误和模型选择。
- 非交互模式输出。
- 确认策略。
- 渲染器宽度、ANSI 截断、CJK 换行。
- 输入编辑器基础按键。
- TUI 状态机。

### 集成测试

需要覆盖：

- `qualia --help`。
- `qualia doctor`。
- `qualia -p "..." --json`，使用 mock provider。
- 工具确认自动拒绝。
- storage on/off 下新建会话。
- fork event 更新 session。

### 手工验证清单

每次 CLI 功能迭代至少验证：

- Windows PowerShell。
- Windows Terminal。
- macOS/Linux 终端（发布前）。
- 80x24 小窗口。
- 中文输入。
- Ctrl+C、Esc、异常退出后终端恢复。
- storage disabled 和 enabled。
- 至少一个真实 provider。

仓库约定中 `npm run check` 是主验证。CLI 变更还必须运行：

```sh
npm run check -w @gatanot/qualia
npm run build -w @gatanot/qualia
```

如果改了 root `src/lib/`，还要运行：

```sh
npm run check
npx vitest run
```

## 开发阶段

### 阶段 0：止血和基线

目标：让当前 CLI 不再以损坏状态继续扩张。

任务：

- 修复所有 CLI 用户可见中文乱码。
- 修复损坏的模板字符串和错误输出。
- 给 `cli.ts` 增加 `--help`、`--version`。
- 明确 Node/TTY 不满足时的错误提示。
- 给当前 TUI 加最小 smoke test 或构建检查。

验收：

- `npm run check -w @gatanot/qualia` 通过。
- `npm run build -w @gatanot/qualia` 通过。
- `qualia --help` 可读。
- `qualia serve --port 5173` 行为稳定。

### 阶段 1：抽出 AgentRunner

目标：统一 TUI 和非交互运行链路。

任务：

- 新建 `runtime/agent-runner.ts`。
- 把 TUI 中 provider/storage/tool/context/lock 装配迁移进去。
- TUI 只订阅 runner event。
- 实现结构化 CLI 错误类型。
- 实现 `qualia -p "..."` 的最小可用版本。

验收：

- TUI 和 `-p` 共享同一 runner。
- 配置缺失、模型缺失、provider 缺失有清晰中文错误。
- `-p` 可真实得到模型回复。

### 阶段 2：命令系统

目标：建立可扩展 CLI 命令骨架。

任务：

- 引入或实现命令分发。
- 拆分 `serve/chat/prompt/doctor/model/config/session`。
- 增加统一 help、version、错误码。
- 增加 `--workspace`、`--model`、`--storage`。

验收：

- 每个命令都有 help。
- 参数错误返回 exit code 2。
- 配置错误返回 exit code 3。

### 阶段 3：TUI 可用性

目标：TUI 达到日常多轮 agent 使用水平。

任务：

- 重做输入编辑器：光标、多行、历史、粘贴、CJK。
- 重做 layout 和 transcript 数据模型。
- 加滚动、重绘、resize。
- 工具调用和工具结果分块显示。
- 确认弹层展示详情。
- 明确 Ctrl+C/Esc 行为。

验收：

- 中文输入和长文本粘贴可用。
- 工具确认可读、可拒绝、可打断。
- 终端异常退出后能恢复。

### 阶段 4：会话、模型、配置

目标：CLI 不再强依赖 Web settings。

任务：

- `model list/use`。
- `config get/set/path`。
- `session list/show/open/delete/export`。
- TUI 内会话列表和命令面板。

验收：

- 新用户可通过 CLI 完成基本配置检查和模型选择。
- 可从 CLI 恢复历史会话。

### 阶段 5：任务和通知

目标：CLI 覆盖 Qualia 的长期 companion 能力。

任务：

- `task list/show/pause/resume/delete`。
- TUI 任务屏幕。
- 明确 CLI 是否启动 scheduler；如需要，先沉到 core 显式 API。
- 展示 gateway 通知状态，不在 CLI 中重复实现 adapter。

验收：

- CLI 可查看和管理已有任务。
- 任务系统行为与 Web 一致。

### 阶段 6：发布质量

目标：作为 npm 包可安装、可诊断、可维护。

任务：

- 完整打包验证。
- `npm pack` 后全局安装测试。
- Windows/macOS/Linux smoke test。
- 文档补充 README CLI 段落。
- 发布前同步 root `src/lib/` 到 `packages/core/src/`，root `src/routes/` 到 `packages/web/src/routes/`。

验收：

- `qualia serve`、`qualia`、`qualia -p` 在全局安装后可用。
- `doctor` 能定位常见安装和配置问题。

## 禁止事项

- 不在 CLI 内复制 Web API route 的大段逻辑。
- 不在 CLI 内绕过 storage/tool/config 的公开 API 直接读写内部文件，除非该文件本身就是配置文件 API 的一部分。
- 不直接编辑 `.svelte-kit/`。
- 不把敏感配置通过命令行参数作为推荐路径写入文档。
- 不让 TUI raw mode 异常退出后污染用户终端。
- 不吞掉不应发生的状态；按项目约定直接 throw Error，并在命令边界转成用户可读错误。
- 不在 `+server.ts` 中导出 helper。
- 不把 root `src/` 和 `packages/core/src/` 的源头关系弄反。

## 优先级总结

最高优先级是先修正 CLI 基线和抽出 `AgentRunner`，否则 TUI、`-p`、session、task 都会各自复制一份 agent 装配逻辑。第二优先级是输入、渲染、确认、打断这些 TUI 基础交互；它们决定 CLI agent 是否真正可用。第三优先级才是更完整的配置、任务和发布体验。
