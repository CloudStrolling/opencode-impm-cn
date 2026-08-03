---
name: impm-urs-create
description: 根据用户输入及输入中提到的文件，按 URS 模板生成当前版本的用户需求说明书，写入版本目录。
---

# impm-urs-create 技能

## 触发词
用户需求说明书、URS、生成需求、需求收集、impm-urs-create

## 何时使用
在版本创建完成（impm-version-create 之后）时使用，根据用户的需求输入，按照模板格式生成用户需求说明书（URS），写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 BA subagent 负责执行。执行时使用 Skill 工具加载本技能。

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
调用 impm_template_reader 读取模板 URS-TEMPLATE.MD，明确用户需求说明书的章节结构与填写格式。

### 步骤 2：生成用户需求说明书
根据用户的输入，以及用户输入中提到的文件，按照模板格式生成用户需求说明书。模板章节包括：业务目标、用户角色、业务场景、功能需求（高层）、非功能需求（高层）、约束条件、假设与依赖。内容须准确反映用户诉求，语言清晰、可验收。

### 步骤 3：写入版本文档
调用 impm_doc_writer（docType=urs，target=version）将生成的用户需求说明书写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md。

### 步骤 4：记录进度
调用 impm_progress（action=add，stepName=impm-urs-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行（序号自动为当前最大序号 +1）。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md（用户需求说明书）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-prd-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
