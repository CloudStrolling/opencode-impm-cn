---
name: impm-docs-review
description: 编排并执行需求分析整理阶段（阶段2）的全部步骤（版本创建、URS、PRD、SAD更新、DBD、API、LLD、任务清单、需求追踪矩阵、git提交），并在 urs/prd/sad/dbd/api/lld/task 每一步文档完成后弹出提示框提示用户审核文档，审核通过后才执行下一步。
---

# impm-docs-review 技能

## 触发词
需求分析、需求分析整理、impm-docs-review、生成需求文档、开始分析需求、执行阶段2、文档审核、审核文档、/impm-docs-review

## 何时使用
当用户需要执行需求分析整理阶段（阶段2），并要求在每份文档（URS、PRD、SAD、DBD、API、LLD、任务清单）生成后由用户审核确认再继续下一步时使用。本技能是阶段编排技能，与 impm-docs 步骤一致，区别在于 urs/prd/sad/dbd/api/lld/task 这 7 步文档完成后均插入"用户审核确认"环节（弹出提示框），审核通过才进入下一步。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。内部文档生成子步骤必须按下方「通用调度要求」派发对应 subagent 执行，PM 只调度、检查与决策；**用户文档审核确认环节由 PM 直接通过 question 工具弹出提示框完成**（该环节 PM 直接执行，不派发 subagent）。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个文档生成子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行文档生成事务（唯一例外：用户审核确认环节由 PM 直接执行）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-docs-review）
| 子步骤 | 技能名 | subagent_type | 是否需用户审核 |
|----|----|----|----|
| 2 | impm-version-create | scm | 否 |
| 3 | impm-urs-create | ba | 是 |
| 4 | impm-prd-create | ba | 是 |
| 5 | impm-sad-update | sa | 是 |
| 6 | impm-dbd-create | dba | 是 |
| 7 | impm-api-create | tl | 是 |
| 8 | impm-lld-create | tl | 是 |
| 9 | impm-task-create | tl | 是 |
| 10 | impm-rtm-create | tl | 否 |
| 11 | impm-analysis-commit | scm | 否 |

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
7. **用户审核确认环节必须等用户明确回复后再继续**：审核未通过时不得进入下一步，需按用户反馈重新生成该文档并再次审核。

## 用户文档审核确认环节（PM 直接执行）

以下"文档审核确认"环节在 urs/prd/sad/dbd/api/lld/task 这 7 个文档生成步骤完成后触发。PM 通过 question 工具弹出提示框，向用户展示已生成的文档路径与内容要点，请用户审核。

**审核选项设计**（question 工具）：
- header：`审核{文档简称}`
- question：`已生成 {文档完整路径}，请审核该文档。审核通过后才会进入下一步；如需修改，请选择"需要修改"并填写修改意见。`
- options：
  - `审核通过`（description：文档内容正确，确认进入下一步）
  - `需要修改`（description：文档存在问题，填写修改意见后将重新生成并再次审核）

**处理逻辑**：
1. 若用户选择"审核通过"，核对 version_progress.md 已记录对应步骤状态为"已完成"，进入下一步骤。
2. 若用户选择"需要修改"（或通过自定义输入给出修改意见）：
   - PM 汇总用户修改意见，作为补充上下文重新派发对应的文档生成 subagent（同 subagent_type、同技能）重新生成该文档；
   - 子步骤完成后再次弹出提示框请用户审核，直到用户选择"审核通过"为止（连续多次未通过可先与用户确认修改意见的可行性，避免无谓反复）；
   - 期间不得推进到下一步骤。
3. 注意：某些步骤可能判定为"无需修改/无需数据库/无需接口"（如 sad-update="无需修改"、dbd-create="无需数据库"、api-create="无需接口"）。此时按原 impm-docs 处理跳过，不触发审核提示框（无需审核的内容不弹窗），如实记录进度状态后进入下一步；若步骤实际产出文档（如专家判断需要修改并已产出新文档），则仍需提示用户审核。

## 执行步骤

### 步骤 1：确定当前版本号
检查本次用户输入及其中提到的文档是否包含版本号：若执行前当前版本号未知且输入中未提及版本号，先按步骤 2 执行 impm-version-create 确定版本号；若版本号已明确，则将相关信息传给后续步骤。

### 步骤 2：执行 impm-version-create
启动 SCM subagent，使用 Skill 工具加载并执行 impm-version-create 技能：
1. 确定当前版本号（优先采用用户输入中的版本号，否则通过 impm_version action=current 获取最大版本号后，用 action=next 在 z 值上 +1）；
2. 拉取最新代码，创建并切换到分支 {项目英文缩写}-v{当前版本号}；
3. 调用 impm_version（action=init）创建版本目录 docs/{项目英文缩写}-v{当前版本号}；
4. 调用 impm_progress（action=init）创建 version_progress.md 并写入首行。
执行完成后，读取 docs/{项目英文缩写}-v{当前版本号}/version_progress.md，确认 impm-version-create 行状态为"已完成"，再进入下一步。（本步骤不触发用户审核，对应"版本创建"不属于文档审核范围。）

