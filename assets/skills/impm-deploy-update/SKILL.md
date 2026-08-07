---
name: impm-deploy-update
description: 创建或更新 deploy 目录下的编译方案 build.md、部署方案 deploy.md，必要时生成编译部署脚本
---

# impm-deploy-update 技能

## 触发词
编译方案、部署方案、build.md、deploy.md、部署脚本、deploy-update

## 何时使用
阶段4中，readme.md 与 agent.md 更新完成后，需要整理编译与部署方案时使用。

## 执行角色
本技能由 文档编写（subagent_type=dw）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dw`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-deploy-update，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：创建或更新 deploy/build.md（编译方案）
1. 根据项目的编程语言与构建工具（如 Maven、npm、pip、go build 等），编写编译方案：编译环境要求、依赖安装、编译命令、编译产物说明、常见问题与处理。
2. 若 deploy/build.md 不存在，则创建；若已存在，则保留原有内容并更新变化部分。
3. 调用 impm_doc_writer（docType=deploy-build）写入 deploy/build.md。
4. 核对文件存在且内容正确。

### 步骤 2：创建或更新 deploy/deploy.md（部署方案）
1. 根据项目部署方式（如本地运行、服务器部署、容器化、前后端分离部署等），编写部署方案：部署环境要求、部署步骤、配置说明、启动与停止命令、健康检查、回滚方案。
2. 若 deploy/deploy.md 不存在，则创建；若已存在，则保留原有内容并更新变化部分。
3. 调用 impm_doc_writer（docType=deploy-deploy）写入 deploy/deploy.md。
4. 核对文件存在且内容正确。

### 步骤 3：生成编译和部署脚本（如可行）
1. 如项目具备明确的编译与部署命令，将编译脚本（如 build.sh / build.bat）与部署脚本（如 deploy.sh / deploy.bat）放置在 deploy 目录下。
2. 脚本要求：参数清晰、错误处理完善、与 build.md 和 deploy.md 中的说明一致。
3. 在 build.md 和 deploy.md 中说明脚本的用法。

### 步骤 4：记录进度
1. 调用 impm_progress add（impm-deploy-update，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- deploy/build.md（编译方案）
- deploy/deploy.md（部署方案）
- deploy 目录下的编译/部署脚本（如可行）
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-git-merge
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
