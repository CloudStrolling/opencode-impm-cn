---
name: impm-regression-test
description: 执行版本回归测试，将测试用例合并到主测试用例、全量运行单元测试和接口测试并记录结果
---

# impm-regression-test 技能

## 触发词
回归测试、单元测试、接口测试、测试用例合并、regression

## 何时使用
阶段4开始、版本编码开发全部完成后，需要对整个版本进行回归测试时使用。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-regression-test，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：将当前版本测试用例合并到主测试用例
1. 读取当前版本测试用例 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md。
2. 若 docs/{项目英文缩写}-testcase.md 不存在或为空，则以当前版本测试用例的内容创建主测试用例。
3. 若已存在，保留主测试用例中已有的历史内容，将当前版本新增、变更的测试用例合并进去；相同用例 ID 以当前版本内容为准更新，不得丢失历史用例。
4. 调用 impm_doc_writer（docType=testcase，target=main）写入 docs/{项目英文缩写}-testcase.md。
5. 核对合并后的主测试用例文件存在且内容正确。

### 步骤 2：全量运行单元测试
1. 通过 impm_project_info 获取项目的编程语言，确定对应的单元测试插件与运行命令（如 Java 的 mvn test、Python 的 pytest、Node 的 npm test 等）。
2. 全量运行单元测试，不得跳过、不得选择性运行任何测试。
3. 记录：测试时间、运行环境、执行命令、用例总数、通过数、失败数、失败用例明细与原因。

### 步骤 3：写入单元测试回归结果
1. 将步骤 2 的结果整理为 Markdown 文档，内容包括：测试时间、运行环境、执行命令、统计结果、失败用例清单及失败原因、结论。
2. 调用 impm_doc_writer（docType=regression-unit）写入 docs/{项目英文缩写}-v{当前版本号}/regression-unit-test.md。
3. 核对文件存在且内容正确。

### 步骤 4：运行接口测试并写入结果
1. 确认 scripts/API-TEST/ 目录下存在接口测试执行程序 run_api_test.py；若不存在，则从 assets/skills/template/API-TEST-RUNNER.py 模板复制到该路径。
2. 列出 scripts/API-TEST/ 目录下的全部 Postman Collection v2.1 接口测试用例文件（如 {项目英文缩写}-api-test-v{当前版本号}.postman_collection.json）。
3. 依次调用 run_api_test.py 运行每个集合（可加 `--base-url http://localhost:端口` 指定被测服务地址），读取其生成的 scripts/API-TEST/report/api-test-report.json 汇总结果，记录每个集合的执行结果（通过/失败、断言明细、错误信息）。
4. 将结果整理为 Markdown 文档：集合名称、执行命令、用例数、通过数、失败数、失败明细、结论。
5. 调用 impm_doc_writer（docType=regression-api）写入 docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md。
6. 核对文件存在且内容正确。

### 步骤 5：记录进度
1. 调用 impm_progress add（impm-regression-test，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/{项目英文缩写}-testcase.md（合并后的主测试用例）
- docs/{项目英文缩写}-v{当前版本号}/regression-unit-test.md
- docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-coding-comment
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
