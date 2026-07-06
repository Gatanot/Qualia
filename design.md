# Qualia Memory System Design

## 判断

Qualia 的定位不是“带历史记录的聊天壳”，而是本地个人 AI 伙伴。对这个定位来说，记忆系统是核心产品能力，不是附属工具。好的记忆系统必须同时满足四个目标：

1. 记得住：能沉淀长期事实、偏好、项目背景、重要事件和用户明确规则。
2. 记得准：每条记忆有来源、时间、状态和可回溯证据，错误能被发现和修正。
3. 用得对：进入模型上下文的是当前任务真正相关的记忆，而不是把所有内容粗暴塞进 system prompt。
4. 用户可控：本地优先、可查看、可编辑、可删除、可导出，模型不能无声污染长期记忆。

当前 `memory.md` 的价值是透明和简单，适合作为早期 MVP；但它不适合作为未来的主记忆层。它缺少结构、来源、置信度、候选流程、去重、检索和遗忘机制。未来应保留 Markdown 作为用户可见层和迁移兼容层，把真实能力迁到 SQLite 的结构化记忆系统。

## 设计原则

### 本地优先

记忆默认存在 `~/.qualia` 下的 SQLite 数据库和可导出的 Markdown/JSON 文件中。所有写入、删除、合并和状态变化都应在本地完成。后续即使引入插件、MCP 或远程同步，也不能改变“用户拥有原始数据”的前提。

### 候选先于写入

模型不应默认直接写长期记忆。对话、摘要、任务结果、日记都可以产生“记忆候选”，候选进入收件箱，由用户接受、编辑、忽略或合并。低风险用户可以开启自动接受策略，但自动接受也必须留下审计记录，并允许回滚。

### 事实和上下文分层

不是所有“记住”都是同一种数据。稳定事实、用户偏好、工作区知识、阶段性目标、情绪上下文、历史事件、任务结果应分层处理。稳定事实可以长期保留；阶段性目标应有有效期；情绪和会话上下文更适合进入摘要或 records，而不是永久注入系统提示词。

### 证据链优先

每条长期记忆都要能回答：它从哪次会话、哪条消息、哪个任务或哪篇日记来？什么时候创建？什么时候更新？由谁批准？是否被模型自动提出？这比“看起来像个知识库”更重要。

### 检索驱动上下文

长期记忆不应全量注入每次 LLM 调用。ContextBuilder 应根据当前会话、工作区、用户输入、最近摘要和任务类型选择相关记忆，并给模型明确标注来源和置信度。全量记忆只用于管理页、导出和人工检查。

## 目标架构

记忆系统分为五层：

1. 原始记录层：messages、sessions、audit_logs、tasks、diary、summaries。
2. 候选层：模型或规则从原始记录中提取的 memory_candidates。
3. 长期记忆层：用户批准或策略自动接受后的 memories。
4. 检索层：按工作区、类型、标签、时间、文本和后续向量索引召回相关记忆。
5. 展示层：记忆管理页、Markdown 导出、`read_memory` 工具、上下文注入。

现有 `memory.md` 应降级为兼容和导出格式：仍可手动编辑，但不再是唯一真相。迁移后，SQLite 是 source of truth，Markdown 是 projection。

## 数据模型

### memories

长期记忆主表。

字段建议：

- `id`: TEXT PRIMARY KEY
- `type`: `fact | preference | event | relationship | rule | project | task_result`
- `scope`: `global | workspace | session`
- `workspace`: TEXT，空字符串表示全局
- `content`: TEXT，给模型和用户看的自然语言内容
- `normalized_key`: TEXT，用于同类记忆去重和合并，例如 `user.name`、`project.qualia.command.check`
- `source_session_id`: TEXT
- `source_message_id`: TEXT
- `source_kind`: `chat | summary | diary | task | manual | import`
- `confidence`: REAL，0 到 1
- `status`: `active | superseded | archived | rejected`
- `priority`: INTEGER，用于上下文预算排序
- `tags`: TEXT，JSON 数组
- `created_at`: INTEGER
- `updated_at`: INTEGER
- `last_used_at`: INTEGER
- `expires_at`: INTEGER，可空
- `approved_by`: `user | policy | migration`
- `metadata`: TEXT，JSON 对象

