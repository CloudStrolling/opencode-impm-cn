---
name: impm-init-testcase
description: 读取 TESTCASE-TEMPLATE.MD 模板，根据项目代码、文档及 PRD、LLD 确定测试用例，编写单元测试函数并生成 Postman Collection v2.1 接口测试用例（scripts/API-TEST/，配合 run_api_test.py 执行）。当初始化阶段需要编写测试用例时使用。
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
调用 impm_template_reader(projectRoot, TESTCASE-TEMPLATE.MD) 读取测试用例文档模板，明确模板章节结构与用例格式（用例编号、用例名称、前置条件、测试步骤、预期结果等）。如涉及 API 接口测试，另调用 impm_template_reader(projectRoot, API-TEST-COLLECTION-TEMPLATE.json) 读取 Postman Collection v2.1 用例结构模板（重点：info/variable/item/request/expected），了解接口用例的字段与 expected 断言写法。

### 步骤 2：确定测试用例
通过 impm_doc_reader 读取已有文档（重点是 PRD、LLD，以及 docs/{项目英文缩写}-api.md 接口定义），结合当前项目代码与文档，确定测试用例清单：
- 存量项目：根据现有功能与代码确定用例。
- 空项目：按模板结构写入空文档，章节标题保留，内容填写“待补充”或空值。

### 步骤 3：写入版本文档并复制主文档
调用 impm_doc_writer(projectRoot, testcase, {项目中文名称}, {当前版本号}, {任务编号}, main, 内容)：写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md，并复制到主文档 docs/{项目英文缩写}-testcase.md（主文档不存在则创建）。核对两个文件均存在且内容一致。

### 步骤 4：编写单元测试函数
针对测试用例中的单元测试部分，编写单元测试函数：测试函数与用例一一对应，函数名、入参、断言与用例的测试步骤、预期结果保持一致。

### 步骤 5：编写 API 接口测试用例（Postman Collection v2.1）
针对测试用例中的 API 接口测试，生成 Postman Collection v2.1 格式的 JSON 用例文件，放入 scripts/API-TEST/{项目英文缩写}-api-test-v0.0.1.postman_collection.json，并与接口测试执行程序配套使用：
1. 确认 scripts/API-TEST/ 目录下已存在接口测试执行程序 run_api_test.py；若不存在，则从 assets/skills/template/API-TEST-RUNNER.py 模板复制到该路径（即创建 run_api_test.py）。
2. 按 API-TEST-COLLECTION-TEMPLATE.json 模板结构，针对每个接口用例生成 item：
   - item.name = 接口路径 + 用例名称 + 用例 ID；
   - item.request.method/url/header/body 按用例所属接口与测试步骤填写（url.raw 使用 `{{base_url}}` 占位符，query 以数组填写，body 为 JSON 时 mode=raw）；
   - item.event 中按用例预期结果生成 pm.test 断言脚本（状态码、业务码、字段值），便于在 Apifox 中调试；
   - item.expected 按用例预期结果填写结构化断言（status 状态码、max_response_time 耗时上限、headers 响应头包含、assertions 响应体断言：type=json 用 path+equals/contains，type=body_contains 用 value）；该 expected 字段由 API-TEST-RUNNER.py 读取执行，必须与实际接口预期一致。
3. 接口测试通过 `python scripts/API-TEST/run_api_test.py scripts/API-TEST/{项目英文缩写}-api-test-v0.0.1.postman_collection.json --report-dir scripts/API-TEST/report` 执行，由程序读取集合、逐个发送请求、对比 expected 预期结果并生成测试报告（控制台 + scripts/API-TEST/report/api-test-report.md、api-test-report.json）。**运行前先检测 Python 环境**（运行 .py 接口测试程序依赖 python 环境）：
   a. 直接检测 shell 能否访问 python：执行 `python --version`；若失败再试 `python3 --version`（Windows 还可试 `py -3 --version`），任一成功即以成功的那条命令作为 python 运行命令；
   b. 若无直接可用的 python，检测 conda 环境：执行 `conda env list` 列出环境，任选其一（如 base）执行 `conda run -n <环境名> python --version` 验证，成功则后续用 `conda run -n <环境名> python` 作为 python 运行命令；
   c. 若也无 conda，检测 uv 托管的 python 环境：执行 `uv python list` 或 `uv run python --version`，成功则后续用 `uv run python`（或 `uv run --python <版本> python`）作为 python 运行命令；
   d. 以上均不可用时，判定当前环境缺少 python，接口测试无法执行，如实向调度方报告并提示先安装 python（官方安装包 / conda / uv 安装均可）。若检测到可用 python，则将上方执行命令中的 `python` 替换为检测确定的 python 运行命令后执行。

### 步骤 6：记录进度
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-testcase, 已完成) 记录本步骤完成。

## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md
- docs/{项目英文缩写}-testcase.md
- scripts/API-TEST/{项目英文缩写}-api-test-v0.0.1.postman_collection.json（Postman Collection v2.1 接口测试用例）
- scripts/API-TEST/run_api_test.py（接口测试执行程序，由模板复制）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-commit
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
