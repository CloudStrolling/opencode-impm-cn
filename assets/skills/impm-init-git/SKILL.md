---
name: impm-init-git
description: 将当前项目纳入 git 管理，根据操作系统与项目编程语言创建/更新 .gitignore，并完成初始提交。当初始化阶段需要建立 git 基线时使用。
---

# impm-init-git 技能
## 触发词
- git 初始化
- 初始提交
- .gitignore
- 纳入版本管理

## 何时使用
- 初始化阶段的 git 步骤（/impm-init-git）执行时。
- 项目尚未纳入 git 管理，需要建立 git 基线与初始提交时。

## 执行角色
本技能由 SCM subagent 负责执行。执行时使用 Skill 工具加载本技能。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号（初始化阶段固定为 0.0.1） | 通过 impm_version 获取或从版本目录名推断 |
| 项目编程语言 | 项目的编程语言，用于确定 .gitignore 忽略项 | 通过 impm_project_info 从 docs/project.md 读取 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。

## 执行步骤
### 步骤 1：检查并纳入 git 管理
调用 impm_git(projectRoot, status) 判断当前项目目录是否在 git 管理内：
- 已在 git 管理内：跳过纳入步骤，继续执行步骤 2。
- 未在 git 管理内：调用 impm_git(projectRoot, init) 将项目纳入 git 管理，并核对 git 仓库初始化成功。

### 步骤 2：创建/更新 .gitignore
1. 直接读取技能模板文件 `.opencode/skills/template/GITIGNORE-TEMPLATE`（该文件与本技能文件同级目录下，相对路径为 `../template/GITIGNORE-TEMPLATE`），以模板内容为基础创建或更新项目根目录的 .gitignore。
2. 根据项目编程语言（通过 impm_project_info 获取）与操作系统（Windows），从模板中裁剪调整：
   - 保留与项目相关的语言段（如前端/Node.js、Python、Java、Rust、Go、PHP 等）；
   - 删除与项目无关的语言段，避免误伤无关文件；
   - 操作系统、IDE、AI 开发工具等通用段保持不变；
   - 必要时补充项目特有的排除项（如框架产物、私有配置等）。
3. 若 .gitignore 已存在，对照模板检查是否有遗漏或需要更新的地方，并直接更新。
4. 核对 .gitignore 已包含关键忽略项：
   - 依赖目录：node_modules、vendor、.venv 等（按编程语言调整）
   - 构建产物：dist、build、out、target、__pycache__ 等（按编程语言调整）
   - 工具与配置目录：.opencode、.idea、.vscode、*.iml、.DS_Store
   - 日志与临时文件：*.log、tmp、temp、*.tmp
   - 环境与密钥：.env、*.local、.secret（密钥类文件一律不提交）

### 步骤 3：初始提交
调用 impm_git(projectRoot, commit, null, 初始化impm项目) 做一次初始提交，提交当前全部初始化内容，并通过 impm_git(projectRoot, status) 或 log 核对提交成功。

### 步骤 4：记录进度
若 version_progress.md 已存在，调用 impm_progress(projectRoot, {项目英文缩写}, {当前版本号}, add, impm-init-git, 已完成) 记录本步骤完成；若 version_progress.md 尚不存在（impm-init-version 未执行），跳过进度记录，由 impm-init-version 统一补录。

## 交付物
- git 仓库（若此前未纳入 git 管理）
- 项目根目录 .gitignore
- 初始提交记录（message：初始化impm项目）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-init-project
- 如需继续执行本阶段后续所有步骤，请输入 /impm-init
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
