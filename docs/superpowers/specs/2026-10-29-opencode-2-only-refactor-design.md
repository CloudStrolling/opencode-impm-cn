# impm 3.0.0：仅支持 opencode 2.x 的全面重构设计

- 状态：已确认（2026-10-29）
- 目标版本：`opencode-impm-cn` 3.0.0
- 目标宿主：opencode >= 2.0.0
- 作者：jenemy8023

## 1. 背景与目标

2.0.x 通过"双形态入口"同时支持 opencode 1.x 与 2.x：`src/index.ts` 同时导出 `setup`（2.x）与 `server`（1.x），运行时层拆成 `src/runtime/v1.ts` 与 `src/runtime/v2.ts`，工具定义维护 V1/V2 两套参数与结果转换，配置与资产也做双键写入（`plugin` + `plugins`、`agent` + `agents`）。

双形态带来持续成本：

- 两套运行时、两套工具转换、两套配置写入，任何改动都要双份验证；
- `src/runtime/v2.ts` 使用手写的结构化类型描述 2.x 上下文，与官方契约存在漂移风险；
- 1.x 已经不再是目标宿主，兼容代码只增加阅读与维护负担。

本次重构删除全部 1.x 支持，把代码、类型、资产、安装脚本、配置与文档统一到 opencode 2.x 原生形态，对外名称（工具名、agent id、命令名）保持不变，只改变定义语法与实现。

**成功标准**

1. `npm run build` 零错误；产物 `dist/` 不引用任何 1.x API，且运行时依赖为零。
2. 在 opencode 2.1.4 上加载插件后，15 个工具可用，prompt 记录与 heartbeat 正常工作。
3. 安装脚本只生成 2.x 配置（`plugins` / `agents`），重复执行幂等。
4. 13 个 agent 与 66 个命令的文件只含 2.x 字段。
5. `npm test` 全绿，覆盖启动、版本闸门、资产字段、安装产物。

## 2. 范围与非目标

**范围**

- 运行时层按 2.x 契约重排（`src/plugin/`、`src/host/`、`src/tools/`）。
- 删除 `src/runtime/`、1.x 宿主探测、1.x 会话端口、双形态类型。
- 工具定义收敛为单一 2.x 形态。
- prompt-recorder 与 heartbeat 的数据层从旧表迁移到 2.x 表。
- `assets/agents`、`assets/commands`、`assets/agent-models.json` 原生 2.x 重写。
- 仓库根 `opencode.json` 迁到 2.x 形态。
- 安装/卸载脚本去掉双版本分支。
- 版本 3.0.0、文档与 CHANGELOG 更新、测试体系建立。

**非目标**

- 不改任何工具名、agent id、命令名、skill id。
- 不改 15 个工具的业务语义（除数据源换表外）。
- 不引入新的运行时依赖；`@opencode/plugin` 仅作类型引用。
- 不兼容 1.x 时代写入旧表（`session` / `message` / `part`）的历史会话。
- 不做无关重构（`utils/` 与工具内部逻辑保持原样，除必要改动）。

## 3. 关键决策

| # | 决策 | 说明 |
|---|---|---|
| 1 | 版本号 3.0.0 | 破坏性变更，CHANGELOG 需给出迁移指引，前置条件 opencode >= 2.0.0 |
| 2 | `@opencode/plugin` 仅 devDependency | 只做 `import type`，编译后擦除；运行时输出等价 `{ id, setup }` 对象，dist 零运行时依赖 |
| 3 | 资产全量原生 2.x 重写 | 不做"默认拒绝"基线，保持既有语义 |
| 4 | `.opencode/` 自安装产物不入库 | `.gitignore` + `git rm -r --cached`，由 installer 在本地生成 |
| 5 | 1.x 宿主非崩溃降级 | 打印明确错误后返回空操作，不注册工具/钩子，不抛异常 |
| 6 | 测试用 `node --test` | 零新依赖；构建后对 `dist/` 做黑盒断言 |
| 7 | 数据层适配 2.x 表 | 保留 SQLite 直读，不再读旧表 |
| 8 | 实现路线 B | 按 2.x 契约重排运行时层，而不是原地删除或最小删除 |
| 9 | 旧表不兼容 | 1.x 时代会话不再可导出，作为破坏性变更写入 CHANGELOG |

