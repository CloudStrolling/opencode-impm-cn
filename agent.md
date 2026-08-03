# Agent 使用说明

opencode-impm-cn 编排了 13 个专业 AI Agent，由 PM Agent（项目经理）统一调度，按照 impm 工程化流程（初始化 → 需求分析整理 → 编码开发 → 回归测试和版本文档整理）协同完成开发任务。

---

## Agent 总览

| Agent | 角色 | 核心职责 | 由谁调度 |
|-------|------|---------|---------|
| PM | 项目经理 | 流程编排、进度追踪、Subagent 调度 | 用户（通过 `/impm` 命令） |
| BA | 业务分析师 | 生成 URS、PRD 需求文档 | PM |
| SA | 软件架构师 | 系统架构设计（SAD）、项目基本信息与项目地图 | PM |
| TL | 技术负责人 | 详细设计（LLD）、API 设计、任务拆解、代码审核 | PM |
| DBA | 数据库管理员 | 数据库设计（DBD）、SQL 脚本与数据库变更 | PM |
| TE | 测试工程师 | 测试用例、测试函数、自动化测试与回归测试 | PM |
| SCM | 版本管理员 | 版本管理、git 分支、提交与合并 | PM |
| DW | 技术写作 | 代码注释、文档合并、readme/agent/部署文档维护 | PM |
| CS | 本地代码查询 | 查询本地代码，输出现有代码与工具类信息 | PM |
| WS | 网络资料查询 | 查询官方文档与应用案例，校验版本兼容性 | PM |
| FEE | 前端工程师 | 前端任务编码实现 | PM |
| BEE | 后端工程师 | 后端任务编码实现 | PM |
| SSE | 高级软件工程师 | 公共/通用任务编码实现 | PM |

---

## PM Agent（项目经理）

**文件：** `assets/agents/pm.md`

PM 是 impm 流程的核心编排者，不直接编写功能代码，而是调度各个专业 Subagent 完成工作。

**核心职责：**
- 按 impm 流程逐步编排开发过程（四阶段：初始化、需求分析整理、编码开发、回归测试和版本文档整理）
- 维护版本进度表 version_progress.md 与任务状态，确保步骤按序执行
- 为每个 Subagent 构建精确的上下文
- 每步完成后核对进度记录，确认后才进入下一步

**调度关系：**
```
PM → BA / SA / TL / DBA / TE / SCM / DW / CS / WS / FEE / BEE / SSE
```

**使用方式：** 在 OpenCode 中输入 `/impm` 启动完整流程，或输入子命令执行特定阶段（如 `/impm-init`、`/impm-docs`、`/impm-coding`、`/impm-finish`）。

---

## BA Agent（业务分析师）

**文件：** `assets/agents/ba.md`

**执行技能：** `impm-init-urs`、`impm-init-prd`、`impm-urs-create`、`impm-prd-create`

**职责：**
- 收集并整理用户原始诉求，识别业务目标、用户角色与业务场景
- 编写 URS 用户需求说明书（业务目标、用户角色、业务场景、功能需求、非功能需求、约束条件、假设与依赖）
- 编写 PRD 产品需求文档（含用户故事 User Story 与验收标准）
- 从存量项目的代码和文档反推需求文档（初始化阶段）

**输入：** 用户需求描述、URS/PRD 模板、参考文档
**输出：** `docs/{缩写}-v{版本}/{缩写}-urs-v{版本}.md`、`{缩写}-prd-v{版本}.md`

---

## SA Agent（软件架构师）

**文件：** `assets/agents/sa.md`

**执行技能：** `impm-init-project`、`impm-init-sad`、`impm-sad-update`、`impm-project-update`

**职责：**
- 生成/维护项目基本信息 docs/project.md（项目信息、编码规范、项目地图）
- 设计系统架构（SAD），确定模块划分、技术选型、数据流
- 存量项目初始化时分析代码结构，按存量项目反推补全
- 更新项目地图（impm_project_analyzer 扫描源码）

**输入：** PRD 文档、源代码结构
**输出：** `docs/project.md`、`docs/sad.md`

