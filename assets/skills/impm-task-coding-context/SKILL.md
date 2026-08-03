---
name: impm-task-coding-context
description: 收集当前任务的需求上下文并合并写入任务目录 context.md，为编码开发阶段提供需求依据。
---

# impm-task-coding-context 技能

## 触发词
- 收集上下文
- 需求上下文
- context

## 何时使用
impm-task-coding 启动 TL subagent 收集当前任务需求上下文，需要将任务内容、PRD 用户故事、SAD/project 相关内容合并为精简上下文时使用。

## 执行角色
本技能由 tl subagent 负责执行。执行时使用 Skill 工具加载本技能。

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
### 步骤 1：接收版本号与任务编号
接收调度方传入的当前版本号与任务编号（{任务编号}，如 TASK-001）。

### 步骤 2：读取任务内容
调用 impm_task_manager（action=query，taskId={任务编号}），读取 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 中对应任务的内容（任务名称、描述、userStoryId、taskType、上下游依赖等）。

### 步骤 3：读取 PRD 用户故事
根据任务内容中的 userStoryId，调用 impm_doc_reader（docType=prd，target=version）获取当前版本 PRD 中该 userstory 的相关内容。

### 步骤 4：读取关联设计文档
从 docs/{项目英文缩写}-sad.md、docs/project.md 等文件中读取与当前任务有关联的内容（如架构设计、技术选型、项目地图、相关约定）。

### 步骤 5：合并上下文
调用 impm_context_builder（projectName={项目英文名称}，version={当前版本号}，taskId={任务编号}）收集并合并所有相关需求信息，整理为精简上下文。

### 步骤 6：写入 context.md
调用 impm_doc_writer（docType=context，taskId={任务编号}），将合并后的上下文写入 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/context.md；任务目录不存在时自动创建。

### 步骤 7：记录完成
核对 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/context.md 已生成且内容完整，调用 impm_progress（action=add，stepName=impm-task-coding-context，status={任务编号}-已完成）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/context.md
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