## 4. 目标架构

```
src/
  index.ts                 # export default { id: "impm", setup }
  plugin/
    contract.ts            # 唯一 import type "@opencode/plugin" 的文件，导出内部窄类型
    setup.ts               # createSetup(deps) + 默认 setup；编排整个启动流程
    location.ts            # resolveDirectory(ctx, sessionID)
    tools.ts               # 静态 + 动态工具统一注册
    prompt-hook.ts         # session.hook("prompt") → recorder.onPrompt
    events.ts              # event.subscribe 消费循环 + AbortController
    session-port.ts        # { interrupt, prompt, get } 注入给 heartbeat
  host/
    version.ts             # readHostVersion(ctx) / isSupported(major)
    install.ts             # ensureInstalled(projectRoot, pluginRoot)
    log.ts                 # console 结构化日志
  tools/                   # 现有 15 个工具（V2-only 改造）
  utils/                   # 不变
  types/                   # bun-sqlite.d.ts、install-core.d.ts（同步更新）
```

**删除**

- `src/runtime/v1.ts`、`src/runtime/v2.ts`（整个 `src/runtime/` 目录）
- `src/host/detect.ts`（由 `host/version.ts` 取代）
- `src/host/session.ts`（由 `plugin/session-port.ts` 取代）
- `src/host/plugin-types.ts`（由 `plugin/contract.ts` 取代）

**职责边界**

| 模块 | 职责 | 依赖 |
|---|---|---|
| `plugin/contract.ts` | 把官方上下文类型收敛为内部别名 | 仅 `@opencode/plugin`（type-only） |
| `plugin/setup.ts` | 编排：版本闸门 → 自安装 → 数据层 → 注册 → cleanup | 其余所有模块 |
| `plugin/tools.ts` | 把 `ToolDef[]` 注册进 `ctx.tool.transform` | contract、tools/tool-defs |
| `plugin/prompt-hook.ts` | 把 `ctx.session.hook("prompt")` 适配成 `onPrompt(sessionID, text)` | contract |
| `plugin/events.ts` | 订阅 `ctx.event` 并分发给 recorder/heartbeat | contract |
| `plugin/session-port.ts` | 封装 `ctx.session.interrupt/prompt/get` | contract |
| `plugin/location.ts` | 解析会话所在目录（location → session.get → subpath） | contract |
| `host/version.ts` | 读 `ctx.app.version`，判断主版本 | contract、log |
| `host/install.ts` | 版本变化时调用 `scripts/install-core.mjs` | log |
| `host/log.ts` | console 输出 | 无 |

## 5. 契约层

`src/plugin/contract.ts` 是唯一接触 `@opencode/plugin` 的文件。要求：

1. 只使用 `import type`，确保编译产物不产生任何 `require`/`import`。
2. 官方导出名与预期不一致时（例如 `Plugin` 为命名空间、`setup` 上下文类型未直接导出），在本文件内用 `Parameters<typeof Plugin.define>[0]` 一类推导取得，不把推导细节扩散到其它文件。
3. 对外导出（命名可在实现时微调，但语义固定）：

```ts
export type ImpmContext = /* 官方 setup 上下文 */;
export type ImpmToolContext = /* 工具 execute 的第二个参数 */;
export type ImpmPromptEvent = /* session.hook("prompt") 回调参数 */;
export type Cleanup = () => void | Promise<void>;
export interface ToolEditor { add(tool: ImpmTool): void }
export interface ImpmTool {
    name: string;
    description: string;
    input: Record<string, unknown>;
    execute(input: Record<string, unknown>, context: ImpmToolContext): Promise<{ content: string }>;
}
```

