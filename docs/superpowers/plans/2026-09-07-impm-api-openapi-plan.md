# impm API 文档 OpenAPI 增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 impm 的 API 文档生成能力，支持 OpenAPI 3.0 标准格式，生成 Swagger UI HTML

**Architecture:** 修改 impm-api-create、impm-init-api、impm-doc-merge 三个技能，在生成 Markdown API 文档的同时生成 OpenAPI JSON 和 Swagger HTML

**Tech Stack:** Markdown, OpenAPI 3.0, Swagger UI

---

## 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.opencode/skills/impm-api-create/SKILL.md` | 修改 | 增加 OpenAPI 生成步骤 |
| `.opencode/skills/impm-init-api/SKILL.md` | 修改 | 增加 OpenAPI 生成步骤 |
| `.opencode/skills/impm-doc-merge/SKILL.md` | 修改 | 步骤3增加 OpenAPI 合并和文档重组 |

---

## Task 1: 修改 impm-api-create 技能

**Files:**
- Modify: `.opencode/skills/impm-api-create/SKILL.md`

### Step 1: 更新技能描述

将文件开头的 description 更新为：

```yaml
---
name: impm-api-create
description: 判断项目是否需要 API 接口，按 API 模板完成当前版本的新增接口设计文档，并生成 OpenAPI 3.0 JSON 和 Swagger UI HTML。
---
```

### Step 2: 在步骤 4 后增加新步骤

在 `### 步骤 4：完成当前版本新增 API 设计` 之后，`### 步骤 5：记录进度` 之前，插入以下内容：

```markdown
### 步骤 4.1：读取项目级 OpenAPI 确定最大编号
调用 impm_doc_reader（docType=api，target=main）读取项目级 API 文档 docs/{项目英文缩写}-api.md，解析其中所有接口编号（格式 API-{序号}），确定当前最大序号 max_api_number。若不存在主文档或无接口编号，max_api_number = 0。

### 步骤 4.2：生成 OpenAPI 3.0 JSON
根据步骤 4 生成的 API Markdown 文档，转换为 OpenAPI 3.0 格式的 JSON 文件：

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

3. **编号全局唯一**：
   - 新接口编号从 max_api_number + 1 开始递增
   - 格式：API-{序号}，如 API-001、API-002

4. **Tags 分组**：
   - 以 SAD 的模块划分为基准生成 tags
   - 格式：`{ "name": "模块名称", "description": "模块描述" }`

写入路径：docs/{项目英文缩写}-v{当前版本号}/openapi-v{当前版本号}.json

### 步骤 4.3：生成 Swagger UI HTML
根据以下模板生成 HTML 文件：

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

写入路径：docs/{项目英文缩写}-v{当前版本号}/index.html
```

### Step 3: 更新交付物

将交付物更新为：

```markdown
## 交付物
- docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md（API 接口设计文档）
- docs/{项目英文缩写}-v{当前版本号}/openapi-v{当前版本号}.json（OpenAPI 3.0 格式）
- docs/{项目英文缩写}-v{当前版本号}/index.html（Swagger UI 入口）
```

---

## Task 2: 修改 impm-init-api 技能

**Files:**
- Modify: `.opencode/skills/impm-init-api/SKILL.md`

### Step 1: 更新技能描述

将文件开头的 description 更新为：

```yaml
---
name: impm-init-api
description: 判断项目是否需要接口设计，需要时读取 API-TEMPLATE.MD 模板反推接口设计文档，写入版本文档并复制到主文档 docs/{项目英文缩写}-api.md，并生成 OpenAPI 3.0 JSON 和 Swagger UI HTML。当初始化阶段需要设计系统接口时使用。
---
```

### Step 2: 在步骤 4 后增加新步骤

在 `### 步骤 4：写入版本文档并复制主文档` 之后，`### 步骤 5：记录进度` 之前，插入以下内容：

```markdown
### 步骤 4.1：生成 OpenAPI 3.0 JSON
根据步骤 3 生成的 API Markdown 文档，转换为 OpenAPI 3.0 格式的 JSON 文件：

1. **基础结构**：
```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "{项目中文名称} API 文档",
    "version": "v0.0.1",
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

3. **编号规则**：
   - 初始化阶段从 API-001 开始编号
   - 格式：API-{序号}，如 API-001、API-002

4. **Tags 分组**：
   - 以 SAD 的模块划分为基准生成 tags
   - 格式：`{ "name": "模块名称", "description": "模块描述" }`

写入路径：docs/{项目英文缩写}-v0.0.1/openapi-v0.0.1.json

### 步骤 4.2：生成 Swagger UI HTML
根据以下模板生成 HTML 文件：

```html
<!DOCTYPE html>
<html>
<head>
  <title>{项目名称} API 文档 - v0.0.1</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <h1>{项目名称} API 文档 - v0.0.1</h1>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "./openapi-v0.0.1.json",
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>
```

写入路径：docs/{项目英文缩写}-v0.0.1/index.html
```

### Step 3: 更新交付物

将交付物更新为：

```markdown
## 交付物
- docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-api-v0.0.1.md
- docs/{项目英文缩写}-v0.0.1/openapi-v0.0.1.json（OpenAPI 3.0 格式）
- docs/{项目英文缩写}-v0.0.1/index.html（Swagger UI 入口）
- docs/{项目英文缩写}-api.md
```

---

## Task 3: 修改 impm-doc-merge 技能

**Files:**
- Modify: `.opencode/skills/impm-doc-merge/SKILL.md`

### Step 1: 更新技能描述

将文件开头的 description 更新为：

```yaml
---
name: impm-doc-merge
description: 将当前版本的 URS、PRD、API、DBD、DBD SQL、LLD 文档重构式合并到项目主文档（URS/PRD 摘要式合并，API/DBD/SQL/LLD 按项目结构与系统架构重构合并），并合并 OpenAPI 3.0 JSON 和 Swagger UI HTML。
---
```

### Step 2: 重写步骤 3

将 `### 步骤 3：合并 API 文档（重构式合并）` 替换为以下内容：

