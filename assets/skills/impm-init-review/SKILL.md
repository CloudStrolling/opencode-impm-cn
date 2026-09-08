---
name: impm-init-review
description: 编排初始化阶段全部13个步骤（impm-init-isinit、impm-init-git、impm-init-project、impm-init-version、impm-init-urs、impm-init-prd、impm-init-sad、impm-init-dbd、impm-init-api、impm-init-lld、impm-init-task、impm-init-testcase、impm-init-commit），并在 project/urs/prd/sad/dbd/api/lld/task/testcase 每一步文档生成后先提取文档摘要显示在对话框中、再弹出提示框请用户审核文档，审核通过后才执行下一步。当用户输入 /impm-init-review 或要求初始化 impm 工程并逐文档审核时使用。
---

# impm-init-review 技能

## 触发词
- /impm-init-review
- 初始化
- 初始化项目
- 开始初始化阶段
- impm 初始化流程（含审核）
- 初始化阶段审核

## 何时使用
- 用户输入 /impm-init-review，要求执行 impm 工程初始化阶段并对各文档逐份审核确认时。
- 用户要求对当前项目进行初始化（生成 project、urs、prd、sad、dbd、api、lld、testcase 等文档），并要求在每份文档生成后由用户审核确认再继续下一步时。
- 本技能与 impm-init 步骤一致，区别在于 project/urs/prd/sad/dbd/api/lld/task/testcase 这 9 个文档生成步骤完成后均插入"用户审核确认"环节（先展示文档摘要，再弹出提示框）。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。内部子步骤必须按下方「通用调度要求」派发对应 subagent 执行，PM 只调度、检查与决策；**用户审核确认环节（含文档摘要提取与展示）由 PM 直接执行，不派发 subagent**。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：每个子步骤通过 task 工具启动对应 subagent（subagent_type 必须与下方对照表完全一致）执行对应技能；禁止 PM 自己代替 subagent 执行具体事务（唯一例外：对照表中标注"PM 直接执行"的步骤以及用户审核确认环节）。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、任务编号（{任务编号}，编码阶段适用）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、当前版本号={版本号}、用户输入={原文}、任务编号={taskId}（如适用）；按技能执行步骤完成全部操作后，返回：产出文件路径清单与 version_progress.md 中 {技能名} 的进度状态。"
4. 完成核对：每步 subagent 返回后，核对产出文件存在、version_progress.md 已记录该步骤状态，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-init-review）
| 子步骤 | 技能名 | subagent_type | 是否需用户审核 |
|----|----|----|----|
| a | impm-init-isinit | PM 直接执行 | 否 |
| b | impm-init-git | scm | 否 |
| c | impm-init-project | sa | 是 |
| d | impm-init-version | sa | 否 |
| e | impm-init-urs | ba | 是 |
| f | impm-init-prd | ba | 是 |
| g | impm-init-sad | sa | 是 |
| h | impm-init-dbd | dba | 是 |
| i | impm-init-api | sa | 是 |
| j | impm-init-lld | tl | 是 |
| k | impm-init-task | tl | 是 |
| l | impm-init-testcase | te | 是 |
| m | impm-init-commit | scm | 否 |

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
7. **用户审核确认环节必须等用户明确回复后再继续**：审核未通过时不得进入下一步，需按用户反馈重新生成该文档并再次审核。

## 用户审核确认环节（PM 直接执行）

### 第一步：文档摘要提取与展示（弹窗前置，PM 直接执行）
在每次触发审核提示框之前，PM 必须先提取待审核文档的简明摘要，并以普通文本消息直接显示在当前对话中，供用户快速预览。要求：
1. 读取文档：用 read 工具（或 impm_doc_reader）读取刚生成的文档全文（优先读取版本目录内完整版本文档，仅主文档的读取主文档）。
2. 提取摘要：归纳出简明摘要，一般包括：文档标题与完整路径、文档章节结构、核心内容要点（如项目基本信息、需求目标与关键需求、架构决策与模块划分、数据表/字段清单、接口清单、任务清单规模与分类、测试用例范围等）。
3. 展示方式：摘要以文本形式直接输出到对话中（仅展示用于用户快速预览，**不写入任何文件**，不落盘）；控制篇幅、突出关键信息，避免全文照搬。

