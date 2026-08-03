---
name: impm-lld-create
description: 根据 SAD 与当前版本 PRD，按 LLD 模板完成当前版本新增需求的详细设计文档。
---

# impm-lld-create 技能

## 触发词
详细设计、LLD、模块设计、类图、时序图、impm-lld-create

## 何时使用
在 API 接口设计完成（impm-api-create 之后）时使用，根据 SAD（docs/{项目英文缩写}-sad.md）和当前版本的 PRD，参考现有详细设计 docs/{项目英文缩写}-lld.md（可能为空），按 LLD 模板完成当前版本新增需求的详细设计，写入版本目录，并在版本进度文件中记录本步骤。

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
调用 impm_template_reader 读取模板 LLD-TEMPLATE.MD，明确详细设计文档的章节结构与填写格式。

### 步骤 2：收集设计依据
调用 impm_doc_reader 读取：
1. 系统架构设计文档 docs/{项目英文缩写}-sad.md；
2. 当前版本 PRD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md；
3. 现有详细设计文档 docs/{项目英文缩写}-lld.md（可能为空，作为参考）。

### 步骤 3：完成当前版本详细设计
根据 SAD 和当前版本的 PRD，参考现有详细设计 docs/{项目英文缩写}-lld.md（可能为空），套用 LLD 模板格式，完成当前版本新增需求的详细设计。调用 impm_doc_writer（docType=lld，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md。

### 步骤 4：记录进度
调用 impm_progress（action=add，stepName=impm-lld-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md（详细设计文档）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-task-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
