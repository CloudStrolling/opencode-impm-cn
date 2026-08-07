---
name: impm-dbd-create
description: 判断项目是否需要数据库，按 DBD 模板完成当前版本的数据库设计文档与 SQL 脚本。
---

# impm-dbd-create 技能

## 触发词
数据库设计、DBD、数据库脚本、SQL、impm-dbd-create

## 何时使用
在系统架构设计更新完成（impm-sad-update 之后）时使用，查看主数据库设计文档 docs/{项目英文缩写}-dbd.md 是否存在：不存在则说明当前项目无需数据库，跳过本步骤；存在则根据 SAD 和当前版本 PRD，按 DBD 模板完成当前版本的数据库设计文档与 SQL 脚本，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 数据库架构设计师（subagent_type=dba）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dba`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-dbd-create，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
调用 impm_template_reader 读取模板 DBD-TEMPLATE.MD，明确数据库设计文档的章节结构与填写格式。

### 步骤 2：判断项目是否需要数据库
调用 impm_doc_reader（docType=dbd，target=main）查看 docs/{项目英文缩写}-dbd.md 是否存在：
- 如果不存在：说明当前项目无需数据库。调用 impm_progress（action=add，stepName=impm-dbd-create，status=无需数据库）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行，然后跳过本步骤，结束本技能。

### 步骤 3：收集设计依据
调用 impm_doc_reader 读取：
1. 系统架构设计文档 docs/{项目英文缩写}-sad.md；
2. 当前版本 PRD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md；
3. 现有数据库设计文档 docs/{项目英文缩写}-dbd.md（可能为空，作为参考）。

### 步骤 4：完成当前版本数据库设计
根据 SAD 和当前版本的 PRD，参考现有数据库设计 docs/{项目英文缩写}-dbd.md（可能为空），套用 DBD 模板格式，完成当前版本的数据库设计。调用 impm_doc_writer（docType=dbd，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md。

### 步骤 5：完成数据库脚本
根据步骤 4 的数据库设计，完成对应的数据库脚本（建库、建表、索引、初始化数据等）。调用 impm_doc_writer（docType=sql，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql。

### 步骤 6：记录进度
调用 impm_progress（action=add，stepName=impm-dbd-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md（数据库设计文档）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql（数据库脚本）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-api-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
