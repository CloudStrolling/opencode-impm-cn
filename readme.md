# opencode-impm-cn —— 我是项目经理（AI 项目经理）

> 基于 OpenCode 的工程化全流程开发套件：以「AI 项目经理」为核心，编排专业 AI 子代理，按瀑布式流程（初始化 → 需求分析整理 → 编码开发 → 回归测试和版本文档整理）完成软件开发全生命周期。

---

## 简介

opencode-impm-cn 是一套 OpenCode 插件套件，包含：

- **13 个专业 AI Agent**：由 PM（项目经理）统一调度，BA / SA / TL / DBA / TE / SCM / DW / CS / WS / FEE / BEE / SSE 各司其职。
- **45 个技能（Skill）与 45 个命令（Command）**：每个瀑布步骤对应一个技能和一个命令，严格按序执行，不跳过、不乱序、不并行。
- **11 个插件工具（Tool）**：文档读写、版本管理、进度管理、任务调度、上下文构建、项目分析、git 操作等，由技能调用。
- **10 个标准文档模板**：URS / PRD / SAD / DBD / API / LLD / TESTCASE / TASK / REVIEW / PROJECT，保证文档结构统一。

## 核心特性

- **瀑布式流程编排**：四阶段固定顺序，每步完成后在版本进度表（version_progress.md）记录状态，可随时核对进度。
- **测试先行（TDD）**：编码前先写测试用例，编码后编写并执行测试，全部通过才提交。
- **版本化管理**：每个版本对应一个版本目录 `docs/{项目英文缩写}-v{版本号}/` 与一个 git 分支 `{项目英文缩写}-v{版本号}`。
- **上下文精简传递**：编码任务只获得精简上下文（任务信息 + 用户故事 + 项目信息 + 架构相关章节）。
- **全程简体中文**：所有文档、注释、汇报均使用简体中文。

## 目录结构

```
opencode-impm-cn/
├── assets/                      # 套件资源（安装时复制到 .opencode/）
│   ├── agents/                  # 13 个 AI Agent 定义（.md）
│   ├── commands/                # 45 个命令（.md）
│   └── skills/                  # 45 个技能（每技能一个目录）+ template/ 模板
├── src/                         # 插件源码（TypeScript）
│   ├── tools/                   # 11 个工具的实现
│   ├── utils/                   # 路径 / 版本 / git / 项目信息工具
│   └── index.ts                 # 插件入口
├── scripts/
│   ├── install.mjs              # 安装脚本（Node）
│   └── install.ps1              # 安装脚本（Windows PowerShell）
├── docs/                        # 项目文档目录（由流程自动生成）
├── opencode.json                # OpenCode 配置文件
├── readme.md                    # 本文档（由 impm-doc-update 维护）
└── agent.md                     # Agent 使用说明（由 impm-doc-update 维护）
```

## 环境要求

- Node.js >= 18
- OpenCode（支持插件、技能、命令的版本）

## 安装

方式一：本地安装（推荐开发调试）

```bash
npm install          # postinstall 自动执行安装脚本
# 或手动执行：
node scripts/install.mjs
```

方式二：作为 npm 依赖安装到目标项目

```bash
npm install opencode-impm-cn
```

安装脚本会把 `assets/` 下的 agents、commands、skills 复制到目标项目的 `.opencode/` 目录，并把编译后的插件复制到 `.opencode/plugins/impm/`（OpenCode 启动时自动加载本地插件）。

也可以指定安装目标：

```bash
node scripts/install.mjs --target /path/to/project
```

安装完成后重启 OpenCode，即可使用 `/impm` 命令。

## 快速开始

在 OpenCode 中输入：

```
/impm
```

PM Agent 会按四阶段依次推进：

| 阶段 | 编排命令 | 说明 |
| --- | --- | --- |
| 阶段 1：初始化 | `/impm-init` | 初始化项目：判定项目类型、创建版本目录与进度表、生成 URS/PRD/SAD/DBD/API/LLD/测试用例初始文档并提交 |
| 阶段 2：需求分析整理 | `/impm-docs` | 确认当前版本需求：创建版本分支与版本目录、生成 URS/PRD、更新 SAD、生成 DBD/API/LLD、创建任务清单并提交 |
| 阶段 3：编码开发 | `/impm-coding` | 循环执行任务：收集上下文 → 代码查询 → 网络查询 → 数据库/API 设计 → 测试用例 → 编码 → 写测试 → 跑测试 → 提交，直至全部任务完成 |
| 阶段 4：回归测试和版本文档整理 | `/impm-finish` | 回归测试、代码注释、代码审核、项目地图更新、文档合并、更新 readme/agent/部署文档、合并主分支 |

也可以单独执行某个步骤的命令，例如 `/impm-init-urs`、`/impm-prd-create`、`/impm-task-coding-code` 等。

## 命令清单（45 个）

### 总流程

| 命令 | 说明 |
| --- | --- |
| `/impm` | 我是项目经理：编排四阶段全流程 |

### 阶段 1：初始化（impm-init 系列）

