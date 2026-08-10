---
name: impm-sprint
description: impm敏捷冲刺开发编排技能，6环节轻量完成一个冲刺周期（需求简报、版本与任务、编码、测试、汇总留存、提交合并），跳过URS/PRD/SAD/DBD/API/LLD六份设计文档与任务级context/cs/ws/testcase文档，PM直接执行轻量操作以减少token消耗与环节数量；汇总环节同时维护docs根目录敏捷需求汇总主文档（docs/{项目英文缩写}-sprint.md）供审核参考。
---

# impm-sprint 技能

## 触发词
- /impm-sprint
- 敏捷冲刺
- 敏捷开发
- 轻量迭代
- sprint

## 何时使用
项目已初始化（docs/project.md 与 docs/sad.md 均存在且非空）后，用户需要快速完成一个小批量迭代需求，希望减少环节、减少 token 消耗、增加速度，同时保留必要的文档留痕供审核时使用。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。PM 直接执行的环节（需求简报、版本与任务、汇总留存）不启动 subagent；其余环节按下方「通用调度要求」派发对应 subagent 执行。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：编码环节通过 task 工具启动对应 subagent（subagent_type 由任务 taskType 决定：common→`sse`、frontend→`fee`、backend→`bee`）执行 impm-sprint-code 技能；测试环节启动 `te` 执行 impm-sprint-test 技能；提交合并环节启动 `scm` 执行 impm-git-merge 技能（复用现有技能）。PM 直接环节禁止启动 subagent。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码环节适用）、需求简报要点（{需求简报要点}，编码环节适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}、需求简报要点={要点}；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-sprint）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 环节1 需求简报 | PM 直接执行 | — |
| 环节2 版本与任务 | PM 直接执行 | — |
| 环节3 编码 | impm-sprint-code | sse/fee/bee（按 taskType） |
| 环节4 测试 | impm-sprint-test | te |
| 环节5 汇总留存 | PM 直接执行 | — |
| 环节6 提交合并 | impm-git-merge（复用） | scm |

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号（在最大版本号 z 值上 +1） | 通过 impm_version action=current/next 获取 |
| 需求简报要点 | 环节1 整理的本次冲刺需求要点，传给编码环节 | 环节1 产出 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤
### 步骤 1：前置检查（PM 直接执行）
调用 impm_isinit(projectRoot) 判断项目是否已初始化：
- 若 initialized=false：向用户提示"项目未初始化，请先执行 /impm-init"，本技能结束，不创建任何文件。
- 若 initialized=true：继续执行步骤 2。

### 步骤 2：需求简报（PM 直接执行）
1. 调用 impm_template_reader(projectRoot, SPRINT-REQUIREMENT-TEMPLATE.MD) 读取敏捷需求简报模板。
2. 若用户输入 $ARGUMENTS 已包含需求描述，直接整理；否则向用户询问本次冲刺的需求（描述、验收标准、影响范围）。
3. 将需求整理为简报内容（需求概述、验收标准、影响范围、任务拆解建议），调用 impm_doc_writer（docType=urs，target=version）写入版本文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md（内容采用敏捷简报格式）。
4. 调用 impm_progress（action=add，stepName=impm-sprint-requirement，status=已完成）记录本环节完成。

### 步骤 3：版本与任务（PM 直接执行）
1. 调用 impm_version（action=current）获取 docs 下当前最大版本号；调用 impm_version（action=next）在最大版本号 z 值上 +1 得到当前版本号。
2. 调用 impm_git（action=branch，branchName={项目英文缩写}-v{当前版本号}）创建并切换到版本分支。
3. 调用 impm_version（action=init，hintVersion={当前版本号}）创建版本目录 docs/{项目英文缩写}-v{当前版本号}。
4. 调用 impm_progress（action=init）创建 version_progress.md。
5. 调用 impm_template_reader(projectRoot, TASK-TEMPLATE.json) 读取任务清单模板。
6. 基于需求简报直接拆解任务：任务描述字段内嵌需求细节与验收标准（不依赖 SAD/DBD/API/LLD 设计文档），taskType 按任务性质填写（common/frontend/backend），上下游按任务依赖关系填写。
7. 调用 impm_task_manager（action=init，taskListJson={任务清单}）校验并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json。
8. 调用 impm_progress（action=add，stepName=impm-sprint-version-task，status=已完成）记录本环节完成。

