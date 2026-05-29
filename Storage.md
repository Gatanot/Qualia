# Storage 模块规划

## 1. 设计目标

- 提供统一的会话/消息持久化接口
- 支持开启/关闭持久化：关闭时仅内存存储，方便开发测试
- 不存储 TTS 音频数据本身，仅记录是否已合成及缓存路径
- SQLite 作为持久化后端，精简表结构

---

## 2. 开启/关闭存储

在 Config 中新增 `storageEnabled` 字段（默认 `true`），通过设置页面控制。

```
设置页面 → 存储开关 → 写入 config.json → Storage 工厂根据开关创建实例
```

| storageEnabled | 实现 |
|---------------|------|
| `true` | `SQLiteStorage` — 读写 `data/db.sqlite` |
| `false` | `MemoryStorage` — 基于 Map 的内存存储 |

二者实现同一 `Storage` 接口，上层代码无感知。关闭后重启数据丢失，开发测试不污染正式库。

---

## 3. TTS 内容策略

**TTS 音频不存入数据库**。理由：

- 音频体积大，存入 SQLite 会导致库文件迅速膨胀
- TTS 可重新生成，属于缓存性质而非核心数据

方案：
- Assistant 消息到达后，Pipeline 触发 TTS 合成 → 音频写入 `data/audio/{message_id}.mp3`
- messages 表仅记录 `audio_path` 字段指向该文件
- 用户点播时前端请求 `/api/audio/{message_id}`，服务端按路径读取返回
- 会话删除时同步清理对应音频文件

---

## 4. 数据库表设计

### 4.1 sessions

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `title` | TEXT | 会话标题（自动取首条用户消息前 30 字） |
| `created_at` | INTEGER | Unix 毫秒时间戳 |
| `updated_at` | INTEGER | 最后活跃时间 |
| `parent_id` | TEXT | 父会话 ID（分叉场景，可为 NULL） |
| `status` | TEXT | `active` / `archived` |
| `token_count` | INTEGER | 缓存的全会话 Token 总数 |

### 4.2 messages

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `session_id` | TEXT FK → sessions.id | 所属会话 |
| `role` | TEXT | `system` / `user` / `assistant` / `tool` |
| `content` | TEXT | 消息文字内容 |
| `reasoning_content` | TEXT | 思维链内容（NULLABLE） |
| `tool_calls` | TEXT | JSON 数组，LLM 请求的 function call |
| `tool_call_id` | TEXT | tool 消息关联的 call id（NULLABLE） |
| `name` | TEXT | tool 消息对应的工具名（NULLABLE） |
| `usage` | TEXT | JSON 对象，本条消息的 token 消耗（NULLABLE） |
| `audio_path` | TEXT | TTS 缓存文件相对路径（NULLABLE） |
| `created_at` | INTEGER | Unix 毫秒时间戳 |
| `seq` | INTEGER | 会话内自增序号，保证消息顺序 |

索引：`session_id + seq` 联合索引，加速消息列表查询。

### 4.3 SQL 建表

```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    parent_id   TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    token_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE messages (
    id                 TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL,
    role               TEXT NOT NULL,
    content            TEXT NOT NULL DEFAULT '',
    reasoning_content  TEXT,
    tool_calls         TEXT,
    tool_call_id       TEXT,
    name               TEXT,
    usage              TEXT,
    audio_path         TEXT,
    created_at         INTEGER NOT NULL,
    seq                INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session_seq ON messages(session_id, seq);
```

---

## 5. Storage 接口

```ts
interface Storage {
  // 会话
  createSession(title?: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  listSessions(): Promise<Session[]>;
  deleteSession(id: string): Promise<void>;
  archiveSession(id: string): Promise<void>;
  forkSession(id: string, summary: string): Promise<Session>;

  // 消息
  addMessage(sessionId: string, message: MessageRecord): Promise<string>;
  getMessages(sessionId: string, options?: { limit?: number; before?: number }): Promise<MessageRecord[]>;
  deleteMessage(id: string): Promise<void>;

  // Token 计数
  getTokenCount(sessionId: string): Promise<number>;
  updateTokenCount(sessionId: string, count: number): Promise<void>;

  // TTS 缓存路径
  setAudioPath(messageId: string, path: string): Promise<void>;
}
```

### 数据类型

```ts
interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  parent_id: string | null;
  status: 'active' | 'archived';
  token_count: number;
}

interface MessageRecord {
  id: string;
  session_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  usage?: Usage;
  audio_path?: string;
  created_at: number;
  seq: number;
}
```

---

## 6. 文件结构

```
src/lib/storage/
├── index.ts           # 统一导出 + createStorage(config) 工厂
├── types.ts           # Storage 接口、Session、MessageRecord
├── memory.ts          # MemoryStorage 实现
├── sqlite.ts          # SQLiteStorage 实现
└── init.sql           # 建表 DDL
```

---

## 7. 依赖

- `better-sqlite3` — 同步 SQLite 驱动，适合本地应用
- `uuid` 或 `crypto.randomUUID()` — 生成主键

---

## 8. Config 集成

`src/lib/config/types.ts` 中 `AppConfig` 新增：

```ts
interface AppConfig {
  providers: ProviderConfig[];
  activeProvider: string;
  storageEnabled: boolean;  // 新增，默认 true
}
```

设置页面新增存储开关控件，持久化到 `data/config.json`。
