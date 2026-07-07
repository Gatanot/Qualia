# Qualia Memory System Design

## 判断

Qualia 的定位不是“带历史记录的聊天壳”，而是本地个人 AI 伙伴。对这个定位来说，记忆系统是核心产品能力，不是附属工具。好的记忆系统必须同时满足四个目标：

1. 记得住：能沉淀长期事实、偏好、项目背景、重要事件和用户明确规则。
2. 记得准：每条记忆有来源、时间、状态和可回溯证据，错误能被发现和修正。
3. 用得对：进入模型上下文的是当前任务真正相关的记忆，而不是把所有内容粗暴塞进 system prompt。
4. 用户可控：本地优先、可查看、可编辑、可删除、可导出，模型不能无声污染长期记忆。

> **实施状态（0.3.x）**：本文档以“候选收件箱”为目标状态撰写，但 0.3.0 落地时做了关键偏离——**放弃候选层，改为对话流内联确认**。各节均已标注实际实现与偏差，最权威的现状见文末「0.3.0 实施的取舍」。

早期的 `memory.md` 已废弃，能力全部迁到 SQLite 的结构化记忆系统（`memories` 表 + MemoryService）。Markdown 仅作导出格式，不再是 source of truth。

## 设计原则

### 本地优先

记忆默认存在 `~/.qualia` 下的 SQLite 数据库和可导出的 Markdown/JSON 文件中。所有写入、删除、合并和状态变化都应在本地完成。后续即使引入插件、MCP 或远程同步，也不能改变“用户拥有原始数据”的前提。

### 确认先于写入

模型不应默认直接写长期记忆。`propose_memory` 抛出 `PendingConfirmation`（与 exec/write_file 同一确认链），在写入前先让用户在对话流内联确认：批准后立即写为 active memory，拒绝则什么都不写，并把 `rejectHint` 回喂给模型重新协商。

> 历史设计曾采用“候选收件箱”（模型提出 → 候选表 → 用户异步接受/忽略/合并）。0.3.0 落地时改为对话流内联确认，移除候选/收件箱表，原因见「0.3.0 实施的取舍」。摘要、任务结果、日记因此不再自动产生候选（后台任务 auto-deny confirm，本就无法内联确认）。

### 事实和上下文分层

不是所有“记住”都是同一种数据。稳定事实、用户偏好、工作区知识、阶段性目标、情绪上下文、历史事件、任务结果应分层处理。稳定事实可以长期保留；阶段性目标应有有效期；情绪和会话上下文更适合进入摘要或 records，而不是永久注入系统提示词。

### 证据链优先

每条长期记忆都要能回答：它从哪次会话、哪条消息、哪个任务或哪篇日记来？什么时候创建？什么时候更新？由谁批准？是否被模型自动提出？这比“看起来像个知识库”更重要。

### 检索驱动上下文

长期记忆不应全量注入每次 LLM 调用。ContextBuilder 应根据当前会话、工作区、用户输入、最近摘要和任务类型选择相关记忆，并给模型明确标注来源和置信度。全量记忆只用于管理页、导出和人工检查。

## 目标架构

记忆系统分为四层：

1. 原始记录层：messages、sessions、audit_logs、tasks、diary、summaries。
2. 长期记忆层：用户内联确认后写入的 memories（`propose_memory` → `PendingConfirmation` → 确认 → active）。
3. 检索层：按类型、标签、时间、文本和后续向量索引召回相关记忆。
4. 展示层：记忆管理页、Markdown 导出、`read_memory` 工具、上下文注入。

> 目标状态原为五层（含候选层）。0.3.0 移除候选层，改为写入前内联确认，详见「确认先于写入」与「0.3.0 实施的取舍」。

现有 `memory.md` 已废弃（`~/.qualia/data/memory.md` 不再使用）。SQLite 是 source of truth，Markdown 仅作导出格式。

## 数据模型

### memories

长期记忆主表。实际字段（`storage/sqlite.ts`，`memory/types.ts`）：

- `id`: TEXT PRIMARY KEY
- `type`: `fact | preference | rule | event`
- `content`: TEXT，给模型和用户看的自然语言内容
- `source_session_id`: TEXT，可空
- `source_kind`: `chat | summary | diary | task | manual`
- `confidence`: REAL，0 到 1
- `status`: `active | superseded | archived`
- `priority`: INTEGER，用于上下文预算排序（rule 默认 10）
- `tags`: TEXT，JSON 数组
- `created_at` / `updated_at`: INTEGER

