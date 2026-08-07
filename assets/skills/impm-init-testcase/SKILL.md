---
name: impm-init-testcase
description: 读取 TESTCASE-TEMPLATE.MD 模板，根据项目代码、文档及 PRD、LLD 确定测试用例，编写测试函数并生成自动化测试脚本（scripts/API-TEST/）。当初始化阶段需要编写测试用例时使用。
---

# impm-init-testcase 技能

## 触发词
- 测试用例
- 自动化测试
- testcase
- 测试脚本

## 何时使用
- 初始化阶段的测试步骤（/impm-init-testcase）执行时。
- 需要创建或补全测试用例文档与自动化测试脚本时。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-init-testcase，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
调用 impm_template_reader(projectRoot, TESTCASE-TEMPLATE.MD) 读取测试用例文档模板，明确模板章节结构与用例格式（用例编号、用例名称、前置条件、测试步骤、预期结果等）。

### 步骤 2：确定测试用例
通过 impm_doc_reader 读取已有文档（重点是 PRD、LLD，以及 docs/{项目英文缩写}-api.md 接口定义），结合当前项目代码与文档，确定测试用例清单：
- 存量项目：根据现有功能与代码确定用例。
- 空项目：按模板结构写入空文档，章节标题保留，内容填写“待补充”或空值。

### 步骤 3：写入版本文档并复制主文档
调用 impm_doc_writer(projectRoot, testcase, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md，并复制到主文档 docs/{项目英文缩写}-testcase.md（主文档不存在则创建）。核对两个文件均存在且内容一致。

### 步骤 4：编写单元测试函数
针对测试用例中的单元测试部分，编写单元测试函数：测试函数与用例一一对应，函数名、入参、断言与用例的测试步骤、预期结果保持一致。

### 步骤 5：编写 API 测试脚本
针对测试用例中的 API 接口测试，编写 API 测试脚本，统一放到 scripts/API-TEST/ 目录下；脚本应可直接执行并输出每个用例的通过/失败结果。

### 步骤 6：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-testcase, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md
- docs/{项目英文缩写}-testcase.md
- scripts/API-TEST/ 下的自动化测试脚本

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-commit
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
