---
name: impm-init-project
description: 读取 PROJECT-TEMPLATE.MD 模板，结合项目现状生成并写入 docs/project.md 项目主文档（项目基本信息、编码规范、项目地图等）。当初始化阶段需要编写项目主文档时使用。
---

# impm-init-project 技能

## 触发词
- project.md
- 项目主文档
- 项目基本信息
- 编码规范

## 何时使用
- 初始化阶段的项目文档步骤（/impm-init-project）执行时。
- 需要创建或补全 docs/project.md 项目主文档时。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-project，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：读取模板
调用 impm_template_reader(projectRoot, PROJECT-TEMPLATE.MD) 读取项目主文档模板，明确模板要求填写的章节结构（项目基本信息、编码规范、项目地图等）。

### 步骤 2：收集项目现状
通过 impm_doc_reader 读取 docs 目录下已有文档（docType=project|sad 等，target=main），检查项目根目录的代码结构（语言、框架、目录组织），确定模板各章节可填写的内容；信息不充分的章节记录为待确认项。

### 步骤 3：必要时向用户提问
如果项目是新建项目（尚无任何代码与文档）、或现有文档代码不足以覆盖 project.md 的章节内容、或有其他不明白的情况，通过对话向用户提问后再填写。提问应聚焦于模板中缺失且必须的信息，例如：项目中文名称/英文名称/英文缩写、编程语言、项目类型、团队角色分工等。

### 步骤 4：生成并写入 docs/project.md
套用 PROJECT-TEMPLATE.MD 模板格式，结合已收集的项目现状与用户回答，生成 project.md 内容（含项目基本信息、编码规范、项目地图等），调用 impm_doc_writer(projectRoot, project, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容) 写入 docs/project.md。核对 docs/project.md 已创建且内容完整。

### 步骤 5：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-project, 已完成) 记录本步骤完成；若 version_progress.md 尚不存在（impm-init-version 未执行），跳过进度记录，由 impm-init-version 统一补录。

## 交付物
- docs/project.md（项目主文档）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-version
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
