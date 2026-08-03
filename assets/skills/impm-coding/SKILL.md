---
name: impm-coding
description: 编码开发阶段（阶段3）主流程技能，按任务上下游顺序循环调度 impm-task-coding 与 impm-task-coding-gitcommit，完成当前版本全部编码任务。
---

# impm-coding 技能

## 触发词
- 开始编码
- 进入编码阶段
- 编码开发
- 阶段3

## 何时使用
impm 瀑布式开发流程完成设计阶段（阶段2）、任务清单 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 就绪之后，进入编码开发阶段（阶段3），需要按上下游顺序逐任务实现全部功能时使用。

## 执行角色
本技能由 pm subagent 负责执行。执行时使用 Skill 工具加载本技能。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由调度方（PM/上级技能）传入 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写}、{当前版本号}、{任务编号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。
7. 本技能为编码流程的一部分，只能被 impm-task-coding 或 impm-coding 调度执行，不能单独脱离版本号和任务编号执行。

## 执行步骤
### 步骤 1：记录编码阶段开始
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-coding，status=执行中），在 version_progress.md 中记录编码开发阶段开始。

### 步骤 2：读取任务清单
调用 impm_task_manager（action=query，projectName={项目英文名称}，version={当前版本号}），读取 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 中所有状态不为"已完成"的任务清单，确认剩余任务数量及其上下游依赖关系。

### 步骤 3：循环调度执行任务
所有任务严格按照上下游顺序执行，循环执行以下步骤：
1. 调用 impm_task_manager（action=next，projectName={项目英文名称}，version={当前版本号}）获取下一个可执行任务（未完成且上游任务全部已完成），一次只返回一个；如果无任务返回，跳到步骤 5；
2. 启动 impm-task-coding 技能：由 PM 调度各 subagent 完成该任务的全部编码步骤（context → cs → ws → dbd → api → testcase → code → writetest → runtest）；
3. 该任务编码与测试全部完成后，启动 SCM subagent 执行 impm-task-coding-gitcommit 技能，把当前任务的全部修改提交到 git，并将任务状态更新为"已完成"；
4. 严格遵守：不并行执行、不乱序执行、不合并执行。

### 步骤 4：判断任务是否全部完成
前一个任务完成所有编码步骤并提交后，回到步骤 3 获取下一个任务；重复循环，直到 impm_task_manager（action=next）不再返回任务，即所有任务均已完成。

### 步骤 5：记录编码阶段完成
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-coding，status=已完成），在 version_progress.md 中记录编码开发阶段完成。

### 步骤 6：汇报编码阶段完成情况
向用户汇报编码阶段完成情况：当前版本号、任务总数与完成数、每个任务的执行结果摘要、git 提交记录（{项目英文缩写}-v{当前版本号}-{任务编号}），并建议下一步进入测试阶段。

## 交付物
- version_progress.md 中新增 impm-coding 执行中/已完成两条进度记录
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 中全部任务状态为"已完成"
- 各任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的全部编码产物
- git 提交记录（{项目英文缩写}-v{当前版本号}-{任务编号}）

## 完成后提示
- 本步骤完成后，由调度方（impm 主流程）按流程继续执行下一步骤（测试阶段）。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
