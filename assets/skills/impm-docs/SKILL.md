---
name: impm-docs
description: 编排并执行需求分析整理阶段（阶段2）的全部9个步骤（版本创建、URS、PRD、SAD更新、DBD、API、LLD、任务清单、git提交），确保各步骤严格按顺序依次执行。
---

# impm-docs 技能

## 触发词
需求分析、需求分析整理、impm-docs、生成需求文档、开始分析需求、执行阶段2、/impm-docs

## 何时使用
当用户需要执行需求分析整理阶段（阶段2）时使用。本技能是阶段编排技能，负责按固定顺序调度该阶段全部9个子技能：impm-version-create → impm-urs-create → impm-prd-create → impm-sad-update → impm-dbd-create → impm-api-create → impm-lld-create → impm-task-create → impm-analysis-commit。每个子技能由对应 subagent 执行。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。内部子步骤必须按下方「通用调度要求」派发对应 subagent 执行，PM 只调度、检查与决策。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行具体事务（唯一例外：对照表中标注"PM 直接执行"的步骤）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-docs）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 2 | impm-version-create | scm |
| 3 | impm-urs-create | ba |
| 4 | impm-prd-create | ba |
| 5 | impm-sad-update | sa |
| 6 | impm-dbd-create | dba |
| 7 | impm-api-create | tl |
| 8 | impm-lld-create | tl |
| 9 | impm-task-create | tl |
| 10 | impm-analysis-commit | scm |

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤

### 步骤 1：确定当前版本号
检查本次用户输入及其中提到的文档是否包含版本号：若执行前当前版本号未知且输入中未提及版本号，先按步骤 2 执行 impm-version-create 确定版本号；若版本号已明确，则将相关信息传给后续步骤。

### 步骤 2：执行 impm-version-create
启动 SCM subagent，使用 Skill 工具加载并执行 impm-version-create 技能：
1. 确定当前版本号（优先采用用户输入中的版本号，否则通过 impm_version action=current 获取最大版本号后，用 action=next 在 z 值上 +1）；
2. 拉取最新代码，创建并切换到分支 {项目英文缩写}-v{当前版本号}；
3. 调用 impm_version（action=init）创建版本目录 docs/{项目英文缩写}-v{当前版本号}；
4. 调用 impm_progress（action=init）创建 version_progress.md 并写入首行。
执行完成后，读取 docs/{项目英文缩写}-v{当前版本号}/version_progress.md，确认 impm-version-create 行状态为"已完成"，再进入下一步。

### 步骤 3：执行 impm-urs-create
启动 BA subagent，使用 Skill 工具加载并执行 impm-urs-create 技能，生成用户需求说明书并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md。
执行完成后，核对文件存在、version_progress.md 已记录 impm-urs-create 状态为"已完成"，再进入下一步。

### 步骤 4：执行 impm-prd-create
启动 BA subagent，使用 Skill 工具加载并执行 impm-prd-create 技能，生成产品需求文档并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md。
执行完成后，核对文件存在、version_progress.md 已记录 impm-prd-create 状态为"已完成"，再进入下一步。

### 步骤 5：执行 impm-sad-update
启动 SA subagent，使用 Skill 工具加载并执行 impm-sad-update 技能，评估并更新系统架构设计文档 docs/{项目英文缩写}-sad.md。
执行完成后，核对 version_progress.md 已记录 impm-sad-update 状态为"已完成"或"无需修改"，再进入下一步。

### 步骤 6：执行 impm-dbd-create
启动 DBA subagent，使用 Skill 工具加载并执行 impm-dbd-create 技能，生成数据库设计文档与 SQL 脚本。
执行完成后，核对 version_progress.md 已记录 impm-dbd-create 状态为"已完成"或"无需数据库"，再进入下一步。

### 步骤 7：执行 impm-api-create
启动 TL subagent，使用 Skill 工具加载并执行 impm-api-create 技能，生成 API 接口设计文档。
执行完成后，核对 version_progress.md 已记录 impm-api-create 状态为"已完成"或"无需接口"，再进入下一步。

### 步骤 8：执行 impm-lld-create
启动 TL subagent，使用 Skill 工具加载并执行 impm-lld-create 技能，生成详细设计文档并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md。
执行完成后，核对文件存在、version_progress.md 已记录 impm-lld-create 状态为"已完成"，再进入下一步。

### 步骤 9：执行 impm-task-create
启动 TL subagent，使用 Skill 工具加载并执行 impm-task-create 技能，生成任务清单 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json。
执行完成后，核对文件存在、version_progress.md 已记录 impm-task-create 状态为"已完成"，再进入下一步。

### 步骤 10：执行 impm-analysis-commit
启动 SCM subagent，使用 Skill 工具加载并执行 impm-analysis-commit 技能，将需求分析整理阶段生成的所有文件和目录提交到 git。
执行完成后，核对 version_progress.md 已记录 impm-analysis-commit 状态为"已完成"。

### 步骤 11：结算最后步骤并汇报
调用 impm_progress（action=finalize）在退出前结算进度表最后一行（impm-analysis-commit，已完成）的总耗时与 token（含该步骤主会话与 subagent 子会话消耗）；汇总本阶段全部产出文件清单、各步骤完成状态，并向用户说明下一步建议（进入编码开发阶段，输入 /impm-coding）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/version_progress.md（版本进度表，9 个步骤全部记录）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json
- 更新后的 docs/{项目英文缩写}-sad.md（如判断需要修改）

## 完成后提示
- 如需继续执行下一步骤（进入编码开发阶段），请输入 /impm-coding
- 如需重新执行本阶段所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
