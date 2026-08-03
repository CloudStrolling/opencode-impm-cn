---
name: impm-init-prd
description: 读取 PRD-TEMPLATE.MD 模板，根据项目代码、文档及 URS 反推产品需求文档，写入版本文档并复制到主文档 docs/{项目英文缩写}-prd.md。当初始化阶段需要编写产品需求文档时使用。
---

# impm-init-prd 技能
## 触发词
- PRD
- 产品需求文档
- 产品需求
- 功能清单

## 何时使用
- 初始化阶段的产品需求步骤（/impm-init-prd）执行时。
- 需要创建或补全产品需求文档（PRD）时。

## 执行角色
本技能由 BA subagent 负责执行。执行时使用 Skill 工具加载本技能。

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
调用 impm_template_reader(projectRoot, PRD-TEMPLATE.MD) 读取产品需求文档模板，明确模板章节：产品背景、目标用户、功能清单、详细功能描述、业务流程图、数据需求、验收标准等。

### 步骤 2：反推产品需求
通过 impm_doc_reader 读取已有文档（重点是 URS：docs/{项目英文缩写}-urs.md 或版本内 urs 文档，以及 project、sad 等），结合当前项目代码与文档，按模板格式填写 PRD：
- 存量项目：从项目代码、已有文档及 URS 反推各章节内容。
- 空项目：按模板结构写入空文档，章节标题保留，内容填写“待补充”或空值。

### 步骤 3：写入版本文档并复制主文档
调用 impm_doc_writer(projectRoot, prd, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-prd-v0.0.1.md，并复制到主文档 docs/{项目英文缩写}-prd.md（主文档不存在则创建）。核对两个文件均存在且内容一致。

### 步骤 4：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-prd, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-prd-v0.0.1.md
- docs/{项目英文缩写}-prd.md

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-sad
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
