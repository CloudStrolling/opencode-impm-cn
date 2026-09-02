# 更新日志

本项目版本号遵循语义化版本（SemVer）：主版本.次版本.修订版本。

## [0.8.4] - 2026-09-01

### 新增
- 版本质量度量报告（regression.md）：回归测试阶段（impm-regression-test）新增阶段一质量度量输出，汇总单元/接口测试用例数与通过率、测试覆盖率（需求/用户故事用例覆盖）写入 docs/{项目英文缩写}-v{当前版本号}/regression.md
- 质量度量回填技能与命令（impm-regression-metrics / /impm-regression-metrics，TL 执行）：在代码审核（impm-coding-review）完成后回填阶段二审核质量度量，统计代码审核问题数及严重级别分布、修复率，并计算缺陷密度、缺陷移除率 DRE、量化目标达标判定，与阶段一共同构成完整回归质量度量报告
- regression.md 映射新增 docType（regression）接入 doc_reader/doc_writer 标准路径（版本目录 regression.md），模板 REGRESSION-TEMPLATE.MD
- impm-finish 阶段4流程新增 impm-regression-metrics 步骤（置于 coding-review 之后），阶段4子步骤由 8 个增至 9 个
- 需求分析文档审核技能（impm-docs-review / /impm-docs-review）：在 impm-docs 基础上，为 urs/prd/sad/dbd/api/lld/task 每步文档生成后增加"用户审核确认"环节（PM 通过 question 工具弹出提示框），审核通过才进入下一步；需要修改时按用户反馈重新生成再审
- 文档审核版总流程技能（impm-review-edition / /impm-review-edition）：与 impm 全流程一致，仅将需求分析整理阶段由 impm-docs 替换为 impm-docs-review，实现全流程开发过程中的逐文档用户审核

### 更新
- impm-regression-test 技能描述与执行要求同步调整，明确阶段一测试度量与阶段二审核度量（impm-regression-metrics）两阶段协同生成同一份 regression.md
- impm 总流程技能阶段四步骤清单同步补入 impm-regression-metrics（回归测试→代码备注→代码审核→质量度量回填→项目地图更新→文档合并→readme/agent→部署方案→合并主分支）

## [0.8.3] - 2026-09-01

### 新增
- 需求追踪矩阵（RTM）技能与命令（impm-rtm-create / /impm-rtm-create，TL 执行）：在 impm-task-create 之后新增步骤，根据当前版本 URS 需求（FR/NFR）、PRD 用户故事（US）、LLD 设计与任务清单，建立"需求 → 设计 → 任务"的多对多追踪矩阵，生成 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-rtm-v{当前版本号}.md，并执行覆盖完整度校验、输出问题清单
- impm 总流程技能与 impm-docs 阶段编排技能同步纳入 impm-rtm-create 步骤（版本创建→URS→PRD→SAD→DBD→API→LLD→任务清单→RTM→git提交，共 10 步）
- impm_regression_test（回归测试）新增 RTM 测试用例回填与覆盖校验环节：将测试用例（TC）按关联需求/用户故事回填到 rtm.md，并校验每个原始需求与用户故事是否均有设计、任务、测试用例，缺口标注到 RTM 问题清单
- RTM 文档类型接入 doc_reader/doc_writer 标准路径（{缩写}-rtm-v{版本号}.md / 主文档 {缩写}-rtm.md），模板 RTM-TEMPLATE.MD

## [0.8.2] - 2026-08-26

### 新增
- 等保三级检查技能与命令（impm-tools-cpc-level3 / /impm-tools-cpc-level3，TL 执行）：依据 GB/T 22239-2019《信息安全技术 网络安全等级保护基本要求》第三级安全要求，整理软件开发相关核心条款生成代码审查 CheckList 模板（TOOLS-CPC-LEVEL3-TEMPLATE.MD，覆盖开发过程管理、身份鉴别、访问控制、安全审计、入侵防范、数据安全、个人信息保护、测试验收共 38 项）
- 技能执行时逐项核查当前项目并输出检查报告 docs/{项目英文缩写}-cpc-level3-check.md，检查结果分为通过、不通过、不适用三种；不通过项附具体说明（文件位置与问题描述）

