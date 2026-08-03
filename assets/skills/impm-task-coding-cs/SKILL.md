---
name: impm-task-coding-cs
description: 查询现有源代码与可复用模块并写入任务目录 cs.md，为编码开发阶段提供代码依据。
---

# impm-task-coding-cs 技能

## 触发词
- 查询现有代码
- 代码查询
- cs

## 何时使用
编码开发阶段需要查询当前项目中与任务相关的现有源代码、工具类和可复用模块，为编码提供依据时使用。

## 执行角色
本技能由 cs subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 2：读取任务上下文
调用 impm_doc_reader（docType=context，taskId={任务编号}），定位并读取 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/context.md。

### 步骤 3：读取项目地图
读取 docs/project.md 中的项目地图，找到可能与当前开发任务相关的现有源代码文件和工具类。

### 步骤 4：查询本地代码
在本地代码中查询与当前需求相关的部分内容（相关函数、类、配置文件、复用组件等），记录代码位置与作用。

### 步骤 5：写入 cs.md
将收集到的所有相关信息合并后，调用 impm_doc_writer（docType=cs，taskId={任务编号}）写入 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/cs.md。

### 步骤 6：记录完成
核对 cs.md 已生成且内容完整，调用 impm_progress（action=add，stepName=impm-task-coding-cs，status={任务编号}-已完成）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/cs.md
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
