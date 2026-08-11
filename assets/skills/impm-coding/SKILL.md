---
name: impm-coding
description: 编码开发阶段（阶段3）主流程技能，按任务上下游依赖并发调度 impm-task-coding（最多5个并行）与串行调度 impm-task-coding-gitcommit，完成当前版本全部编码任务。
---

# impm-coding 技能

## 触发词
- 开始编码
- 进入编码阶段
- 编码开发
- 阶段3

## 何时使用
impm 瀑布式开发流程完成设计阶段（阶段2）、任务清单 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-task-v{当前版本号}.json 就绪之后，进入编码开发阶段（阶段3），需要按上下游依赖并发调度任务实现全部功能时使用。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。每个编码任务通过 task 工具派发 **TM（Task Manager，subagent_type=tm）subagent** 执行 impm-task-coding；任务编码完成后由 PM 调度 **scm subagent** 串行执行 impm-task-coding-gitcommit 提交。PM 只负责调度、并发控制、检查与决策，不执行具体事务。

## 并发调度规则（本技能核心）
1. **并行度上限**：同一时刻最多同时运行 **5 个** impm-task-coding（每个任务一个 TM subagent）。
2. **可并行条件**：任务没有前置任务，或全部前置任务状态为"已完成"（由 impm_task_manager 判定），即可启动；与当前正在运行的任务无任何依赖关系。
3. **状态标记**：任务启动前必须调用 impm_task_manager（action=update，taskId={任务编号}，status=执行中）标记任务，避免同一任务被重复调度；任务提交完成后（gitcommit）更新为"已完成"。
4. **串行化操作**：impm-task-coding-gitcommit（git 提交与任务状态更新）必须串行执行（一次只提交一个任务），不得并行提交；版本目录共享文档的合并写入按「版本目录写入冲突规避」规则处理。
5. **批次循环**：每次取出一批可并行任务（最多5个），全部完成后回到任务清单重新取下一批，直到无任务可执行。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个编码任务通过 task 工具启动 TM subagent（subagent_type 必须为 `tm`）执行 impm-task-coding；任务完成后通过 task 工具启动 scm subagent（subagent_type 必须为 `scm`）执行 impm-task-coding-gitcommit。禁止 PM 自己代替 subagent 执行具体事务（唯一例外：PM 直接执行的调度与进度记录）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   - impm-task-coding："以 任务经理（subagent_type=tm）身份执行 impm 的 impm-task-coding 技能；先用 Skill 工具加载技能 impm-task-coding；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}；按技能执行步骤完成全部操作后，返回：任务完成报告（产出文件清单、测试结果、版本目录写入清单、version_progress.md 中本任务的进度状态）。"
   - impm-task-coding-gitcommit："以 软件配置工程师（subagent_type=scm）身份执行 impm 的 impm-task-coding-gitcommit 技能；先用 Skill 工具加载技能 impm-task-coding-gitcommit；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、任务编号={taskId}；按技能执行步骤提交本任务全部修改后，返回：git 提交记录与任务状态。"
4. 完成核对：每个 TM 返回后，核对任务目录产出文件存在、测试通过、版本目录写入清单无冲突；全部正确后进入提交环节。提交（gitcommit）串行执行：**同时只有一个 scm subagent 在提交**，前一个提交完成后才启动下一个。
5. 失败处理：任一任务失败时先定位原因，必要时回退重做，不得绕过；连续失败达上限（3次）则中止该任务并向用户报告失败原因，其余任务继续。

### 子步骤 subagent 对照表（impm-coding）
| 子步骤 | 技能名 | subagent_type | 执行方式 |
|----|----|----|----|
| 3 | impm-task-coding | tm | 并发（最多5个，按依赖关系） |
| 3 | impm-task-coding-gitcommit | scm | 串行（一次一个） |

## 版本目录写入冲突规避（必须遵守）
多个任务并行编码时，任务会向版本目录 docs/{项目英文缩写}-v{当前版本号}/ 及共享脚本目录写入内容，存在并发写冲突风险。冲突点与规避规则如下：

