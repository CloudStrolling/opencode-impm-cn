---
name: impm-regression-test
description: 执行版本回归测试，将测试用例合并到主测试用例、全量运行单元测试和接口测试并记录结果，对需求追踪矩阵（RTM）进行测试用例回填与覆盖完整度校验，并生成当前版本质量度量报告（阶段一：测试度量，写入 regression.md，审核类质量指标由 impm-regression-metrics 阶段二回填）
---

# impm-regression-test 技能

## 触发词
回归测试、单元测试、接口测试、测试用例合并、需求追踪矩阵、RTM、覆盖校验、测试覆盖率、质量度量、缺陷指标、regression

## 何时使用
阶段4开始、版本编码开发全部完成后，需要对整个版本进行回归测试时使用；同时将测试用例回填到需求追踪矩阵（RTM）并校验所有需求/用户故事的覆盖完整度（设计、任务、测试用例）。

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
0. **检测 Python 环境**（运行 .py 接口测试程序依赖 python 环境，执行前必须先确认是否存在可用的 python）：
   按以下顺序检测并确定可用的 python 运行命令：
   a. 直接检测 shell 能否访问 python：执行 `python --version`；若失败再试 `python3 --version`（Windows 还可试 `py -3 --version`），任一成功即以成功的那条命令作为 python 运行命令；
   b. 若无直接可用的 python，检测 conda 环境：执行 `conda env list` 列出环境，任选其一（如 base）执行 `conda run -n <环境名> python --version` 验证，成功则后续用 `conda run -n <环境名> python` 作为 python 运行命令；
   c. 若也无 conda，检测 uv 托管的 python 环境：执行 `uv python list` 或 `uv run python --version`，成功则后续用 `uv run python`（或 `uv run --python <版本> python`）作为 python 运行命令；
   d. 以上均不可用时，判定当前环境缺少 python，接口测试无法执行，如实向调度方报告并提示先安装 python（官方安装包 / conda / uv 安装均可）。
1. 确认 scripts/API-TEST/ 目录下存在接口测试执行程序 run_api_test.py；若不存在，则从 assets/skills/template/API-TEST-RUNNER.py 模板复制到该路径。
2. 列出 scripts/API-TEST/ 目录下的全部 Postman Collection v2.1 接口测试用例文件（如 {项目英文缩写}-api-test-v{当前版本号}.postman_collection.json）。
3. 用步骤 4.0 确定的 python 运行命令依次调用 run_api_test.py 运行每个集合（可加 `--base-url http://localhost:端口` 指定被测服务地址），读取其生成的 scripts/API-TEST/report/api-test-report.json 汇总结果，记录每个集合的执行结果（通过/失败、断言明细、错误信息）。
4. 将结果整理为 Markdown 文档：集合名称、执行命令、用例数、通过数、失败数、失败明细、结论。
5. 调用 impm_doc_writer（docType=regression-api）写入 docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md。
6. 核对文件存在且内容正确。

### 步骤 5：需求追踪矩阵（RTM）测试用例回填与覆盖校验
1. 调用 impm_doc_reader（docType=rtm，target=version）读取当前版本需求追踪矩阵 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-rtm-v{当前版本号}.md；若文档不存在，读取主文档 docs/{项目英文缩写}-rtm.md，或说明本版本未生成 RTM 并跳过本步骤（标注提示）。
2. 收集本版本测试用例：读取当前版本测试用例 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md（以及步骤 1 合并后的主测试用例 docs/{项目英文缩写}-testcase.md），提取所有测试用例编号（TC-xxx）及其"关联需求ID"（FR-xxx / US-xxx）。
3. 建立"需求/用户故事 → 测试用例"关联并回填：
   - 依据测试用例中的"关联需求ID"字段，将每个测试用例与其对应的需求/用户故事关联；
   - 在 RTM"二、追踪矩阵"的"需求/用户故事 → 测试用例"章节（2.3）补齐/更新每一条关联记录，覆盖情况标注"已覆盖"；从未关联任何测试用例的需求/用户故事标注"缺失"；
   - 同步在"三、覆盖完整度校验"中回填每条需求/用户故事的"是否有测试用例"列。
4. 覆盖完整度校验：逐条核对"一、需求/用户故事清单"中的每个原始需求（FR-xxx / NFR-xxx）与用户故事（US-xxx）是否同时满足以下全部条件：
   - 是否有设计（"需求/用户故事 → 设计"存在"已覆盖"记录）；
   - 是否有任务（"需求/用户故事 → 任务"存在"已覆盖"记录）；
   - 是否有测试用例（"需求/用户故事 → 测试用例"存在"已覆盖"记录）。
   任一条件不满足即视为缺口。
5. 生成/更新问题清单：将校验发现的缺口（缺少设计、缺少任务、缺少测试用例）与既有问题清单合并，填入 RTM"四、问题清单"章节，给出问题描述、处理建议，已解决的更新状态为"已解决"，未解决的保持"待处理"。
6. 调用 impm_doc_writer（docType=rtm，target=version，expectedBase=步骤 1 读取到的最新全文）将包含测试用例关联、覆盖校验与问题清单的完整 rtm.md 覆盖写回（若本版本原本无 rtm.md，可新建，或按 main 写入主文档）。
7. 核对 rtm.md 已写入且校验结果正确。

### 步骤 6：生成版本质量度量报告（阶段一：测试度量）
> 本步骤只产出阶段一的"测试类"质量指标并写入 regression.md；"审核类"质量指标（审核问题数及严重级别分布、修复率、缺陷密度、DRE）因依赖 impm-coding-review 生成的审核报告，由阶段二技能 impm-regression-metrics 在代码审核完成后回填到同一份 regression.md。
1. 读取质量度量报告模板：调用 impm_template_reader 读取 REGRESSION-TEMPLATE.MD 模板内容。
2. 汇总阶段一所需测试指标：
   - 单元测试：用例总数、通过数、失败数、通过率（取自步骤 2/3 的回归结果）；
   - 接口测试：用例总数、通过数、失败数、通过率（取自步骤 4 的回归结果）；
   - 测试覆盖率：需求/用户故事用例覆盖（依据步骤 5 RTM 覆盖完整度校验结果计算：已覆盖的需求/用户故事数 / 需求/用户故事总数）；如工具可产出代码/分支覆盖率一并填入，无则标注"不适用"。
3. 读取当前版本 regression.md（docType=regression，target=version）；若不存在则按模板新建，若已存在则保留历史内容与后续阶段二已回填部分，仅更新阶段一测试度量部分。
4. 调用 impm_doc_writer（docType=regression，target=version，expectedBase=步骤 3 读取到的最新全文）写入 docs/{项目英文缩写}-v{当前版本号}/regression.md；审核质量度量章节（第 3~5 章）暂留待阶段二回填。
5. 核对 regression.md 已写入且测试度量内容正确。

### 步骤 7：记录进度
1. 调用 impm_progress add（impm-regression-test，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/{项目英文缩写}-testcase.md（合并后的主测试用例）
- docs/{项目英文缩写}-v{当前版本号}/regression-unit-test.md
- docs/{项目英文缩写}-v{当前版本号}/regression-api-test.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-rtm-v{当前版本号}.md（已回填测试用例关联与覆盖校验结果）
- docs/{项目英文缩写}-v{当前版本号}/regression.md（阶段一：测试度量；审核类质量指标由 impm-regression-metrics 阶段二回填）
- version_progress.md 进度记录

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-coding-comment
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
