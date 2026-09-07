---
name: impm-api-create
description: 判断项目是否需要 API 接口，按 API 模板完成当前版本的新增接口设计文档，并生成 OpenAPI 3.0 JSON 和 Swagger UI HTML。
---

# impm-api-create 技能

## 触发词
接口设计、API、接口文档、新增接口、impm-api-create

## 何时使用
在数据库设计完成（impm-dbd-create 之后）时使用，查看主接口设计文档 docs/{项目英文缩写}-api.md 是否存在：不存在则说明当前项目无需创建 API 接口，跳过本步骤；存在则根据 SAD 和当前版本 PRD，按 API 模板完成当前版本的新增 API 设计，并在版本进度文件中记录本步骤。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、当前版本号（{当前版本号}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-api-create，要求 subagent 先用 Skill 工具加载本技能再执行）。
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

## 执行步骤

### 步骤 1：读取模板
调用 impm_template_reader 读取模板 API-TEMPLATE.MD，明确接口设计文档的章节结构与填写格式。

### 步骤 2：判断项目是否需要接口
调用 impm_doc_reader（docType=api，target=main）查看 docs/{项目英文缩写}-api.md 是否存在：
- 如果不存在：说明当前项目无需创建 API 接口。调用 impm_progress（action=add，stepName=impm-api-create，status=无需接口）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行，然后跳过本步骤，结束本技能。

### 步骤 3：收集设计依据
调用 impm_doc_reader 读取：
1. 系统架构设计文档 docs/{项目英文缩写}-sad.md；
2. 当前版本 PRD 文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-prd-v{当前版本号}.md；
3. 现有 API 设计文档 docs/{项目英文缩写}-api.md（可能为空，作为参考）。

### 步骤 4：完成当前版本新增 API 设计
根据 SAD 和当前版本的 PRD，参考现有 API 设计 docs/{项目英文缩写}-api.md（可能为空），套用 API 模板格式，完成当前版本的新增 API 设计。调用 impm_doc_writer（docType=api，target=version）写入 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md。

### 步骤 4.1：读取项目级 API 编号确定最大序号
调用 impm_doc_reader（docType=api，target=main）读取项目级 API 文档 docs/{项目英文缩写}-api.md，解析其中所有接口编号（格式 API-{序号}），确定当前最大序号 max_api_number。若主文档不存在或无接口编号，则 max_api_number = 0。

### 步骤 4.2：生成 OpenAPI 3.0 JSON
根据步骤 4 生成的 API Markdown 文档，转换为 OpenAPI 3.0 格式的 JSON 文件 docs/{项目英文缩写}-v{当前版本号}/openapi-v{当前版本号}.json：
1. **基础结构**：
```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "{项目中文名称} API 文档",
    "version": "v{当前版本号}",
    "description": "由 impm 自动生成"
  },
  "servers": [
    {
      "url": "/api",
      "description": "API 基础路径"
    }
  ],
  "paths": {},
  "components": {
    "schemas": {},
    "securitySchemes": {}
  },
  "tags": []
}
```
2. **接口提取规则**：
   - 从 API Markdown 的接口定义（### 5.x 格式）提取
   - HTTP 方法：从接口行 `GET/POST/PUT/DELETE /api/xxx` 提取
   - 路径：从接口行提取完整路径
   - Summary：接口名称
   - Description：功能描述
   - Tags：按模块分组（从章节层级推断）
   - Parameters：从请求参数表提取
   - RequestBody：从请求参数/请求示例提取
   - Responses：从响应参数/响应示例提取
3. **编号全局唯一**：新接口编号从 max_api_number + 1 开始递增，格式为 API-{序号}（如 API-001、API-002），保证全局唯一。
4. **Tags 分组**：以 SAD 的模块划分为基准生成 tags，格式为 `{ "name": "模块名称", "description": "模块描述" }`。

### 步骤 4.3：生成 Swagger UI HTML
根据以下模板生成版本级 Swagger UI 入口文件 docs/{项目英文缩写}-v{当前版本号}/index.html：
```html
<!DOCTYPE html>
<html>
<head>
  <title>{项目名称} API 文档 - v{当前版本号}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <h1>{项目名称} API 文档 - v{当前版本号}</h1>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "./openapi-v{当前版本号}.json",
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>
```

### 步骤 5：记录进度
调用 impm_progress（action=add，stepName=impm-api-create，status=已完成）在版本进度文件 docs/{项目英文缩写}-v{当前版本号}/version_progress.md 表格第一行插入新行。
核对产出文件存在、内容正确，进度行已记录。

## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md（API 接口设计文档）
- docs/{项目英文缩写}-v{当前版本号}/openapi-v{当前版本号}.json（OpenAPI 3.0 格式）
- docs/{项目英文缩写}-v{当前版本号}/index.html（Swagger UI 入口）

## 完成后提示
- 如需继续执行下一步骤，请输入 /impm-lld-create
- 如需继续执行本阶段后续所有步骤，请输入 /impm-docs
<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
