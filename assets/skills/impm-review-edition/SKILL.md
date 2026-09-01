---
name: impm-review-edition
description: impm 总流程的"文档审核版"，自动执行瀑布式开发全部四个阶段（项目初始化、需求分析整理（含逐文档用户审核）、编码开发、回归测试和版本文档整理），其中需求分析整理阶段使用 impm-docs-review（urs/prd/sad/dbd/api/lld/task 每步完成后弹出提示框请用户审核文档）。
---

# impm-review-edition 技能

## 触发词
/impm-review-edition、全流程开发文档审核版、impm文档审核版、带审核的全流程、从需求到上线（含文档审核）

## 何时使用
用户要求执行 impm 软件工程全流程开发，并希望在需求分析整理阶段对每份文档（URS、PRD、SAD、DBD、API、LLD、任务清单）生成后由用户逐份审核确认时使用。本技能与 impm 技能流程完全一致，唯一区别是将阶段二由 impm-docs 替换为 impm-docs-review。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。内部子步骤必须按下方「通用调度要求」派发对应 subagent 执行，PM 只调度、检查与决策；阶段二中的用户文档审核确认由 PM 直接通过 question 工具弹出提示框完成。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行具体事务（唯一例外：阶段二用户文档审核确认环节由 PM 直接执行）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-review-edition）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 阶段一 | impm-init | PM（编排，内部再派发） |
| 阶段二 | impm-docs-review | PM（编排，内部再派发，含逐文档用户审核） |
| 阶段三 | impm-coding | PM（编排，内部再派发） |
| 阶段四 | impm-finish | PM（编排，内部再派发） |

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| --- | --- | --- |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |

## 执行要求
1. 严格按照四个阶段的顺序依次执行：不跳过、不乱序、不并行、不合并任何阶段和步骤（阶段之间串行；阶段内部是否并发由对应技能自行定义，如 impm-coding 编码任务可并发调度）。
2. 每个阶段执行前先检查前置条件，执行后检查版本进度文件 version_progress.md 确认步骤状态已记录。
3. 使用 impm_* 工具获取版本号、任务、项目信息等事实数据，不得臆造。
4. 需要用户输入或进行文档审核时通过 question 工具弹出提示框询问用户，不得自行虚构需求。
5. **阶段二 impm-docs-review 中的文档审核必须在每份文档生成后等待用户明确确认（审核通过）才能进入下一步**；审核未通过时按用户反馈重新生成再审，不得跳过。
6. 全程使用简体中文。

## 执行步骤

### 阶段一：项目初始化（impm-init）
1. 使用 Skill 工具加载并执行 impm-init 技能。
2. 先执行 impm-init-isinit 判断项目是否已初始化：
   - 若 docs/project.md 与 docs/sad.md 都存在且非空，说明已初始化，跳过整个初始化阶段；
   - 若为空项目或存量项目，依次执行初始化全部步骤：impm-init-isinit → impm-init-git → impm-init-project → impm-init-version → impm-init-urs → impm-init-prd → impm-init-sad → impm-init-dbd → impm-init-api → impm-init-lld → impm-init-task → impm-init-testcase → impm-init-commit。
3. 初始化阶段完成后，检查 version_progress.md 确认初始化步骤已记录。

### 阶段二：需求分析整理（impm-docs-review，含逐文档用户审核）
1. 向用户询问本轮需求：请用户输入本次版本的需求描述（或提供需求文档路径）。
2. 使用 Skill 工具加载并执行 impm-docs-review 技能，依次执行：impm-version-create → impm-urs-create（审核）→ impm-prd-create（审核）→ impm-sad-update（审核）→ impm-dbd-create（审核）→ impm-api-create（审核）→ impm-lld-create（审核）→ impm-task-create（审核）→ impm-rtm-create → impm-analysis-commit。其中标记"（审核）"的步骤完成后均由 PM 弹出提示框请用户审核文档，审核通过后才进入下一步。
3. 每步由对应 subagent 执行，每步完成后检查 version_progress.md 确认步骤状态已记录；文档审核确认环节由 PM 通过 question 工具完成，审核通过才继续下一步。

### 阶段三：编码开发（impm-coding）
1. 使用 Skill 工具加载并执行 impm-coding 技能。
2. 读取任务清单中所有状态不为"已完成"的任务，按上下游依赖**并发调度**（最多 5 个并行，由 PM 按阶段波次直接派发子步骤 subagent 执行 impm-task-coding），全部任务编码完成后逐个**串行**执行 impm-task-coding-gitcommit 提交。
3. 全部任务完成后，检查 version_progress.md 确认 impm-coding 状态已记录。

### 阶段四：回归测试和版本文档整理（impm-finish）
1. 使用 Skill 工具加载并执行 impm-finish 技能，依次执行：impm-regression-test → impm-coding-comment → impm-coding-review → impm-regression-metrics → impm-project-update → impm-doc-merge → impm-doc-update → impm-deploy-update → impm-git-merge。
2. 全部步骤完成后，调用 impm_progress（action=finalize）在退出前结算进度表最后一行（impm-finish，已完成）的总耗时与 token（幂等：impm-finish 已结算时自动跳过）。
3. 向用户汇报本次版本开发的完整产出，并说明文档审核结果（阶段二各文档的审核确认情况）。

## 交付物
- 版本目录 docs/{项目英文缩写}-v{当前版本号}/ 及其全部文档
- 版本进度文件 version_progress.md（记录全部步骤状态）
- 实现代码、测试函数与自动化测试脚本
- 回归测试报告、代码审核报告、readme.md、agent.md、deploy/ 编译部署文档
- 阶段二各文档的用户审核确认记录（对话内完成）

## 完成后提示
- 本次版本全流程开发（含文档审核版）已完成。
- 如需查看版本进度，请查看版本目录下的 version_progress.md。
- 若后续不需要逐文档审核，可使用标准全流程 /impm 或 /impm-docs。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
