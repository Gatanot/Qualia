# Beside — AI 伙伴 架构设计

> 个人 AI 伙伴。SvelteKit 全栈，Live2D 集成前端，按住录音交互。

---

## 1. 概述

### 1.1 定位

本地运行的个人 AI 伙伴应用。用户通过浏览器访问：

- 文字对话：流式查看 AI 回复
- 语音对话：按住录音，AI 语音合成后自动播放
- Live2D 形象：浏览器内渲染，配合对话展示表情/动作
- 长期记忆：跨会话保持上下文

### 1.2 技术栈

| 层      | 技术                       |
| ------- | -------------------------- |
| 前端    | SvelteKit + TypeScript     |
| 后端    | SvelteKit server (Node.js) |
| 数据库  | SQLite                     |
| LLM     | OpenAI 兼容 API            |
| TTS/ASR | 外部 API 接入              |
| Live2D  | 浏览器内渲染               |

---

## 2. 系统架构

```
浏览器 (SvelteKit 客户端)
  ├── 对话 UI
  ├── 录音组件
  ├── 音频播放器
  └── Live2D 渲染
        │
   HTTP / SSE
        │
SvelteKit 服务端 (TypeScript)
  ├── Transport 层         (API 路由、SSE 推送)
  ├── Pipeline 编排层      (对话主循环)
  ├── 业务模块
  │   ├── Config            (统一配置管理)
  │   ├── Provider          (LLM API 接入)
  │   ├── TTS Client        (TTS API 接入)
  │   ├── ASR Client        (ASR API 接入)
  │   ├── Agent             (智能体：主循环 / 上下文构建 / 工具系统)
  │   ├── Storage           (SQLite 对话存储)
  │   ├── Memory            (长期记忆，Phase 2)
  │   └── Session Manager   (会话生命周期：创建 / 自动分叉 / 归档)
        │
   HTTP (API Client 调用)
        │
外部 AI 服务
  ├── LLM API
  ├── TTS 引擎
  └── ASR 引擎
```

---

## 3. 模块

### 3.1 Config — 配置管理

贯穿所有模块的横切组件。统一管理设置项，加载来源为配置文件 + 环境变量（后者优先）。前端提供设置页面。

管理的配置域：LLM 接入、TTS/ASR 开关与驱动、多模态、会话分叉策略、Agent 行为、存储路径。

### 3.2 Provider — LLM API 接入

管理不同 LLM API 的连接与调用，对上层暴露统一的流式/非流式接口。支持 OpenAI 兼容格式。负责重试、超时、Token 计数、多模态透传。

### 3.3 TTS Client — TTS API 接入

管理不同 TTS 后端的连接与调用，对 Pipeline 暴露统一的文本→音频接口。不负责实际语音合成。前端可整体关闭。

### 3.4 ASR Client — ASR API 接入

管理不同 ASR 后端的连接与调用，对 Pipeline 暴露统一的音频→文本接口。不负责实际语音识别。预留多模态路径——当 LLM 原生支持音频输入时可跳过。

### 3.5 Agent — 智能体系统

控制 AI 行为，包含三个子模块：

- **Agent Loop**：对话主循环，接收输入 → 构建上下文 → 调用 LLM → 解析 tool call → 输出结果
- **Context Builder**：拼装系统提示词、会话历史、用户输入（含时间前缀）、父会话摘要
- **Tool System**：可插拔工具注册与执行框架，用于 LLM function calling

### 3.6 Storage — 对话存储

SQLite 持久化会话与消息。维护会话 Token 计数缓存，支持增量更新。

### 3.7 Memory — 长期记忆

Phase 2 引入。从对话中提取关键信息，建立跨会话的记忆检索。方案演进：当前会话上下文窗口 → 会话摘要链（分叉时 LLM 生成摘要）→ 向量检索。

### 3.8 Session Manager — 会话生命周期

管理会话的创建、自动分叉、归档。

分叉条件：距上次消息超过 N 小时（可配置），或当前会话 Token 消耗接近模型上限（余量低于阈值）。分叉时生成摘要，新会话携带父会话摘要作为上下文。

支持用户主动创建新会话。

### 3.9 Pipeline — 编排层

协调所有模块执行一次完整对话。流程：接收输入 → 会话检查 → 上下文构建 → Agent 循环 → 流式输出（文字 + 切句 TTS + 动画指令 + 存储）。

---

## 4. 前后端通信

### 4.1 前端 → 后端

| 路径                 | 用途                             |
| -------------------- | -------------------------------- |
| `POST /api/chat`     | 发送文字消息，返回 SSE 流        |
| `POST /api/speech`   | 发送录音，转为文字后进入对话流程 |
| `POST /api/sessions` | 会话管理（创建/列表/删除）       |
| `POST /api/config`   | 读写配置                         |

### 4.2 后端 → 前端 (SSE)

Pipeline 流式推送