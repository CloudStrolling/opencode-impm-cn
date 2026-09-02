---
name: impm-tools-secrets-scanning
description: 扫描项目代码与配置文件中的硬编码密钥、Token、密码、私钥、AK/SK、内网 IP 及其他敏感信息，输出泄露检测报告
---

# impm-tools-secrets-scanning 技能

## 触发词
密钥泄露、敏感信息扫描、secrets scanning、secrets detection、硬编码密钥、AK/SK 检测、凭据扫描、tools-secrets-scanning

## 何时使用
需要对当前项目进行敏感信息/密钥泄露检测扫描，检查代码与配置文件中是否存在硬编码密钥、Token、密码、私钥、AK/SK、内网 IP 及其他敏感信息，并输出检测报告时使用。可独立执行，也可在阶段4代码审核后追加执行。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-tools-secrets-scanning，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对检测报告产出文件已生成且内容完整，全部正确后才能结束。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接报告路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 扫描规则模板 | 敏感信息扫描规则清单与报告模板 | 通过 impm_template_reader 读取 TOOLS-SECRETS-SCANNING-TEMPLATE.MD |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 本技能以只读扫描为主：除写入检测报告外，不得修改任何代码、配置与其他文档。
3. 扫描发现的风险等级只能取三种取值：高、中、低；每条发现必须有实际匹配证据，禁止臆测或编造。
4. 高风险发现必须在修复建议中写明具体文件路径、行号与匹配内容摘要（脱敏处理）；中低风险发现须给出修复方向。
5. 所有文档路径必须用 {项目英文缩写} 拼接，不得臆造文件名。
6. 使用 impm_* 工具获取信息，不得编造工具返回结果。
7. 全程使用简体中文。
8. 对匹配到的敏感信息内容，在报告中必须进行脱敏处理（如截断、掩码），不得在报告中完整暴露密钥/密码原文。

## 执行步骤
### 步骤 1：获取项目信息与确定扫描范围
1. 调用 impm_project_info 读取 docs/project.md，获得项目中文名称与项目英文缩写；若 docs/project.md 不存在（项目未初始化），终止本技能并提示先执行 /impm-init 完成初始化。
2. 结合 docs/project.md 的项目地图与源代码目录结构，确定本次扫描范围：源码目录、配置文件目录（config/、conf/、.env*）、部署脚本、依赖清单（如 package.json、requirements.txt、pom.xml 等）。
3. 确定排除目录列表（必须排除）：node_modules、.git、dist、build、vendor、__pycache__、.next、.nuxt、target、bin、obj 等构建/依赖产物目录。

### 步骤 2：读取扫描规则模板
1. 调用 impm_template_reader（templateName=TOOLS-SECRETS-SCANNING-TEMPLATE.MD）读取模板全文，获得报告格式与扫描规则清单。

### 步骤 3：按规则逐类扫描
1. 按模板中的扫描规则编号顺序，使用 Grep 工具逐一执行正则扫描，覆盖全部八大类别：API 密钥/AK/SK、密码/口令、Token/JWT、私钥、数据库连接串、内网 IP 地址、.env/配置文件泄露、其他敏感信息。
2. 每条规则的扫描要求：
   - 使用 Grep 工具在扫描范围内按正则模式搜索，指定 include 参数限定文件类型（如 `*.js,*.ts,*.py,*.java,*.go,*.yaml,*.yml,*.json,*.xml,*.env,*.properties,*.toml,*.ini,*.conf,*.cfg,*.sql,*.sh,*.bat,*.ps1,*.tf,*.hcl` 等，根据项目语言适当增减）。
   - 对于文件路径匹配类规则（如 .env 文件检测），使用 Glob 工具查找匹配文件，再用 Grep 验证内容。
   - 排除已排除目录中的文件。
3. 去重处理：同一文件同一行的同一匹配只记录一次；若不同规则匹配到同一位置，分别记录但标注规则编号。
4. 误报排除：
   - 跳过测试目录中的测试用例凭证（如 test/、tests/、__tests__/、spec/、mock/ 目录下的示例值）。
   - 跳过 node_modules 等依赖目录。
   - 跳过注释中明确标注为示例的凭证（如 `// example:`, `# placeholder`, `/* test */`）。
   - 对高熵字符串规则（SEC-SCAN-31）需二次验证：排除已知非密钥的 Base64 编码（如图片数据、JWT payload 部分等）。

### 步骤 4：风险等级判定
1. 按模板中的规则清单，对每条匹配结果判定风险等级：
   - **高**：硬编码密码/私钥/AK/SK/JWT/Bearer Token 等可直接导致未授权访问的明文凭证（规则 SEC-SCAN-01 ~ SEC-SCAN-21）。
   - **中**：内网 IP、数据库连接串含凭证、.env 文件被跟踪、配置文件中硬编码凭证、身份证号等间接风险（规则 SEC-SCAN-22 ~ SEC-SCAN-30, SEC-SCAN-32）。
   - **低**：高熵字符串、手机号等低风险发现（规则 SEC-SCAN-31, SEC-SCAN-33）。

### 步骤 5：生成检测报告
1. 严格按 TOOLS-SECRETS-SCANNING-TEMPLATE.MD 的格式组织检测报告：
   - 表头信息（项目名称、扫描日期、扫描人=TL、工具依据）。
   - 扫描结论汇总表（按风险类别统计发现数与各等级数量）。
   - 扫描范围说明。
   - 扫描规则清单（保留模板中的全部规则）。
   - 发现明细表（每条发现含编号、规则编号、风险等级、文件路径、行号、匹配内容摘要-脱敏、修复建议）。
   - 修复建议优先级（高/中/低分层给出）。
2. 使用 Write 工具将报告写入 docs/{项目英文缩写}-secrets-scanning.md。
3. 核对文件存在且内容完整：汇总统计与明细数量一致，每条发现均包含必要的路径、行号与修复建议。

### 步骤 6：总结与汇报
1. 统计各类别的发现数量与风险等级分布。
2. 若存在高风险发现，在报告末尾高亮提醒并列出 top 3 最严重发现摘要。

## 交付物
- docs/{项目英文缩写}-secrets-scanning.md（敏感信息/密钥泄露检测报告）

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方（报告路径、发现统计摘要与高风险项摘要）；严禁自行继续执行其他技能。
- 若为独立命令运行，向用户汇报报告位置、发现总数与风险等级分布、高风险项摘要与修复建议。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
