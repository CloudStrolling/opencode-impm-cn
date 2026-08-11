---
name: impm-task-coding
description: 单任务编码编排技能，由 TM（Task Manager）subagent 执行，按固定顺序调度 context/cs/ws/dbd/api/testcase/code/writetest/runtest 子技能完成一个任务的编码开发，并遵守版本目录写入冲突规避规则。
---

# impm-task-coding 技能

## 触发词
- 编码任务
- 执行任务
- 任务编码

## 何时使用
impm-coding 并发调度阶段确定某个任务可执行（无前置任务或前置任务已完成）后，由 PM 启动 TM subagent 执行该任务的全部编码开发步骤（从收集上下文到测试通过）时使用。同一时刻可能有多个 TM 并行执行不同任务，必须严格遵守本技能的任务隔离与写冲突规避规则。

## 执行角色
本技能由 任务经理（subagent_type=tm）subagent 负责执行，执行时使用 Skill 工具加载本技能。内部子步骤按下方「通用调度要求」派发对应 subagent 执行，TM 只调度、检查与决策。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 TM 自己代替 subagent 执行具体事务（唯一例外：对照表中标注"TM（或调度方）直接执行"的步骤）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；注意：本任务可能与其他任务并行执行，写入版本目录共享文档时必须先读取最新内容再合并写回；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、内容正确，全部正确才能进入下一步。
5. 顺序纪律：任务内部子步骤严格执行顺序，不跳过、不乱序、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。**注意：任务内部禁止并行，子步骤必须串行执行**（并行只发生在任务之间）。

### 子步骤 subagent 对照表（impm-task-coding）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 3 | impm-task-coding-context | tl |
| 4 | impm-task-coding-cs | cs |
| 5 | impm-task-coding-ws | ws |
| 6 | impm-task-coding-dbd | dba |
| 7 | impm-task-coding-api | tl（按需） |
| 8 | impm-task-coding-testcase | te |
| 9 | impm-task-coding-code | sse/fee/bee（按 taskType） |
| 10 | impm-task-coding-writetest | te |
| 11 | impm-task-coding-runtest | te |

## 版本目录写入冲突规避（本技能所有子步骤必须遵守）
多个任务并行编码时，任务会向版本目录写入内容，存在并发写冲突。冲突点与规避规则如下：

| 冲突点 | 写入内容 | 并发冲突 | 规避规则 |
|----|----|----|----|
| version_progress.md | 任务/子步骤进度行（impm_progress action=add） | 多任务并发 add 可能覆盖丢失 | 进度状态必须带 {任务编号} 前缀（如 {任务编号}-执行中、{任务编号}-已完成），impm_progress 对相同 (stepName, status) 幂等去重；同一任务内部子步骤串行记录，不并发 |
| {项目英文缩写}-testcase-v{当前版本号}.md | 测试用例合并（testcase 子步骤 / runtest 子步骤） | 多任务并发覆盖写 | 写入前必须先 impm_doc_reader（docType=testcase，target=version）读最新全文，在最新内容上追加/合并本任务用例后整体写回；禁止基于旧快照覆盖；写回后立即回读校验 |
| {项目英文缩写}-dbd-v{当前版本号}.md / .sql | 数据库设计文档与脚本（dbd 子步骤） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容上追加/合并本任务变更后写回；SQL 按新增对象追加，不重写他人对象 |
| {项目英文缩写}-api-v{当前版本号}.md | 接口设计文档（api 子步骤） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容上追加/合并本任务接口后写回 |
| {项目英文缩写}-ui-test-record-v{当前版本号}.md | 功能/UI 测试记录（writetest 子步骤） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容后追加本任务测试记录段落后写回 |
| scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py | 接口测试脚本（writetest 子步骤） | 多任务并发覆盖写 | 同上：先读最新脚本，保留他人测试函数，仅新增本任务测试函数与入口注册后写回 |

