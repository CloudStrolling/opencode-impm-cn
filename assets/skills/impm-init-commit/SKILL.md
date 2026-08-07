---
name: impm-init-commit
description: 确认 git 工作区状态，提交初始化阶段全部内容，记录进度并向用户报告初始化阶段全部完成。当初始化阶段最后一个步骤执行时使用。
---

# impm-init-commit 技能

## 触发词
- 初始化提交
- 最终提交
- 提交初始化内容

## 何时使用
- 初始化阶段的提交步骤（/impm-init-commit）执行时。
- 初始化阶段全部文档与文件生成后，需要统一提交并汇报完成时。

## 执行角色
本技能由 软件配置工程师（subagent_type=scm）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `scm`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-commit，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：确认工作区状态
调用 impm_git(projectRoot, status) 确认工作区状态，检查是否有未提交的初始化内容；若工作区无任何改动，向用户说明后结束本技能。

### 步骤 2：提交初始化内容
调用 impm_git(projectRoot, commit, null, {项目英文缩写}-v0.0.1-初始化impm项目) 提交所有初始化内容，并通过 impm_git(projectRoot, status) 或 log 核对提交成功。

### 步骤 3：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-commit, 已完成) 记录本步骤完成。

### 步骤 4：汇报完成
向用户报告初始化阶段全部完成，汇报内容包括：提交信息、初始化阶段产出的文档清单（project/urs/prd/sad/dbd/api/lld/testcase 及版本目录）、版本进度表位置，并建议下一步进入后续阶段。

## 交付物
- git 提交记录（message：{项目英文缩写}-v0.0.1-初始化impm项目）

## 完成后提示
- 初始化阶段已全部完成，没有后续步骤。
- 如需重新执行初始化阶段，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