### memory_candidates

候选记忆收件箱。

字段建议：

- `id`: TEXT PRIMARY KEY
- `proposed_type`: TEXT
- `proposed_scope`: TEXT
- `workspace`: TEXT
- `content`: TEXT
- `reason`: TEXT，为什么建议记住
- `evidence`: TEXT，JSON 数组，包含 session/message/task/diary 引用
- `confidence`: REAL
- `status`: `pending | accepted | edited | ignored | merged | rejected`
- `duplicate_of`: TEXT，可空，指向可能重复的 memory id
- `created_at`: INTEGER
- `resolved_at`: INTEGER
- `resolved_memory_id`: TEXT

### memory_revisions

记录记忆变更历史，用于回滚和审计。

字段建议：

- `id`: TEXT PRIMARY KEY
- `memory_id`: TEXT
- `action`: `create | update | merge | archive | delete | restore`
- `before`: TEXT，JSON 快照
- `after`: TEXT，JSON 快照
- `actor`: `user | assistant | policy | migration`
- `reason`: TEXT
- `created_at`: INTEGER

### memory_links

表达记忆之间的关系。

字段建议：

- `id`: TEXT PRIMARY KEY
- `from_memory_id`: TEXT
- `to_memory_id`: TEXT
- `relation`: `supports | contradicts | supersedes | related | derived_from`
- `created_at`: INTEGER

第一版可以先不做复杂图谱，但表结构预留关系比后续硬迁移更稳。

## 记忆类型

### fact

稳定事实。例如用户姓名、常用设备、长期项目、重要身份信息。fact 需要高置信度，不应从含糊表达中自动写入。

### preference

交互偏好和技术偏好。例如回答风格、语言、框架选择、测试习惯。preference 可以从重复行为中产生候选，但最好让用户确认。

### event

有时间属性的重要事件。例如“2026-07-06 决定把 Qualia 的记忆系统升级为结构化设计”。event 适合进入 records 时间线，也可作为长期记忆。

### relationship

人物、组织、项目之间的关系。第一版可以只做普通文本和标签，不必急着做完整实体系统。

### rule