| 冲突点 | 写入内容 | 并发冲突 | 规避规则 |
|----|----|----|----|
| version_progress.md | 各任务/子步骤进度行（impm_progress action=add） | 多个任务并发 add 可能覆盖丢失 | 任务编码期间由 TM 记录"执行中/已完成"两类进度（status 带 {任务编号} 前缀，天然区分）；提交阶段由 scm 记录 gitcommit 进度；impm_progress 对相同 (stepName, status) 幂等去重，不产生重复行 |
| {项目英文缩写}-testcase-v{当前版本号}.md | 测试用例合并（impm-task-coding-testcase / impm-task-coding-runtest） | 多任务并发覆盖写 | 写入前必须先 impm_doc_reader（docType=testcase，target=version）读最新全文，在最新内容基础上追加/合并本任务用例后整体写回；禁止基于过期快照整体覆盖 |
| {项目英文缩写}-dbd-v{当前版本号}.md / .sql | 数据库设计文档与脚本（impm-task-coding-dbd） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容基础上追加/合并本任务变更后写回；SQL 按新增对象追加，不重写他人已建对象 |
| {项目英文缩写}-api-v{当前版本号}.md | 接口设计文档（impm-task-coding-api） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容基础上追加/合并本任务接口后写回 |
| {项目英文缩写}-ui-test-record-v{当前版本号}.md | 功能/UI 测试记录（impm-task-coding-writetest） | 多任务并发覆盖写 | 同上：先读最新版本，在最新内容基础上追加本任务测试记录段落后写回 |
| scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py | 接口测试脚本（impm-task-coding-writetest） | 多任务并发覆盖写 | 同上：先读最新脚本，保留他人测试函数，仅新增本任务测试函数与入口注册后写回；或按任务拆分独立测试文件并统一入口引用 |
| {项目英文缩写}-task-v{当前版本号}.json | 任务状态（impm_task_manager update） | 多任务并发更新 | 任务状态更新只允许两处：PM 启动任务时标记"执行中"、scm 提交完成后标记"已完成"；TM 不更新任务状态；提交串行化保证任务 JSON 无并发写 |
| git 提交 | 全部未提交改动（impm_git commit） | 多任务并发 commit 会混入他任务文件 | gitcommit 强制串行执行：前一个任务提交完成并确认后再提交下一个；提交前核对 git status 仅含本任务改动，混入他人进行中文件时暂缓提交 |

**通用规避铁律**：
1. 每个任务只写自己的任务目录 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/ 下的文件（context.md/cs.md/ws.md/testcase.md）与任务对应的代码文件，禁止写其他任务目录。
2. 写任何版本目录共享文档前，必须先用 impm_doc_reader 读取最新内容，在最新内容上合并，禁止基于读取过的旧内容整体覆盖。
3. 写回后立即回读校验自己的内容已存在且他人内容未被破坏，发现丢失立即重新合并写回。
4. 若与正在运行的其他任务需要写同一共享文档（如两个任务同时改 testcase-v 文档），在 impm-coding 层面感知：尽量把同一共享文档的写入任务错开批次调度；无法错开时遵守"读最新-合并-写回"协议。
5. git 提交串行化：任何时刻最多一个 scm 在执行 gitcommit。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由 impm_task_manager 从任务清单获取 |

## 执行要求
1. 严格按照执行步骤执行：任务编码可并发（上限5个），git 提交串行，不得跳过任何任务的编码或提交。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写}、{当前版本号}、{任务编号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个任务完成后，核对产出文件是否存在、内容是否正确、提交是否成功。
7. 本技能为编码流程的一部分，只能被 impm 主流程调度执行，不能单独脱离版本号执行。

## 执行步骤
### 步骤 1：记录编码阶段开始
调用 impm_progress（action=add，projectName={项目英文名称}，version={当前版本号}，stepName=impm-coding，status=执行中），在 version_progress.md 中记录编码开发阶段开始。

### 步骤 2：读取任务清单
调用 impm_task_manager（action=query，projectName={项目英文名称}，version={当前版本号}），读取任务清单中所有状态不为"已完成"的任务，确认剩余任务数量及其上下游依赖关系。

### 步骤 3：并发调度执行任务（批次循环）
重复执行以下批次流程，直到无任务可执行：
1. **计算可并行任务**：调用 impm_task_manager（action=query）获取任务清单，筛选出所有"可执行任务"：状态为"未完成"、且全部前置任务状态为"已完成"；从中选取最多 **5** 个作为本批次（优先选择无前置任务或前置最早完成的任务）。
2. **标记执行中**：对批次内每个任务调用 impm_task_manager（action=update，taskId={任务编号}，status=执行中），防止重复调度。
3. **并行启动编码**：在同一轮内并发启动批次内全部任务的 TM subagent（每个任务一个 task 工具调用，subagent_type=tm），执行 impm-task-coding。
4. **等待并核对**：等待本批次全部 TM 返回；逐个核对任务目录产出（context.md/cs.md/ws.md/testcase.md）、测试结果、版本目录写入清单；失败任务按「通用调度要求-失败处理」处理。
5. **串行提交**：对本批次已成功完成的任务，**逐个串行**启动 scm subagent（subagent_type=scm）执行 impm-task-coding-gitcommit（前一个提交完成后才启动下一个），把任务修改提交到 git 并标记任务"已完成"。
6. 回到本步骤第 1 条，重新计算下一批可并行任务；如果无任务可执行，跳到步骤 4。

### 步骤 4：判断任务是否全部完成
当 impm_task_manager（action=query）显示所有任务状态均为"已完成"时，即所有任务均已完成。

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
