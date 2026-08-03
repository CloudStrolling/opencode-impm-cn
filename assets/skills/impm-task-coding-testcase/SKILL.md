---
name: impm-task-coding-testcase
description: 按 TESTCASE-TEMPLATE.MD 模板为当前任务编写覆盖单元/接口/功能/UI测试的测试用例，并同步更新版本测试用例文档。
---

# impm-task-coding-testcase 技能

## 触发词
- 编写测试用例
- testcase
- 测试用例

## 何时使用
单任务编码时，需要在编码前按模板编写当前任务的测试用例，并同步到版本测试用例文档时使用。

## 执行角色
本技能由 te subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

### 步骤 3：读取数据库设计文件
调用 impm_doc_reader（docType=dbd，target=main）与（docType=dbd，target=version）读取数据库设计文件；如果文件不存在，就不读取。

### 步骤 4：读取 API 设计文件
调用 impm_doc_reader（docType=api，target=main）与（docType=api，target=version）读取接口设计文件；如果文件不存在，就不读取。

### 步骤 5：读取既有测试用例
调用 impm_doc_reader（docType=testcase，target=main）与（docType=testcase，target=version）读取此前的测试用例；如果文件不存在，就不读取。

### 步骤 6：创建任务测试用例
根据当前任务需求，参考当前版本的测试用例，套用 impm_template_reader 读取的 TESTCASE-TEMPLATE.MD 模板文件，创建当前任务的测试用例，调用 impm_doc_writer（docType=testcase，taskId={任务编号}）写入 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/testcase.md。

### 步骤 7：覆盖四种测试类型
测试用例中应包含测试类型：单元测试、接口测试、功能测试、UI测试。

### 步骤 8：检查测试覆盖率
分别检查不同测试类型的测试覆盖率，及时修正测试用例文件，尽量提高覆盖率，避免漏测。

### 步骤 9：同步版本测试用例文档
根据当前任务的测试用例，对比并更新版本测试用例文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md 中与之不同的测试用例，调用 impm_doc_writer（docType=testcase，target=version）。

### 步骤 10：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-testcase，status={任务编号}-已完成）。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/testcase.md
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md（已同步更新）
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
