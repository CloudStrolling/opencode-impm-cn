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
本技能由 PM（项目经理）Agent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 11：向用户汇报
汇总本阶段全部产出文件清单、各步骤完成状态，并向用户说明下一步建议（进入编码开发阶段，输入 /impm-coding）。

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
