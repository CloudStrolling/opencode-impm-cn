---
name: impm-init
description: 编排初始化阶段全部12个步骤（impm-init-isinit、impm-init-git、impm-init-project、impm-init-version、impm-init-urs、impm-init-prd、impm-init-sad、impm-init-dbd、impm-init-api、impm-init-lld、impm-init-testcase、impm-init-commit），严格按顺序依次执行并汇报结果。当用户输入 /impm-init 或要求初始化 impm 工程时使用。
---

# impm-init 技能
## 触发词
- /impm-init
- 初始化
- 初始化项目
- 开始初始化阶段
- impm 初始化流程

## 何时使用
- 用户输入 /impm-init，要求执行 impm 工程初始化阶段时。
- 用户要求对当前项目进行初始化（生成 project、urs、prd、sad、dbd、api、lld、testcase 等文档）时。

## 执行角色
本技能由 PM subagent 负责执行。执行时使用 Skill 工具加载本技能。

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

## 执行步骤
### 步骤 a：执行 impm-init-isinit（初始化判定）
加载并执行 impm-init-isinit 技能：调用 impm_isinit(projectRoot) 判断当前项目是否已初始化：
- 若 docs/project.md 与 docs/sad.md 都存在且非空：项目已初始化，直接跳过整个初始化阶段，向用户报告判定结论并结束本技能，不再执行后续步骤。
- 若为空项目：按空项目初始化，各文档按模板写入空结构。
- 若为存量项目：按存量项目反推补全各文档。
执行完毕后核对 version_progress.md 中 impm-init-isinit 的进度记录；若子技能未记录（version_progress.md 尚未创建），暂不处理，由步骤 d（impm-init-version）统一补录。

### 步骤 b：执行 impm-init-git（git 基线）
加载并执行 impm-init-git 技能：调用 impm_git(projectRoot, status) 判断是否在 git 管理内，未纳入则调用 impm_git(projectRoot, init) 纳入；根据操作系统（Windows）与项目编程语言创建/更新 .gitignore；调用 impm_git(projectRoot, commit, null, 初始化impm项目) 做初始提交。核对 .gitignore 与提交记录，并核对/补录进度行（impm-init-git，已完成）。

### 步骤 c：执行 impm-init-project（项目主文档）
加载并执行 impm-init-project 技能：调用 impm_template_reader(projectRoot, PROJECT-TEMPLATE.MD) 读取模板，结合现有文档与代码情况生成 docs/project.md（impm_doc_writer docType=project target=main，内容包括项目基本信息、编码规范、项目地图等）；信息不足时向用户提问后再填写。核对 docs/project.md 存在且内容完整，并核对/补录进度行（impm-init-project，已完成）。

### 步骤 d：执行 impm-init-version（版本初始化）
加载并执行 impm-init-version 技能：调用 impm_project_info(projectRoot) 获取项目英文缩写；调用 impm_version(projectRoot, init, v0.0.1, {项目中文名称}) 创建版本目录 docs/{项目英文缩写}-v0.0.1；调用 impm_progress(projectRoot, {项目英文缩写}, 0.0.1, init, null, null) 创建 version_progress.md，并补录已完成的初始化步骤记录（impm-init-isinit、impm-init-git、impm-init-project、impm-init-version 均标记已完成）。核对版本目录与 version_progress.md 存在。

### 步骤 e：执行 impm-init-urs（用户需求说明书）
加载并执行 impm-init-urs 技能：调用 impm_template_reader(projectRoot, URS-TEMPLATE.MD) 读取模板，反推或按空结构生成用户需求说明书，impm_doc_writer docType=urs target=main 写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-urs-v0.0.1.md 并复制到主文档 docs/{项目英文缩写}-urs.md。核对两个文件存在且内容一致，并核对/补录进度行（impm-init-urs，已完成）。