### 第二步：弹出审核提示框（question 工具）
**审核选项设计**（question 工具）：
- header：`审核{文档简称}`
- question：`已生成 {文档完整路径}（摘要已在上方对话框中展示），请审核该文档。审核通过后才会进入下一步；如需修改，请选择"需要修改"并填写修改意见。`
- options：
  - `审核通过`（description：文档内容正确，确认进入下一步）
  - `需要修改`（description：文档存在问题，填写修改意见后将重新生成并再次审核）

**处理逻辑**：
1. 若用户选择"审核通过"，核对 version_progress.md 已记录对应步骤状态为"已完成"，进入下一步骤。
2. 若用户选择"需要修改"（或通过自定义输入给出修改意见）：
   - PM 汇总用户修改意见，作为补充上下文重新派发对应的文档生成 subagent（同 subagent_type、同技能）重新生成该文档；
   - 子步骤完成后再次执行"摘要提取与展示"并弹出提示框请用户审核，直到用户选择"审核通过"为止（连续多次未通过可先与用户确认修改意见的可行性，避免无谓反复）；
   - 期间不得推进到下一步骤。
3. 注意：某些步骤可能判定为"无需数据库/无需接口"（如 impm-init-dbd="无需数据库"、impm-init-api="无需接口"）。此时按原 impm-init 处理跳过，不触发审核提示框（无需审核的内容不弹窗），如实记录进度状态后进入下一步；若步骤实际产出文档，则仍需提示用户审核。

## 执行步骤
### 步骤 a：执行 impm-init-isinit（初始化判定，PM 直接执行，不启动 subagent）
加载并执行 impm-init-isinit 技能（先加载技能，再按技能步骤执行）：调用 impm_isinit(projectRoot) 判断当前项目是否已初始化：
- 若 docs/project.md 与 docs/sad.md 都存在且非空：项目已初始化，直接跳过整个初始化阶段，向用户报告判定结论并结束本技能，不再执行后续步骤。
- 若为空项目：按空项目初始化，各文档按模板写入空结构。
- 若为存量项目：按存量项目反推补全各文档。
执行完毕后核对 version_progress.md 中 impm-init-isinit 的进度记录；若子技能未记录（version_progress.md 尚未创建），暂不处理，由步骤 d（impm-init-version）统一补录。将判定结果（空项目/存量项目/已初始化）作为上下文传给后续步骤。（本步骤不触发用户审核。）

### 步骤 b：执行 impm-init-git（git 基线）
启动 SCM subagent（subagent_type=scm）执行 impm-init-git 技能（task 提示词按「通用调度要求」携带上下文，并要求先用 Skill 工具加载技能）：由 SCM 调用 impm_git(projectRoot, status) 判断是否在 git 管理内，未纳入则调用 impm_git(projectRoot, init) 纳入；根据操作系统（Windows）与项目编程语言创建/更新 .gitignore；调用 impm_git(projectRoot, commit, null, 初始化impm项目) 做初始提交。
完成后核对 .gitignore 与提交记录，并核对/补录进度行（impm-init-git，已完成）。（本步骤不触发用户审核。）

### 步骤 c：执行 impm-init-project（项目主文档，含审核）
1. 启动 SA subagent（subagent_type=sa）执行 impm-init-project 技能：由 SA 调用 impm_template_reader(projectRoot, PROJECT-TEMPLATE.MD) 读取模板，结合现有文档与代码情况生成 docs/project.md（impm_doc_writer docType=project target=main，内容包括项目基本信息、编码规范、项目地图等）；信息不足时向用户提问后再填写。
2. 完成后核对 docs/project.md 存在且内容完整，并核对/补录进度行（impm-init-project，已完成）。
3. **审核确认（project）**：按上文「用户审核确认环节」先提取 docs/project.md 摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 d：执行 impm-init-version（版本初始化）
启动 SA subagent（subagent_type=sa）执行 impm-init-version 技能：由 SA 调用 impm_project_info(projectRoot) 获取项目英文缩写；调用 impm_version(projectRoot, init, v0.0.1, {项目中文名称}) 创建版本目录 docs/{项目英文缩写}-v0.0.1；调用 impm_progress(projectRoot, {项目英文缩写}, 0.0.1, init, null, null) 创建 version_progress.md，并补录已完成的初始化步骤记录（impm-init-isinit、impm-init-git、impm-init-project、impm-init-version 均标记已完成）。
完成后核对版本目录与 version_progress.md 存在。（本步骤不触发用户审核。）

