# Qualia Core Bug 分析报告

## Bug 1: 日记文件路径不一致 — 写入目录与读取目录不同

**严重程度:** CRITICAL  
**文件:** `src/lib/agent/diary.ts:23-31, 66-76`

### 问题代码

```typescript
// diary.ts:8 — DIARY_DIR 解析为 ~/.qualia/data/diary/
const DIARY_DIR = join(getDataPath('diary'));

// diary.ts:23-25 — formatDatePath 返回相对路径
function formatDatePath(y: number, m: string, d: string): string {
    return `data/diary/${y}-${m}-${d}.md`;  // ← 相对路径
}

// diary.ts:27-30 — getTodayFile 使用 formatDatePath
function getTodayFile(): string {
    const { y, m, d } = getTodayDate();
    return formatDatePath(y, m, d);  // ← 返回 "data/diary/2026-07-05.md"
}

// diary.ts:76 — 告诉 AI 用 write_file 写入这个路径
userContent += `\n\n请使用 write_file 工具将日记写入以下文件：${filePath}`;
```

而 `readRecentDiaries` 使用绝对路径读取：

```typescript
// diary.ts:41 — 读取用的是 DIARY_DIR = ~/.qualia/data/diary/
const filePath = join(DIARY_DIR, `${y}-${m}-${d}.md`);
```

`write_file` 工具的路径解析逻辑（`env.ts:22`）：

```typescript
const resolved = resolve(this.root, userPath);  // this.root = process.cwd() 或 session.workspace
```

### 形成判断

- `formatDatePath` 返回 `data/diary/2026-07-05.md`（相对路径）
- `write_file` 将其解析为 `<workspace_root>/data/diary/2026-07-05.md`
- `readRecentDiaries` 从 `~/.qualia/data/diary/` 读取
- 写入目录 ≠ 读取目录，日记永远无法被后续读取到

### 影响范围

1. **日记功能完全失效**：每天的日记写入到工作区目录而非 `~/.qualia/data/diary/`
2. **日记连续性断裂**：`readRecentDiaries` 永远读不到前几天的日记，AI 无法保持叙事连贯
3. **文件污染**：工作区根目录下会多出 `data/diary/` 目录

## Bug 2: SMTP 多行响应处理失败 — 邮件通知静默失效

**严重程度:** CRITICAL  
**文件:** `src/lib/gateway/adapters/email.ts:50-79`

### 问题代码

```typescript
socket.onData((data) => {
    lastResponse = data;
    const code = parseInt(data.slice(0, 3), 10);  // ← 只取前3字符

    if (code >= 400) { /* 错误处理 */ }

    // 状态推进逻辑
    if (step === 0 && code === 220) step = 1;
    else if (step === 1 && code === 250) step = 2;   // ← EHLO 响应
    else if (step === 2 && (code === 235 || code === 334)) step = 3;
    // ...
});
```

### 形成判断

SMTP 协议的多行响应格式如下（以 EHLO 为例）：

```
250-server.example.com Hello
250-SIZE 35840000
250-AUTH PLAIN LOGIN
250-STARTTLS
250 OK                    ← 最后一行（空格分隔）
```

中间行以 `NNN-` 开头，最后一行以 `NNN ` 开头。代码对每一行都做 `parseInt(data.slice(0, 3))`，得到 `250`，然后执行 `step === 1 && code === 250` 判断为真，**在收到第一行 `250-` 时就推进状态到 step=2 并发送 AUTH 命令**。

此时服务器还在发送 EHLO 的剩余行，收到 AUTH 命令后会产生协议错误。

`onData` 回调中 buffer 持续累加但从不重置（`buffer += data.toString()`），意味着 buffer 会包含所有历史数据。但问题在于 `parseInt` 只看前 3 字节，多行响应的第一行就会触发状态推进。

### 影响范围

1. **邮件通知完全失效**：几乎所有真实 SMTP 服务器都返回多行 EHLO 响应
2. **无错误提示**：协议错误后服务器可能返回 5xx 错误，但状态机已经混乱
3. **Gateway 的 EmailAdapter 形同虚设**：`connect()` 发送测试邮件时就会失败

## Bug 3: `addMessage` 用旧值覆盖 `token_count` — 上下文压缩判断失效

**严重程度:** HIGH  
**文件:** `src/lib/storage/sqlite.ts:200-222`

### 问题代码

```typescript
async addMessage(
    sessionId: string,
    message: Omit<MessageRecord, 'id' | 'created_at' | 'seq'> & { id?: string }
): Promise<MessageRecord> {
    const session = await this.getSession(sessionId);  // ← 读取时的 token_count
    if (!session) throw new Error(`会话不存在: ${sessionId}`);

    // ... 插入消息 ...

    this.stmts.updateSession.run(
        session.title,
        now,
        session.token_count,  // ← 用读取时的旧值写回
        sessionId
    );
    return (await this.getMessage(id))!;
}
```

`updateSession` 的 SQL 语句（`sqlite.ts:109`）：

```sql
UPDATE sessions SET title = ?, updated_at = ?, token_count = ? WHERE id = ?
```

### 形成判断

`addMessage` 在函数开头通过 `getSession` 读取 session 快照。之后任何对 `token_count` 的并发更新（如 LLM 调用完成后 `updateTokenCount` 写入新值）都会被 `addMessage` 末尾的 `updateSession` 用旧快照值覆盖。

典型时序：

1. `addMessage` 读取 session，`token_count = 1000`
2. LLM 流式完成，调用 `updateTokenCount` 将 `token_count` 更新为 `50000`
3. `addMessage` 插入消息后，执行 `updateSession`，将 `token_count` 回写为 `1000`

### 影响范围

1. **上下文压缩判断失效**：`tryForkIfWindowLow` 依赖 `token_count` 判断是否需要压缩上下文，错误的 token_count 导致压缩时机不准
2. **上下文窗口溢出**：token_count 被回写为旧值后，系统认为上下文还有大量空间，继续往里塞消息，最终超出模型上下文窗口
3. **数据不一致**：`token_count` 在并发写入时无法保证正确性
