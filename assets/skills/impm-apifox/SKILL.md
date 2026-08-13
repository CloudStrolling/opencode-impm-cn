---
name: impm-apifox
description: 根据当前版本的 API 设计文档与测试用例文档，生成可供 Apifox 导入的接口信息文件（OpenAPI 3.0 JSON）与 API 用例测试信息文件（Postman Collection v2.1 JSON），存入当前版本目录
---

# impm-apifox 技能

## 触发词
apifox、接口导入、用例导入、apifox导出文件、接口信息文件、API用例文件

## 何时使用
阶段4中，代码审核完成后，需要将当前版本设计的全部接口信息与接口用例导出为 Apifox 可识别的导入文件时使用。导入后可在 Apifox 中直接查看接口文档、调试与测试。

## 执行角色
本技能由 文档编写（subagent_type=dw）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `dw`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-apifox，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对产出文件与 version_progress.md 进度记录，全部正确后才能进入下一步。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文名称 | 项目的英文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接所有文档路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 当前版本号 | 当前执行的版本号 | 通过 impm_version action=current 获取，或从版本目录名推断 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 只执行本技能规定的操作，不做与任务无关的工作。
3. 所有文档路径必须用 {项目英文缩写} 和 {当前版本号} 拼接，不得臆造文件名。
4. 使用 impm_* 工具获取信息，不得编造工具返回结果。
5. 全程使用简体中文。
6. 每个步骤完成后，核对产出文件是否存在、内容是否正确。
7. 生成的 JSON 必须格式合法（可被 JSON.parse 解析），字段含义以模板注释与 API/测试用例文档为准；文档中未定义的字段不得臆造填充。

## 执行步骤
### 步骤 1：读取当前版本 API 设计文档
1. 调用 impm_doc_reader（docType=api，target=version）读取 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md。
2. 提取全部接口信息：接口路径、请求方法、请求头、Query/Path 参数、请求体（Body）结构与示例、响应体结构与示例、认证鉴权方式、通用错误码。

### 步骤 2：读取当前版本测试用例文档
1. 调用 impm_doc_reader（docType=testcase，target=version）读取 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-testcase-v{当前版本号}.md。
2. 提取全部接口类测试用例：用例 ID、用例名称、所属接口、前置条件、测试步骤（请求参数与预期结果）、断言信息。
3. 若测试用例文档中无接口类测试用例，则本步骤提取结果为空，进入下一步时仅生成不含用例的用例文件并在用例文件中注释说明。

### 步骤 3：读取 Apifox 导出模板
1. 调用 impm_template_reader 读取 APIFOX-OPENAPI-TEMPLATE.json 模板（接口信息结构）。
2. 调用 impm_template_reader 读取 APIFOX-POSTMAN-TEMPLATE.json 模板（用例测试信息结构）。

### 步骤 4：生成接口信息 JSON 文件
1. 按 APIFOX-OPENAPI-TEMPLATE.json 模板结构，将步骤 1 提取的接口信息填入 OpenAPI 3.0 JSON：
   - info.title=项目中文名称，info.version=当前版本号；
   - 每个接口按 method+path 生成 paths 下的操作项（summary/description/operationId/parameters/requestBody/responses）；
   - 请求体与响应体结构填入 components/schemas，并在操作项中用 $ref 引用；
   - 认证方式为 token/API Key 时在 components.securitySchemes 中定义并在全局 security 中启用。
2. 调用 impm_doc_writer（docType=apifox-openapi）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-apifox-openapi-v{当前版本号}.json。
3. 核对文件存在且 JSON 语法合法（可被 JSON.parse 解析）。

### 步骤 5：生成 API 用例测试信息 JSON 文件
1. 按 APIFOX-POSTMAN-TEMPLATE.json 模板结构，将步骤 2 提取的接口用例填入 Postman Collection v2.1 JSON：
   - info.name=项目中文名称 + 当前版本号，逐个接口用例生成 item；
   - item.name=接口路径 + 用例名称 + 用例 ID；
   - item.request.method/url/header/body 按用例所属接口与测试步骤填写；query 参数按步骤参数名值对填写，body 为 JSON 时以 raw 模式写入；
   - item.event 中按用例预期结果生成 pm.test 断言脚本（状态码断言、业务码断言、字段值断言）；
   - item.response 写入该用例的预期响应示例。
2. 调用 impm_doc_writer（docType=apifox-postman）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-apifox-postman-v{当前版本号}.json。
3. 核对文件存在且 JSON 语法合法（可被 JSON.parse 解析）。

### 步骤 6：记录进度
1. 调用 impm_progress add（impm-apifox，已完成），在 version_progress.md 中记录本技能完成状态。
2. 核对 version_progress.md 中已记录本步骤状态。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-apifox-openapi-v{当前版本号}.json（接口信息，OpenAPI 3.0，Apifox 导入后得到全部接口）
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-apifox-postman-v{当前版本号}.json（接口用例测试信息，Postman Collection v2.1，Apifox 导入后得到全部接口用例）
- version_progress.md 进度记录

## 导入 Apifox 说明（供用户参考）
1. 在 Apifox 项目「项目设置 → 导入数据」中，选择「OpenAPI (Swagger)」导入接口信息 JSON，即可获得全部接口定义。
2. 在 Apifox 项目「项目设置 → 导入数据」中，选择「Postman」导入用例 JSON，即可获得全部接口用例（含请求参数与断言脚本）。

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-project-update
- 如需继续执行本阶段后续所有步骤，请输入 /impm-finish

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->