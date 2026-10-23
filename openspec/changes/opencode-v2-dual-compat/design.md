# Design: opencode-v2-dual-compat

## Overview

将 `opencode-impm-cn` 从「V1 专用插件」重构为「V1/V2 双形态单包」，采用**官方推荐的双入口 default 导出** + **宿主平台抽象层** + **资产文件保持 legacy 形态由 V2 自动翻译** 三支柱策略。

核心判断依据来自官方迁移指南的三条硬事实：

1. V2 声明的破坏性变更只有三个（插件 API、Server API、TUI 配置），其中**只有插件 API 影响本项目**；
2. `.opencode/` 下的 agent / command / skill 文件定义**无需改动即可继续工作**，V2 在内存中自动翻译 legacy frontmatter；
3. 官方明确提供单包双版本形态，代价是宿主最低版本需 ≥ 1.18.29。

因此改造量集中在 **插件运行时（约 900 行 TS）** 与 **安装器（约 100 行 JS）**，而非 145 个资产文件。

## Goals

- 单一 npm 包在 opencode 1.18.29+ 与 2.x 下均完整可用，行为一致。
- 现有 1.x 用户升级插件后行为零回归。
- 业务工具层（`src/tools/*.ts`）与宿主 API 解耦，未来 v3 迁移成本降至最低。
- 用户跨版本升级宿主时，配置零手工修改。

## Constraints

| # | 约束 | 来源 |
|---|---|---|
| C1 | V1 插件实现在 V2 完全不运行，必须提供 `setup(ctx)` | 官方 migrate-v1 |
| C2 | 单包双入口要求 V1 ≥ 1.18.29（object entrypoint） | 官方插件迁移指南 |
| C3 | 单个 `.md` 文件无法同时是 V1-native 与 V2-native 形态 | 结构性限制 |
| C4 | V2 中 `client.app.log` 已移除，无结构化日志端点 | V2 API 无 `app` 资源 |
| C5 | V2 prompt hook 非 exactly-once，且 synthetic/shell/compaction 消息不触发 | 官方 build/plugins |
| C6 | V2 `subagent` 默认嵌套深度为 1 | V2 tools 文档 |
| C7 | V2 事件订阅 live-only，无 replay、无自动重连 | 官方 build/plugins |
| C8 | `ctx.tool.transform` 回调须同步、廉价、无一次性副作用 | 官方 build/plugins |

## Technical Approach

### 架构分层

```
┌─────────────────────────────────────────────────────┐
│  dist/index.ts   双形态 default export（唯一入口）    │
├──────────────────────┬──────────────────────────────┤
│  runtime/v1.ts      │  runtime/v2.ts                │
│  V1 hooks + tool map│  ctx.tool.transform           │
│  chat.message       │  ctx.session.hook("prompt")   │
│  event              │  ctx.event.subscribe()        │
├──────────────────────┴──────────────────────────────┤
│  host/                                              │
│  detect.ts   → HostEnv {major, version, projectRoot} │
│  session.ts  → SessionPort {abort, prompt}           │
│  activity.ts → ActivityPort {lastActive, ...}        │
├─────────────────────────────────────────────────────┤
│  tools/*.ts   平台无关业务核心（execute(args, ports)）│
└─────────────────────────────────────────────────────┘
```

### 1. 入口形态

```ts
// src/index.ts
import type { Plugin as PluginV2 } from "@opencode/plugin";   // 仅类型
import { runV1 } from "./runtime/v1.js";
import { runV2 } from "./runtime/v2.js";

const definition = {
  id: "impm",
  setup: (ctx: never) => runV2(ctx),
};

export default { ...definition, server: runV1 } as unknown as PluginV2;
```

**为何手写对象字面量而不调 `Plugin.define`**：官方示例 `Plugin.define()` 是 identity function，直接展开即可。社区先例 `alibaba/open-code-review` 与 `prevalentWare/opencode-goal-plugin` 均采用「`import type` + 对象字面量」，使 V1 用户运行时完全不需要 `@opencode/plugin` 包（满足 R1.3/R1.4）。

