---
slug: "opencode-v2-dual-compat"
createdAt: "2026-10-17T12:56:38.334Z"
---

# 改造 opencode-impm-cn 为 opencode 1.x / 2.x 双版本兼容插件

## Why

`opencode-impm-cn` 当前仅支持 opencode 1.x。opencode 2.x 已发布，且官方迁移指南明确：

- V2 只有三个刻意破坏性变更，其一就是 **"V1 plugin implementations do not run in V2"** —— 插件代码必须重写；
- 但 `.opencode/` 下的 **agent / command / skill 文件定义无需改动即可继续工作**，V2 在内存中自动翻译 legacy frontmatter。

因此本插件的 15 个自定义工具、2 个事件型内置功能（prompt-recorder、heartbeat）、以及安装器全部需要在 V2 下重写，而 145 个资产文件（13 agents + 66 commands + 66 skills）基本可原样保留。

用户诉求是 **一个 npm 包同时适配 1.x 与 2.x**（不拆包、不发两套安装说明），且不能牺牲现有的 1.x 用户。

## What Changes

### 1. 插件入口改为官方双形态单包

采用官方 [插件迁移指南](https://opencode.ai/v2/docs/build/plugins/migrate-v1) 给出的「Support V1 and V2 from one package」形态：

```ts
export default { ...Plugin.define({ id: "impm", setup: runV2 }), server: runV1 }
```

V1 宿主调用 `server()`，V2 宿主调用 `setup()`。V2 类型仅以 `import type` 引入（照抄 `alibaba/open-code-review` 模式），使 V1 用户无需安装 `@opencode/plugin` 包。**最低宿主版本提升至 opencode 1.18.29**（官方对 object entrypoint 的硬性要求）。

### 2. 新增 `src/host/` 平台抽象层

- `detect.ts`：把 V2 的 `ctx` 与 V1 的 `PluginInput` 统一为 `HostEnv { major, version, projectRoot, sessionPort }`，版本探测走 V2 的 `ctx.app.version` 与 V1 的 `(await client.app.get()).data.version`，无需条件 import。
- `session.ts`：`SessionPort.abort()` / `prompt()`，V2 实现为 `ctx.session.interrupt({sessionID, continue:false})` / `ctx.session.prompt()`，V1 实现为 `client.session.abort()` / `client.session.chat()`。
- `activity.ts`：会话活跃度探测端口。

### 3. 15 个自定义工具改为双形态注册

工具核心逻辑（`src/tools/*.ts`）保持平台无关；两套 runtime 各做一次「入参装配 + 结果封装」：

| | V1 | V2 |
|---|---|---|
| 注册 | `return { tool: {...} }` | `ctx.tool.transform(e => e.add({name, description, input, execute}))` |
| schema | `args`（JSON-Schema 分片） | `input`（完整 JSON Schema object） |
| 结果 | `string` / `{output}` | `{ content }` |
| 目录 | `context.project.path` | `ctx.location.directory`，需要时 `ctx.session.get().location.directory` |
| context | `{sessionID, agent, abort}` | `{sessionID, agent, messageID, id, signal, progress}` |

### 4. 钩子迁移

- `chat.message` → `ctx.session.hook("prompt", ...)`
- `event` → `ctx.event.subscribe({signal})` async 迭代器 + `setup` 返回的 cleanup 中 `AbortController.abort()`

### 5. 解除对宿主私有 SQLite schema 的耦合

heartbeat 与 progress 当前直查 V1 表结构（`message.time_created`、`part.time_updated`、`json_extract(data,'$.role')`、`session.parent_id` 等），而 V2 消息 schema 已扁平化、DB 路径改由 `OPENCODE_DB` 控制。改为**分层降级**：V2 走 `ctx.session.*` API 与事件流维护内存活跃表，V1 保留现有 DB 查询作为回退。

此项收益超出兼容本身：彻底摆脱对宿主内部存储实现的依赖。

### 6. 安装器与配置按宿主版本分支

- `plugin` → `plugins`；`agent` → `agents`；`reasoning_effort` → `model#variant`。
- 采用双键并写策略，各自运行时忽略对方的键，避免用户跨版本时配置失效。
- 保留运行时 `ensureInstalled()` 自愈（V2 后台装包，postinstall 不保证执行）。
- 校验并按需移除 `DEFAULT_PLUGINS` 中硬编码的 `opencode-browser`。

### 7. 资产文件最小改动

- 13 个 agent **保持 legacy `permission:` 形态**（单个 `.md` 无法同时是 v1-native 与 v2-native，V2 会自动翻译），仅剔除失效的 `todowrite: allow`。
- 66 个 command：`subtask` → `subagent`（legacy 名仍受支持，属可选优化）。
- 66 个 skill：无需改动。

## Impact

- **代码**：`src/index.ts` 拆分为 `src/runtime/v1.ts` + `src/runtime/v2.ts` + `src/host/*`；`src/tools/*.ts` 增加端口参数。
- **安装**：`scripts/install-core.mjs` 增加宿主版本探测与配置键分支。
- **资产**：`.opencode/agents/*.md`（13）、`.opencode/commands/*.md`（66）。
- **依赖**：`@opencode/plugin` 进 devDependencies + optional peerDependencies。
- **兼容性边界**：放弃 opencode < 1.18.29（官方 object entrypoint 硬性要求）。
- **破坏性**：插件 `default` 导出形态变化；`client.app.log` 在 V2 已不存在，日志改用 `console`。

## Out of Scope

- 不拆分为两个 npm 包。
- 不迁移到 V2 原生配置形态（官方声明 legacy 形态继续支持，原生化为可选后续项）。
- 不重写 66 个 skill 与 66 个 command 的正文内容。
- 不适配 `opencode < 1.18.29`。