---
name: impm-coding
description: 编码开发阶段（阶段3）主流程技能，由 PM 并发调度编码任务（最多5个并行，按阶段波次派发子步骤 subagent），串行提交 git，完成当前版本全部编码任务。
---

# impm-coding 技能

## 触发词
- 开始编码
- 进入编码阶段
- 编码开发
- 阶段3

## 何时使用
impm 瀑布式开发流程完成设计阶段（阶段2）、任务清单 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 就绪之后，进入编码开发阶段（阶段3），需要并发调度实现全部功能时使用。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。**PM 是唯一调度者**：负责挑选可并行任务、按阶段波次并发派发子步骤 subagent、核对产出、串行提交 git。**不引入 TM 角色**，所有子步骤均由 PM 直接派发。PM 只调度、检查与决策，不代替 subagent 执行具体事务。

## 并发调度模型（本技能核心）
1. **并行度上限**：同一时刻最多同时执行 **5** 个编码任务。
2. **可并行条件**：任务状态为"未完成"，且全部前置任务（upstreamTaskIds）状态为"已完成"，即可纳入批次；与当前批次内其他任务是否同时执行由 PM 统一调度。
3. **阶段波次并行**：每个任务按 impm-task-coding 的标准步骤顺序执行：context → cs → ws → dbd(按需) → api(按需) → testcase → code → writetest → runtest。PM 在**同一阶段**为批次内全部适用任务**并发**派发该阶段子步骤 subagent（同一轮多个 task 调用），本阶段全部返回并核对通过后，才进入下一阶段。
4. **状态标记**：批次选定后，立即将批次内每个任务状态标记为"执行中"（impm_task_manager update），防止重复调度；git 提交完成后由 scm 标记为"已完成"。
5. **串行提交**：批次内全部任务完成 runtest 后，对每个成功任务**逐个串行**启动 scm subagent 执行 impm-task-coding-gitcommit（一次只提交一个任务），前一个提交完成确认后再提交下一个。
6. **批次循环**：每批次全部完成（提交完毕）后，重新读取任务清单计算下一批可并行任务，直到无任务可执行。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方「阶段波次 subagent 对照表」完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行具体事务（唯一例外：PM 直接执行的调度、状态标记与进度记录）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}）。
3. task 提示词模板（每个阶段照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}；注意：本子步骤可能与其他任务的同阶段子步骤并行执行，写入版本目录共享文档时必须遵守「版本目录写入冲突规避」规则（先读最新、合并、expectedBase 写回、冲突重试）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态；重要：本子任务的范围仅限本技能本身，完成全部操作后必须立即结束并返回结果，严禁自行继续执行后续阶段、后续任务或等待后续指令（后续调度由 PM 负责）。"
4. 完成核对：每个 subagent 返回后，核对产出文件存在、内容正确、version_progress.md 已记录（{任务编号} 前缀）；本阶段全部 subagent 核对通过后才能进入下一阶段。
5. 失败处理：任一任务任一步骤失败时先定位原因，将该任务放入重试队列单独重跑（见步骤 3.4）；连续失败达上限（3次）则中止该任务（状态置回"未完成"并记录失败原因），其余任务继续，中止任务向用户报告后由人工介入。
6. 卡死重启（心跳检测）：插件对每个 subagent 子会话做心跳监测，子会话未结束但长时间无活动时会被自动中止（abort），告警记录写入 docs/prompts/heartbeat.md。当 task 工具返回中止/卡死类错误，或 heartbeat.md 出现新告警时，视为该 subagent 被强制重启：立即用原提示词重新派发同一技能（重派计入该任务重试上限），必要时先用 impm_heartbeat（action=status）确认无残留卡死会话。

### 阶段波次 subagent 对照表（impm-coding）
| 阶段 | 技能名 | subagent_type | 说明 |
|----|----|----|----|
| 1 | impm-task-coding-context | tl | 收集需求上下文，写任务目录 context.md |
| 2 | impm-task-coding-cs | cs | 查询现有代码，写任务目录 cs.md |
| 3 | impm-task-coding-ws | ws | 查询网络资料，写任务目录 ws.md |
| 4 | impm-task-coding-dbd | dba | 数据库设计变更（项目无需数据库或无变更时自动跳过） |
| 5 | impm-task-coding-api | tl | 接口设计变更（非前后端分离项目或非后端任务时跳过） |
| 6 | impm-task-coding-testcase | te | 编写测试用例并合并到版本测试用例文档 |
| 7 | impm-task-coding-code | sse/fee/bee | 编码实现（按任务 taskType：common→sse、frontend→fee、backend→bee） |
| 8 | impm-task-coding-writetest | te | 编写单元测试函数、接口测试脚本与功能/UI测试记录 |
| 9 | impm-task-coding-runtest | te | 执行全部测试并合并测试结果 |
| 10 | impm-task-coding-gitcommit | scm | git 提交并标记任务完成（串行，一次一个） |

