# Qualia 后续发展建议

## 判断

Qualia 现在已经超过“本地 ChatGPT 外壳”的阶段：它有本地配置、SQLite 会话存储、长期记忆、自动摘要/日记、任务调度、网关通知、工具调用、安全确认、上下文延续和 Web/CLI 发布雏形。接下来最值得投入的方向不是继续横向堆 provider 或工具，而是把“本地个人 AI 伙伴”这个定位做深：可靠记住用户、能主动跟进、能安全操作本机、能解释自己为什么这样做，并且在长期使用中不损坏数据。

我的建议是按三个阶段推进：先稳底座，再强化个人化与主动性，最后做扩展和发布。

## 基于 Git 历史的修订

补看历史后，原建议需要做几处重心调整。

第一，CLI/TUI 应从“后续扩展”前移为核心产品线。最近提交集中在 TUI：slash commands、inline confirm、`/model`、`/session`、`/undo`、footer、历史加载、选择器、欢迎页、CJK 宽度、差分渲染、主题共享等。这说明项目已经不只是 Web-first，而是“双入口个人 AI 伙伴”：Web 适合长期配置、记录、管理；CLI 适合开发工作流、远程机器和高频操作。因此 0.2 不应只做 `qualia doctor`，还应做 CLI/Web 能力一致性和 TUI 稳定性。

第二，过去很多提交是 bug fix 和回滚，说明核心链路已进入“功能够用但容易回归”的阶段。典型历史包括 storageEnabled 默认值、history 加载、undo 行为、Gateway 通知、Telegram 鉴权、任务竞态、上下文 fork、工具安全绕过、reasoning 持久化、旧 data 目录迁移回滚等。路线图应把“回归测试矩阵”和“升级/迁移策略”前移，而不是只笼统说补测试。

第三，工作区已经是产品主线。历史里已经完成 workspace 选择、文件夹浏览器、侧边栏按工作区分组、session 关联 workspace、AgentLoop 动态 ToolContext。原建议中的“工作区画像”不应放在 0.4 太靠后，至少应在 0.2 做最小版：每个 workspace 的默认模型、允许工具、常用命令、项目说明、最近会话摘要。

第四，统一主题已经落地到 Web/CLI 共享颜色。原建议里的主题只作为工程卫生不够，应补充“跨入口体验一致性”：主题、Markdown 渲染、工具调用折叠、确认 UI、模型选择、会话选择、undo/rollback 语义都应尽量一致。

第五，LLM 指令/工具描述已从中文改英文以提升 function calling。后续新增工具、任务 prompt、压缩 prompt、摘要 prompt 时应固定这个原则：内部控制指令优先英文，用户可见文本按界面语言输出。否则历史上的指令遵循优化会被新功能稀释。

## 阶段一：先把底座做稳

1. 建立数据迁移与备份机制

当前 SQLite 表结构已经有手写迁移，但还没有版本化 schema。建议新增 `schema_migrations` 表，把每次结构调整做成显式版本，并提供启动时自动迁移、迁移失败回滚、导出备份、恢复备份能力。Qualia 的核心资产是记忆、日记、任务和会话，一旦用户把它当个人伙伴使用，数据损坏会比模型回答失败严重得多。

2. 给 AgentLoop、SSE、任务执行补关键测试

已有测试主要覆盖消息清洗、并发锁、文件互斥、后台 worker、日志和工具环境。下一步应优先补这些路径：

- AgentLoop：工具调用、多轮工具、确认中断、LLM retry、达到 `MAX_TOOL_ITERATIONS`、steering 注入、context fork。
- `/api/chat` SSE：首条消息、客户端中断、错误事件、`X-Session-Id` 跳转。
- 任务系统：任务超时、auto-deny confirmation、失败通知、重复调度防抖。
- SQLiteStorage：迁移、rollback/deleteFrom、forkSession、message search、memory snapshot。

这些测试会直接保护产品最容易出事故的地方。

