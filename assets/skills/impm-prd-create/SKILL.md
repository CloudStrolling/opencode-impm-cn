---
name: impm-prd-create
description: 根据用户输入、URS 文档与已有资料，按 PRD 模板生成当前版本的产品需求文档，写入版本目录。
---

# impm-prd-create 技能

## 触发词
产品需求文档、PRD、产品需求、功能清单、impm-prd-create

## 何时使用
在用户需求说明书生成完成（impm-urs-create 之后）时使用，根据用户的输入、输入中提到的文件以及 URS 文档，按照模板格式生成产品需求文档（PRD），写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 业务分析师（subagent_type=ba）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `ba`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-prd-create，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对产出文件与 version_progress.md 进度记录，全部正确后才能进入下一步。

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
调用 impm_template_reader 读取模板 PRD-TEMPLATE.MD，明确产品需求文档的章节结构与填写格式。

### 步骤 2：收集需求依据
1. 调用 impm_doc_reader 读取主文档 docs/{项目英文缩写}-urs.md（上一版 URS 汇总文档）；
2. 调用 impm_doc_reader 读取当前版本 URS 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md（存在则读取）；
3. 结合用户的输入以及用户输入中提到的文件。

### 步骤 3：生成产品需求文档
根据步骤 2 收集的需求依据，按照模板格式生成产品需求文档。模板章节包括：产品背景、目标用户、功能清单、详细功能描述、业务流程图、页面原型、数据需求、验收标准、版本规划、附录（术语表、参考文档）。功能描述须具体、可验收、可追踪，与 URS 保持一致。

### 步骤 4：写入版本文档
调用 impm_doc_writer（docType=prd，target=version）将产品需求文档写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md。

### 步骤 5：记录进度
调用 impm_progress（action=add，stepName=impm-prd-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md（产品需求文档）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-sad-update
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
