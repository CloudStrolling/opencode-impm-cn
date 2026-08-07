---
name: impm-doc-merge
description: 将当前版本的 URS、PRD、API、DBD、DBD SQL、LLD 文档按合并原则合并到项目主文档
---

# impm-doc-merge 技能

## 触发词
文档合并、合并主文档、doc-merge、版本文档合并

## 何时使用
阶段4中，项目地图更新完成后，需要将当前版本的各设计文档合并到 docs 下对应的主文档时使用。

## 执行角色
本技能由 文档编写（subagent_type=dw）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dw`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-doc-merge，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
合并原则：将当前版本文档的内容合并进主文档；主文档不存在就先创建；保留主文档中已有的历史内容，将当前版本新增、变更的内容追加或更新到对应章节，不得整体覆盖主文档的历史内容。

### 步骤 1：合并 URS 文档
1. 若 docs/{项目英文缩写}-urs.md 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md 合并到 docs/{项目英文缩写}-urs.md（impm_doc_writer docType=urs，target=main）。
3. 核对合并结果：主文档保留历史内容且包含当前版本内容。

### 步骤 2：合并 PRD 文档
1. 若 docs/{项目英文缩写}-prd.md 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md 合并到 docs/{项目英文缩写}-prd.md（impm_doc_writer docType=prd，target=main）。
3. 核对合并结果：主文档保留历史内容且包含当前版本内容。

### 步骤 3：合并 API 文档
1. 若 docs/{项目英文缩写}-api.md 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md 合并到 docs/{项目英文缩写}-api.md（impm_doc_writer docType=api，target=main）。
3. 核对合并结果：主文档保留历史内容且包含当前版本内容。

### 步骤 4：合并 DBD 文档
1. 若 docs/{项目英文缩写}-dbd.md 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.md 合并到 docs/{项目英文缩写}-dbd.md（impm_doc_writer docType=dbd，target=main）。
3. 核对合并结果：主文档保留历史内容且包含当前版本内容。

### 步骤 5：合并 DBD SQL 脚本
1. 若 docs/{项目英文缩写}-dbd.sql 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-dbd-v{当前版本号}.sql 合并到 docs/{项目英文缩写}-dbd.sql（impm_doc_writer docType=sql，target=main）。
3. 核对合并结果：SQL 语句完整、无重复冲突、可执行。

### 步骤 6：合并 LLD 文档
1. 若 docs/{项目英文缩写}-lld.md 不存在，先创建。
2. 将 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-lld-v{当前版本号}.md 合并到 docs/{项目英文缩写}-lld.md（impm_doc_writer docType=lld，target=main）。
3. 核对合并结果：主文档保留历史内容且包含当前版本内容。

### 步骤 7：记录进度
1. 调用 impm_progress add（impm-doc-merge，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/{项目英文缩写}-urs.md、docs/{项目英文缩写}-prd.md、docs/{项目英文缩写}-api.md、docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql、docs/{项目英文缩写}-lld.md（合并后的主文档）
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-doc-update
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
