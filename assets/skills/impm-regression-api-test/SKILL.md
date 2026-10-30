---
name: impm-regression-api-test
description: 执行版本接口测试回归，全量运行接口测试并记录结果，识别并删除过时测试用例，并生成当前版本质量度量报告（阶段一：接口测试度量，写入 regression.md）。
---

# impm-regression-api-test 技能

## 触发词
回归测试、接口测试、api-test、postman、regression-api

## 何时使用
阶段4开始、版本编码开发全部完成后，需要对整个版本进行接口测试回归时使用。

## 执行角色
本技能由 测试工程师（subagent_type=te）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `te`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-regression-api-test，要求 subagent 先用 Skill 工具加载本技能再执行）。
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
### 步骤 1：检查并启动服务与中间件
1. **识别服务与中间件**：分析项目结构，识别被测服务及其依赖的中间件（如数据库、消息队列、缓存、外部 API 等）；查找项目根目录下的配置文件（如 `.env`、`config.*`、`docker-compose.yml`、`Makefile` 等），确定服务的启动方式和依赖关系。
2. **检查服务状态**：检查被测服务是否已启动（访问健康检查端点或检查进程/端口）；检查依赖中间件是否已启动。
3. **启动未运行的服务与中间件**：若存在 `docker-compose.yml`，使用 `docker-compose up -d`；若存在启动脚本，执行对应命令。
4. **验证启动状态**：重新检查所有服务与中间件是否已成功启动，若仍有未启动的，记录错误并终止本技能。

### 步骤 2：检测 Python 环境
按以下顺序检测并确定可用的 python 运行命令：
a. 执行 `python --version`；若失败再试 `python3 --version`（Windows 还可试 `py -3 --version`），任一成功即使用该命令。
b. 若无直接可用的 python，检测 conda 环境：执行 `conda env list`，任选其一执行 `conda run -n <环境名> python --version` 验证。
c. 若也无 conda，检测 uv：执行 `uv python list` 或 `uv run python --version`。
d. 以上均不可用时判定缺少 python，接口测试无法执行，如实向调度方报告。

### 步骤 3：运行接口测试
1. 确认 docs/api-test/ 目录下存在接口测试执行程序 run_api_test.py；若不存在，则从 assets/skills/template/API-TEST-RUNNER.py 模板复制到该路径。
2. 列出版本目录 docs/{项目英文缩写}-v{当前版本号}/ 下的全部 Postman Collection v2.1 接口测试用例文件。
3. 用步骤 2 确定的 python 运行命令依次调用 run_api_test.py 运行每个集合文件：
   `<python运行命令> docs/api-test/run_api_test.py docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-test-v{当前版本号}.postman_collection.json --report-dir docs/{项目英文缩写}-v{当前版本号}`
4. 读取生成的 docs/{项目英文缩写}-v{当前版本号}/api-test-report.json 汇总结果，记录每个集合的执行结果。

### 步骤 4：处理过时测试用例
1. 分析步骤 3 中失败的接口测试用例，识别失败原因为"用例已过时"（如接口已下线、请求/响应格式已变更、业务逻辑已调整导致用例不再适用）的测试用例。
2. 若存在过时测试用例，使用 question 工具向用户列出这些测试用例（编号、名称、所在文件路径、过时原因）。
3. 询问用户是否确认删除。
4. 若用户确认删除：
   a. 从版本测试用例文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md 中删除对应条目；
   b. 从 Postman Collection JSON 文件中删除对应的 item；
   c. 记录删除的测试用例清单。

### 步骤 5：写入接口测试回归结果
1. 读取报告模板：调用 impm_template_reader 读取 REGRESSION-API-TEST-TEMPLATE.MD 模板内容，严格按模板的章节结构组织本报告，不得臆造章节。
2. 将步骤 3 的测试结果与步骤 4 的过时用例处理记录填入模板对应章节；无内容的可选章节（如过时用例删除记录、失败用例清单）标注"无"，不得删除章节。
3. 调用 impm_doc_writer（docType=regression-api）写入 docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md。
4. 核对文件存在且内容正确。

### 步骤 6：更新版本质量度量报告（阶段一：接口测试度量）
1. 读取 docs/{项目英文缩写}-v{当前版本号}/regression.md（如存在），在阶段一测试度量章节中补充接口测试指标：用例总数、通过数、失败数、通过率。
2. 调用 impm_doc_writer（docType=regression，target=version，expectedBase=步骤 6.1 读取到的最新全文）写回（保留已有的单元测试度量部分）。

### 步骤 7：记录进度
调用 impm_progress add（impm-regression-api-test，已完成），在 version_progress.md 中记录本技能完成状态。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md
- docs/{项目英文缩写}-v{当前版本号}/regression.md（已更新接口测试度量）
- version_progress.md 进度记录

## 完成后提示
- 本技能完成后，请继续执行 impm-regression-metrics（阶段二回填审核质量指标）
- 如需继续执行后续所有步骤，请输入 /impm-finish
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
