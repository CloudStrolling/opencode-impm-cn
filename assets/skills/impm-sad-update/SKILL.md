---
name: impm-sad-update
description: 评估当前版本需求下的系统架构设计是否需要修改，为空时创建初稿，需要时更新 docs/{项目英文缩写}-sad.md。
---

# impm-sad-update 技能

## 触发词
系统架构、架构设计、SAD、架构更新、impm-sad-update

## 何时使用
在产品需求文档生成完成（impm-prd-create 之后）时使用，查看主架构文档 docs/{项目英文缩写}-sad.md 是否为空：为空则创建系统架构设计初稿；不为空则根据当前版本需求（URS 和 PRD）判断是否需要修改，需要时直接更新 docs/{项目英文缩写}-sad.md，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-sad-update，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
调用 impm_template_reader 读取模板 SAD-TEMPLATE.MD，明确系统架构设计文档的章节结构与填写格式。

### 步骤 2：查看主架构文档是否为空
调用 impm_doc_reader（docType=sad，target=main）查看 docs/{项目英文缩写}-sad.md 的内容，判断其是否为空文件。

### 步骤 3：创建架构设计初稿（仅当主文档为空）
如果 docs/{项目英文缩写}-sad.md 为空文件：根据本次对话内容以及本次对话涉及到的参考文件，套用 SAD 模板格式，完成系统架构设计的初稿，然后调用 impm_doc_writer（docType=sad，target=main）覆盖写入 docs/{项目英文缩写}-sad.md。完成后直接跳转到步骤 6。

### 步骤 4：判断是否需要修改（仅当主文档非空）
如果 docs/{项目英文缩写}-sad.md 不是空文件：调用 impm_doc_reader 读取当前版本的 URS 和 PRD 文档，判断在当前版本需求下，系统架构设计是否需要修改。

### 步骤 5：记录"无需修改"并结束
如果判断无需修改：调用 impm_progress（action=add，stepName=impm-sad-update，status=无需修改）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行，然后结束本技能，不再执行后续步骤。

### 步骤 6：修改架构文档并记录进度（仅当需要修改）
如果需要修改：直接修改 docs/{项目英文缩写}-sad.md（按需套用 SAD 模板章节），完成修改后调用 impm_progress（action=add，stepName=impm-sad-update，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-sad.md（系统架构设计文档，创建初稿或按需更新）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-dbd-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
