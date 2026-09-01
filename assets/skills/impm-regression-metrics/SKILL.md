---
name: impm-regression-metrics
description: 在代码审核完成后回填当前版本质量度量报告（阶段二：审核质量度量），统计审核问题数及严重级别分布、修复率，并计算缺陷密度与缺陷移除率 DRE，写入版本 regression.md
---

# impm-regression-metrics 技能

## 触发词
质量度量、缺陷密度、缺陷移除率、DRE、测试覆盖率、修复率、严重级别分布、审核问题统计、regression-metrics、回归质量

## 何时使用
阶段4中，代码审核（impm-coding-review）完成后、版本收尾前，需要将代码审核类质量指标回填到由 impm-regression-test 阶段一生成的 regression.md 质量度量报告时使用。本技能是质量度量的阶段二，与 impm-regression-test 的阶段一共同构成完整的版本质量度量报告。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-regression-metrics，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对产出文件与 version_progress.md 进度记录，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。本技能只负责回归质量度量计算与 regression.md 回填，不得修改任何其他文件。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。计算所用数据必须取自实际读取的审核报告与回归报告，不得虚构数值。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤
### 步骤 1：读取审核报告与阶段一回归质量报告
1. 调用 impm_doc_reader（docType=review，target=version）读取当前版本代码审核报告 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-review.md。
2. 调用 impm_doc_reader（docType=regression，target=version）读取当前版本质量度量报告 docs/{项目英文缩写}-v{当前版本号}/regression.md（阶段一由 impm-regression-test 生成）。
3. 若审核报告缺失，说明本版本未执行代码审核，如实报告并跳过回填（审核类指标标注"未执行"），仍进入步骤 6 记录进度。

### 步骤 2：统计审核问题数及严重级别分布
1. 从审核报告"问题清单"（3.1 安全漏洞 / 3.2 性能陷阱 / 3.3 代码质量 / 3.4 架构合规性 / 3.5 测试覆盖）逐类统计问题总数。
2. 汇总所有问题的"严重程度"（高/中/低），输出严重级别分布统计。
3. 汇总所有问题的"修复状态"，统计已修复数 / 未修复数。

### 步骤 3：计算修复率与缺陷质量指标
1. 修复率 = 已修复问题数 / 审核问题总数 × 100%。
2. 缺陷密度：选择口径并说明——
   - 可选口径一（按代码规模）：缺陷密度 = 审核问题总数 / 本次变更代码规模（KLOC 或新增代码行数，如便于获取）；
   - 可选口径二（按需求规模）：缺陷密度 = 审核问题总数 / 本次版本需求/用户故事总数。
   二选一并在报告说明口径，便于跨版本对比。
3. 缺陷移除率 DRE（Defect Removal Efficiency）：DRE = 已修复（已移除）缺陷数 / 发现缺陷总数 × 100%；以审核问题总数作为发现缺陷总数、已修复数作为已移除数计算。
4. 测试覆盖率：阶段一已按需求/用户故事用例覆盖或工具覆盖写入，如有审核报告测试覆盖评估结论可补充说明。

### 步骤 4：回填 regression.md 审核质量度量章节
1. 依据步骤 2/3 计算结果，按 REGRESSION-TEMPLATE.MD 第 3~5 章格式回填到 regression.md：
   - 3.1 代码审核问题统计（严重级别分布表 + 修复率）；
   - 3.2 缺陷密度；
   - 3.3 缺陷移除率 DRE；
   - 4 达标判定（结合阶段一测试指标对量化目标逐项判定达标/未达标）；
   - 5 结论与建议（含未达标项说明、遗留未修复问题处理建议、跨版本对比参考）。
2. 保留阶段一已写入的"1、2、3.x 测试度量"等已有内容，仅补充/更新审核质量度量与结论章节，不得覆盖删除阶段一内容。
3. 调用 impm_doc_writer（docType=regression，target=version，expectedBase=步骤 1.2 读取到的最新全文）将完整 regression.md 覆盖写回。
4. 核对 regression.md 已回填审核质量度量且内容正确。

### 步骤 5：记录进度
1. 调用 impm_progress add（impm-regression-metrics，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/regression.md（阶段二：已回填审核问题数及严重级别分布、修复率、缺陷密度、DRE 与达标判定、结论）
- version_progress.md 进度记录

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方（产出清单与 version_progress.md 进度状态）；严禁自行继续执行后续技能，后续步骤请由调度方（PM）输入 /impm-project-update、/impm-finish 继续。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
