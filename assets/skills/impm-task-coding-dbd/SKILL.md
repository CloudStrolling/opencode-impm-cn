---
name: impm-task-coding-dbd
description: 判断当前任务是否需要变更数据库设计，如需变更则同步更新版本数据库设计文档与 SQL 脚本。
---

# impm-task-coding-dbd 技能

## 触发词
- 数据库设计
- dbd
- 修改数据库

## 何时使用
impm-task-coding 启动 DBA subagent 处理数据库设计，需要根据任务上下文判断数据库设计是否需要变更并同步文档与脚本时使用。

## 执行角色
本技能由 dba subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 2：检查项目是否需要数据库
调用 impm_doc_reader（docType=dbd，target=main）查看 docs/{项目英文缩写}-dbd.md 是否存在：
- 如果不存在，说明当前项目无需数据库，调用 impm_progress（action=add，stepName=impm-task-coding-dbd，status={任务编号}-无需数据库），然后结束此步骤。

### 步骤 3：读取任务上下文
调用 impm_doc_reader（docType=context、docType=cs、docType=ws，taskId={任务编号}），读取任务目录的 context.md、cs.md、ws.md。

### 步骤 4：读取数据库设计文档
调用 impm_doc_reader（docType=dbd，target=main）与（docType=dbd，target=version），读取主数据库设计文档与当前版本数据库设计文档。

### 步骤 5：判断是否需要变更
根据当前任务的 context.md、cs.md、ws.md，判断数据库设计是否需要变更：
- 如果不需要变更，调用 impm_progress（action=add，stepName=impm-task-coding-dbd，status={任务编号}-数据库设计无需修改），然后结束此步骤。

### 步骤 6：更新数据库设计文档与脚本
如果需要修改：
1. 先调用 impm_doc_writer（docType=dbd，target=version）修改版本数据库设计文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md；
2. 然后调用 impm_doc_writer（docType=sql，target=version）同步修改版本数据库脚本 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql；
3. 核对两份文件内容一致、脚本可执行。

### 步骤 7：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-dbd，status={任务编号}-数据库设计已更新）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md（如有变更）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql（如有变更）
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
