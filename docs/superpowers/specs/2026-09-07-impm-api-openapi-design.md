# impm API 文档 OpenAPI 增强设计

**日期**：2026-09-07  
**版本**：v0.1.0  
**状态**：设计中

## 1. 背景与目标

### 1.1 背景
当前 impm 的 API 文档仅支持 Markdown 格式，无法直接用于 API 调试和测试工具（如 Swagger UI、Postman）。需要增强 API 文档生成能力，支持 OpenAPI 3.0 标准格式。

### 1.2 目标
1. 在生成版本级 API 文档时，同时生成 OpenAPI 3.0 JSON 文件
2. 在合并 API 文档时，同时合并 OpenAPI 3.0 JSON
3. 项目级 API 文档按模块+业务逻辑重组，不按版本分节
4. API 编号全局唯一
5. 生成 Swagger UI HTML 入口文件

## 2. 文件组织结构

```
docs/
├── {项目英文缩写}-api.md              # 项目级 API 文档（重构后）
├── openapi.json                       # 项目级 OpenAPI 3.0 JSON
├── index.html                         # 项目级 Swagger UI 入口
├── {项目英文缩写}-v0.0.1/
│   ├── {项目英文缩写}-api-v0.0.1.md   # 版本级 API 文档
│   ├── openapi-v0.0.1.json            # 版本级 OpenAPI 3.0 JSON
│   └── index.html                     # 版本级 Swagger UI 入口
├── {项目英文缩写}-v0.0.2/
│   ├── {项目英文缩写}-api-v0.0.2.md
│   ├── openapi-v0.0.2.json
│   └── index.html
└── ...
```

## 3. 技能修改清单

### 3.1 impm-api-create（版本 API 设计）

**新增步骤**：在步骤 4 之后增加"生成 OpenAPI JSON 和 Swagger HTML"

| 步骤 | 操作 | 说明 |
|------|------|------|
| 步骤 4 | 完成当前版本新增 API 设计 | 生成 {项目英文缩写}-api-v{版本}.md |
| 步骤 4.1 | 读取项目级 openapi.json | 确定当前最大 API 序号 |
| 步骤 4.2 | 生成 openapi-v{版本}.json | 从 Markdown 提取接口定义，编号从 max+1 开始 |
| 步骤 4.3 | 生成 index.html | 引用 openapi-v{版本}.json |

### 3.2 impm-init-api（初始化 API 设计）

**新增步骤**：在步骤 4 之后增加"生成 OpenAPI JSON 和 Swagger HTML"

与 impm-api-create 类似，但版本固定为 0.0.1。

### 3.3 impm-doc-merge（文档合并）

**修改步骤 3**：合并 API 文档时同时合并 OpenAPI JSON

| 步骤 | 操作 | 说明 |
|------|------|------|
| 步骤 3.1 | 读取主文档 openapi.json | 确定当前最大 API 序号 |
| 步骤 3.2 | 合并版本级 openapi-v{版本}.json | 新接口编号从主文档 max+1 开始 |
| 步骤 3.3 | 生成主文档 openapi.json | 按模块+业务逻辑重组 |
| 步骤 3.4 | 生成 index.html | 引用 openapi.json |
| 步骤 3.5 | 重构主文档 api.md | 按模块+业务逻辑排序，去除版本分节 |

## 4. OpenAPI JSON 生成规则

### 4.1 基础结构

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "{项目中文名称} API 文档",
    "version": "{当前版本号}",
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

### 4.2 路径提取规则

从 API Markdown 的接口定义提取：
- **接口编号**：`API-{序号}` 格式，全局唯一
- **HTTP 方法**：从接口定义中的 `GET/POST/PUT/DELETE` 提取
- **路径**：从接口定义中的路径提取
- **Summary**：接口名称
- **Description**：功能描述
- **Tags**：按模块分组
- **Parameters**：从请求参数表提取
- **RequestBody**：从请求参数/请求示例提取
- **Responses**：从响应参数/响应示例提取

### 4.3 编号全局唯一性

1. 读取项目级 `docs/openapi.json`（如存在）
2. 遍历所有 paths，提取最大 API 序号
3. 新接口从 `max + 1` 开始编号
4. 写入版本级和项目级 openapi.json

### 4.4 Tags 分组

以 SAD 的模块划分为基准生成 tags：

```json
"tags": [
  { "name": "用户管理", "description": "用户相关接口" },
  { "name": "订单管理", "description": "订单相关接口" }
]
```

## 5. 项目级 API 文档重组规则

### 5.1 重组原则

- **不按版本分节**：去除版本号作为章节层级
- **按模块排序**：以 SAD 的模块划分为基准
- **模块内按业务逻辑排序**：主流程在前，支线在后
- **来源版本列**：每个接口保留"来源版本"列，标注首次引入和最近修改版本

### 5.2 重组后结构

```markdown
# {项目名称} API 文档

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v0.0.2 | 2026-09-07 | 新增订单相关接口 |
| v0.0.1 | 2026-09-01 | 初始化 |

## 1. 用户管理模块

### 1.1 用户注册（API-001）
...

### 1.2 用户登录（API-002）
...

## 2. 订单管理模块

### 2.1 创建订单（API-003）
...
```

## 6. Swagger HTML 模板

### 6.1 版本级 HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>{项目名称} API 文档 - v{版本号}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <h1>{项目名称} API 文档 - v{版本号}</h1>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "./openapi-v{版本号}.json",
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>
```

### 6.2 项目级 HTML

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

## 7. 实现计划

### 7.1 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `.opencode/skills/impm-api-create/SKILL.md` | 修改 | 增加 OpenAPI 生成步骤 |
| `.opencode/skills/impm-init-api/SKILL.md` | 修改 | 增加 OpenAPI 生成步骤 |
| `.opencode/skills/impm-doc-merge/SKILL.md` | 修改 | 步骤3增加 OpenAPI 合并和文档重组 |
| `.opencode/skills/template/API-TEMPLATE.MD` | 可选 | 增加 OpenAPI 转换提示 |

### 7.2 验证方式

1. 初始化阶段：执行 /impm-init-api，检查 openapi-v0.0.1.json 和 index.html 是否生成
2. 版本阶段：执行 /impm-api-create，检查 openapi-v{版本}.json 和 index.html 是否生成
3. 合并阶段：执行 /impm-doc-merge，检查 openapi.json、index.html 是否生成，api.md 是否重组

## 8. 风险与注意事项

1. **Token 消耗**：OpenAPI JSON 生成会增加 TL subagent 的 token 消耗
2. **Markdown 解析**：需要正确解析 Markdown 格式的接口定义
3. **编号冲突**：多版本并发开发时可能出现编号冲突，需在合并时处理
4. **Swagger UI 依赖**：需要网络访问 unpkg.com 加载 Swagger UI 资源

---

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
