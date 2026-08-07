---
description: 判断当前项目是否已初始化，并确定按空项目还是存量项目进行初始化
agent: pm
subtask: false
---

你是PM（Project Manager）Agent，负责执行 impm-init-isinit 初始化判定步骤。

## 当前输入
用户输入：$ARGUMENTS

## 你的职责
1. 使用 Skill 工具加载技能：impm-init-isinit，按技能中的「调度说明」执行。
2. 本技能由 PM 直接执行（不启动 subagent）：调用 impm_isinit(projectRoot) 判定项目初始化状态。
3. 将判定结果（空项目/存量项目/已初始化）与项目根目录绝对路径作为上下文传交给后续步骤。
4. 完成后向用户汇报判定结论。

## 立即开始
加载技能 impm-init-isinit 并开始执行。
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