4. 内部代码不出现 `any`，不出现 `unknown` 强转成具体形状后再访问属性而不做守卫。

`src/plugin/contract.ts` 里同时用 `satisfies` 或显式标注保证默认导出对象符合官方插件形状：

```ts
// src/index.ts
import type { Plugin } from "@opencode/plugin";
import { createSetup } from "./plugin/setup.js";

export default { id: "impm", setup: createSetup() } satisfies Plugin;
```

`Plugin` 若不是对象类型（例如是命名空间），改用 `Parameters<typeof Plugin.define>[0]` 标注，效果等价：编译期由官方类型校验，运行期不带依赖。

## 6. 启动流程

```ts
export function createSetup(deps: SetupDeps = defaultDeps) {
  return async function setup(ctx: ImpmContext): Promise<Cleanup | undefined> {
    // 1. 版本闸门
    const host = readHostVersion(ctx);          // { raw: "2.1.4", major: 2 } | { raw, major: NaN }
    if (!isSupported(host)) {                   // major < 2
      log.error(`impm 3.0.0 需要 opencode >= 2.0.0，当前 ${host.raw}；已跳过全部功能注册`);
      return undefined;
    }

    // 2. 目录与自安装
    const projectRoot = ctx.location.directory;
    await deps.ensureInstalled(projectRoot, resolvePluginRoot(import.meta.url));

    // 3. 会话端口与数据层
    const sessionPort = deps.createSessionPort(ctx);
    const recorder = await deps.createPromptRecorder(projectRoot);
    const heartbeat = await deps.createHeartbeatMonitor(projectRoot, sessionPort);

    // 4. 工具注册（11 静态 + 4 动态 = 15）
    await registerTools(ctx, [...STATIC_TOOL_DEFS, ...recorder.tools, ...heartbeat.tools], { projectRoot, sessionPort });

    // 5. prompt 钩子
    await registerPromptHook(ctx, (event) => recorder.onPrompt(event.sessionID, event.text));

    // 6. 事件订阅 + cleanup
    const abort = new AbortController();
    const consumer = deps.startEventLoop(ctx, abort.signal, [recorder, heartbeat]);
    return () => { abort.abort(); return consumer; };
  };
}
```

`SetupDeps` 是测试缝，字段为 `readHostVersion`、`ensureInstalled`、`createSessionPort`、`createPromptRecorder`、`createHeartbeatMonitor`、`startEventLoop`。默认实现即上文模块；测试注入假实现后无需真实数据库与网络。

## 7. 版本闸门

`src/host/version.ts`

```ts
export interface HostVersion { raw: string; major: number }

export function readHostVersion(ctx: ImpmContext): HostVersion {
    const raw = ctx.app.version;                 // 同步读取，2.x 保证存在
    const major = Number.parseInt(String(raw).split(".")[0] ?? "", 10);
    return { raw: String(raw), major: Number.isFinite(major) ? major : Number.NaN };
}

export function isSupported(host: HostVersion): boolean {
    if (Number.isNaN(host.major)) return true;   // 不可解析按向前兼容放行
    return host.major >= 2;
}
```

- `major < 2`：`log.error` + 返回 `undefined`，不注册任何东西。
- `major >= 2`：正常启动。
- 不可解析（如 `"dev"`）：`log.warn` 后放行，避免未来版本被误杀。

删除 `HostMajor = 1 | 2`、`client.app.get()` 回退、默认按 1 处理的逻辑。

## 8. 工具层

`src/tools/tool-defs.ts` 收敛为单一形态：

```ts
export interface PropSchema { type: "string" | "array"; items?: "string"; description: string }

export interface ToolDef {
    name: string;
    description: string;
    props: PropSchemas;
    run(args: Record<string, unknown>, ports: ToolPorts): string | Promise<string>;
}

export function toInputSchema(props: PropSchemas): Record<string, unknown>; // { type:"object", properties, required:[], additionalProperties:false }
export function textResult(text: string): { content: string };
```