3. 统一发布链路

根 `src/` 是源头，`packages/*/src/` 是发布快照，这个策略可以继续，但需要一个明确脚本完成 root -> packages 同步、检查、构建、打包。现在包版本看起来已经出现不同步风险，例如 `@gatanot/qualia_web` 依赖 `@gatanot/qualia_core ^0.1.1`，而 core 包显示为 `0.1.2`；CLI 又是 `0.1.4`。建议做一个 `npm run sync:packages` 和 `npm run release:local`，把版本、快照、build、pack 串成单一路径，避免手工发布漂移。

4. 把安全策略从“命令分类”升级为“权限模型”

`safeguard.ts` 已经能分类 safe/confirm/reject，但未来工具更多后，仅靠命令字符串会变脆。建议引入工具级权限声明，例如：

- filesystem.read
- filesystem.write
- filesystem.delete
- process.exec
- network.search
- memory.write
- task.schedule
- notification.send

每个工具声明能力，AgentLoop 在执行前统一做权限判断、确认、审计日志。这样后续做插件或 MCP 时，不会把安全规则散落到每个工具内部。

5. 增加操作审计日志

本地 AI 伙伴会执行文件、命令、记忆写入和任务调度。建议保存一份结构化审计日志，记录时间、会话、工具名、参数摘要、确认结果、执行结果、工作区。UI 上可以在设置或记录页查看。它既能帮助用户信任系统，也能帮助调试“它为什么改了这个文件”。

6. 建立跨入口回归矩阵

Git 历史显示很多问题不是单点功能缺失，而是 Web、CLI、storageEnabled、session、workspace、history、undo、confirm 之间的组合回归。建议建立一份固定冒烟矩阵：

- Web 新会话、历史会话、图片消息、工具确认、rollback、steering。
- CLI 新会话、历史加载、`/model`、`/session`、`/undo`、inline confirm、非 TTY prompt。
- storageEnabled on/off 两种模式。
- workspace 指定/未指定两种模式。
- provider 不存在、模型切换、reasoning 开关。

这份矩阵可以先是手工 checklist，再逐步自动化。

7. 最小化配置/数据迁移风险

历史里出现过旧 `data/` 到 `~/.qualia/data/` 自动迁移并回滚，说明迁移策略需要更保守。建议迁移必须满足：先备份、可重复执行、写入迁移日志、失败不删除源数据、提供 `doctor` 检查和手动修复建议。个人 AI 伙伴的数据迁移应宁可慢一点，也不要自动吞掉用户资产。

## 阶段二：把“个人 AI 伙伴”做深

1. 重构长期记忆为结构化记忆

当前长期记忆是 `memory.md`，优点是透明、可编辑，缺点是难以检索、去重、置信度管理和遗忘。建议保留 Markdown 作为用户可见层，但底层增加结构化记忆表：

- fact：稳定事实，例如用户姓名、偏好、设备、长期项目。
- preference：交互偏好、回答风格、技术栈习惯。
- event：有时间的事件。
- relationship：人物、组织、项目之间的关系。
- rule：用户明确要求的长期规则。

每条记忆建议包含 `content`、`source_session_id`、`created_at`、`updated_at`、`confidence`、`status`、`tags`。AI 写入记忆前可以生成候选，UI 提供批准、编辑、删除、合并。

2. 做“记忆收件箱”

不要让模型直接无声写长期记忆。更好的体验是：模型提出“我建议记住这些”，进入记忆收件箱；用户可以一键接受、编辑、忽略。对于低风险偏好可自动写入，但也要可回溯。这样可以避免个人 AI 最常见的问题：越用越“自信地记错”。

3. 让日记和摘要变成可用的时间线

现在已有自动摘要和每日 diary，这是很好的差异点。下一步建议把 `/records` 做成真正的个人时间线：