---

## TL Agent（技术负责人）

**文件：** `assets/agents/tl.md`

**执行技能：** `impm-init-api`、`impm-init-lld`、`impm-api-create`、`impm-lld-create`、`impm-task-create`、`impm-task-coding-context`、`impm-task-coding-api`、`impm-coding-review`

**职责：**
- 编写 API 接口设计文档与详细设计文档（LLD）
- 将开发需求拆解为可执行的任务清单（task JSON，含上下游依赖）
- 编码阶段收集需求上下文（context.md）
- 代码质量审核（安全漏洞、性能陷阱、代码质量、架构合规性、测试覆盖）

**输入：** PRD、SAD、DBD、API 文档
**输出：** `{缩写}-api-v{版本}.md`、`{缩写}-lld-v{版本}.md`、`{缩写}-task-v{版本}.json`、`task_{编号}/context.md`、`{缩写}-review.md`

---

## DBA Agent（数据库管理员）

**文件：** `assets/agents/dba.md`

**执行技能：** `impm-init-dbd`、`impm-dbd-create`、`impm-task-coding-dbd`

**职责：**
- 生成数据库设计文档（DBD）与 SQL 脚本（`{缩写}-dbd-v{版本}.sql`）
- 无数据库需求时记录「无需数据库」进度并跳过
- 编码阶段评估数据库变更，输出变更 SQL

**输入：** PRD、SAD、任务需求
**输出：** `{缩写}-dbd-v{版本}.md`、`{缩写}-dbd-v{版本}.sql`

---

## TE Agent（测试工程师）

**文件：** `assets/agents/te.md`

**执行技能：** `impm-init-testcase`、`impm-task-coding-testcase`、`impm-task-coding-writetest`、`impm-task-coding-runtest`、`impm-regression-test`

**职责：**
- 按模板编写测试用例（正常路径、边界条件、异常路径）
- 编写单元测试函数与自动化测试脚本
- 用 Python 编写接口测试脚本（scripts/API-TEST/，统一入口）
- 执行测试并更新测试结果，失败时回退编码
- 回归测试（全量单元测试 + 全部接口测试脚本），输出回归报告

**TDD 流程：**
1. 编码前：编写测试用例文档
2. 编码后：编写测试脚本并执行
3. 测试失败 → 回退重新编码（连续失败达 3 次则中止）
4. 测试通过 → 进入下一步

**输入：** context.md、cs.md、ws.md、测试模板、已编码代码
**输出：** `task_{编号}/testcase.md`、单元测试、`scripts/API-TEST/{缩写}-api-test-v{版本}.py`、`{缩写}-ui-test-record-v{版本}.md`、回归测试报告

---

## SCM Agent（版本管理员）

**文件：** `assets/agents/scm.md`

**执行技能：** `impm-init-git`、`impm-init-version`、`impm-init-commit`、`impm-version-create`、`impm-analysis-commit`、`impm-task-coding-gitcommit`、`impm-git-merge`

**职责：**
- 初始化 git 仓库，创建版本分支 `{缩写}-v{版本号}`
- 创建版本目录与版本进度表
- 按阶段/任务提交代码，更新任务状态为已完成
- 将版本分支以 `git merge --squash` 方式合并到主分支（master 或 main）

**输入：** 版本号、项目名称、待提交文件
**输出：** git 分支、提交记录、合并结果

---

## DW Agent（技术写作）

**文件：** `assets/agents/dw.md`

**执行技能：** `impm-coding-comment`、`impm-doc-merge`、`impm-doc-update`、`impm-deploy-update`

**职责：**
- 依据 git 修改记录为版本更新的代码补充清晰的中文注释
- 将版本 URS/PRD/API/DBD/DBD SQL/LLD 文档合并到 docs 下对应主文档
- 创建或更新根目录 readme.md 与 agent.md
- 创建或更新 deploy/build.md、deploy/deploy.md，必要时生成编译部署脚本

**输入：** 版本文档、已完成的代码、git 修改记录
**输出：** 代码注释、合并后的主文档、readme.md、agent.md、部署文档

---

