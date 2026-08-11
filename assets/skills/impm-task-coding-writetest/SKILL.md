---
name: impm-task-coding-writetest
description: 按测试用例编写单元测试函数、接口测试 Python 脚本与功能/UI测试记录文档，并回标 testcase.md。
---

# impm-task-coding-writetest 技能

## 触发词
- 编写测试
- 自动化脚本
- writetest

## 何时使用
当前任务编码实现完成后，需要按测试用例编写单元测试、接口测试自动化脚本与功能/UI测试记录时使用。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-task-coding-writetest，要求 subagent 先用 Skill 工具加载本技能再执行）、任务编号（taskId，从 $ARGUMENTS 提取，缺失时用 impm_task_manager 查询下一个可执行任务）。
3. 完成要求：等待 subagent 返回完成结果后，核对产出文件与 version_progress.md 进度记录，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由调度方（PM/上级技能）传入 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写}、{当前版本号}、{任务编号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。
7. 本技能为编码流程的一部分，只能被 impm-task-coding 或 impm-coding 调度执行，不能单独脱离版本号和任务编号执行。

## 执行步骤
### 步骤 1：接收版本号与任务编号
接收调度方传入的当前版本号与任务编号（{任务编号}，如 TASK-001）。

### 步骤 2：读取测试用例并分类编写
调用 impm_doc_reader（docType=testcase，taskId={任务编号}）读取当前任务的测试用例，按测试类型分别编写：
1. 单元测试：按当前开发语言，直接按开发语言的习惯和常用的测试插件，编写单元测试函数；
2. 接口测试：用 python 语言编写接口测试脚本，放入 scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py，每个测试脚本用统一的入口。**版本目录写入冲突规避**：先调用 impm_doc_reader 或直接读取脚本最新内容（可能有其他并行任务已写入测试函数），在最新脚本基础上保留他人测试函数、仅新增本任务测试函数与入口注册后整体写回，写回后回读校验；
3. 功能与UI测试：在版本目录 docs/{项目英文缩写}-v{当前版本号}/ 下新增/更新 {项目英文缩写}-ui-test-record-v{当前版本号}.md，调用 impm_doc_writer（docType=ui-test-record）。**版本目录写入冲突规避**：先读取该文档最新内容，在最新内容后追加本任务测试记录段落后写回，禁止基于旧快照整体覆盖。

### 步骤 3：回标测试用例
根据完成的测试函数和脚本，在 testcase.md 中标注对应的函数位置或者脚本位置（更新任务目录 testcase.md）。

### 步骤 4：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-writetest，status={任务编号}-已完成）。

## 交付物
- 单元测试函数（随源码提交）
- scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py 接口测试脚本
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-ui-test-record-v{当前版本号}.md 功能/UI测试记录文档
- 任务目录 testcase.md（已回标测试位置）
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