> 目标设计曾含 `scope`/`workspace`/`normalized_key`/`expires_at`/`approved_by`/`metadata` 等字段，0.3.0 未采用——记忆不分作用域，去重/合并/关系图谱推迟。

### memory_revisions

修订快照，回滚/审计依赖它。字段：`id`、`memory_id`、`content`、`confidence`、`status`、`priority`、`tags`、`created_at`。每次编辑/归档/回滚前保存旧状态。

### memory_candidates（已移除）

候选收件箱在 0.3.0 被替换为内联确认，此表未实现，不再保留。原设计字段（proposed_type/content/reason/evidence/status/duplicate_of…）仅作历史参考。

### memory_revisions（实际 schema 见上）

上文「memory_revisions」已列出落地字段。原目标设计的 `action`/`before`/`after`/`actor`/`reason` 字段未采用——修订表只存旧状态快照，动作与理由由 audit log 承载。

### memory_links（未实现）

记忆关系图谱（supports/contradicts/supersedes…）在记忆量达到数百条前无实际价值，未建表。

## 记忆类型

实际实现 4 种（`MemoryType`）：

### fact

稳定事实。例如用户姓名、常用设备、长期项目、重要身份信息。fact 需要高置信度，不应从含糊表达中自动写入。

### preference

交互偏好和技术偏好。例如回答风格、语言、框架选择、测试习惯。preference 可从重复行为中推断，但仍需用户内联确认。

### event

有时间属性的重要事件。例如“2026-07-06 决定把 Qualia 的记忆系统升级为结构化设计”。

### rule

