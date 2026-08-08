<div align="center">

# 🤖 opencode-impm-cn

**我是项目经理 —— AI 驱动的工程化全流程开发套件**

<p>
  <a href="#"><img src="https://img.shields.io/badge/version-0.4.2-2ea44f?style=flat-square" alt="version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node->=%2018-339933?style=flat-square&logo=node.js&logoColor=white" alt="node"></a>
  <a href="https://opencode.ai/"><img src="https://img.shields.io/badge/OpenCode-必需-ff6b6b?style=flat-square" alt="opencode"></a>
</p>

<p><i>基于 OpenCode 平台，以「AI 项目经理」为核心，编排 13 个专业 Agent，按瀑布式四阶段完成软件全生命周期开发。</i></p>

[🚀 快速开始](#-快速开始) · [📖 使用文档](#-使用文档) · [📂 项目结构](#-项目结构) · [❓ 常见问题](#-常见问题)

</div>

---

## 📋 目录

- [核心特性](#-核心特性)
- [架构概览](#-架构概览)
- [快速开始](#-快速开始)
- [安装](#-安装)
- [配置](#-配置)
- [使用文档](#-使用文档)
  - [四阶段流程](#四阶段流程说明)
  - [文档标准路径](#文档标准路径)
  - [完整命令清单](#完整命令清单)
- [项目结构](#-项目结构)
- [贡献指南](#-贡献指南)
- [常见问题](#-常见问题)
- [附录](#-附录)

---

## ✨ 核心特性

| 特性 | 说明 |
|:---:|:---|
| 🎭 | **AI 项目经理调度** — 统一编排 BA / SA / TL / DBA / TE / SCM / DW / CS / WS / FEE / BEE / SSE 共 13 个专业 Agent |
| 📋 | **4 阶段 45 个技能** — 每阶段严格按序执行，不跳过、不乱序、不并行 |
| 🧪 | **测试先行（TDD）** — 编码前先写测试用例，编码后执行测试，全部通过才提交 |
| 📁 | **版本化管理** — 每个版本独立目录 `docs/{项目缩写}-v{版本号}/` + 独立 Git 分支 |
| 📝 | **全程简体中文** — 文档、注释、汇报均使用简体中文，降低团队学习成本 |
| 🔌 | **14 个插件工具** — 文档读写、版本管理、任务调度、Git 操作、Prompt 记录与导出等 |

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        🤖 PM 项目经理                         │
│                   （编排调度，不做具体事务）                      │
└─────────────┬───────────────────────────────────────────────┘
              │ 派发任务
    ┌─────────┼─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼         ▼
 ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
 │ BA  │  │ SA  │  │ TL  │  │ DBA │  │ TE  │
 │业务 │  │系统 │  │技术 │  │数据库│  │测试 │
 │分析 │  │架构 │  │负责人│  │架构师│  │工程师│
 └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
 ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
 │ SCM │  │ DW  │  │ CS  │  │ WS  │  │ SSE │  │ FEE │  │ BEE │
 │配置 │  │文档 │  │代码 │  │网络 │  │高级 │  │前端 │  │后端 │
 │管理 │  │编写 │  │查询 │  │查询 │  │工程师│  │工程师│  │工程师│
 └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘

 ═══════════════════════════════════════════════════════════════
  阶段 1        阶段 2        阶段 3        阶段 4
  初始化  ──▶  需求分析  ──▶  编码开发  ──▶  回归测试与归档
 ═══════════════════════════════════════════════════════════════
```

---

## 🚀 快速开始

### 一键启动（推荐）

在 OpenCode 中输入：

```bash
/impm
```

PM Agent 将自动引导完成全部四阶段开发任务。

### 分阶段手动执行

| 阶段 | 命令 | 说明 |
|:----:|:-----|:-----|
| 1 | `/impm-init` | 初始化项目、生成 URS/PRD/SAD/DBD/API/LLD/任务清单/测试用例 |
| 2 | `/impm-docs` | 确认版本需求、更新设计文档、创建任务清单 |
| 3 | `/impm-coding` | 循环执行任务：上下文 → 编码 → 测试 → 提交 |
| 4 | `/impm-finish` | 回归测试、代码审核、文档合并、合并主分支 |

> 💡 **提示**：手动执行时可监控每步结果，必要时修改需求、回滚 Git 重新执行。每个项目有独立 Git 分支，阶段结束时自动提交。

---

## 📦 安装

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [OpenCode](https://opencode.ai/)（支持插件、技能、命令的版本）

### 方式一：本地安装（⭐ 推荐，用于开发调试）

```bash
# 克隆项目
git clone https://github.com/CloudStrolling/opencode-impm-cn.git
cd opencode-impm-cn

# 安装依赖（postinstall 自动执行安装脚本）
npm install

# 编译 TypeScript 源码
npm run build

# 安装到目标项目
node scripts/install.mjs --target /path/to/project
# Windows PowerShell 用户：
# .\scripts\install.ps1 -Target D:\path\to\project
```

### 方式二：作为 npm 依赖安装

```bash
npm install opencode-impm-cn
```

### 验证安装

安装完成后重启 OpenCode，输入 `/impm` 即可看到 PM Agent 的欢迎提示。

---

## ⚙️ 配置

安装后自动在目标项目生成以下结构：

```
项目根目录/
├── .opencode/
│   ├── agents/              # 13 个 AI Agent 定义
│   ├── commands/            # 45 个命令定义
│   ├── skills/              # 45 个技能与模板
│   └── plugins/impm/        # 编译后的插件入口
└── opencode.json            # OpenCode 配置文件
```

**最小配置示例**（通常安装脚本自动处理，无需手动修改）：

```json
{
  "plugins": [
    {
      "name": "impm",
      "entry": ".opencode/plugins/impm/index.js"
    }
  ]
}
```

---

## 📖 使用文档

### 四阶段流程说明

```mermaid
flowchart LR
    A[阶段1: 初始化<br/>/impm-init] --> B[阶段2: 需求分析<br/>/impm-docs]
    B --> C[阶段3: 编码开发<br/>/impm-coding]
    C --> D[阶段4: 回归测试与归档<br/>/impm-finish]

    style A fill:#e1f5fe
    style B fill:#fff3e0
    style C fill:#e8f5e9
    style D fill:#fce4ec
```

| 阶段 | 命令 | 核心动作 |
|:----:|:-----|:---------|
| **1** | `/impm-init` | 判定项目类型 → 创建版本目录与进度表 → 生成全部初始文档 → 提交 |
| **2** | `/impm-docs` | 确认版本需求 → 创建版本分支 → 生成/更新 URS/PRD/SAD/DBD/API/LLD → 创建任务清单 |
| **3** | `/impm-coding` | 按任务清单循环调度：收集上下文 → 代码查询 → 网络查询 → 数据库/API 设计 → 测试用例 → 编码 → 写测试 → 跑测试 → 提交 |
| **4** | `/impm-finish` | 全量回归测试 → 补充注释 → 代码审核 → 更新项目地图 → 合并文档 → 更新 README/Agent/部署文档 → 合并主分支 |

### 文档标准路径

| 文档类型 | 路径 |
|:---------|:-----|
| 项目基本信息 | `docs/project.md` |
| 系统架构设计 | `docs/sad.md` |
| 版本目录 | `docs/{项目英文缩写}-v{版本号}/` |
| 版本需求/设计文档 | `docs/{缩写}-v{版本}/{缩写}-{urs|prd|dbd|api|lld|testcase}-v{版本}.md` |
| 数据库脚本 | `docs/{缩写}-v{版本}/{缩写}-dbd-v{版本}.sql` |
| 任务清单 | `docs/{缩写}-v{版本}/{缩写}-task-v{版本}.json` |
| 版本进度表 | `docs/{缩写}-v{版本}/version_progress.md` |
| 提问记录 | `docs/prompts/prompts.md` |
| 编译/部署方案 | `deploy/build.md`、`deploy/deploy.md` |

### 完整命令清单

<details>
<summary>📋 点击展开 46 个命令（按阶段分组）</summary>

#### 总流程

| 命令 | 说明 |
|:-----|:-----|
| `/impm` | 我是项目经理：编排四阶段全流程 |

#### 阶段 1：初始化

| 命令 | 说明 | 执行 Agent |
|:-----|:-----|:----------:|
| `/impm-init` | 编排初始化阶段全部步骤 | PM |
| `/impm-init-isinit` | 判定项目是否已初始化、是否为空项目 | PM |
| `/impm-init-git` | 初始化 git 仓库并创建首个提交 | SCM |
| `/impm-init-project` | 生成项目基本信息 `docs/project.md` | SA |
| `/impm-init-version` | 创建版本目录与版本进度表 | SA |
| `/impm-init-urs` | 生成用户需求说明书 | BA |
| `/impm-init-prd` | 生成产品需求文档 | BA |
| `/impm-init-sad` | 生成系统架构设计文档 | SA |
| `/impm-init-dbd` | 生成数据库设计文档与 SQL 脚本 | DBA |
| `/impm-init-api` | 生成 API 接口设计文档 | SA |
| `/impm-init-lld` | 生成详细设计文档 | TL |
| `/impm-init-task` | 生成任务清单（task JSON） | TL |
| `/impm-init-testcase` | 生成测试用例文档 | TE |
| `/impm-init-commit` | 提交初始化阶段全部产出 | SCM |

#### 阶段 2：需求分析整理

| 命令 | 说明 | 执行 Agent |
|:-----|:-----|:----------:|
| `/impm-docs` | 编排需求分析整理阶段全部步骤 | PM |
| `/impm-version-create` | 确定版本号、创建版本分支、版本目录与进度表 | SCM |
| `/impm-urs-create` | 生成用户需求说明书（URS） | BA |
| `/impm-prd-create` | 生成产品需求文档（PRD，含用户故事与验收标准） | BA |
| `/impm-sad-update` | 评估并更新系统架构设计文档（SAD） | SA |
| `/impm-dbd-create` | 生成数据库设计文档（DBD）与 SQL 脚本 | DBA |
| `/impm-api-create` | 生成 API 接口设计文档 | TL |
| `/impm-lld-create` | 生成详细设计文档（LLD） | TL |
| `/impm-task-create` | 生成任务清单（task JSON） | TL |
| `/impm-analysis-commit` | 提交需求分析整理阶段全部产出 | SCM |

#### 阶段 3：编码开发

| 命令 | 说明 | 执行 Agent |
|:-----|:-----|:----------:|
| `/impm-coding` | 编排编码开发阶段：循环调度全部任务 | PM |
| `/impm-task-coding` | 编排单个任务的编码全流程 | PM |
| `/impm-task-coding-context` | 收集任务需求上下文（context.md） | TL |
| `/impm-task-coding-cs` | 本地代码查询（cs.md） | CS |
| `/impm-task-coding-ws` | 网络资料查询（ws.md） | WS |
| `/impm-task-coding-dbd` | 数据库变更设计 | DBA |
| `/impm-task-coding-api` | API 接口变更设计 | TL |
| `/impm-task-coding-testcase` | 编写任务测试用例 | TE |
| `/impm-task-coding-code` | 功能编码实现 | SSE/FEE/BEE |
| `/impm-task-coding-writetest` | 编写测试函数与自动化脚本 | TE |
| `/impm-task-coding-runtest` | 执行测试并更新结果 | TE |
| `/impm-task-coding-gitcommit` | 提交任务代码并更新任务状态 | SCM |

#### 阶段 4：回归测试与归档

| 命令 | 说明 | 执行 Agent |
|:-----|:-----|:----------:|
| `/impm-finish` | 编排阶段 4 全部步骤 | PM |
| `/impm-regression-test` | 回归测试（全量单元测试 + 接口测试） | TE |
| `/impm-coding-comment` | 为版本代码补充中文注释 | DW |
| `/impm-coding-review` | 代码审核（安全、性能、质量、合规、测试覆盖） | TL |
| `/impm-project-update` | 更新项目地图与 `docs/project.md` | SA |
| `/impm-doc-merge` | 合并版本文档到主文档 | DW |
| `/impm-doc-update` | 更新 `readme.md` 与 `agent.md` | DW |
| `/impm-deploy-update` | 更新编译部署方案（`deploy/build.md`、`deploy/deploy.md`） | DW |
| `/impm-git-merge` | 合并版本分支到主分支 | SCM |

</details>

---

## 📂 项目结构

```
opencode-impm-cn/
├── 📁 assets/                   # 套件资源（安装时复制到 .opencode/）
│   ├── 📁 agents/               # 13 个 AI Agent 定义（.md）
│   ├── 📁 commands/             # 45 个命令（.md）
│   └── 📁 skills/               # 45 个技能（每技能一个目录）+ template/ 模板
├── 📁 src/                      # 插件源码（TypeScript）
│   ├── 📁 tools/                # 14 个工具的实现（含 prompt-recorder）
│   ├── 📁 utils/                # 路径 / 版本 / git / 项目信息工具
│   └── 📄 index.ts              # 插件入口
├── 📁 scripts/
│   ├── 📄 install.mjs           # 安装脚本（Node）
│   └── 📄 install.ps1           # 安装脚本（Windows PowerShell）
├── 📁 docs/                     # 项目文档目录（由流程自动生成）
├── 📄 opencode.json             # OpenCode 配置文件
├── 📄 LICENSE                   # Apache License 2.0
├── 📄 README.md                 # 本文档（由 impm-doc-update 维护）
└── 📄 agent.md                  # Agent 使用说明（由 impm-doc-update 维护）
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

| 类型 | 要求 |
|:-----|:-----|
| 🐛 **Bug 反馈** | 描述复现步骤、环境版本（Node.js / OpenCode / 操作系统） |
| 💡 **功能建议** | 说明使用场景和预期行为 |
| 🔧 **代码贡献** | 确保通过现有测试，并遵循现有代码风格 |

---

## ❓ 常见问题

<details>
<summary><b>Q1: 安装后 OpenCode 中不显示 <code>/impm</code> 命令？</b></summary>

检查 `.opencode/commands/` 目录下是否有 `impm*.md` 文件，并重启 OpenCode。
</details>

<details>
<summary><b>Q2: Windows 和 macOS 安装有区别吗？</b></summary>

核心逻辑一致。Windows 用户可额外使用 `scripts/install.ps1` 进行安装。
</details>

<details>
<summary><b>Q3: OpenCode 版本不兼容怎么办？</b></summary>

请确保 OpenCode 支持插件、技能和命令机制。建议升级到最新版。
</details>

<details>
<summary><b>Q4: 如何调试插件？</b></summary>

在 `src/` 目录修改源码后执行 `npm run build`（如有配置），然后重新运行安装脚本。
</details>

---

## 📜 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 协议开源。

```
Copyright 2026 jenemy8023 <jenemy8023@163.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

---

## 📎 附录

### 文档名词解析

| 缩写 | 英文全称 | 中文名称 | 说明 |
|:----:|:---------|:---------|:-----|
| **URS** | User Requirement Specification | 用户需求说明书 | 业务目标、用户角色、业务场景、功能需求（高层）、非功能需求（高层）、约束条件、假设与依赖 |
| **PRD** | Product Requirement Document | 产品需求文档 | 产品背景、目标用户、功能清单、详细功能描述、业务流程图、页面原型、数据需求、验收标准、版本规划、附录 |
| **SAD** | System Architecture Design | 系统架构设计 | 设计目标与约束、技术栈选型及理由、系统上下文图、容器图、组件图、部署架构图、安全架构、性能架构、数据流图、架构决策记录 |
| **DBD** | Database Design Document | 数据库设计文档 | 设计目标、数据库选型、ER 图（Mermaid）、逻辑模型、物理模型、表结构定义、索引设计、视图/存储过程/触发器设计、数据字典、备份恢复策略、安全策略 |
| **API** | API Design Document | 接口设计文档 | 接口清单、接口版本策略、认证鉴权机制、通用错误码定义、接口详细定义（URL/Method/Header/Body/Response）、状态码映射、限流策略、示例代码 |
| **LLD** | Low-Level Design Document | 详细设计文档 | 模块概述、模块划分与职责、类图（Mermaid）、核心业务流程时序图（Mermaid）、状态图、核心业务逻辑伪代码/流程图、业务规则与约束、业务数据流、数据结构定义、异常处理策略、日志规范、性能优化点、单元测试策略 |
| **TestCase** | Test Case Document | 测试用例 | 用例 ID、用例名称、所属模块、优先级、前置条件、测试步骤、预期结果、测试数据、关联需求 ID、测试类型（功能/接口/性能/安全） |

### Agent 清单

> PM 为主控 Agent，其余 12 个为 Sub-Agent。

| Agent | 英文名称 | 中文名称 | 角色职责 |
|:-----:|:---------|:---------|:---------|
| **PM** | Project Manager | 项目经理 | 主控 Agent，不做具体事务，指派 Sub-Agent 执行 |
| **BA** | Business Analyst | 业务分析师 | 收集需求 URS，将业务诉求转化为清晰、可验收、可追踪的 PRD |
| **SA** | System Architect | 系统架构师 | 系统架构设计、项目结构搭建和技术决策，编写 SAD |
| **TL** | Tech Lead | 技术负责人 | 详细设计和任务清单生成 |
| **DBA** | Database Architect | 数据库架构设计师 | 精通业务建模、关系型数据库、NoSQL、分布式数据库和性能优化 |
| **TE** | Test Engineer | 测试工程师 | 测试用例、测试函数、自动化测试脚本编写 |
| **SCM** | Software Configuration Management | 软件配置工程师 | 版本管理、变更管理、发布管理 |
| **DW** | Document Writer | 文档编写 | 各类通用技术文档编写 |
| **CS** | Code Searcher | 本地代码查询 | 按要求查询本地代码 |
| **WS** | Web Searcher | 网络查询 | 查询官方文档、应用案例、技术资料 |
| **SSE** | Senior Software Engineer | 高级软件工程师 | 处理复杂业务逻辑需求 |
| **FEE** | Front-End Engineer | 前端工程师 | 设计符合现代美感的前端页面 |
| **BEE** | Back-End Engineer | 后端工程师 | 接口规划与后端开发 |

### 技能与 Agent 映射表

<details>
<summary>阶段 1：初始化与初始化检验</summary>

| 步骤说明 | 技能名 | 子代理 |
|:---------|:-------|:------:|
| 是否已初始化 | `impm-init-isinit` | PM |
| Git 初始化 | `impm-init-git` | SCM |
| 项目信息文件初始化 | `impm-init-project` | SA |
| 版本初始化 | `impm-init-version` | SA |
| 用户需求文档初始化 | `impm-init-urs` | BA |
| 产品需求设计文档初始化 | `impm-init-prd` | BA |
| 系统架构设计初始化 | `impm-init-sad` | SA |
| 数据库设计初始化 | `impm-init-dbd` | DBA |
| API 设计初始化 | `impm-init-api` | SA |
| 详细设计初始化 | `impm-init-lld` | TL |
| 开发任务初始化 | `impm-init-task` | TL |
| 测试用例、测试函数和测试脚本初始化 | `impm-init-testcase` | TE |
| 提交初始化文档 | `impm-init-commit` | SCM |

</details>

<details>
<summary>阶段 2：需求和设计方案分析</summary>

| 步骤说明 | 技能名 | 子代理 |
|:---------|:-------|:------:|
| 创建版本目录 | `impm-version-create` | SCM |
| 创建当前版本的用户需求文档 | `impm-urs-create` | BA |
| 创建当前版本的产品需求文档 | `impm-prd-create` | BA |
| 更新架构设计 | `impm-sad-update` | SA |
| 创建当前版本的数据库设计 | `impm-dbd-create` | DBA |
| 创建当前版本的 API 设计 | `impm-api-create` | TL |
| 创建当前版本的详细设计 | `impm-lld-create` | TL |
| 创建当前版本的开发任务清单 | `impm-task-create` | TL |
| 提交此前生成的所有文档 | `impm-analysis-commit` | SCM |

</details>

<details>
<summary>阶段 3：编码开发</summary>

| 步骤说明 | 技能名 | 子代理 |
|:---------|:-------|:------:|
| 循环获取开发任务清单，启动编码 | `impm-coding` | PM |
| 针对某一个具体的任务，启动编码流程 | `impm-task-coding` | PM |
| 获取任务相关需求作为上下文 | `impm-task-coding-context` | TL |
| 查询现有代码情况 | `impm-task-coding-cs` | CS |
| 查询网络上相关资料 | `impm-task-coding-ws` | WS |
| 根据任务调整数据库设计 | `impm-task-coding-dbd` | DBA |
| 根据任务调整 API 设计 | `impm-task-coding-api` | TL |
| 生成测试用例 | `impm-task-coding-testcase` | TE |
| 根据任务要求选择工程师完成开发 | `impm-task-coding-code` | SSE/FEE/BEE |
| 根据测试用例和当前代码编写测试 | `impm-task-coding-writetest` | TE |
| 执行测试，失败则返回重新编写代码 | `impm-task-coding-runtest` | TE |
| 提交 Git | `impm-task-coding-gitcommit` | SCM |

</details>

<details>
<summary>阶段 4：回归测试和文档整理归档</summary>

| 步骤说明 | 技能名 | 子代理 |
|:---------|:-------|:------:|
| 回归测试 | `impm-regression-test` | TE |
| 代码备注 | `impm-coding-comment` | DW |
| 代码审核 | `impm-coding-review` | TL |
| 项目地图更新 | `impm-project-update` | SA |
| 版本文档合并到主文档 | `impm-doc-merge` | DW |
| 更新 README.md 和 agent.md | `impm-doc-update` | DW |
| 更新编译部署文档 | `impm-deploy-update` | DW |
| 当前版本分支合并到主分支 | `impm-git-merge` | SCM |

</details>
