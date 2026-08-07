---
name: impm-project-update
description: 扫描项目源代码目录生成项目地图，并更新 docs/project.md 的项目地图部分
---

# impm-project-update 技能

## 触发词
项目地图、更新project、project.md、扫描代码、project-update

## 何时使用
阶段4中，代码审核完成后，需要根据当前代码结构更新项目地图时使用。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-project-update，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：扫描源代码目录生成项目地图
1. 读取 docs/project.md，确定项目源代码目录（如 src、backend、frontend、scripts 等）与需要排除的目录（如 node_modules、dist、build、.git 等）。
2. 调用 impm_project_analyzer（sourceDirs、excludeDirs）扫描源代码目录，生成项目地图 Markdown 内容。
3. 核对项目地图内容：目录结构、主要模块、关键文件是否与实际代码一致，如有明显缺失或多余项应调整扫描参数后重新扫描。

### 步骤 2：更新 docs/project.md 的项目地图部分
1. 读取 docs/project.md 现有内容。
2. 仅更新项目地图部分：用新生成的项目地图替换旧的项目地图，其他部分保持不变。
3. 调用 impm_doc_writer（docType=project，target=main）写入 docs/project.md。
4. 核对文件存在且内容正确，项目地图与实际代码结构一致。

### 步骤 3：记录进度
1. 调用 impm_progress add（impm-project-update，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/project.md（项目地图部分已更新）
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-doc-merge
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