**类型策略**：`@opencode/plugin` 放入 `devDependencies` 供编译期类型检查，同时声明为 `peerDependenciesMeta: { optional: true }`。`tsconfig` 的 `importsNotUsedAsValues` 默认行为会擦除 type-only import。

### 2. 宿主探测（`host/detect.ts`）

```ts
export interface HostEnv {
  major: 1 | 2;
  version: string;
  projectRoot: string;
  sessionPort: SessionPort;
  location(): string;                      // 会话工作目录解析
}

export async function detectHost(input: unknown): Promise<{ major: 1|2; version: string }>
```

- V2：`input.app.version`（同步、零网络）。
- V1：`await input.client.app.get()` → `data.version`。
- 两者皆失败 → `major = 1`（保守降级，与改造前行为一致）。

`major` 判定用 `version.split(".")[0]` 数值比较，容忍 `v2.0.0-beta` 等预发布标识。

### 3. 会话控制（`host/session.ts`）

| 操作 | V1 实现 | V2 实现 |
|---|---|---|
| `abort(id)` | `client.session.abort({ path: { id } })` | `ctx.session.interrupt({ sessionID: id, continue: false })` |
| `prompt(id, text)` | `client.session.chat({path:{id}}, {agent, parts:[{type:"text",text}]})` | `ctx.session.prompt({ sessionID: id, text })` |

两实现均容忍宿主 API 缺失（`?.` + try/catch），失败仅记告警——这是现有 `OpencodeClientLike` 设计的延续。

### 4. 工具双形态注册

**单一属性表派生 schema**（满足 R3.6）：

```ts
const TOOLS = {
  impm_doc_reader: {
    description: docReaderDefinition.description,
    props: {
      projectRoot: { type: "string", description: "项目根目录的绝对路径" },
      docType:     { type: "string", description: "..." },
      // ...
    },
    run: (args, ports) => docReaderExecute({ ...args, projectRoot: args.projectRoot || ports.projectRoot }),
  },
} as const;

// 派生
const v1Args = Object.fromEntries(Object.entries(props).map(([k, s]) => [k, s]));
const v2Input = { type: "object", properties: props, additionalProperties: false };
```

**结果封装**：

| | V1 | V2 |
|---|---|---|
| 标量结果 | `{ output: String(r) }` | `{ content: String(r) }` |
| 对象结果 | `{ output: JSON.stringify(r, null, 2) }` | `{ content: JSON.stringify(r, null, 2) }` |

若实测确认 V2 接受 `{output}`（待验证项 V2），则在 V2 侧同时返回 `{ content, output }` 以最大化兼容；否则仅 `{content}`。

**工作目录解析**（满足 R3.5）：

```ts
// V2
async location(sessionID?: string) {
  if (!sessionID) return ctx.location.directory;
  try {
    const s = await ctx.session.get({ sessionID });
    return join(s.location.directory, s.subpath ?? ".");
  } catch { return ctx.location.directory; }
}
```

**取消处理**：V2 用 `context.signal` 传入 `node:fs` / `fetch` 等可取消 API；不可取消的同步逻辑沿用现状。

### 5. 钩子迁移

| 能力 | V1 | V2 |
|---|---|---|
| 提问记录 | `"chat.message": promptRecorder.chatMessage` | `ctx.session.hook("prompt", e => recorder.onPrompt(e.sessionID, e.prompt.text))` |
| 事件流 | `event: async ({event}) => {...}` | `for await (const e of ctx.event.subscribe({signal})) {...}` |
| 清理 | `dispose` hook | `setup` 返回 `() => ctl.abort()` |

**prompt 幂等**（满足 R4.4）：现有 `busy` 布尔量不足——V2 并发提交可能多次触发。改为按 `sessionID + text 前 120 字符` 的短窗去重集合（TTL 5s），既防并发重复又不影响正常的连续提问。

**事件 payload 差异**：现有 `extractSessionId(props)` 已做多形态防御（`props.sessionID` / `info.sessionID` / `part.sessionID` 等），可直接复用；V2 的 `V2EventEncoded` 结构须按待验证项 V3 实测校正。

### 6. 解除 SQLite 耦合

