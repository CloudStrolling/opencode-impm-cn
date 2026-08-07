---
name: impm-task-coding-code
description: 按任务 taskType 由 BEE/FEE/SSE subagent 实现编码，力求简洁清晰，并核对需求覆盖与逻辑正确性。
---

# impm-task-coding-code 技能

## 触发词
- 编码实现
- 编写代码
- code

## 何时使用
当前任务的上下文、数据库设计、API 设计与测试用例就绪后，需要按任务 taskType 实现编码时使用。

## 执行角色
本技能由 sse、fee、bee subagent 负责执行，执行时使用 Skill 工具加载本技能。调度方（impm-task-coding）按任务 taskType 选择对应角色：common→sse、frontend→fee、backend→bee。

## 调度说明（PM/impm-task-coding 启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 由任务 taskType 决定：common→`sse`、frontend→`fee`、backend→`bee`；禁止由调度方自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、任务编号（taskId）、技能名（impm-task-coding-code，要求 subagent 先用 Skill 工具加载本技能再执行）、任务 taskType。
3. 完成要求：等待 subagent 返回完成结果后，核对代码产出与需求覆盖，全部正确后才能进入下一步。

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

### 步骤 2：读取任务上下文
调用 impm_doc_reader（docType=context、docType=cs、docType=ws，taskId={任务编号}），读取任务目录的 context.md、cs.md、ws.md。

### 步骤 3：确认执行角色
根据需求内容判断角色职责：
- 如果是包含前后端的后端业务需求，由 BEE subagent 执行本技能（负责后端业务代码）；
- 如果是包含前后端的前端业务需求，由 FEE subagent 执行本技能（负责前端业务代码）；
- 如果不是包含前后端业务的需求，由 SSE subagent 执行本技能（负责公共/服务端通用代码）；
- 调度由 impm-task-coding 按任务 taskType 决定，本技能正文已写清楚三种角色分支职责。

### 步骤 4：读取数据库设计文件
调用 impm_doc_reader（docType=dbd，target=main）、（docType=dbd，target=version）、（docType=sql，target=version）读取数据库设计文件；如果文件不存在，就不读取。

### 步骤 5：读取 API 设计文件
调用 impm_doc_reader（docType=api，target=main）与（docType=api，target=version）读取接口设计文件；如果文件不存在，就不读取。

### 步骤 6：读取测试用例
调用 impm_doc_reader（docType=testcase，taskId={任务编号}），读取当前任务的测试用例。

### 步骤 7：编写代码
根据上述文件内容编写代码，编码力求简洁，逻辑清晰，函数和文件大小适中，避免超长函数和超长代码文件。

### 步骤 8：自检格式与结构
编写完成后，先检查代码是否有明显的格式、语法问题，函数和文件的功能划分是否合适，结构是否清晰、可读性高。

### 步骤 9：核对需求覆盖
再检查代码是否覆盖了参考上下文中所有的需求，逐条对照 context.md 中的需求点核对。

### 步骤 10：检查逻辑漏洞
最后检查代码逻辑上是否有漏洞和问题（异常处理、边界条件、资源释放、并发安全等）。

### 步骤 11：按需补充资料
编码过程中如果需要，也可以读取 docs/{项目英文缩写}-sad.md、docs/project.md，也可以调用 CS/WS 获取更多现有代码信息和相关资料。

### 步骤 12：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-code，status={任务编号}-已完成）。

## 交付物
- 当前任务对应的编码实现文件
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