删除 `toV1Args`、`toV2Input`、`toV2Result`、`toV1Result`、`toText` 中所有 1.x 专用分支，只保留一个输入 schema 生成器与一个结果包装器。

- 11 个静态工具定义不动，只换输出形态。
- `createPromptRecorder` 返回 `{ tools: ToolDef[], onPrompt, onEvent, dispose? }`（不再返回 V1 `tool` map）。
- `createHeartbeatMonitor` 返回 `{ tools: ToolDef[], onEvent, dispose? }`。
- `plugin/tools.ts` 遍历 `ToolDef[]`，为每个工具调用 `editor.add({ name, description, input: toInputSchema(props), execute })`，`execute` 内调用 `def.run(input, ports)` 并返回 `textResult(...)`。
- 删除 `adaptDynamicTool`。

**不变量**：注册工具数恒为 15；所有 `input` 满足 `type === "object"`、`additionalProperties === false`、`properties` 键集合与 `props` 完全一致。

## 9. prompt 钩子与事件

**prompt 钩子**（`plugin/prompt-hook.ts`）

```ts
await ctx.session.hook("prompt", (event) => {
    const sessionID = String(event.sessionID);
    const text = String(event.prompt?.text ?? "");
    if (!sessionID || !text) return;
    onPrompt(sessionID, text);
});
```

- 适配层只做取值与守卫，不读 `event.prompt.parts` 之外的内部结构。
- 记录失败不影响宿主：`onPrompt` 内部 try/catch + `log.warn`。
- 1.x 的 `chat.message` 适配代码（构造 `{ parts: [...] }` 再交给 `chatMessage`）删除。

**事件循环**（`plugin/events.ts`）

```ts
export function startEventLoop(ctx, signal, consumers): Promise<void> {
    return (async () => {
        try {
            for await (const event of ctx.event.subscribe({ signal })) {
                await Promise.all(consumers.map((c) => c.onEvent(event)));
            }
        } catch (error) {
            if (!signal.aborted) log.warn(`事件订阅中断：${describe(error)}`);
        }
    })();
}
```

- `cleanup` 中 `abort.abort()`，循环退出，返回的 Promise 被 await 时不会悬挂。
- 单个 consumer 抛错不影响其它 consumer（各自内部捕获，外层再兜一层）。

## 10. 会话端口

`src/plugin/session-port.ts`

```ts
export interface SessionPort {
    interrupt(sessionID: string): Promise<OpResult>;
    prompt(sessionID: string, text: string): Promise<OpResult>;
    get(sessionID: string): Promise<{ directory?: string } | undefined>;
}
export interface OpResult { ok: boolean; detail: string }
```

- 只调用 `ctx.session.interrupt` / `ctx.session.prompt` / `ctx.session.get`。
- `interrupt` 的参数键以安装的 `@opencode/plugin` 类型为准（`resume` 与 `continue` 二选一），由 `tsc` 校验，不靠记忆。
- heartbeat 只依赖 `SessionPort`，不再接收裸 `client`，删除两套参数形态兼容代码。

## 11. 自安装

`src/host/install.ts`

```ts
export async function ensureInstalled(projectRoot: string, pluginRoot: string): Promise<void> {
    const version = readPackageVersion(pluginRoot);
    const manifest = readJson(join(projectRoot, ".opencode", "impm-manifest.json"));
    if (manifest?.installedVersion === version) return;
    const mod = await import(pathToFileURL(join(pluginRoot, "scripts", "install-core.mjs")).href);
    await mod.runInstall({ pluginRoot, projectRoot, version });
}
```

- 只比较 `installedVersion`，删除 `hostMajor` 维度。
- 失败不再静默：`log.warn` 输出原因与可执行的手动安装命令。
- `resolvePluginRoot(import.meta.url)` 的向上查找逻辑保留（最多 5 层，按 `package.json` 的 `name` 命中）。

## 12. 日志