## 版本目录写入冲突规避（必须遵守）
多个任务并行编码时，任务会向版本目录 docs/{项目英文缩写}-v{当前版本号}/ 及共享脚本目录写入内容，存在并发写冲突。**所有存在写入冲突的地方及规避规则如下**：

| 冲突点（文件） | 写入方 | 并发冲突 | 规避规则 |
|----|----|----|----|
| version_progress.md | 全部子步骤 subagent（impm_progress action=add） | 多个 subagent 并发「读-改-写」可能丢失进度行 | 进度状态必须带 {任务编号} 前缀（如 {任务编号}-已完成），天然区分；impm_progress 对相同 (stepName, status) 幂等去重；工具层文件写锁（读改写全程加锁）保证并发不丢行 |
| {项目英文缩写}-testcase-v{当前版本号}.md | testcase / runtest 子步骤 | 多任务并发整体覆盖写 | 写前先 impm_doc_reader（docType=testcase，target=version）读最新全文，在最新内容上追加/合并本任务用例后，以 expectedBase=读取到的全文调用 impm_doc_writer 写回；若返回并发冲突错误（文件已被他人修改），重新读取合并再写；写回后回读校验 |
| {项目英文缩写}-dbd-v{当前版本号}.md / .sql | dbd 子步骤 | 多任务并发覆盖写 | 同上：先读最新，在最新内容上合并本任务表/字段/索引变更（SQL 按新增对象追加，不重写他人已建对象），expectedBase 写回，冲突重试，回读校验 |
| {项目英文缩写}-api-v{当前版本号}.md | api 子步骤 | 多任务并发覆盖写 | 同上：先读最新，合并本任务接口定义，expectedBase 写回，冲突重试，回读校验 |
| {项目英文缩写}-ui-test-record-v{当前版本号}.md | writetest 子步骤 | 多任务并发覆盖写 | 同上：先读最新，在最新内容后追加本任务测试记录段落，expectedBase 写回，冲突重试 |
| scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py | writetest 子步骤 | 多任务并发覆盖写 | 同上：先读最新脚本，保留他人测试函数与入口，仅新增本任务测试函数并注册入口，expectedBase 写回，冲突重试 |
| {项目英文缩写}-task-v{当前版本号}.json | PM（标记"执行中"）、scm（标记"已完成"） | 并发更新互相覆盖 | 任务状态只由 PM 与 scm 独占更新，子步骤 subagent 一律不更新；提交串行化；工具层文件写锁保证并发更新不丢失 |
| git 工作区 | impm_git commit | 并发 commit 会混入他人任务文件 | gitcommit 强制串行：一次只启动一个 scm 提交，前一个提交完成并确认后再提交下一个；提交前 impm_git（action=status）核对工作区改动仅含本任务与已完成任务的文件，若混入其他进行中任务的文件则暂缓提交并报告 PM |

**通用规避铁律**：
1. 每个任务只写自己的任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的文件（context.md/cs.md/ws.md/testcase.md）与本任务对应的代码文件，禁止写其他任务目录。
2. 写任何版本目录共享文档前，必须先用 impm_doc_reader 读取最新内容，在最新内容上合并，写回时传 expectedBase=读取到的全文；工具返回并发冲突错误时重新读取合并后再写，禁止基于旧快照整体覆盖。
3. 写回后立即回读校验：自己的内容已写入且他人内容未被破坏，发现丢失立即重新合并写回。
4. 子步骤 subagent 不更新任务清单 JSON（{项目英文缩写}-task-v{当前版本号}.json）中的任务状态，该操作由 PM/scm 独占。
5. git 提交串行化：任何时刻最多一个 scm 在执行 gitcommit。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由 impm_task_manager 从任务清单获取 |