### 步骤 4：编码（每任务启动 sse/fee/bee）
1. 调用 impm_task_manager（action=query）读取任务清单中所有状态不为"已完成"的任务，确认数量与上下游关系。
2. 循环执行：调用 impm_task_manager（action=next）获取下一个可执行任务（未完成且上游全部完成）；若无任务返回，跳到步骤 5。
3. 按任务 taskType 用 task 工具启动对应 subagent（common→sse、frontend→fee、backend→bee）执行 impm-sprint-code 技能，提示词按「通用调度要求」携带上下文（含任务编号与需求简报要点）。
4. 编码完成后核对产出，调用 impm_task_manager（action=update，taskId={任务编号}，status=已完成）更新任务状态；回到步骤 4.2 继续下一个任务。
5. 全部任务完成后，调用 impm_progress（action=add，stepName=impm-sprint-code，status=已完成）记录本环节完成。

### 步骤 5：测试（启动 te）
1. 用 task 工具启动 te subagent 执行 impm-sprint-test 技能，提示词按「通用调度要求」携带上下文（含本次冲刺任务清单范围）。
2. 测试全部通过后，调用 impm_progress（action=add，stepName=impm-sprint-test，status=已完成）记录本环节完成。

### 步骤 6：汇总留存（PM 直接执行）
1. 调用 impm_template_reader(projectRoot, SPRINT-SUMMARY-TEMPLATE.MD) 读取敏捷汇总模板。
2. 汇总本次冲刺的变更摘要、任务完成情况（从 task JSON 读取）、测试结果（从 regression 文档读取）。
3. 调用 impm_doc_writer（docType=review，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-review.md（内容采用敏捷汇总格式）。
4. 维护 docs 根目录主文档 docs/{项目英文缩写}-sprint.md（全部敏捷需求汇总）：
   - 调用 impm_template_reader(projectRoot, SPRINT-MASTER-TEMPLATE.MD) 读取主文档模板；
   - 若 docs/{项目英文缩写}-sprint.md 不存在：用内置 read/write 工具按模板创建，其中填写本次冲刺需求概述、验收标准、任务完成情况、测试结果、验证记录；
   - 若已存在：用内置 read/write 工具在文件末尾追加本次冲刺一节（沿用模板的「冲刺 {版本号}」节结构），保留历史记录；
   - 注意：主文档不在 impm_doc_writer 标准 docType 路径体系内，使用内置文件工具直接维护（与热修复主文档 docs/{项目英文缩写}-hotfix.md 同策略）。
5. 调用 impm_progress（action=add，stepName=impm-sprint-summary，status=已完成）记录本环节完成。

### 步骤 7：提交合并（启动 scm，复用 impm-git-merge）
1. 用 task 工具启动 scm subagent 执行 impm-git-merge 技能（提示词按「通用调度要求」携带上下文），将版本分支以 git merge --squash 方式合并到主分支并提交。
2. 完成后核对主分支合并提交存在，调用 impm_progress（action=add，stepName=impm-sprint，status=已完成）记录本技能完成；随后调用 impm_progress（action=finalize）在退出前结算进度表最后一行（impm-sprint，已完成）的总耗时与 token。

### 步骤 8：向用户汇报
向用户汇报本次冲刺完成情况：当前版本号、任务总数与完成数、产出文件清单、git 合并提交记录、文档留存位置（需求简报/汇总/测试结果/docs 根目录敏捷需求汇总主文档 docs/{项目英文缩写}-sprint.md），并提示遗留事项（如需补充正式设计文档，可手动执行 /impm-docs 的相应步骤）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md（敏捷需求简报，复用 urs 路径）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json（任务清单，描述内嵌需求与验收标准）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-review.md（敏捷汇总，复用 review 路径）
- docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md（测试结果，由 impm-sprint-test 产出）
- docs/{项目英文缩写}-sprint.md（docs 根目录敏捷需求汇总主文档，每次冲刺追加一节）
- 实现代码、测试函数与测试脚本
- version_progress.md 进度记录、git 分支与 squash 合并提交记录

## 完成后提示
- 本次敏捷冲刺已完成。如需补充正式设计文档（URS/PRD/SAD/DBD/API/LLD），请手动执行 /impm-docs 对应步骤。
- 如需查看版本进度，请查看版本目录下的 version_progress.md。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
