---
name: impm-task-create
description: 根据 SAD、当前版本 PRD 与 LLD，按任务模板生成当前版本的任务清单 JSON 并校验写入。
---

# impm-task-create 技能

## 触发词
任务清单、任务分解、task.json、任务拆分、impm-task-create

## 何时使用
在详细设计完成（impm-lld-create 之后）时使用，根据 SAD、当前版本的 PRD 和当前版本的 LLD，使用任务模板中的 JSON 格式完成当前版本的任务清单，写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 TL subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 1：读取模板
调用 impm_template_reader 读取模板 TASK-TEMPLATE.json，明确任务清单的 JSON 结构与字段定义。

### 步骤 2：收集任务依据
调用 impm_doc_reader 读取：
1. 系统架构设计文档 docs/{项目英文缩写}-sad.md；
2. 当前版本 PRD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md；
3. 当前版本 LLD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md。

### 步骤 3：生成任务清单
根据 SAD、当前版本的 PRD 和当前版本的 LLD，使用模板中的 JSON 格式完成当前版本的任务清单。任务清单包含字段：projectName、version、tasks 数组。每个任务包含：id、title、description、taskType（backend|frontend|common）、userStoryId、upstreamTaskIds、downstreamTaskIds、priority、status（未完成|执行中|已完成）、testMethod、acceptanceCriteria。任务必须按上下游依赖关系排序：被依赖的任务在前，依赖他人的任务在后，确保编码阶段可依序串行执行。

### 步骤 4：校验并写入任务清单
调用 impm_task_manager（action=init，taskListJson=步骤 3 生成的清单）校验并写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json。

### 步骤 5：记录进度
调用 impm_progress（action=add，stepName=impm-task-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、JSON 格式正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json（任务清单）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-analysis-commit
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