### 步骤 f：执行 impm-init-prd（产品需求文档）
加载并执行 impm-init-prd 技能：调用 impm_template_reader(projectRoot, PRD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 URS 反推或按空结构生成产品需求文档，impm_doc_writer docType=prd target=main 写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-prd-v0.0.1.md 并复制到主文档 docs/{项目英文缩写}-prd.md。核对两个文件存在且内容一致，并核对/补录进度行（impm-init-prd，已完成）。

### 步骤 g：执行 impm-init-sad（系统架构设计）
加载并执行 impm-init-sad 技能：调用 impm_template_reader(projectRoot, SAD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD 反推或按空结构生成系统架构设计文档，impm_doc_writer docType=sad target=main 写入 docs/sad.md（sad 仅主文档，无版本内文档）。核对 docs/sad.md 存在且内容完整，并核对/补录进度行（impm-init-sad，已完成）。

### 步骤 h：执行 impm-init-dbd（数据库设计）
加载并执行 impm-init-dbd 技能：根据 docs/project.md 与 docs/sad.md 判断是否需要数据库：
- 无需数据库：仅记录进度行（impm-init-dbd，无需数据库），跳过文档生成。
- 需要数据库：读取 DBD-TEMPLATE.MD 模板，反推数据库设计文档与初始化 SQL，impm_doc_writer docType=dbd 与 docType=sql 分别写入版本文档并复制到主文档 docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql。
核对文件存在，并核对/补录进度行（impm-init-dbd，已完成）。

### 步骤 i：执行 impm-init-api（接口设计）
加载并执行 impm-init-api 技能：根据 docs/project.md 与 docs/sad.md 判断是否前后端分离或接口对接、是否需要设计接口：
- 无需接口：仅记录进度行（impm-init-api，无需接口），跳过文档生成。
- 需要接口：读取 API-TEMPLATE.MD 模板，反推接口设计文档，impm_doc_writer docType=api target=main 写入版本文档并复制到主文档 docs/{项目英文缩写}-api.md。
核对文件存在，并核对/补录进度行（impm-init-api，已完成）。

### 步骤 j：执行 impm-init-lld（详细设计）
加载并执行 impm-init-lld 技能：调用 impm_template_reader(projectRoot, LLD-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD、SAD 反推或按空结构生成详细设计文档，impm_doc_writer docType=lld target=main 写入版本文档并复制到主文档 docs/{项目英文缩写}-lld.md。核对两个文件存在且内容一致，并核对/补录进度行（impm-init-lld，已完成）。

### 步骤 k：执行 impm-init-testcase（测试用例与测试脚本）
加载并执行 impm-init-testcase 技能：调用 impm_template_reader(projectRoot, TESTCASE-TEMPLATE.MD) 读取模板，根据项目代码、文档及 PRD、LLD 确定测试用例，impm_doc_writer docType=testcase target=main 写入版本文档 docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-testcase-v0.0.1.md 并复制到主文档 docs/{项目英文缩写}-testcase.md；根据用例完成测试函数编写，并生成自动化测试脚本（scripts/API-TEST/ 下）。核对文档与脚本存在，并核对/补录进度行（impm-init-testcase，已完成）。

### 步骤 l：执行 impm-init-commit（最终提交）
加载并执行 impm-init-commit 技能：调用 impm_git(projectRoot, status) 确认工作区状态，调用 impm_git(projectRoot, commit, null, {项目英文缩写}-v0.0.1-初始化impm项目) 提交所有初始化内容，核对提交成功。

### 步骤 m：记录编排完成并汇报
调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init, 已完成) 记录本编排技能完成；向用户汇报初始化阶段全部完成，汇报内容包括：初始化方式（空项目/存量项目）、产出文件清单、各步骤执行角色（PM/SCM/SA/BA/DBA/TL/TE）、版本进度表位置与下一步建议。

## 交付物
- 版本目录 docs/{项目英文缩写}-v0.0.1/ 及其全部初始化文档
- 主文档 docs/project.md、docs/sad.md、docs/{项目英文缩写}-urs.md、docs/{项目英文缩写}-prd.md、docs/{项目英文缩写}-api.md、docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql、docs/{项目英文缩写}-lld.md、docs/{项目英文缩写}-testcase.md
- 版本进度表 version_progress.md
- .gitignore 与 git 初始提交记录
- 自动化测试脚本 scripts/API-TEST/

## 完成后提示
- 初始化阶段已全部完成，没有后续步骤。
- 如需查看版本进度，请查看版本目录下的 version_progress.md。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
