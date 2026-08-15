---
name: impm-sprint-code
description: 敏捷冲刺编码子技能，由SSE/FEE/BEE按任务taskType直接实现编码，跳过context/cs/ws/testcase前置子技能，需求上下文由编排技能直接传入。
---

# impm-sprint-code 技能

## 触发词
- 敏捷编码
- sprint 编码
- 快速编码
- sprint-code

## 何时使用
impm-sprint 编排技能（环节3）获取到下一个可执行任务后，需要快速实现该任务编码时使用。本技能为敏捷流程专用，跳过瀑布式编码的 context/cs/ws/testcase 等前置子技能，由调度方直接传入需求上下文。

## 执行角色
本技能由 sse、fee、bee subagent 负责执行，执行时使用 Skill 工具加载本技能。调度方（impm-sprint）按任务 taskType 选择对应角色：common→sse、frontend→fee、backend→bee。

## 调度说明（PM/impm-sprint 启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 由任务 taskType 决定：common→`sse`、frontend→`fee`、backend→`bee`；禁止由调度方自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、任务编号（taskId）、技能名（impm-sprint-code，要求 subagent 先用 Skill 工具加载本技能再执行）、任务 taskType、需求简报要点（本次任务的需求描述与验收标准）。
3. 完成要求：等待 subagent 返回完成结果后，核对代码产出与需求覆盖，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 由调度方（PM）传入 |
| 任务编号 | 当前执行的任务编号（如 TASK-001） | 由调度方（PM）传入 |
| 需求简报要点 | 本次任务的需求描述与验收标准 | 由调度方（PM）传入 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 使用 impm_* 工具获取信息，不得编造工具返回结果。
4. 全程使用简体中文。
5. 本技能为敏捷流程的一部分，只能被 impm-sprint 调度执行，不能单独脱离版本号和任务编号执行。

## 执行步骤
### 步骤 1：接收上下文
接收调度方传入的当前版本号、任务编号与需求简报要点，确认任务存在（可通过 impm_task_manager action=query 校验）。

### 步骤 2：读取需求简报
调用 impm_doc_reader（docType=urs，target=version）读取需求简报 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-urs-v{当前版本号}.md，结合调度方传入的需求简报要点，明确本任务的需求范围与验收标准。

### 步骤 3：查询现有代码（按需）
直接用 read/grep/glob 工具查询本项目相关代码与可复用模块（不启动 cs subagent）；如项目存在 docs/sad.md、docs/{项目英文缩写}-api.md、docs/{项目英文缩写}-dbd.md 等主文档，按需读取其中与本任务相关的部分。

### 步骤 4：编写代码
根据需求简报与现有代码编写代码，编码力求简洁，逻辑清晰，函数和文件大小适中，避免超长函数和超长代码文件；逐条覆盖需求简报中的验收标准。

### 步骤 5：自检质量
编写完成后检查：代码是否有明显的格式、语法问题；逻辑上是否有漏洞（异常处理、边界条件、资源释放、并发安全等）；是否覆盖了需求简报中的全部验收标准。

### 步骤 6：记录完成
调用 impm_progress（action=add，stepName=impm-sprint-code，status={任务编号}-已完成）。

## 交付物
- 当前任务对应的编码实现文件
- version_progress.md 中的进度记录

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方：产出文件路径清单与 version_progress.md 中本技能的进度状态；严禁自行继续执行后续阶段或后续任务、严禁等待后续指令，后续调度由调度方（PM/impm-sprint）负责。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