### 步骤 3：执行 impm-urs-create（含审核）
1. 启动 BA subagent，使用 Skill 工具加载并执行 impm-urs-create 技能，生成用户需求说明书并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md。
2. 执行完成后，核对文件存在、version_progress.md 已记录 impm-urs-create 状态为"已完成"。
3. **文档审核确认（URS）**：按上文"用户文档审核确认环节"弹出提示框，请用户审核 URS 文档；审核通过后方可进入下一步。

### 步骤 4：执行 impm-prd-create（含审核）
1. 启动 BA subagent，使用 Skill 工具加载并执行 impm-prd-create 技能，生成产品需求文档并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md。
2. 执行完成后，核对文件存在、version_progress.md 已记录 impm-prd-create 状态为"已完成"。
3. **文档审核确认（PRD）**：弹出提示框，请用户审核 PRD 文档；审核通过后方可进入下一步。

### 步骤 5：执行 impm-sad-update（含审核）
1. 启动 SA subagent，使用 Skill 工具加载并执行 impm-sad-update 技能，评估并更新系统架构设计文档 docs/{项目英文缩写}-sad.md。
2. 执行完成后，核对 version_progress.md 已记录 impm-sad-update 状态为"已完成"或"无需修改"。
3. **文档审核确认（SAD）**：若本步骤实际更新/产出了 SAD 文档（状态为"已完成"且 docs/{项目英文缩写}-sad.md 有实质更新），弹出提示框请用户审核；若状态为"无需修改"且未产出新内容，则不弹窗，直接进入下一步。

### 步骤 6：执行 impm-dbd-create（含审核）
1. 启动 DBA subagent，使用 Skill 工具加载并执行 impm-dbd-create 技能，生成数据库设计文档与 SQL 脚本。
2. 执行完成后，核对 version_progress.md 已记录 impm-dbd-create 状态为"已完成"或"无需数据库"。
3. **文档审核确认（DBD）**：若实际产出 DBD 文档（状态为"已完成"），弹出提示框请用户审核；若"无需数据库"则不弹窗，进入下一步。

### 步骤 7：执行 impm-api-create（含审核）
1. 启动 TL subagent，使用 Skill 工具加载并执行 impm-api-create 技能，生成 API 接口设计文档。
2. 执行完成后，核对 version_progress.md 已记录 impm-api-create 状态为"已完成"或"无需接口"。
3. **文档审核确认（API）**：若实际产出 API 文档（状态为"已完成"），弹出提示框请用户审核；若"无需接口"则不弹窗，进入下一步。

### 步骤 8：执行 impm-lld-create（含审核）
1. 启动 TL subagent，使用 Skill 工具加载并执行 impm-lld-create 技能，生成详细设计文档并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md。
2. 执行完成后，核对文件存在、version_progress.md 已记录 impm-lld-create 状态为"已完成"。
3. **文档审核确认（LLD）**：弹出提示框，请用户审核 LLD 文档；审核通过后方可进入下一步。

### 步骤 9：执行 impm-task-create（含审核）
1. 启动 TL subagent，使用 Skill 工具加载并执行 impm-task-create 技能，生成任务清单 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json。
2. 执行完成后，核对文件存在、version_progress.md 已记录 impm-task-create 状态为"已完成"。
3. **文档审核确认（任务清单）**：弹出提示框，请用户审核任务清单；审核通过后方可进入下一步。

### 步骤 10：执行 impm-rtm-create
启动 TL subagent，使用 Skill 工具加载并执行 impm-rtm-create 技能，根据当前版本 URS、PRD、LLD 与任务清单，建立"需求 → 设计 → 任务"的多对多追踪矩阵，写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-rtm-v{当前版本号}.md。
执行完成后，核对文件存在、version_progress.md 已记录 impm-rtm-create 状态为"已完成"，再进入下一步。（本步骤不触发用户审核。）

### 步骤 11：执行 impm-analysis-commit
启动 SCM subagent，使用 Skill 工具加载并执行 impm-analysis-commit 技能，将需求分析整理阶段生成的所有文件和目录（含 rtm.md）提交到 git。
执行完成后，核对 version_progress.md 已记录 impm-analysis-commit 状态为"已完成"。

### 步骤 12：结算最后步骤并汇报
调用 impm_progress（action=finalize）在退出前结算进度表最后一行（impm-analysis-commit，已完成）的总耗时与 token（含该步骤主会话与 subagent 子会话消耗）；汇总本阶段全部产出文件清单、各步骤完成状态与用户审核结果，并向用户说明下一步建议（进入编码开发阶段，输入 /impm-coding）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/version_progress.md（版本进度表，10 个步骤全部记录）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md（如适用）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-rtm-v{当前版本号}.md（需求追踪矩阵）
- 更新后的 docs/{项目英文缩写}-sad.md（如判断需要修改）
- 各文档生成后的用户审核确认记录（对话内完成）

## 完成后提示
- 如需继续执行下一步骤（进入编码开发阶段），请输入 /impm-coding
- 如需重新执行本阶段所有步骤（含审核确认），请输入 /impm-docs-review
- 如需执行不带文档审核的常规需求分析阶段，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
