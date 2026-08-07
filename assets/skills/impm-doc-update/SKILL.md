---
name: impm-doc-update
description: 创建或更新项目根目录下的 readme.md 与 agent.md，涵盖项目介绍、快速开始、目录结构、命令说明及 agent 角色说明
---

# impm-doc-update 技能

## 触发词
readme、agent.md、项目文档、使用说明、doc-update

## 何时使用
阶段4中，版本文档合并到主文档后，需要创建或更新项目根目录 readme.md 与 agent.md 时使用。

## 执行角色
本技能由 文档编写（subagent_type=dw）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dw`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-doc-update，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：创建或更新 readme.md
1. 调用 impm_project_info 获取项目中文名称、英文名称、英文缩写、编程语言等信息。
2. 若根目录 readme.md 不存在，则创建；若已存在，则保留原有内容并更新变化部分。
3. 内容包含：项目介绍、快速开始、目录结构、命令说明。
4. 调用 impm_doc_writer（docType=readme）写入根目录 readme.md。
5. 核对文件存在且内容正确。

### 步骤 2：创建或更新 agent.md
1. 若根目录 agent.md 不存在，则创建；若已存在，则保留原有内容并更新变化部分。
2. 内容包含：本项目 agent 角色说明（PM、BA、SA、TL、DBA、TE、SCM、DW、CS、WS、SSE、FEE、BEE 等）与使用方式。
3. 调用 impm_doc_writer（docType=agent）写入根目录 agent.md。
4. 核对文件存在且内容正确。

### 步骤 3：记录进度
1. 调用 impm_progress add（impm-doc-update，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- readme.md（项目根目录）
- agent.md（项目根目录）
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-deploy-update
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