`src/host/log.ts` 收敛为：

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry { service: string; level: LogLevel; message: string; extra?: unknown }
export function log(level: LogLevel, message: string, extra?: unknown): void; // console + [impm] 前缀
```

删除模块级 `structuredSink`、`bindStructuredLogger`、`safeStringify` 的全局状态（`safeStringify` 可作为纯函数保留供 `extra` 序列化）。

## 13. 数据层：prompt-recorder 换表

**表映射**

| 用途 | 旧 | 新 |
|---|---|---|
| 会话主表 | `session` | `session_v2` |
| 消息 | `message` | `session_message`（`type` + `data` JSON） |
| 消息部件 | `part` | `session_message.data.content[]`（assistant 承载） |

**SQL**

```sql
-- 会话头部
SELECT id, parent_id, title, time_created, time_updated,
       tokens_input, tokens_output, tokens_reasoning,
       tokens_cache_read, tokens_cache_write, agent, model
FROM session_v2 WHERE id = ?

-- 会话全部消息
SELECT id, type, seq, time_created, time_updated, data
FROM session_message WHERE session_id = ? ORDER BY seq ASC

-- 父会话
SELECT parent_id FROM session_v2 WHERE id = ?
```

**data 解析**（按 `type` 分支，全部做守卫，坏数据跳过而非抛错）

- `user`：`{ text, time, metadata: { displayText, agent, model, comments?, attachments? } }`
- `assistant`：`{ time, agent, model, content: [{ type: "text" | "tool" | ..., ... }] }`，文本取 `type === "text"` 的 `text`，工具调用取 `type === "tool"` 的 `name` 与 `state`
- `system` / `synthetic` / `compaction` / `idle` / `agent-switched` / `model-switched`：只保留能映射到现有 `prompts.md` 结构的字段，其余忽略

**每轮 token**：`session_message` 不含 per-message usage，改为会话聚合增量。

1. 收到 prompt 时读取 `session_v2` 的 5 个 token 列作为 `before` 快照，按 `sessionID` 暂存（同一会话串行处理，后到的 prompt 覆盖前一次快照）；
2. 回合结束事件到达时再读一次作为 `after`；
3. 写入记录的 token 为 `max(0, after - before)`，并在导出中标注 `（会话聚合增量，近似值）`。

**其它**

- `openDb` 保持 `node:sqlite` 优先、`bun:sqlite` 回退、只读打开。
- `defaultDbPath()` 不变（`OPENCODE_DATA` 覆盖，否则 `~/.local/share/opencode/opencode.db`）。
- 工具 `dbPath` 参数与说明文字同步为 2.x 路径与"仅支持 2.x 会话"的提示。
- 不实现旧表回退：旧 `session`/`message`/`part` 完全不读。

## 14. 数据层：heartbeat

- 活跃时间来源：优先 `ctx.event` 实时事件（`plugin/events.ts` 分发）；DB 兜底改为

```sql
SELECT time_updated FROM session_v2 WHERE id = ?
```

- 卡死判定阈值、自动重启流程、告警记录结构不变。
- 重启通过注入的 `SessionPort`（`interrupt` / `prompt`）执行，不再直连 client。
- 删除旧表 `message`/`part` 的 `latestDbActivity()` 查询。

## 15. 资产：agents

13 个文件只保留 V2 字段：`description`、`mode`、`model`、`permissions`。

**权限映射表**

| V1 键 | V2 规则 |
|---|---|
| `bash` | `{ action: "shell", effect: <原值> }` |
| `write` / `edit` / `patch` | 合并为 `{ action: "edit", effect: <更严格者> }` |
| `read` / `grep` / `glob` / `webfetch` / `websearch` / `skill` / `question` | 同名 action |
| `todowrite` | 删除（2.x 无此工具） |
| `impm_*` | 原样作为 action（自定义工具名可作 action，实现时以运行时工具清单校验） |
| `task: { <agent>: allow|deny|ask }` | `{ action: "subagent", resource: "<agent>", effect }`，`"*"` 原样映射 |

**排序规则**（最后匹配者胜）：通配在前，具体在后。

1. `action: "*"` 的规则
2. `resource: "*"` 的规则
3. 具体 action 与具体 agent 名

同一范围内若 allow 与 deny 同时存在，deny 在前、allow 在后（后者胜）；ask 与 allow 冲突时把 ask 放后面，保留"显式询问"的语义。

示例（`sse` 的 `task` 映射）：

```yaml
permissions:
  - { action: "subagent", resource: "*", effect: "deny" }
  - { action: "subagent", resource: "cs", effect: "allow" }
  - { action: "subagent", resource: "ws", effect: "allow" }
  - { action: "subagent", resource: "dba", effect: "allow" }