## [0.8.1] - 2026-08-26

### 新增
- impm_progress 步骤完成输出附带当前时间：init 写入首行、add 插入/去重、finalize 结算时，返回消息统一附加"当前时间：yyyy-MM-dd HH:mm:ss"，并新增 currentTime 字段，保证每次向对话框输出步骤完成时都能看到当前时间

## [0.8.0] - 2026-08-25

### 新增
- 代码审核技能（impm-coding-review）新增问题修复环节：审核完成后，对有必要修复或可修复且便于修复的问题直接予以修复
- 审核报告模板（REVIEW-TEMPLATE.MD）问题清单新增"修复状态"列，已修复问题标注"已修复"，未修复问题标注"未修复"并说明原因

### 更新
- impm-coding-review 技能描述与执行要求同步调整：由"只审核、不修复"改为"审核为主、修复为辅"

## [0.7.3] - 2026-08-22

### 新增
- 运行 API 接口测试前自动检测 python 环境（按「shell python → conda → uv」顺序），均不可用时提示先安装 python（官方安装包 / conda / uv 均可）
- readme 环境要求、接口测试运行环境说明与 agent.md（TE）补充 python 环境说明

## [0.7.1] - 2026-08-21

### 修复
- 初始化阶段的 API 测试文件与接口用例脚本同步修改

## [0.7.0] - 2026-08-21

### 更新
- 调整 API 测试方式

## [0.6.4] - 2026-08-16

### 优化
- 并行批次内多个任务可一次批量提交，无需按任务单独多次提交

## [0.6.3] - 2026-08-15

### 优化
- 调用后续技能的描述优化

## [0.6.2] - 2026-08-14

### 优化
- 更新默认使用的模型，降低成本

## [0.6.1] - 2026-08-13

### 新增
- 添加对 Apifox 的支持

## [0.6.0] - 2026-08-11

### 新增
- 编码开发阶段任务并行调度：按上下游依赖并发执行（最多 5 个任务并行），Git 提交串行

## [0.5.4] - 2026-08-13

### 其他
- 占位空提交（0.5.3 已包含重写的并行任务功能）

## [0.5.3] - 2026-08-13

### 修复
- 版本进度表 `impm_progress` 已知步骤名缺失敏捷冲刺（impm-sprint）步骤，导致 `/impm-sprint` 流程进度记录失败
- `impm_progress` 未显式传 version 时自动使用最新版本目录，与文档工具行为一致

### 优化
- 清理未使用代码（VERSIONED_DOC_TYPES、TASK_DOC_TYPES、isDirEmpty、extractVersionFromFileName）
- 目录排除清单 EXCLUDED_DIRS 收敛到 utils/paths.ts 单点维护
- readme 更新：版本徽章、技能/命令/模板计数、编码阶段并行调度说明
- prompt-recorder 运行时产物（docs/prompts/）不再入库

## [0.5.2] - 2026-08-13

### 其他
- 安装脚本（install.mjs / install.ps1）与 readme 更新

## [0.5.1] - 2026-08-10

### 优化
- 版本进度表增加总耗时与 token 消耗统计（输入/输出/缓存命中/缓存写入/总 token）

## [0.5.0] - 2026-08-09

### 新增
- 敏捷冲刺流程 `/impm-sprint`（需求简报、版本与任务、编码、测试、汇总留存、提交合并）
- 热修复流程 `/impm-hotfix`（定位分析、修复编码、留存提交，main 分支直接提交）
- prompt-recorder 内置功能：提问记录、token 回填、对话导出

## [0.4.3] - 2026-08-01

### 修复
- readme 文档更新与安装脚本（install.mjs / install.ps1）稳定性修复

## [0.4.2] - 2026-07-28

### 新增
- 代码注释技能 `/impm-coding-comment`：为版本更新代码补充中文注释

## [0.4.1] - 2026-07-25

### 其他
- 全项目添加 Apache License 2.0 许可