- 按日期查看今天做了什么、讨论了什么、AI 完成了什么任务。
- 支持按项目/工作区过滤。
- 摘要中关联原始会话，点击可跳回上下文。
- 标记重要事件并沉淀为长期记忆候选。

这样 Qualia 会从“聊天记录列表”变成“个人活动记录系统”。

4. 强化任务系统的主动性

任务目前是 one-shot，更像提醒加后台 Agent。建议下一步支持：

- 递归任务：每天、每周、每月、工作日。
- 条件任务：当文件变化、日记出现某关键词、某接口返回状态时触发。
- 任务预演：执行前展示将使用哪些工具、哪些权限。
- 任务结果归档：完成后自动进入 records，并可转成记忆。

注意不要急着做复杂自动化平台。先把“提醒我跟进 X，并在到点时基于上下文帮我处理”做好，这更符合个人伙伴定位。

5. 做工作区画像

代码里已有 session workspace。建议围绕工作区建立画像：每个 workspace 有自己的项目说明、常用命令、安全边界、历史摘要、偏好模型、允许工具。这样 Qualia 在不同项目中会表现出不同上下文，而不是全局混在一起。

这个方向应提前做最小版，因为 Git 历史已经表明 workspace 是近期主线，不是远期增强。最小版可以只包含 `workspace.json` 或 SQLite 表中的说明、默认模型、允许工具、最近摘要，不必一开始做复杂项目知识库。

## 阶段三：扩展、互通与发布

1. 插件系统可以做，但要晚于权限模型

ToolRegistry 已经有 sourceId，明显为扩展系统留了口子。建议等权限模型、审计日志和工具 manifest 稳定后，再做插件。插件 manifest 至少应包含名称、版本、工具列表、权限、配置 schema、入口文件。否则插件会很快变成安全和兼容性负担。

2. Provider 层做“能力协商”

`models.ts` 目前是静态模型表。后续可抽象为能力协商：

- contextWindow
- supportsVision
- supportsReasoning
- supportsToolCalling
- supportsStructuredOutput
- maxOutputTokens
- pricing 或 costLevel

UI 不要只展示模型名，而要基于能力禁用图片、推理、工具、长上下文等功能。这样添加 Ollama 或更多 OpenAI 兼容 provider 时会少很多特判。

3. CLI 不要只做 Web 启动器

这个建议需要修改：从 Git 历史看，CLI 已经不是 Web 启动器，而是正在快速产品化的主入口。建议让 CLI 明确承担这些角色：

- `qualia serve`：启动本地 Web。
- `qualia chat`：终端会话，适合远程机器。
- `qualia doctor`：检查配置、数据库、provider、依赖、端口、主题、发布包一致性。
- `qualia prompt`：脚本化单次任务，输出可管道处理。
- `qualia model/session/config`：低成本管理常用状态。

其中 `doctor` 对个人本地软件非常实用，也能减少 issue 排查成本。CLI 接下来更重要的是稳定交互契约：slash command 行为、选择器键位、undo 语义、确认弹层、历史恢复都应有测试或至少有快照式冒烟脚本。

4. 统一 Web/CLI 的体验契约

历史已经做了统一主题，但还需要统一更高层的交互语义：

- Web rollback 与 CLI `/undo` 的边界要一致：是撤回未发送输入、撤回最后一轮，还是删除历史消息。
- 工具确认在 Web inline confirm 与 CLI inline confirm 中应使用同一套事件语义。
- 模型选择、会话选择、工作区选择应复用 core 能力，不要让 Web/CLI 各自发明排序和过滤规则。
- Markdown、代码高亮、工具调用折叠、reasoning 展示尽量共享格式约定。

这比继续单独美化某一个入口更重要。

5. 做导入/导出与可迁移性

个人 AI 产品一定要让用户能带走数据。建议提供：

- 导出全部数据为目录：config、theme、memory、diary、sessions、tasks、attachments。
- 导出单个会话为 Markdown/JSON。
- 导入旧数据并做 schema migration。
- 清除 API key 后的分享包。