```

示例（`pm` 的片段）：

```yaml
permissions:
  - { action: "edit", effect: "allow" }
  - { action: "read", effect: "allow" }
  - { action: "shell", effect: "allow" }
  - { action: "impm_git", effect: "allow" }
  - { action: "subagent", resource: "ba", effect: "allow" }
```

- `temperature` 删除：2.x session runner 不会随请求下发该字段，模型温度迁移到 provider/model/variant 配置。
- `mode` 保留原值（`primary` / `subagent`）。
- 不补默认拒绝基线：只翻译 V1 中显式出现的条目。

## 16. 资产：commands

66 个文件仅做一处替换：`subtask: false` → `subagent: false`。正文（模板主体）零改动。校验其它 V1 专属字段（`template`、`tools`、`permission`）不存在。

## 17. 模型预设与配置

**`assets/agent-models.json`**

```json
{ "name": "...", "model": "provider/model", "variant": "high" }
```

- 删除 `reasoning_effort`。
- `max` → `high`、空 → `medium` 的映射保留在 installer 内。

**写入配置**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-impm-cn", "opencode-browser"],
  "agents": {
    "pm": { "model": "provider/model#high" }
  },
  "mcp": { "servers": { "browsermcp": { "type": "local", "command": ["npx", "-y", "@browsermcp/mcp@0.1.3"] } } }
}
```

- 只写 `agents` / `plugins`，不再写 `agent` / `plugin`。
- `model` 统一为 `provider/model#variant`。
- MCP 用 `mcp.servers`；`enabled: true` 改为省略或 `disabled: false`（按官方 schema 校验）。

**仓库根 `opencode.json`** 按上述形态手工迁移，13 个 agent 的模型与 variant 与 `agent-models.json` 保持一致。

## 18. installer 改造

`scripts/install-core.mjs`：

- 删除 `AGENT_CONFIG_KEYS` / `PLUGIN_CONFIG_KEYS` 双写，仅操作 `agents` / `plugins`。
- 删除 `detectHostMajor`、`hostMajor` 参数与 manifest 字段。
- `applyAgentConfig` 只写 `config.agents[name] = { model: \`${model}#${variant}\` }`；`clear` 只清理 `agents` 键。
- `mergePluginEntries` 保留（仍要兼容字符串与 `{ package, options }` 两种条目形态）。
- 卸载路径同步只清理 `agents` / `plugins` 与 `.opencode/{agents,commands,skills,plugins}` 中 impm 拥有的文件。
- manifest 结构变为 `{ installedVersion, everInstalled: { agents, commands, skills }, pluginNames, pkgJsonTypeModule }`。

`scripts/install.mjs`、`install.ps1`、uninstall 两个入口：删除 `--host`/`-Host` 一类参数与相关提示文案。

## 19. `.opencode/` 产物出库

```
git rm -r --cached .opencode/agents .opencode/commands .opencode/skills .opencode/plugins
git rm --cached .opencode/impm-manifest.json .opencode/package.json
```

`.gitignore` 增加：

```
.opencode/agents/
.opencode/commands/
.opencode/skills/
.opencode/plugins/
.opencode/impm-manifest.json
.opencode/package.json
```