### 步骤 e：执行 impm-init-urs（用户需求说明书，含审核）
1. 启动 BA subagent（subagent_type=ba）执行 impm-init-urs 技能：由 BA 调用 impm_template_reader(projectRoot, URS-TEMPLATE.MD) 读取模板，反推或按空结构生成用户需求说明书，impm_doc_writer docType=urs target=version 写入完整版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-urs-v0.0.1.md，再提取摘要写入主文档 docs/{项目英文缩写}-urs.md（不复制完整内容）。
2. 完成后核对版本文档为完整内容、主文档为摘要内容，并核对/补录进度行（impm-init-urs，已完成）。
3. **审核确认（URS）**：按上文「用户审核确认环节」先提取版本文档摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 f：执行 impm-init-prd（产品需求文档，含审核）
1. 启动 BA subagent（subagent_type=ba）执行 impm-init-prd 技能：由 BA 调用 impm_template_reader(projectRoot, PRD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 URS 反推或按空结构生成产品需求文档，impm_doc_writer docType=prd target=version 写入完整版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-prd-v0.0.1.md，再提取摘要写入主文档 docs/{项目英文缩写}-prd.md（不复制完整内容）。
2. 完成后核对版本文档为完整内容、主文档为摘要内容，并核对/补录进度行（impm-init-prd，已完成）。
3. **审核确认（PRD）**：按上文「用户审核确认环节」先提取版本文档摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 g：执行 impm-init-sad（系统架构设计，含审核）
1. 启动 SA subagent（subagent_type=sa）执行 impm-init-sad 技能：由 SA 调用 impm_template_reader(projectRoot, SAD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD 反推或按空结构生成系统架构设计文档，impm_doc_writer docType=sad target=main 写入 docs/sad.md（sad 仅主文档，无版本内文档）。
2. 完成后核对 docs/sad.md 存在且内容完整，并核对/补录进度行（impm-init-sad，已完成）。
3. **审核确认（SAD）**：按上文「用户审核确认环节」先提取 docs/sad.md 摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 h：执行 impm-init-dbd（数据库设计，含审核）
1. 启动 DBA subagent（subagent_type=dba）执行 impm-init-dbd 技能：由 DBA 根据 docs/project.md 与 docs/sad.md 判断是否需要数据库：
   - 无需数据库：仅记录进度行（impm-init-dbd，无需数据库），跳过文档生成，不触发审核。
   - 需要数据库：读取 DBD-TEMPLATE.MD 模板，反推数据库设计文档与初始化 SQL，impm_doc_writer docType=dbd 与 docType=sql 分别写入版本文档并复制到主文档 docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql。
2. 完成后核对文件存在，并核对/补录进度行（impm-init-dbd，已完成）。
3. **审核确认（DBD）**：若实际产出 DBD 文档（状态为"已完成"），按上文「用户审核确认环节」先提取版本文档摘要并展示在对话框中，再弹出提示框请用户审核；若"无需数据库"则不弹窗，进入下一步。

### 步骤 i：执行 impm-init-api（接口设计，含审核）
1. 启动 SA subagent（subagent_type=sa）执行 impm-init-api 技能：由 SA 根据 docs/project.md 与 docs/sad.md 判断是否前后端分离或接口对接、是否需要设计接口：
   - 无需接口：仅记录进度行（impm-init-api，无需接口），跳过文档生成，不触发审核。
   - 需要接口：读取 API-TEMPLATE.MD 模板，反推接口设计文档，impm_doc_writer docType=api target=main 写入版本文档并复制到主文档 docs/{项目英文缩写}-api.md。
2. 完成后核对文件存在，并核对/补录进度行（impm-init-api，已完成）。
3. **审核确认（API）**：若实际产出 API 文档（状态为"已完成"），按上文「用户审核确认环节」先提取版本文档摘要并展示在对话框中，再弹出提示框请用户审核；若"无需接口"则不弹窗，进入下一步。

### 步骤 j：执行 impm-init-lld（详细设计，含审核）
1. 启动 TL subagent（subagent_type=tl）执行 impm-init-lld 技能：由 TL 调用 impm_template_reader(projectRoot, LLD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD、SAD 反推或按空结构生成整体业务逻辑的详细设计文档，impm_doc_writer docType=lld target=main 写入版本文档并复制到主文档 docs/{项目英文缩写}-lld.md。
2. 完成后核对两个文件存在且内容一致，并核对/补录进度行（impm-init-lld，已完成）。
3. **审核确认（LLD）**：按上文「用户审核确认环节」先提取版本文档摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 k：执行 impm-init-task（任务清单，含审核）
1. 启动 TL subagent（subagent_type=tl）执行 impm-init-task 技能：由 TL 调用 impm_template_reader(projectRoot, TASK-TEMPLATE.json) 读取模板，根据 PRD、LLD、SAD 及 API 文档反推任务清单，impm_task_manager action=init 校验并写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-task-v0.0.1.json。
2. 完成后核对文件存在且 JSON 格式正确，并核对/补录进度行（impm-init-task，已完成）。
3. **审核确认（任务清单）**：按上文「用户审核确认环节」先提取任务清单摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 l：执行 impm-init-testcase（测试用例与测试脚本，含审核）
1. 启动 TE subagent（subagent_type=te）执行 impm-init-testcase 技能：由 TE 调用 impm_template_reader(projectRoot, TESTCASE-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD、LLD 确定测试用例，impm_doc_writer docType=testcase target=main 写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md 并复制到主文档 docs/{项目英文缩写}-testcase.md；根据用例完成测试函数编写，并生成自动化测试脚本（scripts/API-TEST/ 下）。
2. 完成后核对文档与脚本存在，并核对/补录进度行（impm-init-testcase，已完成）。
3. **审核确认（测试用例）**：按上文「用户审核确认环节」先提取测试用例文档摘要并展示在对话框中，再弹出提示框请用户审核；审核通过后方可进入下一步。

### 步骤 m：执行 impm-init-commit（最终提交）
启动 SCM subagent（subagent_type=scm）执行 impm-init-commit 技能：由 SCM 调用 impm_git(projectRoot, status) 确认工作区状态，调用 impm_git(projectRoot, commit, null, {项目英文缩写}-v0.0.1-初始化impm项目) 提交所有初始化内容。
完成后核对提交成功。（本步骤不触发用户审核。）

### 步骤 n：记录编排完成并汇报
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-review, 已完成) 记录本编排技能完成；随后调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, finalize, null, null) 在退出前结算进度表最后一行（impm-init-review，已完成）的总耗时与 token（含该步骤主会话与 subagent 子会话消耗）；向用户汇报初始化阶段全部完成，汇报内容包括：初始化方式（空项目/存量项目）、产出文件清单、各步骤执行角色（PM/SCM/SA/BA/DBA/TL/TE）、各文档审核结果、版本进度表位置与下一步建议。

## 交付物
- 版本目录 docs/{项目英文缩写}-v0.0.1/ 及其全部初始化文档
- 主文档 docs/project.md、docs/sad.md、docs/{项目英文缩写}-urs.md、docs/{项目英文缩写}-prd.md、docs/{项目英文缩写}-api.md、docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql、docs/{项目英文缩写}-lld.md、docs/{项目英文缩写}-testcase.md
- 任务清单 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-task-v0.0.1.json
- 版本进度表 version_progress.md
- .gitignore 与 git 初始提交记录
- 自动化测试脚本 scripts/API-TEST/
- 各文档生成后的用户审核确认记录（对话内完成，摘要不落盘）

## 完成后提示
- 初始化阶段已全部完成（含逐文档审核），没有后续步骤。
- 如需查看版本进度，请查看版本目录下的 version_progress.md。
- 如需执行不带文档审核的常规初始化，请输入 /impm-init。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->