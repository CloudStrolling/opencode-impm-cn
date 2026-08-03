---
name: impm-task-coding-runtest
description: 执行当前任务全部测试并更新测试结果，全部通过后把任务测试用例合并更新到版本测试用例文档。
---

# impm-task-coding-runtest 技能

## 触发词
- 执行测试
- 运行测试
- runtest

## 何时使用
当前任务的测试函数与测试脚本编写完成后，需要执行全部测试、确认测试结果并更新文档时使用。

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

### 步骤 2：读取测试用例
调用 impm_doc_reader（docType=testcase，taskId={任务编号}），读取当前任务的测试用例。

### 步骤 3：执行测试
根据当前任务的测试用例，找到对应的测试函数和测试脚本，并执行测试脚本（单元测试、接口测试、功能/UI测试）。

### 步骤 4：更新测试结果
每一个测试完成后，更新当前任务的测试用例的测试通过情况（更新任务目录 testcase.md，标注通过/失败及失败原因）。

### 步骤 5：处理失败
全部测试完成后，如果其中有部分测试失败：
1. 把报错信息加入上下文；
2. 由调度方（impm-task-coding）回退到 impm-task-coding-context 重新收集信息并编码，再按流程重新执行；
3. 连续失败达上限（3次）则中止本任务并向用户报告。

### 步骤 6：确认全部通过
如果全部测试都成功，表明当前任务编码已成功完成。

### 步骤 7：合并版本测试用例
将当前任务的测试用例 docs/{项目英文缩写}-v{当前版本号}/task_{任务编号}/testcase.md 合并、更新到当前版本的测试用例 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md，调用 impm_doc_writer（docType=testcase，target=version）。

### 步骤 8：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-runtest，status={任务编号}-已完成）。

## 交付物
- 任务目录 testcase.md（已更新测试通过情况）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md（已合并更新）
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
