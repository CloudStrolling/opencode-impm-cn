---
name: impm-lld-create
description: 根据 SAD 与当前版本 PRD，按 LLD 模板完成当前版本新增需求的整体业务逻辑详细设计文档（模块划分、业务流程、核心业务逻辑等，不涉及接口细节设计）。
---

# impm-lld-create 技能

## 触发词
详细设计、LLD、模块设计、业务逻辑设计、类图、时序图、impm-lld-create

## 何时使用
在 API 接口设计完成（impm-api-create 之后）时使用，根据 SAD（docs/{项目英文缩写}-sad.md）和当前版本的 PRD，参考现有详细设计 docs/{项目英文缩写}-lld.md（可能为空），按 LLD 模板完成当前版本新增需求的整体业务逻辑详细设计，写入版本目录，并在版本进度文件中记录本步骤。注意：LLD 聚焦整体业务逻辑设计（模块划分、业务流程、核心业务逻辑、业务规则等），接口定义、请求/响应参数等接口细节由 API 设计文档负责，LLD 中不重复编写。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-lld-create，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
调用 impm_template_reader 读取模板 LLD-TEMPLATE.MD，明确详细设计文档的章节结构与填写格式（业务逻辑设计导向，不含接口细节）。

### 步骤 2：收集设计依据
调用 impm_doc_reader 读取：
1. 系统架构设计文档 docs/{项目英文缩写}-sad.md；
2. 当前版本 PRD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md；
3. 现有详细设计文档 docs/{项目英文缩写}-lld.md（可能为空，作为参考）。

### 步骤 3：完成当前版本详细设计
根据 SAD 和当前版本的 PRD，参考现有详细设计 docs/{项目英文缩写}-lld.md（可能为空），套用 LLD 模板格式，从业务逻辑视角完成当前版本新增需求的详细设计（模块划分与职责、类图、核心业务流程时序图、状态图、核心业务逻辑、业务规则与约束、业务数据流等；接口定义与请求/响应参数不写入 LLD）。调用 impm_doc_writer（docType=lld，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md。

### 步骤 4：记录进度
调用 impm_progress（action=add，stepName=impm-lld-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md（详细设计文档）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-task-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