| 命令 | 说明 |
| --- | --- |
| `/impm-init` | 编排初始化阶段全部步骤 |
| `/impm-init-isinit` | 判定项目是否已初始化、是否为空项目 |
| `/impm-init-git` | 初始化 git 仓库并创建首个提交 |
| `/impm-init-project` | 生成项目基本信息 docs/project.md |
| `/impm-init-version` | 创建版本目录与版本进度表 |
| `/impm-init-urs` | 生成用户需求说明书 |
| `/impm-init-prd` | 生成产品需求文档 |
| `/impm-init-sad` | 生成系统架构设计文档 |
| `/impm-init-dbd` | 生成数据库设计文档与 SQL 脚本 |
| `/impm-init-api` | 生成 API 接口设计文档 |
| `/impm-init-lld` | 生成详细设计文档 |
| `/impm-init-testcase` | 生成测试用例文档 |
| `/impm-init-commit` | 提交初始化阶段全部产出 |

### 阶段 2：需求分析整理（impm-docs 系列）

| 命令 | 说明 |
| --- | --- |
| `/impm-docs` | 编排需求分析整理阶段全部步骤 |
| `/impm-version-create` | 确定版本号、创建版本分支、版本目录与进度表 |
| `/impm-urs-create` | 生成用户需求说明书（URS） |
| `/impm-prd-create` | 生成产品需求文档（PRD，含用户故事与验收标准） |
| `/impm-sad-update` | 评估并更新系统架构设计文档（SAD） |
| `/impm-dbd-create` | 生成数据库设计文档（DBD）与 SQL 脚本 |
| `/impm-api-create` | 生成 API 接口设计文档 |
| `/impm-lld-create` | 生成详细设计文档（LLD） |
| `/impm-task-create` | 生成任务清单（task JSON） |
| `/impm-analysis-commit` | 提交需求分析整理阶段全部产出 |

### 阶段 3：编码开发（impm-coding 系列）

| 命令 | 说明 |
| --- | --- |
| `/impm-coding` | 编排编码开发阶段：循环调度全部任务 |
| `/impm-task-coding` | 编排单个任务的编码全流程 |
| `/impm-task-coding-context` | 收集任务需求上下文（context.md） |
| `/impm-task-coding-cs` | 本地代码查询（cs.md） |
| `/impm-task-coding-ws` | 网络资料查询（ws.md） |
| `/impm-task-coding-dbd` | 数据库变更设计 |
| `/impm-task-coding-api` | API 接口变更设计 |
| `/impm-task-coding-testcase` | 编写任务测试用例 |
| `/impm-task-coding-code` | 功能编码实现 |
| `/impm-task-coding-writetest` | 编写测试函数与自动化脚本 |
| `/impm-task-coding-runtest` | 执行测试并更新结果 |
| `/impm-task-coding-gitcommit` | 提交任务代码并更新任务状态 |

### 阶段 4：回归测试和版本文档整理（impm-finish 系列）

| 命令 | 说明 |
| --- | --- |
| `/impm-finish` | 编排阶段 4 全部步骤 |
| `/impm-regression-test` | 回归测试（全量单元测试 + 接口测试） |
| `/impm-coding-comment` | 为版本代码补充中文注释 |
| `/impm-coding-review` | 代码审核（安全、性能、质量、合规、测试覆盖） |
| `/impm-project-update` | 更新项目地图与 docs/project.md |
| `/impm-doc-merge` | 合并版本文档到主文档 |
| `/impm-doc-update` | 更新 readme.md 与 agent.md |
| `/impm-deploy-update` | 更新编译部署方案（deploy/build.md、deploy/deploy.md） |
| `/impm-git-merge` | 合并版本分支到主分支 |

## 插件工具（11 个）

| 工具 | 说明 |
| --- | --- |
| `impm_project_info` | 读取项目基本信息（docs/project.md） |
| `impm_isinit` | 检查项目是否已初始化、是否为空项目 |
| `impm_doc_reader` | 按标准路径读取各类文档 |
| `impm_doc_writer` | 按标准路径写入文档（自动建目录） |
| `impm_template_reader` | 读取标准模板 |
| `impm_version` | 版本管理：current / next / init |
| `impm_progress` | 版本进度表管理：init / add / check / list |
| `impm_task_manager` | 任务清单管理：init / query / next / update |
| `impm_context_builder` | 构建任务精简上下文 |
| `impm_project_analyzer` | 扫描源码生成项目地图 |
| `impm_git` | git 操作：init / status / branch / checkout / commit / merge / pull / log |

## 文档标准路径

| 文档 | 路径 |
| --- | --- |
| 项目基本信息 | `docs/project.md` |
| 系统架构设计 | `docs/sad.md` |
| 版本目录 | `docs/{项目英文缩写}-v{版本号}/` |
| 版本需求/设计文档 | `docs/{缩写}-v{版本}/{缩写}-{urs\|prd\|dbd\|api\|lld\|testcase}-v{版本}.md` |
| 数据库脚本 | `docs/{缩写}-v{版本}/{缩写}-dbd-v{版本}.sql` |
| 任务清单 | `docs/{缩写}-v{版本}/{缩写}-task-v{版本}.json` |
| 版本进度表 | `docs/{缩写}-v{版本}/version_progress.md` |
| 任务目录 | `docs/{缩写}-v{版本}/task_{任务编号}/`（context.md、cs.md、ws.md、testcase.md） |
| 接口测试脚本 | `scripts/API-TEST/{缩写}-api-test-v{版本}.py` |
| 编译/部署方案 | `deploy/build.md`、`deploy/deploy.md` |
| 项目说明 | 根目录 `readme.md`、`agent.md` |

## 许可

Apache License 2.0

Copyright 2026 jenemy8023 <jenemy8023@163.com>

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