本仓库自身安装时由 installer 重新生成为未跟踪文件。

## 20. 包元数据与发布

`package.json`：

- `version`: `3.0.0`
- `engines.opencode`: `">=2.0.0"`，`engines.node`: `">=22.5.0"`（`node:sqlite` 需要）
- 删除 `peerDependencies`；新增 `devDependencies["@opencode/plugin"]: "^2.2.0"`
- 新增 `"test": "npm run build && node --test test/"`

`src/index.ts` 默认导出保持 `{ id: "impm", setup }`，`main`/`types` 指向 `dist/` 不变。

## 21. 测试策略

`test/` 下 5 个文件，全部 `node --test`，import `dist/`（先构建）。

**1. `test/setup.test.mjs`**

假 ctx：

```js
const ctx = {
  app: { version: "2.1.4" },
  location: { directory: tmpdir },
  tool: { transform: async (fn) => fn({ add: (t) => registered.push(t) }) },
  session: { hook: async (name, fn) => { hooks[name] = fn }, get: async () => ({}) },
  event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {} }) },
};
```

断言：

- `registered.length === 15`，名称集合等于 11 静态 + 4 动态工具名；
- 每个工具的 `input.type === "object"`、`input.additionalProperties === false`、`input.properties` 非空；
- `hooks.prompt` 存在，调用后 `onPrompt` 收到 `(sessionID, text)`；
- 返回的 cleanup 可调用且不抛错；
- 注入的 `ensureInstalled` 被调用一次，参数含 `projectRoot`。

**2. `test/version-gate.test.mjs`**

- `app.version = "1.18.29"` → `transform` 零调用、`hook` 零调用、返回 `undefined`、无异常；
- `app.version = "2.0.0"` → 正常注册；
- `app.version = "dev"` → warn 后正常注册。

**3. `test/frontmatter.test.mjs`**

- 解析 `assets/agents/*.md`：数量 13；字段 ⊆ `{description, mode, model, permissions}`；不含 `temperature`/`permission`/`tools`；`permissions` 每项含 `action` 与 `effect`，`effect ∈ {allow, ask, deny}`；通配规则索引小于具体规则索引。
- 解析 `assets/commands/*.md`：数量 66；字段 ⊆ `{description, agent, model, subagent}`；不含 `subtask`/`template`/`tools`。
- 解析手写 YAML 的最小实现（缩进与 `- ` 列表）放在 `test/helpers/frontmatter.mjs`，不引入依赖。

**4. `test/install.test.mjs`**

在 `mkdtemp` 目录内调用 `runInstall({ pluginRoot, projectRoot, version: "3.0.0" })`：

- 生成 `opencode.json` 含 `plugins` 与 `agents`，不含 `plugin` / `agent`；
- 每个 `agents[*].model` 含 `#`；
- manifest 无 `hostMajor`，`installedVersion === "3.0.0"`；
- 连续执行两次，第二次输出与第一次一致（幂等）；
- `.opencode/plugins/impm.js` 存在且导出 `./impm/dist/index.js`。

**5. `test/tool-defs.test.mjs`**

- 11 个静态工具 `description` 非空、`props` 每个字段有 `type` 与 `description`；
- `toInputSchema` 对 `array` 类型生成 `{ type: "array", items: { type: "string" } }`；
- `textResult` 返回 `{ content: string }`。

## 22. 文档更新

- `readme.md`：前置条件只写 opencode >= 2.0.0；删除 1.x 安装路径、`plugin` 键、"1.x 停在 1.1.2"的说明；新增"从 2.x 升级到 3.0.0"小节；模型预设表改为 variant 说明。
- `CHANGELOG.md`：新增 `[3.0.0]`，列出破坏性变更与迁移步骤（见第 23 节）。
- `agent.md`：权限模型改为 2.x 有序规则；说明 `bash`→`shell`、`write`/`edit`→`edit`、`task`→`subagent`、`todowrite` 已移除；补充"仅支持 2.x"。
- `deploy.md`：同步脚本参数变化（无 `--host`）。
- 保留历史 CHANGELOG 条目不动。

