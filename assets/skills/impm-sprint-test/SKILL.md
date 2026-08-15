---
name: impm-sprint-test
description: 敏捷冲刺测试子技能，由TE统一编写测试并运行，合并writetest与runtest为单一环节。
---

# impm-sprint-test 技能

## 触发词
- 敏捷测试
- sprint 测试
- 快速测试
- sprint-test

## 何时使用
impm-sprint 编排技能（环节4）全部编码任务完成后，需要对本次冲刺的全部代码改动统一编写测试并执行时使用。本技能为敏捷流程专用，将瀑布式的 impm-task-coding-writetest 与 impm-task-coding-runtest 两个技能合并为单一环节，不做任务级拆解。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-sprint-test，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对测试产出与 version_progress.md 进度记录，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 由调度方（PM）传入 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 本技能为敏捷流程的一部分，只能被 impm-sprint 调度执行，不能单独脱离版本号执行。

## 执行步骤
### 步骤 1：接收版本号与测试范围
接收调度方传入的当前版本号；调用 impm_doc_reader（docType=task）读取任务清单，结合 impm_git（action=status 或 log）确定本次冲刺的代码改动范围。

### 步骤 2：编写测试
按现有测试框架与项目语言习惯编写测试：
1. 单元测试：按当前开发语言与常用测试插件，为本次冲刺改动涉及的函数编写单元测试函数（随源码提交）；
2. 接口测试：用 python 语言编写接口测试脚本，放入 scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py，每个测试脚本用统一的入口；
3. 功能与UI测试：在版本目录 docs/{项目英文缩写}-v{当前版本号}/ 下新增 {项目英文缩写}-ui-test-record-v{当前版本号}.md，调用 impm_doc_writer（docType=ui-test-record），列清楚功能与UI测试的步骤和记录。

### 步骤 3：运行测试
全量运行单元测试与接口测试脚本；若有失败，定位失败原因并修复（测试代码问题直接修复，产品代码问题记录后返回给调度方安排修复后重测），重跑直至全部通过。

### 步骤 4：记录测试结果
将测试结果（通过数/总数、失败详情）写入 docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md，调用 impm_doc_writer（docType=regression-api）写入。

### 步骤 5：记录完成
调用 impm_progress（action=add，stepName=impm-sprint-test，status=已完成）。

## 交付物
- 单元测试函数（随源码提交）
- scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py 接口测试脚本
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-ui-test-record-v{当前版本号}.md 功能/UI测试记录文档
- docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md 测试结果记录
- version_progress.md 中的进度记录

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方：产出文件路径清单与 version_progress.md 中本技能的进度状态；严禁自行继续执行后续阶段或后续任务、严禁等待后续指令，后续调度由调度方（PM/impm-sprint）负责。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
