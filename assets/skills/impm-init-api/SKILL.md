---
name: impm-init-api
description: 判断项目是否需要接口设计，需要时读取 API-TEMPLATE.MD 模板反推接口设计文档，写入版本文档并复制到主文档 docs/{项目英文缩写}-api.md。当初始化阶段需要设计系统接口时使用。
---

# impm-init-api 技能

## 触发词
- API
- 接口设计
- 接口文档
- 前后端分离

## 何时使用
- 初始化阶段的接口步骤（/impm-init-api）执行时。
- 需要创建或补全接口设计文档（API）时。

## 执行角色
本技能由 系统架构师（subagent_type=sa）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `sa`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-api，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：判断是否需要接口设计
通过 impm_doc_reader 读取 docs/project.md 与 docs/sad.md，判断项目是否前后端分离或存在接口对接（如 Web 服务、第三方系统对接等），是否需要设计接口：
- 无需接口：调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-api, 无需接口) 记录进度并结束本技能。
- 需要接口：继续执行步骤 2。

### 步骤 2：读取模板
调用 impm_template_reader(projectRoot, API-TEMPLATE.MD) 读取接口设计文档模板，明确模板章节：接口清单、认证鉴权、错误码、接口详细定义等。

### 步骤 3：反推接口设计
通过 impm_doc_reader 读取已有文档（重点是 PRD、SAD），结合当前项目代码与文档，按模板格式填写 API：
- 存量项目：从现有 Controller/接口代码、路由与调用方反推接口定义（请求/响应参数、认证方式、错误码等）。
- 空项目：按模板结构写入空文档，章节标题保留，内容填写“待补充”或空值。

### 步骤 4：写入版本文档并复制主文档
调用 impm_doc_writer(projectRoot, api, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-api-v0.0.1.md，并复制到主文档 docs/{项目英文缩写}-api.md（主文档不存在则创建）。核对两个文件均存在且内容一致。

### 步骤 5：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-api, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-api-v0.0.1.md
- docs/{项目英文缩写}-api.md

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-lld
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
