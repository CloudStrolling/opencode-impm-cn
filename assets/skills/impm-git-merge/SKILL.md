---
name: impm-git-merge
description: 将当前版本分支以 git merge --squash 方式合并到主分支并提交，完成本版本的版本管理收尾
---

# impm-git-merge 技能

## 触发词
合并主分支、git merge、版本提交、分支合并、git-merge

## 何时使用
阶段4最后一个步骤，全部回归测试与文档整理完成后，需要将当前版本分支合并到主分支并提交时使用。

## 执行角色
本技能由 软件配置工程师（subagent_type=scm）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `scm`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-git-merge，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：获取当前分支名称
1. 调用 impm_git（action=current-branch）获取当前分支名称。
2. 记录当前分支名称，用于后续合并操作。

### 步骤 2：切换到主分支并拉取最新代码
1. 通过 impm_git（action=branch）确认仓库主分支名（master 或 main）。
2. 调用 impm_git（action=checkout，branchName=主分支名）切换到主分支。
3. 拉取主分支最新代码，确保主分支为最新状态。

### 步骤 3：将当前版本分支合并到主分支
1. 调用 impm_git（action=merge，branchName=当前分支名称）执行 git merge --squash 当前分支。
2. 如有冲突，逐一解决冲突后暂存；如无冲突，直接暂存合并结果。

### 步骤 4：提交合并结果
1. 调用 impm_git（action=commit）提交合并结果，message 为：{项目英文缩写}-v{当前版本号}-回归测试和版本文档整理完成。
2. 核对提交成功。

### 步骤 5：记录进度
1. 调用 impm_progress add（impm-git-merge，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

### 步骤 6：汇报完成
1. 向用户报告：当前版本分支已合并到主分支并提交，本版本开发全流程（需求分析整理、编码开发、回归测试、版本文档整理）全部完成。

## 交付物
- 主分支上的合并提交（message：{项目英文缩写}-v{当前版本号}-回归测试和版本文档整理完成）
- version_progress.md 进度记录

## 完成后提示
- 本技能为阶段4最后一个步骤，执行完成后本版本开发全部完成，无需继续执行其他步骤。
- 如需重新执行本阶段全部步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