这会显著提高用户信任。

## 产品体验优先级

短期最值得做的 UI 改进：

1. 设置页增加“系统状态”：当前模型、存储路径、数据库大小、后台 worker 状态、网关状态、最近一次摘要时间、最近一次任务扫描时间。
2. 会话页显示工具执行审计入口，用户能展开每次工具调用的参数、结果、确认状态。
3. records 页升级为时间线，而不是仅仅显示摘要。
4. 任务页增加手动运行、暂停、复制、查看历史结果。
5. 记忆页单独成页，支持搜索、编辑、删除、接受候选记忆。

这些都直接服务于“长期使用”而不是一次性演示。

## 工程卫生建议

1. 明确所有源码、脚本和发布包使用 UTF-8。PowerShell 下读取中文容易显示异常，发布包描述里也已经能看到 mojibake 痕迹，建议加 `.editorconfig` 并在 CI 或脚本中检查文本编码。
2. 给 API route 增加统一错误结构，便于前端恢复和调试。
3. 给后台 worker 增加生命周期状态和健康检查，避免 hooks import 后静默失败。
4. 把搜索、任务、通知这些可选能力拆成更清晰的配置校验，设置页保存时就提示不可用原因。
5. 避免继续扩大 `+page.svelte` 单文件复杂度，聊天页可以拆出 SSE client、message reducer、confirm handler、rollback handler。

## 建议路线图

### 0.2：可靠性版本

- ~~schema migration~~ — 跳过：当前功能未稳定、无正式发布，无历史 schema 需兼容
- ~~数据备份/恢复~~ — 跳过：同上，无存量用户数据需要保护
- AgentLoop/API/任务关键测试 — 部分完成：新增 loop.test.ts (11) + sqlite.test.ts (8)，核心路径已覆盖（工具调用、确认、重试、MAX_TOOL_ITERATIONS、审计日志、forkSession、deleteSession）
- Web/CLI 回归冒烟矩阵 — 未完成：无 CI/e2e 基础设施
- CLI/TUI 稳定化：slash commands、选择器、undo、confirm、history — 已完成
- ~~workspace 画像最小版~~ — 跳过：职责移交给用户自行创建的 AGENTS.md（workspace 根目录自动加载）
- 权限声明与审计日志 — 已完成：safeguard.ts 已有命令分类；新增 audit_logs 表 + AgentLoop 内 logAudit() 钩子 + GET /api/audit
- package sync/release 脚本 — 已完成：scripts/release.mjs
- `qualia doctor` — 已完成：packages/cli/src/commands/doctor.ts

### 0.3：个人记忆版本

- 结构化记忆表
- 记忆收件箱
- 记忆管理页
- records 时间线
- 会话摘要与记忆候选联动

### 0.4：主动伙伴版本

- 递归任务
- 任务历史结果
- 工作区画像增强：项目知识、常用命令、工具权限 profile
- 通知交互增强
- 任务结果自动归档到 records

### 0.5：扩展版本

- 插件 manifest
- 工具权限沙箱
- Provider 能力协商
- 导入/导出
- CLI chat/serve/doctor 完整化

## 当前不建议优先做的事

1. 不建议马上做复杂插件市场。权限、审计、版本兼容还没稳，太早开放会拖慢主线。
2. 不建议先追求更多 provider。当前更缺的是能力治理、错误恢复和长期记忆质量。
3. 不建议把 UI 做成营销型首页。Qualia 的价值在长期使用，第一屏应该继续服务于“直接开始对话/处理任务”。
4. 不建议把 `packages/*/src` 当成并行开发源。继续保持根 `src/` 为唯一源头，但必须自动化同步。

## 一句话结论

Qualia 下一阶段最该做的是“可信赖的长期本地伙伴”：把数据、权限、审计、记忆和任务做扎实。等这些稳定后，再扩展插件和发布生态，项目的定位会比普通聊天客户端清晰得多。

