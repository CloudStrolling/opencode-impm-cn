---
name: impm-init-task
description: 读取 TASK-TEMPLATE.json 模板，根据 URS、PRD、SAD、LLD 及 API 文档反推任务清单，通过 impm_task_manager 校验写入 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-task-v0.0.1.json。当初始化阶段需要生成任务清单时使用。
---

# impm-init-task 技能

## 触发词
- 任务清单
- 任务分解
- task.json
- 任务拆分

## 何时使用
- 初始化阶段的任务清单步骤（/impm-init-task）执行时。
- 需要创建或补全任务清单（task.json）时。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-task，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对产出文件与 version_progress.md 进度记录，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号（初始化阶段固定为 0.0.1） | 通过 impm_version 获取或从版本目录名推断 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤
### 步骤 1：读取模板
调用 impm_template_reader(projectRoot, TASK-TEMPLATE.json) 读取任务清单模板，明确 JSON 结构与字段定义。任务包含字段：id、title、description、taskType、userStoryId（对应 PRD 用户故事编号）、apiId（对应 API 接口编号，任务不涉及接口时留空）、upstreamTaskIds、downstreamTaskIds、priority、status、testMethod、acceptanceCriteria。

### 步骤 2：收集任务依据
通过 impm_doc_reader 读取已有文档：
1. docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-prd-v0.0.1.md（或主文档 docs/{项目英文缩写}-prd.md），提取用户故事编号（US-xxx）及其故事描述；
2. docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-lld-v0.0.1.md（或主文档 docs/{项目英文缩写}-lld.md）；
3. 系统架构设计文档 docs/sad.md；
4. API 设计文档 docs/{项目英文缩写}-api.md（存在时读取，提取接口编号 API-xxx 与功能描述；不存在时跳过）。
结合项目代码与文档，确定任务清单；若文档内容不完整，按已有内容合理拆分任务。

### 步骤 3：生成任务清单
根据步骤 2 收集的依据，按 TASK-TEMPLATE.json 格式生成任务清单，包含字段：projectName、version、tasks 数组。每个任务包含：id、title、description、taskType（backend|frontend|common）、userStoryId、apiId、upstreamTaskIds、downstreamTaskIds、priority、status（未完成|执行中|已完成）、testMethod、acceptanceCriteria。
字段映射规则：
- userStoryId：填写该任务实现的 PRD 用户故事编号（如 US-001），从步骤 2 读取的 PRD 中获取；
- apiId：填写该任务涉及/实现的 API 接口编号（如 API-001），从步骤 2 读取的 API 文档中获取；一个任务涉及多个接口时用逗号分隔（如 API-001,API-002）；任务不涉及接口或项目无 API 文档时留空字符串。
任务必须按上下游依赖关系排序：被依赖的任务在前，依赖他人的任务在后，确保编码阶段可依序串行执行。
- 存量项目：根据现有功能与代码反推任务清单。
- 空项目：按模板结构写入，tasks 数组留空（[]）。

### 步骤 4：校验并写入任务清单
调用 impm_task_manager(projectRoot, {项目中文名称}, {当前版本号}, init, null, null, 步骤 3 生成的任务清单 JSON) 校验并写入 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-task-v0.0.1.json。核对文件存在且 JSON 格式正确。

### 步骤 5：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-task, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-task-v0.0.1.json（任务清单）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-testcase
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
