---
name: impm
description: impm 总流程技能，自动执行瀑布式开发全部四个阶段（项目初始化、需求分析整理、编码开发、回归测试和版本文档整理）。当用户输入 /impm 或要求执行 impm 全流程开发时使用。
---

# impm 技能

## 触发词
/impm、全流程开发、开始impm、执行impm、impm软件工程全流程、从需求到上线

## 何时使用
用户要求执行 impm 软件工程全流程开发时使用。本技能自动编排四个阶段：
1. 项目初始化阶段（impm-init）
2. 需求分析整理阶段（impm-docs）
3. 编码开发阶段（impm-coding）
4. 回归测试和版本文档整理阶段（impm-finish）

## 执行角色
本技能由 PM（Project Manager，主控 Agent）负责执行，作为调度核心启动各 subagent 执行具体技能。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| --- | --- | --- |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |

## 执行要求
1. 严格按照四个阶段的顺序依次执行：不跳过、不乱序、不并行、不合并任何阶段和步骤。
2. 每个阶段执行前先检查前置条件，执行后检查版本进度文件 version_progress.md 确认步骤状态已记录。
3. 使用 impm_* 工具获取版本号、任务、项目信息等事实数据，不得臆造。
4. 需要用户输入时通过对话询问用户，不得自行虚构需求。
5. 全程使用简体中文。

## 执行步骤

### 阶段一：项目初始化（impm-init）
1. 使用 Skill 工具加载并执行 impm-init 技能。
2. 先执行 impm-init-isinit 判断项目是否已初始化：
   - 若 docs/project.md 与 docs/sad.md 都存在且非空，说明已初始化，跳过整个初始化阶段；
   - 若为空项目或存量项目，依次执行初始化全部步骤。
3. 初始化阶段完成后，检查 version_progress.md 确认初始化步骤已记录。

### 阶段二：需求分析整理（impm-docs）
1. 向用户询问本轮需求：请用户输入本次版本的需求描述（或提供需求文档路径）。
2. 使用 Skill 工具加载并执行 impm-docs 技能，依次执行：impm-version-create → impm-urs-create → impm-prd-create → impm-sad-update → impm-dbd-create → impm-api-create → impm-lld-create → impm-task-create → impm-analysis-commit。
3. 每步由对应 subagent 执行，每步完成后检查 version_progress.md 确认步骤状态已记录，再继续下一步。

### 阶段三：编码开发（impm-coding）
1. 使用 Skill 工具加载并执行 impm-coding 技能。
2. 读取任务清单中所有状态不为"已完成"的任务，严格按上下游顺序，对每个任务执行 impm-task-coding（含 10 个子步骤）与 impm-task-coding-gitcommit。
3. 全部任务完成后，检查 version_progress.md 确认 impm-coding 状态已记录。

### 阶段四：回归测试和版本文档整理（impm-finish）
1. 使用 Skill 工具加载并执行 impm-finish 技能，依次执行：impm-regression-test → impm-coding-comment → impm-coding-review → impm-project-update → impm-doc-merge → impm-doc-update → impm-deploy-update → impm-git-merge。
2. 全部步骤完成后，向用户汇报本次版本开发的完整产出。

## 交付物
- 版本目录 docs/{项目英文缩写}-v{当前版本号}/ 及其全部文档
- 版本进度文件 version_progress.md（记录全部步骤状态）
- 实现代码、测试函数与自动化测试脚本
- 回归测试报告、代码审核报告、readme.md、agent.md、deploy/ 编译部署文档

## 完成后提示
- 本次版本全流程开发已完成。
- 如需查看版本进度，请查看版本目录下的 version_progress.md。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
