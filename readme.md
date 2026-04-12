# SheepKing

一款轻量可扩展的 Node.js AI 智能体调度框架，基于多 Agent 架构与状态化会话管理，支持技能注册、工具调用、多轮追问与上下文持久化，以调度中枢统一编排智能体，让 AI 具备思考、反问、联网与任务执行能力。

## 特性

- 🐑 多 Agent 调度：支持智能体注册、精准路由与多轮会话追踪（UUID 标识）
- 🧠 状态化记忆：内置 BaseMessage 维护对话上下文，支持二次/多轮追问
- 🔧 技能插件化：支持技能动态注册、工具调用，兼容自定义业务场景
- 🚀 轻量易用：基于 Node.js + TypeScript 开发，开箱即用，易二次开发
- 📡 可扩展：预留联网搜索、本地执行等扩展接口，适配多场景需求

## 快速开始

### 环境要求

- Node.js ≥ 18.x
- TypeScript ≥ 5.7.x
- npm / yarn / pnpm

```bash
npm install

```

### 启动项目

```bash

# 开发模式

npm run dev

# 构建项目

npm run build

# 生产启动

npm run start

# 类型检查

npm run typecheck

```

## 核心架构

1. 调度器（Orchestrator）：核心中枢，负责智能体选择与任务编排
2. Agent 注册中心：统一管理所有智能体实例，支持动态注册
3. 技能系统（Skill）：插件化技能，支持工具调用与多轮交互
4. 上下文管理：基于 BaseMessage 与 UUID 实现会话状态持久化

## 许可证

[MIT License](sslocal://flow/file_open?url=LICENSE&flow_extra=eyJsaW5rX3R5cGUiOiJjb2RlX2ludGVycHJldGVyIn0=)

## 备注

项目基于自研多 Agent 架构开发，适配 AI 智能体调度、自动化任务执行等场景
