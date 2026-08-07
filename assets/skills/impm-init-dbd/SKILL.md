---
name: impm-init-dbd
description: 判断项目是否需要数据库，需要时读取 DBD-TEMPLATE.MD 模板反推数据库设计文档与初始化 SQL，写入版本文档并复制到主文档 docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql。当初始化阶段需要设计数据库时使用。
---

# impm-init-dbd 技能

## 触发词
- DBD
- 数据库设计
- 表结构
- 初始化 SQL

## 何时使用
- 初始化阶段的数据库步骤（/impm-init-dbd）执行时。
- 需要创建或补全数据库设计文档（DBD）与初始化 SQL 时。

## 执行角色
本技能由 数据库架构设计师（subagent_type=dba）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dba`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-dbd，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：判断是否需要数据库
通过 impm_doc_reader 读取 docs/project.md 与 docs/sad.md，判断当前项目是否需要数据库，以及具体数据库产品（如 MySQL、PostgreSQL 等）与版本：
- 无需数据库：调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-dbd, 无需数据库) 记录进度并结束本技能。
- 需要数据库：继续执行步骤 2。

### 步骤 2：读取模板
调用 impm_template_reader(projectRoot, DBD-TEMPLATE.MD) 读取数据库设计文档模板，明确模板章节：ER 图、表结构、索引设计、数据字典等。

### 步骤 3：反推数据库设计
通过 impm_doc_reader 读取已有文档（重点是 PRD、SAD，以及 PRD 中的数据需求），结合当前项目代码与文档，按模板格式填写 DBD，同时反推项目初始化的 SQL 语句（建库、建表、初始数据等）：
- 存量项目：从现有代码、实体类、持久层代码反推表结构与索引设计。
- 空项目：写空 MD 和空 SQL（保留模板结构）。

### 步骤 4：写入版本文档并复制主文档
调用 impm_doc_writer(projectRoot, dbd, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-dbd-v0.0.1.md，并复制到主文档 docs/{项目英文缩写}-dbd.md（主文档不存在则创建）；调用 impm_doc_writer(projectRoot, sql, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-dbd-v0.0.1.sql，并复制到主文档 docs/{项目英文缩写}-dbd.sql（主文档不存在则创建）。核对四个文件均存在且内容一致。

### 步骤 5：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-dbd, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-dbd-v0.0.1.md
- docs/{项目英文缩写}-dbd.md
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-dbd-v0.0.1.sql
- docs/{项目英文缩写}-dbd.sql

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-api
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
