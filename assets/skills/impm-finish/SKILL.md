---
name: impm-finish
description: 编排回归测试和版本文档整理阶段（阶段4）的全部步骤，调度各 subagent 按顺序完成版本收尾工作
---

# impm-finish 技能

## 触发词
/impm-finish、阶段4、回归测试、版本文档整理、版本收尾、完成本版本

## 何时使用
阶段3编码开发全部完成、版本内所有任务均已提交后，需要执行回归测试和版本文档整理时使用。本技能是阶段4的编排入口，负责严格按顺序调度其余8个技能。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。内部子步骤必须按下方「通用调度要求」派发对应 subagent 执行，PM 只调度、检查与决策。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行具体事务（唯一例外：对照表中标注"PM 直接执行"的步骤）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-finish）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 1 | impm-regression-test | te |
| 2 | impm-coding-comment | dw |
| 3 | impm-coding-review | tl |
| 4 | impm-project-update | sa |
| 5 | impm-doc-merge | dw |
| 6 | impm-doc-update | dw |
| 7 | impm-deploy-update | dw |
| 8 | impm-git-merge | scm |

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
### 步骤 1：执行回归测试
1. 检查 docs/{项目英文缩写}-v{当前版本号}/version_progress.md，确认 impm-regression-test 步骤状态。若状态已为"已完成"，则跳过本步骤直接进入步骤 2；否则：
2. 启动 TE subagent，通过 Skill 工具加载 impm-regression-test 技能，由 TE 完成：合并测试用例到主测试用例、全量运行单元测试、运行 scripts/API-TEST/ 目录下全部接口测试脚本，并分别写入回归测试结果。
3. TE 执行完成后，重新核对 version_progress.md 中 impm-regression-test 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 2：执行代码备注
1. 启动 DW subagent，通过 Skill 工具加载 impm-coding-comment 技能，由 DW 依据当前分支 git 修改记录，为本次版本更新的全部代码补充清晰的中文注释。
2. 执行完成后，核对 version_progress.md 中 impm-coding-comment 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 3：执行代码审核
1. 启动 TL subagent，通过 Skill 工具加载 impm-coding-review 技能，由 TL 对本次版本代码进行安全漏洞、性能陷阱、代码质量、架构合规性、测试覆盖审核，按模板输出审核报告。
2. 执行完成后，核对 version_progress.md 中 impm-coding-review 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 4：更新项目地图
1. 启动 SA subagent，通过 Skill 工具加载 impm-project-update 技能，由 SA 扫描源代码目录生成项目地图，并更新 docs/project.md 的项目地图部分。
2. 执行完成后，核对 version_progress.md 中 impm-project-update 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 5：合并版本文档到主文档
1. 启动 DW subagent，通过 Skill 工具加载 impm-doc-merge 技能，由 DW 将当前版本的 URS、PRD、API、DBD、DBD SQL、LLD 文档合并进 docs 下对应的主文档。
2. 执行完成后，核对 version_progress.md 中 impm-doc-merge 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 6：更新 readme.md 与 agent.md
1. 启动 DW subagent，通过 Skill 工具加载 impm-doc-update 技能，由 DW 创建或更新项目根目录下的 readme.md 与 agent.md。
2. 执行完成后，核对 version_progress.md 中 impm-doc-update 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 7：更新编译部署方案
1. 启动 DW subagent，通过 Skill 工具加载 impm-deploy-update 技能，由 DW 创建或更新 deploy/build.md、deploy/deploy.md，必要时在 deploy 目录下生成编译部署脚本。
2. 执行完成后，核对 version_progress.md 中 impm-deploy-update 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 8：合并主分支并提交
1. 启动 SCM subagent，通过 Skill 工具加载 impm-git-merge 技能，由 SCM 将当前版本分支以 git merge --squash 方式合并到主分支（master 或 main）并提交。
2. 执行完成后，核对 version_progress.md 中 impm-git-merge 步骤状态已记录为"已完成"，方可继续下一步。

### 步骤 9：记录进度并汇报
1. 调用 impm_progress add（impm-finish，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中阶段4全部 8 个步骤均已记录为"已完成"。
3. 向用户汇报：阶段4（回归测试和版本文档整理）全部步骤已按顺序完成，本版本开发全部完成。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/version_progress.md 中阶段4全部步骤的状态记录
- 版本合并到主分支后的提交记录

## 完成后提示
- 阶段4（回归测试和版本文档整理）已全部完成，本版本开发全部完成。
- 如需重新执行本阶段全部步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
