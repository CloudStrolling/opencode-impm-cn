---
name: impm-init-sad
description: 读取 SAD-TEMPLATE.MD 模板，根据项目代码、文档及 PRD 反推系统架构设计文档，写入 docs/sad.md。当初始化阶段需要编写系统架构设计文档时使用。
---

# impm-init-sad 技能

## 触发词
- SAD
- 系统架构设计
- 架构文档
- sad.md

## 何时使用
- 初始化阶段的架构步骤（/impm-init-sad）执行时。
- 需要创建或补全系统架构设计文档（SAD）时。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-sad，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
调用 impm_template_reader(projectRoot, SAD-TEMPLATE.MD) 读取系统架构设计文档模板，明确模板章节：设计目标与约束、技术栈选型、系统上下文图、容器图、组件图、部署架构、安全架构、性能架构、数据流图、架构决策记录。

### 步骤 2：反推架构设计
通过 impm_doc_reader 读取已有文档（重点是 PRD：docs/{项目英文缩写}-prd.md，以及 project 等），结合当前项目代码与文档，按模板格式填写 SAD：
- 存量项目：从现有代码、技术栈与文档反推架构设计各章节。
- 空项目：按模板结构写入空文档，章节标题保留，内容填写“待补充”或空值。

### 步骤 3：写入 docs/sad.md
调用 impm_doc_writer(projectRoot, sad, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容) 写入主文档 docs/sad.md（sad 仅主文档，无版本内文档，主文档不存在则创建）。核对 docs/sad.md 已创建且内容完整。

### 步骤 4：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-sad, 已完成) 记录本步骤完成。

## 交付物
- docs/sad.md

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-dbd
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