**分层策略**（满足 R5.1/R5.2）：

| 数据需求 | V1 实现 | V2 实现 |
|---|---|---|
| 会话父子关系 | `SELECT parent_id, directory FROM session` | `ctx.session.list()`（待验证 V4 是否暴露 parentID，否则改为「排除主会话 + 按事件 `session.updated` 建表」） |
| 最近活跃时间 | `MAX(time_created/time_updated) FROM message/part` | 内存活跃表，由 `ctx.tool.hook("execute.after")` 与事件流打点 |
| assistant 错误 | `json_extract(data,'$.error')` | 事件流 `session.error` 载荷 |
| token 用量 | `message.data.tokens` | 事件流 / `ctx.session.context()` |
| DB 路径 | `OPENCODE_DATA` + 默认 | `OPENCODE_DB` → `OPENCODE_DATA` → 默认（满足 R5.4） |

`ActivityPort` 抽象：

```ts
interface ActivityPort {
  lastActive(sessionId: string): Promise<number | null>;   // epoch ms
  childSessions(parentId: string): Promise<SessionRef[]>;
  lastAssistantError(sessionId: string): Promise<string | null>;
}
```

V2 实现在内存中维护，V1 实现包装现有 SQL。这样 heartbeat 的判定逻辑（阈值、abort+nudge、告警写入）完全复用。

### 7. 安装器

```js
// scripts/install-core.mjs
function detectHostMajor() {
  try { return execSync("opencode --version").toString().trim()[0] === "2" ? 2 : 1 }
  catch { return 1 }   // 探测失败按 V1（更保守）
}
```

配置写入采用**双键并写**（满足 R6.2）：

