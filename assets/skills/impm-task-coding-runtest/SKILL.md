---
name: impm-task-coding-runtest
description: 执行当前任务全部测试并更新测试结果，全部通过后把任务测试用例合并更新到版本测试用例文档。
---

# impm-task-coding-runtest 技能

## 触发词
- 执行测试
- 运行测试
- runtest

## 何时使用
当前任务的测试函数与测试脚本编写完成后，需要执行全部测试、确认测试结果并更新文档时使用。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-task-coding-runtest，要求 subagent 先用 Skill 工具加载本技能再执行）、任务编号（taskId，从 $ARGUMENTS 提取，缺失时用 impm_task_manager 查询下一个可执行任务）。
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

### 步骤 2：读取测试用例
调用 impm_doc_reader（docType=testcase，taskId={任务编号}），读取当前任务的测试用例。

### 步骤 3：按测试类型执行测试
根据当前任务的测试用例（docType=testcase，taskId={任务编号}），按测试类型分别执行：

1. **单元测试**：找到本任务编写的单元测试函数，使用当前开发语言或构建环境中的单元测试工具（如 pytest / go test / mvn test / npm test / dotnet test 等）执行单元测试；执行完成后生成单元测试结果概览（通过/失败用例数与失败原因）。

2. **功能与UI测试**：本步骤不执行、不生成 UI 自动化测试，忽略即可（UI 测试以 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-ui-test-record-v{当前版本号}.md 中的人工/功能测试记录为准）。

3. **接口测试**：
   1. 判断目标项目 scripts/API-TEST/ 目录下是否已存在接口测试执行程序 run_api_test.py；若不存在，则调用 impm_template_reader 读取 assets/skills/template/API-TEST-RUNNER.py 模板内容，在 scripts/API-TEST/ 目录下创建 run_api_test.py（即把模板复制到该路径）；
   2. 找到本任务在 scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.postman_collection.json 中生成的接口测试用例（Postman Collection v2.1 格式）；
   3. 调用该 python 程序执行接口测试，并指定上述 Postman Collection JSON 文件与可选的基础地址（如 `--base-url http://localhost:端口`）：
      `python scripts/API-TEST/run_api_test.py scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.postman_collection.json --report-dir scripts/API-TEST/report`
   4. 程序会读取集合、逐个发送请求、对比 expected 预期结果、生成测试报告（控制台 + scripts/API-TEST/report/api-test-report.md、api-test-report.json）；根据报告中的 PASS/FAIL 汇总判断接口测试是否通过。

### 步骤 4：更新测试结果
每一个测试完成后，更新当前任务的测试用例的测试通过情况（更新任务目录 testcase.md，标注通过/失败及失败原因）；接口测试需结合步骤 3.3 生成的 api-test-report 报告，将每条用例的执行结果（HTTP 状态码、耗时、断言失败详情）回填到 testcase.md 对应用例的"测试结果"栏。

### 步骤 5：处理失败（单元测试与接口测试）
全部测试完成后，如果单元测试或接口测试中有部分用例失败（UI 测试不计入失败判定）：
1. 把报错信息/报告中的失败详情加入上下文；
2. 由调度方（impm-task-coding）回退到 impm-task-coding-context 重新收集信息并编码，再按流程重新执行测试；
3. 连续失败达上限（3次）则中止本任务并向用户报告。

### 步骤 6：确认全部通过
如果全部测试都成功，表明当前任务编码已成功完成。

### 步骤 7：合并版本测试用例
将当前任务的测试用例 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/testcase.md 合并、更新到当前版本的测试用例 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md。**版本目录写入冲突规避**：先调用 impm_doc_reader（docType=testcase，target=version）读取最新内容，在最新内容基础上追加/合并本任务用例（保留他人用例），以 expectedBase=读取到的全文调用 impm_doc_writer（docType=testcase，target=version）整体写回；若返回并发冲突错误（文件已被其他任务修改），重新读取合并后再写回；写回后回读校验。

### 步骤 8：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-runtest，status={任务编号}-已完成）。

## 交付物
- 任务目录 testcase.md（已更新测试通过情况）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md（已合并更新）
- version_progress.md 中的进度记录

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方：产出文件路径清单与 version_progress.md 中本技能的进度状态；严禁自行继续执行后续阶段或后续任务、严禁等待后续指令，后续调度由调度方（PM）负责。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