## 23. 用户侧迁移指引（写入 CHANGELOG）

1. 升级 opencode 到 >= 2.0.0（`opencode --version` 确认）。
2. 升级插件：`npm i -g opencode-impm-cn@3`，或在项目内更新依赖后重跑安装脚本。
3. 若手改过 `opencode.json`：把 `plugin` 改为 `plugins`、`agent` 改为 `agents`，agent 的 `model` 写成 `provider/model#variant`，`reasoning_effort` 删除。
4. 若手改过 `.opencode/agents/*.md`：`permission` 映射改为 `permissions` 规则列表，删除 `temperature`。
5. 若手改过 `.opencode/commands/*.md`：`subtask` 改为 `subagent`。
6. 旧版 `impm_prompt_export` 产物不含 2.x 会话；1.x 时代的历史会话不再可导出。

## 24. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `@opencode/plugin` 导出名与预期不符 | 契约集中在 `contract.ts`，用 `Parameters<typeof Plugin.define>` 推导；`tsc` 兜底 |
| `ctx.session.interrupt` 参数键不一致（`resume` vs `continue`） | 以安装包 `.d.ts` 为准，编译期校验 |
| 权限 action 名与 2.x 工具清单不符 | 实现时对照运行时工具清单；未知 action 不影响其它规则 |
| 换表后导出内容与旧 `prompts.md` 结构差异过大 | 保持 `prompts.md` 既有章节结构，只替换数据来源；差异写入 CHANGELOG |
| token 只有会话聚合增量 | 明确标注"近似值"，不做精确承诺 |
| 自安装失败导致资产滞后 | 失败改为 `log.warn` 并给出可执行的手动命令 |
| 测试用假 ctx 与真实契约漂移 | `contract.ts` 用官方类型标注默认导出，`tsc` 在构建期就会失败 |

## 25. 验收标准

- [ ] `npm run build` 零错误，`dist/` 内无 `@opencode/plugin` 的任何运行时引用（`grep -r "@opencode/plugin" dist/` 无命中）。
- [ ] `npm test` 全绿（5 个测试文件）。
- [ ] 仓库内无 1.x 残留符号：`runV1`、`toV1Args`、`toV1Result`、`detectHost`、`hostMajor`、`"chat.message"`、`server:` 入口、`subtask:`、`permission:`、`reasoning_effort`。
- [ ] `assets/agents` 13 个、`assets/commands` 66 个全部通过字段校验。
- [ ] 在临时项目跑 `runInstall` 生成 2.x 形态 `opencode.json`，重启后插件加载、15 个工具可见。
- [ ] 在 opencode 2.1.4 真机冒烟：`impm_project_info`、`impm_prompt_record`、`impm_heartbeat` 可调用；一次提问后 `prompts.md` 有记录且 token 标注为近似值。
- [ ] `readme.md`、`CHANGELOG.md`、`agent.md`、`deploy.md` 已更新且无 1.x 安装说明。

## 26. 实施顺序（供 writing-plans 细化）

1. 契约层与目录骨架（`contract.ts`、`log.ts`、`version.ts`）。
2. 工具层收敛（`tool-defs.ts`）与 15 个工具注册路径。
3. `plugin/setup.ts` 编排 + 钩子 + 事件 + 会话端口。
4. 数据层换表（prompt-recorder、heartbeat）。
5. 删除 `src/runtime/`、`host/detect.ts`、`host/session.ts`、`host/plugin-types.ts`，`tsc` 收敛。
6. 资产重写（agents、commands、agent-models、根 `opencode.json`）。
7. installer 与卸载脚本改造。
8. `.opencode/` 出库与 `.gitignore`。
9. 测试体系（5 个文件）。
10. 文档与 CHANGELOG、版本号、发布元数据。
11. 真机冒烟与最终验收。