## 执行要求
1. 任务编码可并发（上限5个，按阶段波次），git 提交串行；不得跳过任何任务的任一阶段。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写}、{当前版本号}、{任务编号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个 subagent 返回后核对产出文件是否存在、内容是否正确；每个任务提交后核对提交成功。
7. 本技能为编码流程的一部分，只能被 impm 主流程调度执行，不能单独脱离版本号执行。

## 执行步骤
### 步骤 1：记录编码阶段开始
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-coding，status=执行中），在 version_progress.md 中记录编码开发阶段开始。

### 步骤 2：读取任务清单并判断项目特性
1. 调用 impm_task_manager（action=query，projectName={项目英文名称}，version={当前版本号}），读取任务清单中所有任务，确认剩余任务数量及其上下游依赖关系。
2. 判断项目特性（用于决定 dbd/api 阶段是否派发）：
   - 项目是否需要数据库：调用 impm_doc_reader（docType=dbd，target=main）查看 docs/{项目英文缩写}-dbd.md 是否存在；
   - 项目是否前后端分离：调用 impm_project_info 读取项目类型。

### 步骤 3：并发调度执行任务（批次循环）
重复执行以下流程，直到无任务可执行：
1. **计算可并行任务**：调用 impm_task_manager（action=query）获取任务清单，筛选所有"可执行任务"：状态为"未完成"、且全部前置任务（upstreamTaskIds）状态为"已完成"；从中选取最多 **5** 个作为本批次（优先选择无前置任务或前置最早完成的任务；若批次内已含同一共享文档写入方，按「版本目录写入冲突规避」尽量错开）。
2. **标记执行中**：对批次内每个任务调用 impm_task_manager（action=update，taskId={任务编号}，status=执行中），防止重复调度。
3. **阶段波次循环**：对批次内全部任务，按 impm-task-coding 的标准步骤顺序，逐阶段执行；**每个阶段为批次内全部适用任务并发派发该阶段 subagent**（同一轮多个 task 调用），本阶段全部返回并核对通过后再进入下一阶段：
   - 阶段 1 context：为批次内每个任务并发启动 tl subagent 执行 impm-task-coding-context；
   - 阶段 2 cs：为批次内每个任务并发启动 cs subagent 执行 impm-task-coding-cs；
   - 阶段 3 ws：为批次内每个任务并发启动 ws subagent 执行 impm-task-coding-ws；
   - 阶段 4 dbd：仅当项目需要数据库（步骤 2 判定）时为批次内每个任务并发启动 dba subagent 执行 impm-task-coding-dbd，否则整批跳过；
   - 阶段 5 api：仅当项目前后端分离且任务 taskType=backend 时为相应任务并发启动 tl subagent 执行 impm-task-coding-api，否则跳过；
   - 阶段 6 testcase：为批次内每个任务并发启动 te subagent 执行 impm-task-coding-testcase；
   - 阶段 7 code：按每个任务 taskType 并发启动对应 subagent（common→sse、frontend→fee、backend→bee）执行 impm-task-coding-code；
   - 阶段 8 writetest：为批次内每个任务并发启动 te subagent 执行 impm-task-coding-writetest；
   - 阶段 9 runtest：为批次内每个任务并发启动 te subagent 执行 impm-task-coding-runtest。
4. **处理失败重试**：本批次某任务任一阶段失败时，将该任务放入重试队列；本批次其他任务继续。批次内全部成功任务完成后，对重试队列中每个任务**单独**重跑步骤序列（阶段1→阶段9），重试仍失败则再次进入重试队列；同一任务连续失败达上限（3次）则中止该任务：调用 impm_task_manager（action=update，status=未完成）置回未完成并记录失败原因，向用户报告后由人工介入，其余任务不受影响。task 返回中止/卡死类错误或 docs/prompts/heartbeat.md 出现该子会话新告警时（心跳检测强制重启），同样按失败重试处理：立即用原提示词重派同一 subagent，重派计入重试上限。
5. **串行提交**：对本批次全部成功完成任务，**逐个串行**启动 scm subagent（subagent_type=scm）执行 impm-task-coding-gitcommit：先启动任务 A 的 scm，等待其提交完成并核对通过后，再启动任务 B 的 scm，依此类推，一次只提交一个任务。
6. 回到本步骤第 1 条，重新计算下一批可并行任务；如果无任务可执行，跳到步骤 4。

### 步骤 4：判断任务是否全部完成
当 impm_task_manager（action=query）显示所有任务状态均为"已完成"时，即所有任务均已完成（被中止任务除外，需人工介入）。

### 步骤 5：记录编码阶段完成
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-coding，status=已完成），在 version_progress.md 中记录编码开发阶段完成；随后调用 impm_progress（action=finalize，projectName={项目英文名称}，version={当前版本号}）在退出前结算进度表最后一行（impm-coding，已完成）的总耗时与 token（含该步骤主会话与 subagent 子会话消耗）。

### 步骤 6：汇报编码阶段完成情况
向用户汇报编码阶段完成情况：当前版本号、任务总数与完成数、每个任务的执行结果摘要、版本目录共享文档的最终合并情况（testcase/dbd/api/ui-test-record/api-test 脚本是否有冲突及处理结果）、git 提交记录（{项目英文缩写}-v{当前版本号}-{任务编号}），并建议下一步进入测试阶段。

## 交付物
- version_progress.md 中新增 impm-coding 执行中/已完成两条进度记录
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 中全部任务状态为"已完成"
- 各任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的全部编码产物
- 版本目录共享文档（testcase/dbd/api/ui-test-record/api-test 脚本）的并发合并结果
- git 提交记录（{项目英文缩写}-v{当前版本号}-{任务编号}）

## 完成后提示
- 本步骤完成后，由调度方（impm 主流程）按流程继续执行下一步骤（测试阶段）。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
