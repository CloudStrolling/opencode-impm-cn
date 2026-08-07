---
name: impm-analysis-commit
description: 将需求分析整理阶段生成的所有文件和目录提交到 git，并报告阶段完成。
---

# impm-analysis-commit 技能

## 触发词
提交、git提交、需求分析提交、分析阶段完成、impm-analysis-commit

## 何时使用
在任务清单生成完成（impm-task-create 之后）时使用，作为需求分析整理阶段（阶段2）的最后一步：将本阶段生成的所有文件和目录提交到 git，记录进度，并向用户报告需求分析阶段全部完成。

## 执行角色
本技能由 软件配置工程师（subagent_type=scm）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `scm`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-analysis-commit，要求 subagent 先用 Skill 工具加载本技能再执行）。
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

### 步骤 1：确认工作区状态
调用 impm_git（action=status）确认工作区状态，查看需求分析整理阶段生成的文件和目录是否都已就位，确认分支为 {项目英文缩写}-v{当前版本号}。

### 步骤 2：提交到 git
调用 impm_git（action=commit，message={项目英文缩写}-v{当前版本号}-需求分析整理）将需求分析整理阶段生成的所有文件和目录提交到 git。提交内容包括：版本目录 docs/{项目英文缩写}-v{当前版本号}/ 下生成的各文档、任务清单、进度文件，以及本阶段更新的主文档（如 docs/{项目英文缩写}-sad.md 的修改）。确认提交成功。

### 步骤 3：记录进度
调用 impm_progress（action=add，stepName=impm-analysis-commit，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行，确认进度行已记录。

### 步骤 4：向用户报告
向用户报告需求分析阶段全部完成，列出提交的版本号、commit 信息与阶段产出概要。

## 交付物
- git 提交记录：{项目英文缩写}-v{当前版本号}-需求分析整理
- 更新后的 docs/{项目英文缩写}-v{当前版本号}/version_progress.md（含全部阶段步骤状态）

## 完成后提示
- 如需继续执行下一步骤（进入编码开发阶段），请输入 /impm-coding
- 如需重新执行本阶段所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