用户明确要求长期遵守的规则。例如“不要直接编辑 packages/*/src”。rule 优先级最高，进入上下文时应标注为用户长期规则。

### project

工作区画像。例如项目命令、架构约束、发布流程、常见坑。它和 AGENTS.md 互补：AGENTS.md 是项目提供的静态规则，project memory 是长期使用中形成的经验。

### task_result

后台任务结果和主动跟进结果。默认进 records，可由用户选择沉淀为长期记忆。

## 写入流程

### 对话中显式记住

当用户说“记住”“以后都”“我的偏好是”这类明确意图时，助手应创建候选记忆，并在当前回复中简短说明已放入记忆收件箱。若用户配置允许自动接受明确规则，可直接写入 `memories`，但仍记录 revision 和 audit log。

### 摘要后自动提取

自动摘要完成后，额外运行一个轻量提取步骤，从新增消息和更新后的 summary 中提出候选记忆。提取结果不要直接写入长期记忆。

候选提取 prompt 应要求输出结构化 JSON，字段包括 `type`、`scope`、`content`、`reason`、`confidence`、`evidence`、`tags`。低置信度候选直接丢弃或只进入 debug 日志。

### 日记和 records 转记忆

日记更适合记录“发生了什么”，不等同于长期记忆。records 页面应允许用户把某条日记片段或任务结果转换成候选记忆。这样可以避免每天的流水账污染长期记忆。

### 工具写入

现有 `write_memory` 应改造成候选创建工具，而不是直接覆盖 `memory.md`。

建议工具拆分：

- `propose_memory`: 创建候选记忆。
- `read_memory`: 检索长期记忆。
- `manage_memory`: 仅内部或用户确认后使用，执行接受、编辑、归档、合并。

`manage_memory` 属于 `memory.write` 权限，默认需要确认或来自用户在 UI 上的显式动作。

## 检索与上下文注入

### ContextBuilder 的新职责

ContextBuilder 不再读取完整 `memory.md`。它应调用 MemoryService，基于以下信号召回记忆：

- 当前 user message
- 当前 session id
- 当前 workspace
- 最近 session summary
- 最近若干条消息
- 工具调用意图，例如文件操作、任务调度、写作、规划

召回结果按规则、工作区相关性、文本匹配、最近使用、优先级和置信度排序。

### 上下文格式

注入给模型的记忆应分组，并明确权重：

```text
## 长期记忆

### 用户长期规则
- [rule, high confidence] ...

### 当前工作区相关记忆
- [project, source: session title/date] ...

### 可能相关的用户偏好
- [preference, medium confidence] ...
```

不要把低置信度候选注入为事实。pending candidates 只在用户正在管理记忆时展示，不进入普通对话上下文。

### 预算控制

第一版可用简单文本召回和固定预算：

- rule: 最多 20 条，高优先级
- workspace/project: 最多 20 条
- preference/fact: 最多 20 条
- event/task_result: 默认不注入，除非 query 命中

后续再增加 embedding。不要在第一版为了向量库引入复杂外部依赖；可以先预留 `memory_embeddings` 表。

## UI 设计

### 记忆收件箱

收件箱是 0.3 的关键体验。每条候选显示：

- 建议记住的内容
- 类型和作用域
- 为什么建议记住
- 来源会话/消息/任务
- 可能重复的已有记忆
- 接受、编辑后接受、忽略、合并

默认不做大段解释。重点是让用户快速扫过和处理。

### 记忆管理页

管理页支持：

- 按类型、工作区、标签、状态过滤
- 搜索 active memories
- 编辑内容
- 归档或删除
- 查看来源和修订历史
- 合并重复记忆
- 导出 Markdown/JSON

这页应是运维型界面，不是营销页面。信息密度可以高一些。

### 对话内轻提示

当助手提出候选记忆时，对话里只显示短提示，例如“我把 2 条可能值得长期保留的信息放进记忆收件箱”。不要每次都打断主任务。

## API 与服务边界

建议新增 MemoryService，封装所有记忆操作。路由、工具、摘要 worker、任务 executor 都不直接操作表。

核心方法：

- `proposeMemory(input)`
- `listCandidates(filters)`
- `resolveCandidate(id, action, editedContent?)`
- `createMemory(input)`
- `updateMemory(id, patch)`
- `archiveMemory(id)`
- `mergeMemories(sourceIds, targetPatch)`
- `searchMemories(query, context)`
- `getContextMemories(context, budget)`
- `exportMemory(format)`

API 路由建议：

- `GET /api/memory`
- `POST /api/memory`
- `PATCH /api/memory/:id`
- `DELETE /api/memory/:id`
- `GET /api/memory/candidates`
- `POST /api/memory/candidates/:id/accept`
- `POST /api/memory/candidates/:id/ignore`
- `POST /api/memory/candidates/:id/merge`
- `GET /api/memory/export`

SvelteKit `+server.ts` 仍需只导出 HTTP method names 或 `_` 前缀辅助。

## 权限与审计

记忆写入应纳入工具权限模型：

- `memory.read`: 默认安全。
- `memory.propose`: 默认安全，但需要记录来源。
- `memory.write`: 接受、编辑、合并、归档、删除，默认需要用户确认或 UI 显式动作。

每次状态变化都写入 `memory_revisions`。如果已有 audit log 能表达工具调用，也应记录工具名、参数摘要、确认状态和结果。用户应能从记忆详情看到“谁在什么时候为什么改了这条记忆”。

## 与现有系统的关系

### summary

summary 是会话压缩和 records 的输入，不是长期记忆本身。它可以产生候选，但不直接替代 memories。

### diary

diary 是时间线叙事，适合“今天发生了什么”。只有被用户标记或被提取器高置信识别的内容才进入候选。

### AGENTS.md

AGENTS.md 是当前工作区的外部项目指令，优先级高于普通 project memory。project memory 负责记录长期使用中形成的经验，例如常用命令、项目坑点、用户选择。

### memory.md

迁移后，`memory.md` 作为导出和兼容层：

- 启动时如发现旧 `memory.md` 且 SQLite 无结构化记忆，执行一次迁移。
- 迁移产生 `approved_by = migration` 的 memories。
- 保留原文件备份，不自动删除。
- 后续可从 SQLite 生成 `memory.md`，但不再让它作为唯一 source of truth。

## 迁移策略

第一步增加 schema migrations，再增加记忆相关表。迁移必须可重复执行，失败不删除源文件。

旧 `memory.md` 迁移规则：

- “关于用户”迁移为 `fact` 或 `preference` 候选，默认 pending，除非内容明显是稳定事实。
- “重要事件”迁移为 `event`。
- “关于我自己”迁移为 `rule` 或 `fact`，但需要谨慎，避免把旧默认模板当作真实记忆。

迁移结束后生成报告：导入多少条、跳过多少条、哪些需要用户确认。

## 分阶段落地

### 0.3.1 最小可用结构化记忆

- 新增 `memories`、`memory_candidates`、`memory_revisions` 表。
- 新增 MemoryService。
- `write_memory` 改为 `propose_memory` 或创建 pending candidate。
- ContextBuilder 使用 MemoryService 检索 active memories。
- 新增简单记忆管理页和收件箱。
- `memory.md` 迁移为候选。

### 0.3.2 质量治理

- 候选去重和合并。
- 来源消息跳转。
- 修订历史和回滚。
- 按 workspace 过滤。
- 摘要后自动候选提取。
- 导出 Markdown/JSON。

### 0.3.3 检索增强

- 增加更好的文本打分。
- 预留或实现 embedding 索引。
- 上下文预算可配置。
- `read_memory` 支持类型、工作区、时间范围过滤。

### 0.4 主动伙伴联动

- 任务结果进入 records，并可转候选记忆。
- recurring tasks 使用相关记忆构建上下文。
- workspace profile 与 project memories 合流。
- 通知里可附带“是否记住这个结果”的轻操作。

## 不建议做的事

不要一开始做复杂知识图谱。关系表可以预留，但第一版重点是来源、候选、管理和检索。

不要把所有历史消息向量化后称为记忆。历史搜索和长期记忆是两件事：历史是证据库，长期记忆是经过筛选的稳定知识。

不要让模型无确认直接覆盖长期记忆。当前 `write_memory` 的覆盖式设计应尽快收敛。

不要把 `memory.md` 继续扩展成复杂 Markdown 协议。越复杂越难稳定解析，也违背项目里避免脆弱文本解析的习惯。

不要把低置信度情绪判断永久保存。情绪上下文适合 summary/diary，不适合长期贴标签。

## 成功标准

一个好的 Qualia 记忆系统应满足：

- 用户能清楚看到 Qualia 记住了什么。
- 每条记忆都能追溯来源。
- 错误记忆能被删除、修正、合并和回滚。
- 普通聊天不会被无关旧记忆干扰。
- 工作区相关记忆能在对应项目中自然生效。
- 摘要、日记、任务结果能产生候选，但不会自动污染长期记忆。
- 数据可导出、可迁移，用户不被锁死。

如果只能优先做一件事，先做“候选记忆收件箱 + 结构化 memories 表”。它直接解决当前系统最大的问题

## 0.3.0 实施的取舍

以上设计是目标状态的完整描述。0.3.0 作为第一个结构化记忆版本，做了以下简化（原因见 temp.md 0.3 节）：

**保留：**
- 五层架构的核心骨架（候选层 + 长期记忆层 + 检索层）
- memories + memory_candidates 两张核心表
- 4 种记忆类型：fact / preference / rule / event（project 用 scope=workspace 区分）
- 候选先于写入的流程
- 检索替代全量注入的 ContextBuilder 策略
- 上下文预算控制
- memory.md → memories 的一次性迁移

**推迟到 0.3.2/0.3.3：**
- memory_revisions 表 → 审计日志已能覆盖谁在何时做了什么，暂不需独立修订表
- memory_links 关系表 → 记忆量达到数百条前，supports/contradicts 关系无实际价值
- embedding / 向量检索 → 文本匹配 + 分类过滤在第一版足够
- 9 种类型 → 收敛到 4 种，降低 LLM 分类负担和 UI 复杂度

**推迟到 0.4：**
- 摘要后自动候选提取
- 任务结果自动转候选记忆
- workspace profile 与 project memory 合流
