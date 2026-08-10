---
name: impm-version-create
description: 确定当前版本号，创建版本分支、版本目录与版本进度文件 version_progress.md，为需求分析整理阶段提供版本基础。
---

# impm-version-create 技能

## 触发词
版本创建、创建版本、确定版本号、版本目录、impm-version-create、新版本

## 何时使用
在需求分析整理阶段（阶段2）开始时使用，是阶段的第一步。用于确定当前版本号，创建 git 分支 {项目英文缩写}-v{当前版本号}、版本目录 docs/{项目英文缩写}-v{当前版本号} 及版本进度文件 version_progress.md，为后续所有步骤提供版本基础。

## 执行角色
本技能由 软件配置工程师（subagent_type=scm）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `scm`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-version-create，要求 subagent 先用 Skill 工具加载本技能再执行）。
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

### 步骤 1：确定当前版本号
a) 检查用户本次对话提交的内容，以及内容中提到的文档里是否包含版本号：若包含，直接使用该版本号作为当前版本号；
b) 若均未提及版本号，调用 impm_version（action=current）获取 docs 目录下所有版本目录（目录格式为 {项目英文缩写}-v{x.y.z}，x.y.z 为版本号）中的最大版本号，再调用 impm_version（action=next）在最大版本号的 z 值基础上 +1，将 x.y.(z+1) 作为当前版本号。

### 步骤 2：拉取最新代码并创建版本分支
调用 impm_git（action=log 或 action=status）确认仓库状态：若配置了远程仓库，先执行 pull 拉取最新代码。然后创建并切换到新分支 {项目英文缩写}-v{当前版本号}，确认当前分支已切换成功。

### 步骤 3：创建版本目录
调用 impm_version（action=init）创建项目版本目录 docs/{项目英文缩写}-v{当前版本号}，记录返回的版本号并核对目录已创建。

### 步骤 4：初始化版本进度文件
调用 impm_progress（action=init）创建版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md，文件内容为表格，10 列：步骤序号、步骤名称、步骤状态、启动时间、总耗时(秒)、输入token、输出token、命中缓存、存入缓存、总token。写入首行：步骤序号 1，步骤名称 impm-version-create，步骤状态 已完成（启动时间自动记录为当前时间）。
核对文件存在且首行内容正确。

### 步骤 5：返回当前版本号
向调用方（PM）返回当前版本号，供后续所有步骤使用。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/（版本目录）
- docs/{项目英文缩写}-v{当前版本号}/version_progress.md（版本进度文件，含首行：1 | impm-version-create | 已完成）
- git 分支 {项目英文缩写}-v{当前版本号}（已创建并切换）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-urs-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