**通用规避铁律**：
1. 只写自己的任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的文件（context.md/cs.md/ws.md/testcase.md）与本任务对应的代码文件，禁止写其他任务目录。
2. 写任何版本目录共享文档前，必须先用 impm_doc_reader 读取最新内容，在最新内容上合并，禁止基于读取过的旧内容整体覆盖。
3. 写回后立即回读校验自己的内容已存在且他人内容未被破坏，发现丢失立即重新合并写回。
4. 本任务不更新任务清单 JSON（{项目英文缩写}-task-v{当前版本号}.json）中的任务状态，该操作由 PM/scm 独占。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由调度方（PM/impm-coding）传入 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤（任务内部串行）。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写}、{当前版本号}、{任务编号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。
7. 本技能为编码流程的一部分，只能被 impm-coding 调度执行，不能单独脱离版本号和任务编号执行。

## 执行步骤
### 步骤 1：接收版本号与任务编号
接收调度方传入的当前版本号与任务编号（{任务编号}，如 TASK-001），调用 impm_task_manager（action=query，taskId={任务编号}）校验任务存在、状态为"执行中"。

### 步骤 2：记录任务编码开始
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-task-coding，status={任务编号}-执行中），记录当前任务开始编码。

### 步骤 3：收集需求上下文
启动 TL subagent 执行 impm-task-coding-context 技能，收集并合并当前任务的需求上下文，写入任务目录 context.md。

### 步骤 4：查询现有代码
启动 CS subagent 执行 impm-task-coding-cs 技能，查询现有源代码与可复用模块，写入任务目录 cs.md。

### 步骤 5：查询网络资料
启动 WS subagent 执行 impm-task-coding-ws 技能，查询三方包与相关资料，写入任务目录 ws.md。

### 步骤 6：处理数据库设计
启动 DBA subagent 执行 impm-task-coding-dbd 技能，判断数据库设计是否需要变更并同步更新版本数据库设计文档与 SQL 脚本；写入必须遵守「版本目录写入冲突规避」规则（先读最新再合并写回）。

### 步骤 7：设计接口（按需）
判断是否为分前后端项目且当前任务为后端任务：通过 impm_project_info 获取项目类型（是否前后端分离），通过任务 taskType 字段判断任务类型；如果分前后端且为后端任务，则启动 TL subagent 执行 impm-task-coding-api 技能设计接口；否则跳过此步骤。API 版本文档写入遵守「版本目录写入冲突规避」规则。

### 步骤 8：编写测试用例
启动 TE subagent 执行 impm-task-coding-testcase 技能，按 TESTCASE-TEMPLATE.MD 模板编写当前任务的测试用例（单元/接口/功能/UI），写入任务目录 testcase.md，并合并到版本测试用例文档（遵守写冲突规避规则）。

### 步骤 9：编码实现
根据任务类型（taskType）启动对应 subagent 执行 impm-task-coding-code 技能实现编码：backend→BEE subagent，frontend→FEE subagent，common→SSE subagent。编码只改本任务对应文件，不越界。

### 步骤 10：编写测试脚本
启动 TE subagent 执行 impm-task-coding-writetest 技能，编写单元测试函数、接口测试自动化脚本（scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py，遵守写冲突规避规则）与功能/UI测试记录文档（版本目录 ui-test-record 文档，遵守写冲突规避规则）。

### 步骤 11：执行测试
启动 TE subagent 执行 impm-task-coding-runtest 技能，执行全部测试并更新测试结果；如果测试失败，回退到步骤 3 重新收集信息并编码，再按序重新执行；连续失败达上限（3次）则中止本任务并向用户报告失败原因。

### 步骤 12：记录任务编码完成
全部测试通过后，调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-task-coding，status={任务编号}-已完成），记录当前任务编码完成；整理任务完成报告返回调度方（PM）：产出文件清单、测试结果、版本目录写入/变更清单（testcase/dbd/api/ui-test-record/api-test 脚本的变更内容）。

## 交付物
- 任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的 context.md、cs.md、ws.md、testcase.md
- 版本数据库设计文档与 SQL 脚本、API 设计文档（如需要变更，已按合并规则写回）
- 任务编码实现代码
- scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py 接口测试脚本（已合并）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-ui-test-record-v{当前版本号}.md 功能/UI测试记录（已合并）
- version_progress.md 中的进度记录（{任务编号} 前缀）

## 完成后提示
- 本步骤完成后，由调度方（impm-coding）串行调度 scm 执行 impm-task-coding-gitcommit 提交当前任务。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->