```js
config.plugin  = mergeLegacyPluginArray(config.plugin,  DEFAULT_PLUGINS)   // V1 读
config.plugins = mergePluginArray(config.plugins, DEFAULT_PLUGINS)         // V2 读
config.agent[name]  = { model, reasoning_effort }                          // V1 读
config.agents[name] = { model: `${model}#${variantOf(reasoning_effort)}` } // V2 读
```

`variantOf`：`low→low`、`medium→medium`、`high→high`、`max→high`（V2 variant 集合按模型而定，`max` 降级为 `high` 并记告警）。

理由：两个运行时各自忽略不认识的键；用户跨版本时无需手工改配置，这是唯一免维护方案。风险是 V1 运行时若对未知顶层键报错——**须实测**（已列入实施期验证项）。

### 8. 资产文件

- **agent（13）**：保持 legacy `permission:` 映射不变（满足 C3/R7.1），仅删除 `todowrite: allow`。理由：若改为 V2 原生 `permissions` 数组，V1 将无法解析同一文件，双版本兼容即告破裂。
- **command（66）**：`subtask: false` → `subagent: false`。legacy 名仍受支持，属清理性改动。
- **skill（66）**：不动。frontmatter 仅 `name` + `description`，两版本语义一致；目录扁平，ID 稳定。
- **subagent_depth**：需确认无「subagent 再派 subagent」的嵌套调度。若存在，写入 `experimental.subagent_depth: 2`（顶层 `subagent_depth` 在 V2 被忽略）。

## Alternatives Considered

### 方案 A：单包双入口（采纳）

官方推荐，社区两个成熟先例。代价是放弃 V1 < 1.18.29。

### 方案 B：拆成两个 npm 包（否决）

`diegosouzapw/OmniRoute` 的做法。用户明确要求「一个包适配两个版本」，且双包会导致安装说明分裂、版本漂移。

### 方案 C：把 agent frontmatter 迁到 V2 原生形态（否决）

V2 原生更整洁，但会使同一 `.md` 无法在 V1 加载。除非引入双资产树（`assets/` + `assets-v2/`）由安装器按版本选择——保留为待验证项 V1 失败时的应急预案。

### 方案 D：V2 下继续读 SQLite，仅适配新 schema（否决）

改动量小（写一套 V2 SQL 即可），但仍把插件焊死在宿主私有存储实现上，v3 会再次断裂；且 V2 DB 路径随发布渠道变化、`OPENCODE_DB` 语义未完全明确。采用「V2 走 API/事件，V1 保留 DB」的混合策略，长期更稳。

### 方案 E：运行时条件 import 真实 V2 API（否决）

需要把 `@opencode/plugin` 变成运行时依赖，V1 用户安装即报缺包。采用 `import type` 规避。

## Impacted Files / Modules

| 文件 | 改动 |
|---|---|
| `src/index.ts` | 重写为双形态入口（原 525 行 → 约 30 行） |
| `src/runtime/v1.ts` | 新增，承接现 `index.ts` 的 V1 逻辑 |
| `src/runtime/v2.ts` | 新增，V2 工具注册 + prompt hook + 事件订阅 |
| `src/host/detect.ts` / `session.ts` / `activity.ts` | 新增 |
| `src/tools/tool-defs.ts` | 新增，15 个工具的单一属性表 |
| `src/tools/prompt-recorder.ts` | `chat.message` 逻辑抽为 `onPrompt(sessionID, text)`；DB 路径支持 `OPENCODE_DB` |
| `src/tools/heartbeat.ts` | 接入 `SessionPort` + `ActivityPort`，移除对 `OpencodeClientLike` 的直连 |
| `src/tools/progress.ts` | token 统计走 `ActivityPort` |
| `scripts/install-core.mjs` | 宿主版本探测 + 双键并写 |
| `scripts/agent-models.json` | `reasoning_effort` 语义保持，新增 V2 variant 映射表 |
| `package.json` | `devDependencies` 加 `@opencode/plugin`；`peerDependenciesMeta` optional；`engines` 标注宿主 ≥1.18.29 |
| `.opencode/agents/*.md`（13） | 删除 `todowrite: allow` |
| `.opencode/commands/*.md`（66） | `subtask` → `subagent` |
| `readme.md` / `agent.md` | 双版本安装说明、`plugins` vs `plugin` |

## Risks and Mitigations

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | V2 不翻译 `permission.task` 嵌套 map | 13 个 agent 权限失效 | 实施首日实机验证；失败则切双资产树（备选方案 C） |
| R2 | V1 运行时对 `plugins` / `agents` 未知键报错 | 双键并写策略失败 | 实测；若报错则改为按 major 单写 + 跨版本时由插件自愈补写 |
| R3 | V2 事件 payload 与预期不符 | heartbeat / prompt-recorder 失效 | `extractSessionId` 已多形态防御；实施期打印真实事件结构后校正 |
| R4 | `ctx.session.list()` 不暴露父子关系 | V2 下无法识别子会话 | 降级为「非主会话即子会话」+ 事件流建表 |
| R5 | `opencode-browser` 不兼容 V2 | 安装报错或插件列表异常 | 验证后从 `DEFAULT_PLUGINS` 移除或改可选 |
| R6 | V2 中 `subagent` 深度 1 阻断嵌套调度 | PM 调度链断裂 | 核查调度深度；必要时写 `experimental.subagent_depth` |
| R7 | `node:sqlite` 在 V2 运行时不可用 | DB 相关能力降级 | 已有 `bun:sqlite` 回落；V2 主路径本就不依赖 DB |
| R8 | 放弃 V1 < 1.18.29 引发存量用户投诉 | 支持面收窄 | 在 readme 与安装输出中明示最低版本 |
| R9 | V2 无 `client.app.log`，日志丢失 | 排障难度上升 | 统一封装 `log()`，V2 走 `console`，V1 保留结构化日志 |

## Verification Strategy

1. **双机矩阵**：opencode 1.18.29+ 与 2.x 各一台环境，Windows 优先（本项目主要开发环境）。
2. **逐工具清单**：15 个 `impm_*` 工具在两版本下各调用一次，比对输出。
3. **端到端**：`/impm-init` → `/impm-docs` → `/impm-coding` → `/impm-finish` 两版本各跑一轮。
4. **跨版本升级**：1.x 装好 → 升 2.x → 零配置修改可用。
5. **静态检查**：`src/**` 中不得出现 `time_created` / `time_updated` / `json_extract(data` 等 V1 DB 字段引用。