```markdown
### 步骤 3：合并 API 文档（重构式合并）+ OpenAPI 合并

#### 3.1 合并 Markdown API 文档
1. 用 impm_doc_reader（docType=api，target=main）读取主文档 docs/{项目英文缩写}-api.md；若主文档不存在且当前版本 API 文档存在，按其结构+架构基准创建。
2. 确定接口分组：以 sad.md/LLD 的模块划分为准；现有分组保留，新模块接口插入与架构一致的位置。
3. 将版本文档 docs/{项目英文缩写}-v{当前版本号}/{项目英文缩写}-api-v{当前版本号}.md 的接口逐条并入：
   - **编号全局唯一**：先读取主文档所有接口编号，确定最大序号 max_api_number；版本文档中的接口编号若与主文档冲突，重新编号为 max_api_number + 1 开始递增
   - 新增接口插入所属模块组
   - 已有接口（URL/路径相同视为同一接口）原位更新请求/响应/错误码，并标注最近修改版本
   - 接口清单同步更新
   - 被删除或废弃的接口移入"废弃/下线接口"小节并标注下线版本
4. **重组原则**（不按版本分节）：
   - 主文档按「模块 → 业务逻辑」排序
   - 模块以 SAD 的模块划分为基准
   - 模块内按业务逻辑排序（主流程在前，支线在后）
   - 每个接口保留「来源版本」列，标注首次引入和最近修改版本
5. 若本次为首次合并（v0.0.1），按架构分组建立主文档结构，将版本接口重构组织进去而非原文照抄。
6. 用 impm_doc_writer（docType=api，target=main）写回主文档。
7. 核对：主文档按模块分组、无重复定义、接口与编号/来源版本可追溯，历史接口保留。

#### 3.2 合并 OpenAPI 3.0 JSON
1. 读取项目级主文档 docs/openapi.json（如不存在则创建空结构）：
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

2. 读取版本级 docs/{项目英文缩写}-v{当前版本号}/openapi-v{当前版本号}.json
3. 确定主文档最大 API 序号：遍历主文档 paths，提取所有 API-{序号} 中的最大值
4. 版本文档接口编号重映射：若版本文档中的接口编号与主文档冲突，重新编号为 max_api_number + 1 开始递增
5. 合并 paths：新增接口直接加入，已有接口（路径相同）原位更新
6. 合并 tags：新增模块 tag 加入，已有模块保留
7. 合并 components：新增 schema 加入，已有 schema 保留
8. 更新 info.version 为当前版本号
9. 写入主文档 docs/openapi.json

#### 3.3 生成项目级 Swagger UI HTML
根据以下模板生成 HTML 文件：

```html
<!DOCTYPE html>
<html>
<head>
  <title>{项目名称} API 文档</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <h1>{项目名称} API 文档（最新版本）</h1>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "./openapi.json",
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>
```

写入路径：docs/index.html
```

### Step 3: 更新交付物

将交付物更新为：

```markdown
## 交付物
- docs/{项目英文缩写}-urs.md、docs/{项目英文缩写}-prd.md（需求/功能/用户故事**摘要**汇总主文档，非完整内容）
- docs/{项目英文缩写}-api.md、docs/{项目英文缩写}-dbd.md、docs/{项目英文缩写}-dbd.sql、docs/{项目英文缩写}-lld.md（按项目组织方式、代码结构、系统架构**重构式合并**后的完整设计主文档）
- docs/openapi.json（项目级 OpenAPI 3.0 格式）
- docs/index.html（项目级 Swagger UI 入口）
- version_progress.md 进度记录
```

---

## Task 4: 验证测试

**Files:**
- Test: 通过 impm-init-api 和 impm-doc-merge 流程验证

### Step 1: 验证 impm-init-api

执行 /impm-init-api，检查：
- [ ] `docs/{项目英文缩写}-v0.0.1/{项目英文缩写}-api-v0.0.1.md` 生成
- [ ] `docs/{项目英文缩写}-v0.0.1/openapi-v0.0.1.json` 生成，格式正确
- [ ] `docs/{项目英文缩写}-v0.0.1/index.html` 生成，引用正确
- [ ] `docs/{项目英文缩写}-api.md` 生成，内容一致

### Step 2: 验证 impm-api-create

执行 /impm-api-create，检查：
- [ ] `docs/{项目英文缩写}-v{版本}/{项目英文缩写}-api-v{版本}.md` 生成
- [ ] `docs/{项目英文缩写}-v{版本}/openapi-v{版本}.json` 生成
- [ ] `docs/{项目英文缩写}-v{版本}/index.html` 生成
- [ ] API 编号全局唯一（从项目级文档最大值递增）

### Step 3: 验证 impm-doc-merge

执行 /impm-doc-merge，检查：
- [ ] `docs/{项目英文缩写}-api.md` 按模块+业务逻辑重组，无版本分节
- [ ] `docs/openapi.json` 生成，包含所有版本接口
- [ ] `docs/index.html` 生成，引用正确
- [ ] API 编号全局唯一，无冲突

---

## 执行顺序

1. Task 1: 修改 impm-api-create 技能
2. Task 2: 修改 impm-init-api 技能
3. Task 3: 修改 impm-doc-merge 技能
4. Task 4: 验证测试（在实际项目中执行 impm 流程验证）

---

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
