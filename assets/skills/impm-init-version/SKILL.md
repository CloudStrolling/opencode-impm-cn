---
name: impm-init-version
description: 创建版本目录 docs/{项目英文缩写}-v0.0.1 与版本进度表 version_progress.md，并补录已完成的初始化步骤记录。当初始化阶段需要建立版本管理时使用。
---

# impm-init-version 技能

## 触发词
- 版本目录
- 版本初始化
- version_progress
- 版本进度表

## 何时使用
- 初始化阶段的版本步骤（/impm-init-version）执行时。
- 需要创建版本目录 docs/{项目英文缩写}-v{版本} 或版本进度表 version_progress.md 时。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-version，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：获取项目英文缩写
调用 impm_project_info(projectRoot) 从 docs/project.md 读取项目中文名称、英文名称、英文缩写等信息；若 project.md 尚未生成，先执行 /impm-init-project 生成后再继续。

### 步骤 2：创建版本目录
调用 impm_version(projectRoot, init, v0.0.1, {项目中文名称}) 创建版本目录 docs/{项目英文缩写}-v0.0.1，工具返回当前版本号；核对版本目录已创建、当前版本号为 0.0.1。

### 步骤 3：创建版本进度表并补录记录
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, init, null, null) 创建 version_progress.md（表头：步骤序号|步骤名称|步骤状态）；随后依次调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, 步骤名, 已完成) 补录初始化阶段已完成的步骤：impm-init-isinit、impm-init-git、impm-init-project、impm-init-version 均标记为已完成，后续步骤继续使用 add 追加新行（序号自动为当前最大序号+1）。

### 步骤 4：核对并记录
核对版本目录 docs/{项目英文缩写}-v0.0.1/ 与 version_progress.md 均存在，进度表中已包含上述 4 条已完成记录；调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-version, 已完成) 记录本步骤完成。

## 交付物
- 版本目录 docs/{项目英文缩写}-v0.0.1/
- version_progress.md（含已完成步骤记录）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-urs
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