用户明确要求长期遵守的规则。例如“不要直接编辑 packages/*/src”。rule 优先级最高（priority 默认 10），注入上下文时标注为用户长期规则。

> 目标设计的 `relationship` / `project` / `task_result` 类型未采用。项目经验目前靠 workspace `AGENTS.md` 自动加载（见「AGENTS.md」），不进 memories 表。

## 写入流程

### 对话中显式记住

当用户说“记住”“以后都”“我的偏好是”这类明确意图时，助手调用 `propose_memory`，在当前回复中内联弹出确认（web `ConfirmInline` / CLI `confirm-dialog`）；用户批准后写为 active memory，拒绝则不写并把 `rejectHint` 回喂模型重新协商。

### 摘要与日记不产记忆

自动摘要、日记、后台任务都在无人值守的后台运行（auto-deny confirm），无法完成内联确认，因此不写长期记忆。summary 供 records 页展示、日记供叙事连贯；若某条信息值得长期保留，应由用户在正常对话中让助手 `propose_memory`。

> 历史设计曾规划“摘要后自动提取候选”“日记/records 转候选”。候选层移除后这些路径不再适用；未来若需摘要/日记沉淀记忆，需另设“待用户 UI 确认的建议”机制，与内联确认链解耦。

### 工具写入

写入类工具只有 `propose_memory`（内联确认后写 active memory）。不存在直接覆盖式写入。

工具分工：

- `propose_memory`: 内联确认后写入长期记忆。
- `read_memory`: 检索 active memories。
- 管理操作（编辑、归档、删除、回滚）通过记忆管理页 UI + `/api/memory` 完成，不暴露为模型工具。

## 检索与上下文注入

### ContextBuilder 的职责

ContextBuilder 调用 `MemoryService.searchContext({ query })`，只用当前 user message 做文本匹配召回 active memories，按 `type`（rule 强加权）、`confidence`、`priority` 打分排序（`service.ts:_score`）。

> 目标设计曾规划用 session id / workspace / 最近 summary / 工具意图等多信号召回，0.3.0 只实现了 query 文本匹配。summary、最近消息未参与召回。

### 上下文格式

注入的记忆按 rule vs 其他分组，标注类型和置信度（`context-builder.ts:formatMemorySection`）：

```text
## 长期记忆

### 用户长期规则
- [rule, confidence: 1.0] ...

### 用户偏好与事实
- [偏好, confidence: 0.8] ...
- [事实, confidence: 1.0] ...
```

不要把低置信度记忆注入为高置信事实。预算 rule 20 条 / 其他 40 条。

### 预算控制

固定预算（`service.ts`）：

- rule: 最多 20 条，`_score` 中 +50 强加权
- 其他（fact/preference/event）: 最多 40 条
- 只召回 `_score > 0`（query 词命中）的记忆

后续可增加 embedding 与可配置预算（推迟）。

## UI 设计

### 内联确认（替代收件箱）

0.3.0 移除了异步收件箱，改为对话流内联确认（web `ConfirmInline` / CLI `confirm-dialog`）。助手 `propose_memory` 时，当前回复处直接弹出一张确认卡片：

- 建议记住的内容
- 类型（fact/preference/rule/event）
- 批准 / 拒绝

批准即写入 active memory；拒绝把 `rejectHint` 回喂模型。不再有 pending 列表、编辑后接受、合并等异步动作——这些改由记忆管理页处理已写入的记忆。

### 记忆管理页

管理页支持（`/api/memory`）：

- 按类型、状态过滤，搜索 active memories
- 编辑内容
- 归档或删除
- 查看来源和修订历史、回滚
- 导入 / 导出 Markdown/JSON

> 目标设计的“按 workspace 过滤”“合并重复记忆”未实现。

这页应是运维型界面，信息密度可以高一些。

### 对话内确认卡片

助手提出记忆时，对话流内直接渲染确认卡片，用户当场批准或拒绝，不留异步待办。同一时刻应避免堆叠多张卡片，逐条确认。

## API 与服务边界

MemoryService 封装所有记忆操作，路由、工具、摘要 worker、任务 executor 都通过它，不直接操作表。

实际方法（`memory/service.ts`）：

- `list(filters)` / `get(id)` / `exportAll()` / `import(memories)`
- `update(id, patch)` / `archive(id)` / `delete(id)`
- `listRevisions(memoryId)` / `rollback(memoryId, revisionId)`
- `searchContext(ctx)` — 检索注入用（rule 20 / 其他 40 预算）

写入不走 MemoryService 的 create——由 `propose_memory` 工具经内联确认后调 `storage.createMemory`，或管理页 POST `action: 'create'`。无 candidate 相关方法。

API 路由（`/api/memory/+server.ts`，单文件 GET/POST）：

- `GET /api/memory` — 列表（`?search`/`?type` 过滤 active）
- `GET /api/memory?export=1&format=md|json` — 导出
- `GET /api/memory?revisions=<id>` — 修订历史
- `POST /api/memory` — body `action`: `create | update | archive | delete | rollback | import`

无 `/api/memory/candidates` 端点。SvelteKit `+server.ts` 仍需只导出 HTTP method names 或 `_` 前缀辅助。

## 权限与审计

记忆写入纳入工具确认模型：

- `read_memory`: 默认安全。
- `propose_memory`: 写入前抛 `PendingConfirmation`，需用户内联确认；后台/定时任务 auto-deny，故永不写记忆。
- 管理操作（编辑、归档、删除、回滚）仅经记忆管理页 UI + `/api/memory`，不暴露为模型工具。

记忆变更写入 `memory_revisions`（回滚依赖它），工具调用另有 audit log 记录工具名、参数摘要、确认状态和结果。

## 与现有系统的关系

### summary

summary 是每会话的结构化压缩（`summarizer.ts`），存入 `sessions.summary`，供 records 页展示，并作为日记的输入。它不注入对话上下文，也不产生记忆。若某条摘要信息值得长期保留，应由用户在对话中让助手 `propose_memory`。

### diary

diary 是时间线叙事（`diary.ts`），由当天各会话摘要 + 近 7 天日记合成，用 `write_file` 写入 `~/.qualia/data/diary/YYYY-MM-DD.md`。

**健壮性（已修复）**：日记路径在 chat 工作区之外，后台任务 auto-deny confirm 曾导致 `write_file` 抛 `PendingConfirmation` 被静默吞掉、日记从不落盘。现 `completeWithToolLoop` 接受可选 `ToolContext`，`generateDiary` 传入根为 `getDataDir()` 的上下文，使写入判为 `safe`；循环结束后校验文件是否真的变更，未变更则用模型返回内容直接兜底写入。

**检索（已落地）**：`read_diary` 工具支持按日期读、跨全部日记关键词搜、列出可用日期。它与 `search_history`（聊天记录）、`read_memory`（长期记忆）区分。

**仍未做**：日记浏览 UI、注入对话上下文。日记本身不自动转记忆——沉淀仍走用户对话内 `propose_memory`。

### AGENTS.md

AGENTS.md 是当前工作区的外部项目指令，优先级高于普通 project memory。project memory 负责记录长期使用中形成的经验，例如常用命令、项目坑点、用户选择。

### memory.md（已废弃）

`~/.qualia/data/memory.md` 不再使用。SQLite 是唯一 source of truth，记忆通过 `/api/memory/export` 导出为 Markdown/JSON。原“启动时迁移旧 memory.md”方案未保留。

## 迁移策略

> `memory.md` 已废弃，原“启动迁移旧 memory.md 为候选”方案未落地，此节仅作历史参考。当前 schema 变更走 SQLite migrations（`storage/sqlite.ts`），必须可重复执行。

## 分阶段落地

### 0.3.0 结构化记忆（已落地）

- `memories` 表 + MemoryService + `memory_revisions`（回滚/审计），无 `memory_candidates` 候选表。
- `propose_memory` 内联确认写入 active memory；`read_memory` 检索。
- ContextBuilder 用 `searchContext` 按需检索注入（rule 20 / 其他 40 预算）。
- 记忆管理页 + `/api/memory`：编辑、归档、删除、修订历史、回滚、导入导出 Markdown。
- 4 种类型：fact / preference / rule / event。

### 0.3.x 后续（可选）

- 更好的文本打分。
- 预留或实现 embedding 索引。
- 上下文预算可配置。
- `read_memory` 支持类型、时间范围过滤。

### 摘要与日记改进（本轮）

方向：**让日记可见可检索 + 提质摘要/日记健壮性**（不打通到记忆，见「摘要与日记不产记忆」）。

- ✅ 日记检索/读回：`read_diary` 工具（按日期读 / 关键词搜 / 列日期），加入 CORE_TOOLS。
- ✅ 日记写入健壮性：`completeWithToolLoop` 支持传入 `ToolContext`，日记以 `getDataDir()` 为根使写入判为 `safe`；写入后校验 + 兜底直接写。
- ⬜ 日记浏览 UI：列出 `~/.qualia/data/diary/*.md`，按日期查看渲染后的叙事。
- ⬜ 摘要/日记 prompt 进一步提质。

### 0.4 主动伙伴联动

- 任务结果进入 records。
- recurring tasks 使用相关记忆构建上下文。
- 通知里可附带“是否记住这个结果”的轻操作（需与内联确认链解耦的 UI 建议机制）。

## 不建议做的事

不要一开始做复杂知识图谱。关系表可以预留，但第一版重点是来源、确认、管理和检索。

不要把所有历史消息向量化后称为记忆。历史搜索和长期记忆是两件事：历史是证据库，长期记忆是经过筛选的稳定知识。

不要让模型无确认直接写长期记忆。写入必须经 `propose_memory` 的内联确认。

不要复活 `memory.md` 或把它扩展成复杂 Markdown 协议。SQLite 是唯一 source of truth，Markdown 仅作导出。

不要把低置信度情绪判断永久保存。情绪上下文适合 summary/diary，不适合长期贴标签。

## 成功标准

一个好的 Qualia 记忆系统应满足：

- 用户能清楚看到 Qualia 记住了什么。
- 每条记忆都能追溯来源。
- 错误记忆能被删除、修正和回滚。
- 普通聊天不会被无关旧记忆干扰。
- 摘要、日记不会自动污染长期记忆；沉淀由用户在对话中内联确认。
- 数据可导出、可迁移，用户不被锁死。

如果只能优先做一件事，先做“结构化 memories 表 + 写入前确认”。它直接解决当前系统最大的问题。

## 0.3.0 实施的取舍

以上设计原为“候选收件箱”目标状态的完整描述。0.3.0 落地时做了关键偏离——**放弃候选层，改为对话流内联确认**：

**实际落地：**
- 长期记忆层 + 检索层（无候选层）
- 仅 `memories` 一张主表 + `memory_revisions`（回滚/审计），无 `memory_candidates`
- 4 种记忆类型：fact / preference / rule / event（无 scope/workspace 字段）
- **确认先于写入**：`propose_memory` → `PendingConfirmation` → 内联确认 → 直接写 active
- 检索替代全量注入的 ContextBuilder 策略
- 上下文预算控制（rule 20 / 其他 40）
- 记忆管理页：编辑、归档、删除、修订历史、回滚、导入导出 Markdown

**未实现 / 已放弃：**
- `memory_candidates` 收件箱 → 被内联确认取代
- `memory_links` 关系表 → 记忆量达到数百条前无实际价值
- embedding / 向量检索 → 文本匹配 + 分类过滤够用
- scope/workspace 维度 → 记忆不分作用域
- memory.md 迁移 → `memory.md` 直接废弃，无迁移

**推迟 / 不适用：**
- 摘要/日记/任务自动产生记忆 → 候选层移除后此路径不适用（见「摘要与日记不产记忆」）
- 摘要与日记改进（可见可检索）→ 本轮聚焦，见「分阶段落地」
