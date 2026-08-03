---
name: impm-task-coding-writetest
description: 按测试用例编写单元测试函数、接口测试 Python 脚本与功能/UI测试记录文档，并回标 testcase.md。
---

# impm-task-coding-writetest 技能

## 触发词
- 编写测试
- 自动化脚本
- writetest

## 何时使用
当前任务编码实现完成后，需要按测试用例编写单元测试、接口测试自动化脚本与功能/UI测试记录时使用。

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

### 步骤 2：读取测试用例并分类编写
调用 impm_doc_reader（docType=testcase，taskId={任务编号}）读取当前任务的测试用例，按测试类型分别编写：
1. 单元测试：按当前开发语言，直接按开发语言的习惯和常用的测试插件，编写单元测试函数；
2. 接口测试：用 python 语言编写接口测试脚本，放入 scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py，每个测试脚本用统一的入口；
3. 功能与UI测试：在版本目录 docs/{项目英文缩写}-v{当前版本号}/ 下新增 {项目英文缩写}-ui-test-record-v{当前版本号}.md，调用 impm_doc_writer（docType=ui-test-record），里面列清楚功能与UI测试的步骤和记录。

### 步骤 3：回标测试用例
根据完成的测试函数和脚本，在 testcase.md 中标注对应的函数位置或者脚本位置（更新任务目录 testcase.md）。

### 步骤 4：记录完成
调用 impm_progress（action=add，stepName=impm-task-coding-writetest，status={任务编号}-已完成）。

## 交付物
- 单元测试函数（随源码提交）
- scripts/API-TEST/{项目英文缩写}-api-test-v{当前版本号}.py 接口测试脚本
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-ui-test-record-v{当前版本号}.md 功能/UI测试记录文档
- 任务目录 testcase.md（已回标测试位置）
- version_progress.md 中的进度记录

## 完成后提示
- 本步骤完成后，由调度方（impm-task-coding / impm-coding）按流程继续执行下一步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