## CS Agent（本地代码查询）

**文件：** `assets/agents/cs.md`

**执行技能：** `impm-task-coding-cs`

**职责：**
- 读取任务上下文（context.md）与项目地图（docs/project.md）
- 在本地代码中查询与当前需求相关的现有代码、工具类、可复用组件
- 汇总查询结果写入任务目录 cs.md，标注文件路径与关键函数

**输入：** 任务编号、context.md、项目地图
**输出：** `task_{编号}/cs.md`

---

## WS Agent（网络资料查询）

**文件：** `assets/agents/ws.md`

**执行技能：** `impm-task-coding-ws`

**职责：**
- 判断任务需要使用的第三方中间件、包或 SDK
- 查询官方文档、使用方法与应用样例，校验版本兼容性
- 汇总分析写入任务目录 ws.md

**输入：** 任务编号、context.md、cs.md
**输出：** `task_{编号}/ws.md`

---

## FEE / BEE / SSE Agent（开发工程师）

**文件：** `assets/agents/fee.md`、`assets/agents/bee.md`、`assets/agents/sse.md`

**执行技能：** `impm-task-coding-code`

**职责：**
- 根据编码上下文（context.md/cs.md/ws.md）与测试用例实现功能代码
- 前端业务需求 → FEE Agent
- 后端业务需求 → BEE Agent
- 公共/通用需求 → SSE Agent
- 编码力求简洁清晰，核对需求覆盖与逻辑正确性

**输入：** context.md、cs.md、ws.md、testcase.md
**输出：** 功能代码

---

## 协作流程

```
用户 → [/impm] → PM
                    │
                    ├── [阶段1 初始化] /impm-init
                    │   ├── PM   → 判定项目类型（空项目/存量项目）
                    │   ├── SCM  → git init、版本目录、进度表、提交
                    │   ├── SA   → project.md、sad.md
                    │   ├── BA   → urs.md、prd.md
                    │   ├── DBA  → dbd.md / 无需数据库
                    │   ├── TL   → api.md、lld.md
                    │   └── TE   → testcase.md
                    │
                    ├── [阶段2 需求分析整理] /impm-docs
                    │   ├── SCM  → 版本分支 + 版本目录 + 进度表
                    │   ├── BA   → URS、PRD（含用户故事）
                    │   ├── SA   → SAD 更新
                    │   ├── DBA  → DBD + SQL
                    │   ├── TL   → API、LLD、任务清单
                    │   └── SCM  → 提交
                    │
                    ├── [阶段3 编码开发] /impm-coding
                    │   └── 对每个任务（impm_task_manager next）：
                    │       ├── TL   → context.md
                    │       ├── CS   → cs.md
                    │       ├── WS   → ws.md
                    │       ├── DBA  → 数据库变更
                    │       ├── TL   → API 变更
                    │       ├── TE   → testcase.md
                    │       ├── FEE/BEE/SSE → 编码
                    │       ├── TE   → 写测试、跑测试（失败回退）
                    │       └── SCM  → 提交、任务状态置为已完成
                    │
                    └── [阶段4 回归测试和版本文档整理] /impm-finish
                        ├── TE   → 回归测试
                        ├── DW   → 代码注释
                        ├── TL   → 代码审核
                        ├── SA   → 项目地图更新
                        ├── DW   → 文档合并、readme/agent、部署文档
                        └── SCM  → 合并主分支
```

---

## 注意事项

1. **严格按序执行**：四阶段步骤固定顺序，不跳过、不乱序、不并行、不合并，每步完成后核对版本进度表记录。
2. **上下文隔离**：每个 Subagent 只接收其任务所需的材料，不传递无关信息。
3. **交付物驱动**：步骤之间通过标准路径下的文档交付物衔接。
4. **TDD 优先**：编码步骤严格遵循「测试先行」原则，测试不通过不得提交。
5. **Subagent 之间不直接通信**，全部通过 PM Agent 编排调度。
6. **所有输出使用简体中文**。
7. 所有进度与状态以版本进度表 version_progress.md 与任务清单 task JSON 的记录为准，不口头声称完成。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
