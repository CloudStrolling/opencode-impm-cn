---
name: impm-task-coding-gitcommit
description: 将当前任务的全部修改提交到 git，并把任务状态更新为已完成。
---

# impm-task-coding-gitcommit 技能

## 触发词
- 提交代码
- git提交
- commit

## 何时使用
单个任务的全部编码步骤与测试全部完成并确认通过后，需要把该任务的修改提交到 git 并更新任务状态时使用。

## 执行角色
本技能由 scm subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 2：提交当前任务的修改
调用 impm_git（action=commit，message={项目英文缩写}-v{当前版本号}-{任务编号}），将当前所有的修改提交到 git，核对提交成功且包含本任务全部改动。

### 步骤 3：更新任务状态
调用 impm_task_manager（action=update，taskId={任务编号}，status=已完成），将 {项目英文缩写}-task-v{当前版本号}.json 上当前任务的状态改为已完成。

### 步骤 4：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-gitcommit，status={任务编号}-已完成）。

### 步骤 5：返回调度方继续
提交完成后，回到 impm-coding 步骤，获取并执行下一个 task，直到所有 task 都完成。

## 交付物
- git 提交记录（{项目英文缩写}-v{当前版本号}-{任务编号}）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 中任务状态为"已完成"
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
