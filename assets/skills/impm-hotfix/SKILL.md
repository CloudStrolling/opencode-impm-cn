---
name: impm-hotfix
description: impm热修复编排技能，3环节轻量完成bug定位到修复（定位分析、修复编码、留存提交），不建版本目录不建分支，直接在main分支提交，仅产出1份修复记录文档供审核。
---

# impm-hotfix 技能

## 触发词
- /impm-hotfix
- 热修复
- bug 修复
- 修复 bug
- hotfix

## 何时使用
项目已初始化（docs/project.md 存在）后，用户报告了 bug，希望快速定位、修复并留痕时使用。本技能追求最快修复速度，不建版本目录不建分支，直接在 main 分支提交，仅维护 1 份追加式修复记录文档。

## 执行角色
本技能由 项目经理（主控 Agent） 负责执行（编排），执行时使用 Skill 工具加载本技能。PM 直接执行的环节（定位分析、留存提交）不启动 subagent；修复编码环节按「通用调度要求」派发对应 subagent 执行。

## 通用调度要求（本技能所有子步骤必须遵守）
1. 启动方式：修复编码环节通过 task 工具启动对应 subagent（subagent_type 由 bug 性质决定：前端页面类 bug→`fee`、后端接口/逻辑类 bug→`bee`、通用类 bug→`sse`）执行 impm-hotfix-fix 技能；PM 直接环节禁止启动 subagent。
2. task 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、用户输入 $ARGUMENTS 原文（含 bug 描述与相关文件路径）、技能名（要求 subagent 先用 Skill 工具加载技能再执行）、根因分析（{根因分析}）、修复方案（{修复方案}）。
3. task 提示词模板（每个子步骤照此填写）：
   "以 {subagent 中文名}（subagent_type={x}）身份执行 impm 的 {技能名} 技能；先用 Skill 工具加载技能 {技能名}；必须携带的上下文：项目根目录={绝对路径}、项目英文缩写={缩写}、用户输入={原文}、根因分析={根因}、修复方案={方案}；按技能执行步骤完成全部操作后，返回：改动文件路径清单与验证结果。"
4. 完成核对：每步 subagent 返回后，核对改动文件与验证结果，全部正确才能进入下一步。
5. 顺序纪律：严格执行顺序，不跳过、不乱序、不并行、不合并；任一子步骤失败时先定位原因，必要时回退重做，不得绕过。

### 子步骤 subagent 对照表（impm-hotfix）
| 子步骤 | 技能名 | subagent_type |
|----|----|----|
| 环节1 定位分析 | PM 直接执行 | — |
| 环节2 修复编码 | impm-hotfix-fix | sse/fee/bee（按 bug 性质） |
| 环节3 留存提交 | PM 直接执行 | — |

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接修复记录路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 根因分析 | 环节1 定位到的 bug 根因 | 环节1 产出 |
| 修复方案 | 环节1 确定的修复方案 | 环节1 产出 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 修复记录路径必须用 {项目英文缩写} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤
### 步骤 1：前置检查（PM 直接执行）
调用 impm_isinit(projectRoot) 判断项目状态：
- 若 docs/project.md 不存在：向用户提示"项目未初始化，请先执行 /impm-init"，本技能结束。
- 若 docs/project.md 存在：继续执行步骤 2（不强制要求 sad.md，hotfix 门槛低于敏捷流程）。

### 步骤 2：定位分析（PM 直接执行）
1. 从用户输入 $ARGUMENTS 提取 bug 描述、报错信息、相关文件/日志路径；信息不足时向用户提问补充（复现步骤、期望行为、实际行为、环境信息）。
2. 用 read/grep/glob 工具定位相关代码，分析根因，确定影响范围与修复方案。
3. 调用 impm_template_reader(projectRoot, HOTFIX-RECORD-TEMPLATE.MD) 读取修复记录模板。
4. 用 read/write 工具维护 docs/{项目英文缩写}-hotfix.md：若文件不存在则按模板创建；若已存在则在末尾追加新一条记录（含日期、bug 描述、根因分析、修复方案）。注意：此文件不在 impm_doc_writer 标准 docType 路径体系内，使用内置文件工具直接维护。

### 步骤 3：修复编码（启动 sse/fee/bee）
1. 按 bug 性质用 task 工具启动对应 subagent（前端页面类→fee、后端接口/逻辑类→bee、通用类→sse）执行 impm-hotfix-fix 技能，提示词按「通用调度要求」携带上下文（含根因分析与修复方案）。
2. 核对 subagent 返回的改动文件清单与验证结果，确认修复完成。

### 步骤 4：留存提交（PM 直接执行）
1. 用 read/write 工具更新 docs/{项目英文缩写}-hotfix.md 中对应记录：补充修复方案执行结果、改动文件清单、验证结果。
2. 调用 impm_git（action=commit，message={项目英文缩写}-hotfix-{日期}-{简述}）将全部修改提交到 main 分支（不建分支、不建版本目录）。
3. 向用户汇报：根因分析、修复方案、改动文件清单、验证结果、提交信息（commit 摘要），并提示后续如需正式归档可执行 /impm-finish 对应步骤。

## 交付物
- docs/{项目英文缩写}-hotfix.md（追加式修复记录，含最新一条修复记录）
- 修复代码与回归测试（随提交入库）
- main 分支提交记录（message：{项目英文缩写}-hotfix-{日期}-{简述}）

## 完成后提示
- 本次热修复已完成，修复记录已写入 docs/{项目英文缩写}-hotfix.md。
- 如需补充正式版本文档，请执行 /impm-docs 对应步骤；如需归档代码注释与审核，请执行 /impm-finish 对应步骤。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
