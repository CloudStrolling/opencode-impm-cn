# impm 3.0.0 仅支持 opencode 2.x 重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除全部 opencode 1.x 支持，把运行时、工具定义、数据层、资产、安装脚本、配置与文档统一到 opencode 2.x 原生形态，发布 `opencode-impm-cn@3.0.0`。

**Architecture:** 新增 `src/plugin/` 契约层（唯一 `import type` 官方包的文件）与编排层，用 `ctx.app.version` 做版本闸门，用 `ctx.tool.transform` / `ctx.session.hook("prompt")` / `ctx.event.subscribe` 注册能力；`src/tools/` 收敛为单一 2.x 工具形态；prompt-recorder 与 heartbeat 改读 `session_v2` / `session_message`；资产与 installer 只写 2.x 字段。

**Tech Stack:** TypeScript 5.7、Node.js >= 22.5（`node:sqlite`）、`node --test`、`@opencode/plugin@^2.2.0`（仅 devDependency，仅 `import type`）、opencode >= 2.0.0。

**Spec:** `docs/superpowers/specs/2026-10-29-opencode-2-only-refactor-design.md`

## Global Constraints

- 目标版本 `3.0.0`；`engines.opencode` = `">=2.0.0"`；`engines.node` = `">=22.5.0"`。
- 运行时依赖为零；`dist/` 内不得出现 `@opencode/plugin` 的任何运行时引用（只允许类型擦除）。
- `@opencode/plugin` 只允许以 `import type` 出现，且只出现在 `src/plugin/contract.ts`。
- 不修改任何对外名称：11 个静态工具名、4 个动态工具名、13 个 agent id、66 个命令名、skill id 全部不变。
- 不引入新依赖；测试只用 `node:test` 与 `node:assert/strict`。
- 代码注释与用户可见文案使用简体中文。
- 下列符号不得在仓库内残留：`runV1`、`runV2`、`toV1Args`、`toV1Result`、`toV2Input`、`toV2Result`、`adaptDynamicTool`、`detectHost`、`hostMajor`、`DualVersionPlugin`、`"chat.message"`、`server:` 入口、`subtask:`、`permission:`、`reasoning_effort`。
- 官方契约以 `@opencode/plugin@2.2.0` 为准：`Plugin` 是命名空间，插件对象类型用 `Parameters<typeof Plugin.define>[0]`。
- 本机验证环境：opencode `2.1.4`、node `24.13.1`。

## Review Focus

以下五类输入/条件规格未直接覆盖，但破坏面最大，必须在所属任务里用测试钉住：

1. **`ctx.app.version` 缺失或非数字**：宿主版本异常时会得到 `undefined` 或 `"dev"`，用户期望插件不崩溃、打印告警后照常启动 → `test/setup.test.mjs`。
2. **工具收到非对象入参**（`null` / 字符串 / 数组）：模型可能违反 schema，用户期望得到可读错误文本，而不是宿主侧工具崩溃 → `test/setup.test.mjs`。
3. **cleanup 被重复调用、事件流已被中断**：宿主重载插件时可能二次清理，用户期望不抛错、不悬挂 → `test/setup.test.mjs`。
4. **`session_message.data` 非法 JSON 或未知 `type`**：数据库里有历史坏行，用户期望跳过该行继续导出，而不是整个 `prompts.md` 更新失败 → `test/prompt-recorder.test.mjs`。
5. **目标会话在 `session_v2` 中不存在（1.x 老会话）**：用户期望得到明确的“无 2.x 会话”提示，而不是异常堆栈 → `test/prompt-recorder.test.mjs`。

---

### Task 1: 包元数据、契约层与版本闸门

**Files:**
- Modify: `package.json`
- Create: `src/plugin/contract.ts`
- Create: `src/host/version.ts`
- Test: `test/version-gate.test.mjs`

**Interfaces:**
- Consumes: 无（本任务只依赖官方包类型）。
- Produces:
  - `contract.ts`: `type PluginDefinition`、`type ImpmContext`、`type Cleanup`。
  - `version.ts`: `interface HostVersion { raw: string; major: number }`、`readHostVersion(ctx: ImpmContext): HostVersion`、`isSupported(host: HostVersion): boolean`。

- [ ] **Step 1: 写失败测试**

创建 `test/version-gate.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readHostVersion, isSupported } from "../dist/host/version.js";

/** 只带 app.version 的假上下文，version.ts 不读取其它字段 */
const fakeCtx = (version) => ({ app: { version } });

test("解析 2.x 主版本并放行", () => {
    const host = readHostVersion(fakeCtx("2.1.4"));
    assert.equal(host.raw, "2.1.4");
    assert.equal(host.major, 2);
    assert.equal(isSupported(host), true);
});

test("1.x 主版本被拒绝", () => {
    const host = readHostVersion(fakeCtx("1.18.29"));
    assert.equal(host.major, 1);
    assert.equal(isSupported(host), false);
});

test("不可解析的版本放行且标记 NaN", () => {
    const host = readHostVersion(fakeCtx("dev"));
    assert.equal(host.raw, "dev");
    assert.ok(Number.isNaN(host.major));
    assert.equal(isSupported(host), true);
});

test("缺少 version 字段时不抛异常并放行", () => {
    const host = readHostVersion(fakeCtx(undefined));
    assert.ok(Number.isNaN(host.major));
    assert.equal(isSupported(host), true);
});

test("空串版本不抛异常并放行", () => {
    const host = readHostVersion(fakeCtx(""));
    assert.ok(Number.isNaN(host.major));
    assert.equal(isSupported(host), true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/version-gate.test.mjs`
Expected: FAIL，报 `Cannot find module '.../dist/host/version.js'`。

- [ ] **Step 3: 写契约层**

创建 `src/plugin/contract.ts`（全仓库唯一引用官方包的文件，只做类型推导）：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * 官方插件契约的类型收敛层。
 *
 * 只允许本文件 `import type` `@opencode/plugin`，编译后不会留下任何运行时引用。
 * 官方把 `Plugin` 导出为命名空间，因此插件对象类型必须从 `Plugin.define` 推导。
 */

import type { Plugin } from "@opencode/plugin";

/** 官方插件对象形状：`{ id, setup }` */
export type PluginDefinition = Parameters<typeof Plugin.define>[0];

/** setup 回调收到的插件上下文 */
export type ImpmContext = Parameters<PluginDefinition["setup"]>[0];

/** 插件卸载回调 */
export type Cleanup = () => void | Promise<void>;
```

- [ ] **Step 4: 写版本闸门**

创建 `src/host/version.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

/** opencode 宿主版本 */
export interface HostVersion {
    /** 原始版本号字符串，例如 "2.1.4" */
    raw: string;
    /** 主版本号；无法解析时为 NaN */
    major: number;
}

/**
 * 同步读取宿主版本。
 *
 * opencode 2.x 保证 `ctx.app.version` 存在；这里仍对缺失值做守卫，
 * 避免测试桩或异常宿主导致插件启动即崩溃。
 */
export function readHostVersion(ctx: { app?: { version?: unknown } }): HostVersion {
    const raw = ctx.app?.version === undefined ? "" : String(ctx.app.version);
    const major = Number.parseInt(raw.split(".")[0] ?? "", 10);
    return { raw, major: Number.isFinite(major) ? major : Number.NaN };
}

/**
 * 判断宿主是否受支持。
 *
 * 主版本低于 2 直接拒绝；无法解析时按向前兼容放行，
 * 避免未来版本（如 "3.0.0-dev"）被误杀。
 */
export function isSupported(host: HostVersion): boolean {
    if (Number.isNaN(host.major)) return true;
    return host.major >= 2;
}
```

- [ ] **Step 5: 构建并运行测试确认通过**

Run: `npm run build && node --test test/version-gate.test.mjs`
Expected: 编译零错误，5 个用例全部 PASS。

- [ ] **Step 6: 更新包元数据**

修改 `package.json`，只改以下字段（其余保持原样）：

```json
{
    "version": "3.0.0",
    "scripts": {
        "build": "tsc",
        "dev": "tsc --watch",
        "prepublishOnly": "npm run build",
        "test": "npm run build && node --test test/",
        "install:plugin": "node scripts/install.mjs",
        "uninstall:plugin": "node scripts/uninstall.mjs",
        "postinstall": "node scripts/install.mjs"
    },
    "devDependencies": {
        "@opencode/plugin": "^2.2.0",
        "@types/node": "^22.0.0",
        "typescript": "^5.7.0"
    },
    "engines": {
        "node": ">=22.5.0",
        "opencode": ">=2.0.0"
    }
}
```

同时删除整个 `peerDependencies` 字段（不再声明 `@opencode/plugin` 运行时对等依赖）。

- [ ] **Step 7: 安装依赖并复跑**

Run: `npm install && npm test`
Expected: `node_modules/@opencode/plugin` 安装成功；`npm test` 全绿。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json src/plugin/contract.ts src/host/version.ts test/version-gate.test.mjs
git commit -m "feat(plugin): 引入 2.x 契约层与版本闸门，版本号升至 3.0.0"
```

---

### Task 2: 插件层与入口切换（删除 1.x 运行时）

**Files:**
- Create: `src/plugin/setup.ts`
- Create: `src/plugin/location.ts`
- Create: `src/plugin/session-port.ts`
- Create: `src/plugin/tools.ts`
- Create: `src/plugin/prompt-hook.ts`
- Create: `src/plugin/events.ts`
- Modify: `src/index.ts`
- Modify: `src/host/log.ts`
- Modify: `src/host/install.ts`
- Modify: `src/tools/tool-defs.ts`
- Modify: `src/tools/prompt-recorder.ts`（只改对外 API，数据层留到 Task 3）
- Modify: `src/tools/heartbeat.ts`（只改对外 API 与端口注入，数据层留到 Task 4）
- Delete: `src/runtime/v1.ts`、`src/runtime/v2.ts`、`src/host/detect.ts`、`src/host/session.ts`、`src/host/plugin-types.ts`
- Test: `test/setup.test.mjs`（新建）、`test/tool-defs.test.mjs`（新建）

**Interfaces:**
- Consumes: Task 1 的 `ImpmContext`、`PluginDefinition`、`Cleanup`、`readHostVersion`、`isSupported`。
- Produces:
  - `session-port.ts`: `interface SessionPort { interrupt(sessionID): Promise<OpResult>; prompt(sessionID, text): Promise<OpResult>; get(sessionID): Promise<{ directory?: string; parentID?: string } | undefined> }`、`interface OpResult { ok: boolean; detail: string }`、`createSessionPort(ctx): SessionPort`。
  - `events.ts`: `interface ImpmEvent { type: string; data?: unknown }`、`interface EventConsumer { onEvent(event: ImpmEvent): Promise<void> | void }`、`startEventLoop(ctx, signal, consumers): Promise<void>`。
  - `tools.ts`: `registerTools(ctx, defs, ports): Promise<void>`。
  - `prompt-hook.ts`: `registerPromptHook(ctx, onPrompt): Promise<void>`。
  - `setup.ts`: `interface SetupDeps`、`createSetup(deps?): (ctx) => Promise<Cleanup | undefined>`。
  - `tool-defs.ts`: `toInputSchema(props)`、`textResult(value)`，删除 `toV1Args` / `toV1Result` / `toV2Input` / `toV2Result` / `adaptDynamicTool` / `DynamicToolDef`。
  - `prompt-recorder.ts`: 返回 `{ tools: ToolDef[]; onPrompt(sessionID, text); onEvent(event); dispose?() }`。
  - `heartbeat.ts`: 返回 `{ tools: ToolDef[]; onEvent(event); dispose?() }`，第二参数改为 `SessionPort`。

- [ ] **Step 1: 编写启动流程的失败测试**

创建 `test/setup.test.mjs`（先确认失败）：

```js
import { createSetup } from "../dist/plugin/setup.js";

/** 构造可用假依赖：所有外部副作用都被替换 */
function fakeDeps(overrides = {}) {
    const calls = { ensureInstalled: [], onPrompt: [] };
    const deps = {
        readHostVersion: (ctx) => {
            const raw = ctx?.app?.version ?? "";
            const major = Number.parseInt(String(raw).split(".")[0] ?? "", 10);
            return { raw: String(raw), major: Number.isFinite(major) ? major : Number.NaN };
        },
        isSupported: (host) => (Number.isNaN(host.major) ? true : host.major >= 2),
        ensureInstalled: async (projectRoot, pluginRoot) => {
            calls.ensureInstalled.push([projectRoot, pluginRoot]);
        },
        createSessionPort: () => ({
            interrupt: async () => ({ ok: true, detail: "" }),
            prompt: async () => ({ ok: true, detail: "" }),
            get: async () => ({ directory: "/p" }),
        }),
        createPromptRecorder: async () => ({
            tools: ["impm_prompt_record", "impm_prompt_finalize", "impm_prompt_export"].map((name) => ({
                name,
                description: `${name} 描述`,
                props: { projectRoot: { type: "string", description: "项目根目录" } },
                run: () => `${name} ok`,
            })),
            onPrompt: (sessionID, text) => {
                calls.onPrompt.push([sessionID, text]);
            },
            onEvent: async () => {},
        }),
        createHeartbeatMonitor: async () => ({
            tools: [
                {
                    name: "impm_heartbeat",
                    description: "心跳",
                    props: { projectRoot: { type: "string", description: "项目根目录" } },
                    run: () => "ok",
                },
            ],
            onEvent: async () => {},
        }),
        startEventLoop: async () => {},
        ...overrides,
    };
    return { deps, calls };
}

test("1.x 宿主：不注册任何能力且返回 undefined", async () => {
    const { deps, calls } = fakeDeps();
    const ctx = { app: { version: "1.18.29" }, location: { directory: "/p" } };
    const cleanup = await createSetup(deps)(ctx);
    assert.equal(cleanup, undefined);
    assert.deepEqual(calls.ensureInstalled, []);
});

test("2.x 宿主：注册 15 个工具、prompt 钩子，并可重复 cleanup", async () => {
    const { deps, calls } = fakeDeps();
    const registered = [];
    const hooks = {};
    let aborted = false;
    const ctx = {
        app: { version: "2.1.4" },
        location: { directory: "/p" },
        tool: {
            transform: async (fn) => {
                fn({ add: (tool) => registered.push(tool) });
                return { dispose: async () => {} };
            },
        },
        session: {
            hook: async (name, fn) => {
                hooks[name] = fn;
                return { dispose: async () => {} };
            },
        },
        event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {} }) },
    };
    const cleanup = await createSetup(deps)(ctx);

    assert.equal(registered.length, 15);
    for (const tool of registered) {
        assert.equal(tool.input.type, "object");
        assert.equal(tool.input.additionalProperties, false);
        assert.ok(Object.keys(tool.input.properties).length > 0);
    }
    assert.equal(calls.ensureInstalled.length, 1);
    assert.equal(calls.ensureInstalled[0][0], "/p");

    await hooks.prompt({ sessionID: "ses_1", prompt: { text: "你好" } });
    assert.deepEqual(calls.onPrompt, [["ses_1", "你好"]]);

    await cleanup();
    await cleanup();
    assert.equal(aborted, false);
});

test("非对象入参返回可读错误而不是抛出", async () => {
    const { deps } = fakeDeps();
    const registered = [];
    const ctx = {
        app: { version: "2.1.4" },
        location: { directory: "/p" },
        tool: {
            transform: async (fn) => {
                fn({ add: (tool) => registered.push(tool) });
                return { dispose: async () => {} };
            },
        },
        session: { hook: async () => ({ dispose: async () => {} }) },
        event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {} }) },
    };
    await createSetup(deps)(ctx);
    const result = await registered[0].execute(null, {});
    assert.equal(typeof result.content, "string");
    assert.match(result.content, /JSON 对象/);
});

test("无法解析的版本：告警后正常注册", async () => {
    const { deps, calls } = fakeDeps();
    const ctx = {
        app: { version: "dev" },
        location: { directory: "/p" },
        tool: { transform: async () => ({ dispose: async () => {} }) },
        session: { hook: async () => ({ dispose: async () => {} }) },
        event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {} }) },
    };
    const cleanup = await createSetup(deps)(ctx);
    assert.equal(typeof cleanup, "function");
    assert.equal(calls.ensureInstalled.length, 1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && node --test test/setup.test.mjs`
Expected: FAIL，`dist/plugin/setup.js` 不存在。

- [ ] **Step 3: 重写日志层**

用下面内容整体替换 `src/host/log.ts`（删除 `structuredSink` 与 `bindStructuredLogger`）：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

/** 日志级别 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** 结构化日志条目（保留给调试输出使用） */
export interface LogEntry {
    service: string;
    level: LogLevel;
    message: string;
    extra?: unknown;
}

/** 控制台方法映射 */
const CONSOLE_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error",
};

/** 安全序列化：失败时降级为占位符，绝不抛出 */
export function safeStringify(value: unknown): string {
    try {
        const text = JSON.stringify(value);
        return text === undefined ? String(value) : text;
    } catch {
        return "[unserializable]";
    }
}

/** 把 unknown 错误归一为可读文本 */
export function describe(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : safeStringify(error);
}

/** 输出一行带 `[impm]` 前缀的日志 */
export function log(level: LogLevel, message: string, extra?: unknown): void {
    const line = `[impm] ${message}`;
    const method = CONSOLE_METHOD[level];
    if (extra === undefined) {
        console[method](line);
        return;
    }
    console[method](line, safeStringify(extra));
}
```

- [ ] **Step 4: 自安装去掉 hostMajor**

用下面内容整体替换 `src/host/install.ts` 中的清单读取与 `ensureInstalled` 部分（`resolvePluginRoot`、`getPluginVersion`、`PACKAGE_NAME`、`MAX_LOOKUP_DEPTH`、`isPluginPackageJson` 原样保留）：

```ts
/** 安装清单中本插件关心的字段 */
interface ManifestLike {
    installedVersion?: string;
}

/**
 * 启动自检：插件版本与本地安装记录不一致时重跑安装脚本。
 *
 * 只比较 `installedVersion`；3.0.0 起不再区分宿主主版本。
 */
export async function ensureInstalled(projectRoot: string, pluginRoot: string): Promise<void> {
    if (!projectRoot) return;
    const currentVersion = getPluginVersion(pluginRoot);
    if (!currentVersion) return;

    const manifestFile = join(projectRoot, ".opencode", "impm-manifest.json");
    try {
        const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as ManifestLike;
        if (manifest.installedVersion === currentVersion) return;
    } catch {
        // 清单缺失或损坏都按“未安装”处理
    }

    try {
        const modulePath = pathToFileURL(join(pluginRoot, "scripts", "install-core.mjs")).href;
        const mod = (await import(modulePath)) as {
            runInstall(options: { pluginRoot: string; projectRoot: string; version: string }): boolean;
        };
        mod.runInstall({ pluginRoot, projectRoot, version: currentVersion });
    } catch (error) {
        log("warn", `自动安装失败：${describe(error)}；可手动执行 node scripts/install.mjs --target "${projectRoot}"`);
    }
}
```

- [ ] **Step 5: 工具定义收敛**

修改 `src/tools/tool-defs.ts`：

1. 删除 `toV1Args`、`toV1Result`、`toV2Input`、`toV2Result`、`DynamicToolDef`、`adaptDynamicTool`。
2. `V2InputSchema` 改名为 `InputSchema`。
3. `ToolPorts` 收敛为 `{ projectRoot: string }`（不再依赖 `SessionPort`）。
4. 追加两个导出函数（`toText` 保留为内部函数）：

```ts
/** 生成 opencode 2.x 工具入参 JSON Schema */
export function toInputSchema(props: PropSchemas): InputSchema {
    return {
        type: "object",
        properties: { ...props },
        required: [],
        additionalProperties: false,
    };
}

/** 把工具返回值包装成 2.x 工具结果 */
export function textResult(value: unknown): { content: string } {
    return { content: toText(value) };
}
```

- [ ] **Step 6: 改造 prompt-recorder 对外 API（数据层不动）**

在 `src/tools/prompt-recorder.ts` 中：

1. 保持全部 SQL 与内部函数不变。
2. 在 `createPromptRecorder` 内部新增把现有工具转成 `ToolDef` 的适配函数：

```ts
/** 把内部工具形态转换为统一的 ToolDef */
function toToolDef(
    name: string,
    def: { description: string; args: Record<string, { type: "string"; description: string }>; execute(args: Record<string, unknown>): Promise<string> },
): ToolDef {
    return {
        name,
        description: def.description,
        props: def.args,
        run: (args) => def.execute(args),
    };
}
```

3. 返回值改为：

```ts
return {
    /** 3 个手动工具（记录 / 回填 token / 导出） */
    tools: [
        toToolDef("impm_prompt_record", recordTool),
        toToolDef("impm_prompt_finalize", finalizeTool),
        toToolDef("impm_prompt_export", exportTool),
    ],
    /** 用户提问时记录（由 prompt 钩子调用） */
    onPrompt: (sessionID: string, text: string) =>
        chatMessage({ sessionID }, { parts: [{ type: "text", text }] }),
    /** 宿主事件（由事件循环分发） */
    onEvent: (event: { type: string; data?: unknown }) => handleEvent({ event }),
};
```

其中 `recordTool` / `finalizeTool` / `exportTool` 就是原来的 `impm_prompt_record` / `impm_prompt_finalize` / `impm_prompt_export` 工具对象，`handleEvent` 就是原来的 `event` 函数。在文件顶部补 `import type { ToolDef } from "./tool-defs.js";`。

- [ ] **Step 7: 改造 heartbeat 对外 API 与端口注入**

在 `src/tools/heartbeat.ts` 中：

1. 删除 `OpencodeClientLike`，改为 `import type { SessionPort } from "../plugin/session-port.js";`。
2. 签名改为 `createHeartbeatMonitor(projectRoot: string, port: SessionPort)`。
3. 删除 `abortSession` 与 `chatSession` 两个函数，调用处替换为：

```ts
const result = await port.interrupt(sessionID);
if (!result.ok) log("warn", `中断会话 ${sessionID} 失败：${result.detail}`);
```

```ts
const result = await port.prompt(mainId, buildNudgeText(reason));
if (!result.ok) log("warn", `唤醒会话 ${mainId} 失败：${result.detail}`);
```

4. 返回值改为：

```ts
return {
    /** 手动工具：查看状态 / 立即扫描 / 查看告警 */
    tools: [
        {
            name: "impm_heartbeat",
            description: heartbeatTool.description,
            props: heartbeatTool.args,
            run: (args) => heartbeatTool.execute(args),
        },
    ],
    /** 宿主事件（由事件循环分发） */
    onEvent: (event: { type: string; data?: unknown }) => handleEvent({ event }),
    /** 卸载时清理定时器 */
    dispose: () => clearInterval(timer),
};
```

其中 `heartbeatTool` 与 `handleEvent` 为原 `tool.impm_heartbeat` 与 `event` 函数的重命名；`timer` 为原 `setInterval` 的返回值（若原代码用 `const timer` 之外的名字，统一改为 `timer`）。

- [ ] **Step 8: 新建会话端口与目录解析**

创建 `src/plugin/location.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from "node:path";
import { describe, log } from "../host/log.js";
import type { ImpmContext } from "./contract.js";

/** 会话所在位置 */
export interface SessionLocation {
    directory?: string;
    parentID?: string;
}

/**
 * 读取会话目录与父会话。
 *
 * 目录优先取 `session.get().location.directory`，再拼上 `subpath`；
 * 失败时返回 undefined，由调用方回退到项目根目录。
 */
export async function readSessionLocation(
    ctx: ImpmContext,
    sessionID: string,
): Promise<SessionLocation | undefined> {
    try {
        const info = await ctx.session.get({ sessionID });
        const base = info.location?.directory ? String(info.location.directory) : "";
        const subpath = info.subpath ? String(info.subpath) : "";
        return {
            directory: base ? (subpath ? join(base, subpath) : base) : undefined,
            parentID: info.parentID ? String(info.parentID) : undefined,
        };
    } catch (error) {
        log("debug", `无法解析会话 ${sessionID} 的位置：${describe(error)}`);
        return undefined;
    }
}

/** 解析会话目录，失败时回退到项目根目录 */
export async function resolveDirectory(ctx: ImpmContext, sessionID?: string): Promise<string> {
    const base = String(ctx.location.directory);
    if (!sessionID) return base;
    const location = await readSessionLocation(ctx, sessionID);
    return location?.directory ?? base;
}
```

创建 `src/plugin/session-port.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe } from "../host/log.js";
import type { ImpmContext } from "./contract.js";
import { readSessionLocation } from "./location.js";

/** 操作结果 */
export interface OpResult {
    ok: boolean;
    detail: string;
}

/** 会话操作端口：heartbeat 只依赖这个接口 */
export interface SessionPort {
    interrupt(sessionID: string): Promise<OpResult>;
    prompt(sessionID: string, text: string): Promise<OpResult>;
    get(sessionID: string): Promise<{ directory?: string; parentID?: string } | undefined>;
}

/** 基于 `ctx.session` 实现会话端口 */
export function createSessionPort(ctx: ImpmContext): SessionPort {
    return {
        async interrupt(sessionID) {
            try {
                await ctx.session.interrupt({ sessionID, resume: false });
                return { ok: true, detail: "已中断" };
            } catch (error) {
                return { ok: false, detail: describe(error) };
            }
        },
        async prompt(sessionID, text) {
            try {
                await ctx.session.prompt({ sessionID, text });
                return { ok: true, detail: "已注入" };
            } catch (error) {
                return { ok: false, detail: describe(error) };
            }
        },
        async get(sessionID) {
            return readSessionLocation(ctx, sessionID);
        },
    };
}
```

- [ ] **Step 9: 新建注册器、钩子与事件循环**

创建 `src/plugin/tools.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { toInputSchema, textResult } from "../tools/tool-defs.js";
import type { ToolDef, ToolPorts } from "../tools/tool-defs.js";
import type { ImpmContext } from "./contract.js";

/** 入参守卫：非对象一律视为非法调用 */
function asArgs(input: unknown): Record<string, unknown> | undefined {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    return input as Record<string, unknown>;
}

/** 把工具定义批量注册进宿主 */
export async function registerTools(ctx: ImpmContext, defs: ToolDef[], ports: ToolPorts): Promise<void> {
    await ctx.tool.transform((editor) => {
        for (const def of defs) {
            editor.add({
                name: def.name,
                description: def.description,
                input: toInputSchema(def.props),
                execute: async (input: unknown) => {
                    const args = asArgs(input);
                    if (!args) return { content: `${def.name} 的参数必须是 JSON 对象` };
                    return textResult(await def.run(args, ports));
                },
            });
        }
    });
}
```

创建 `src/plugin/prompt-hook.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, log } from "../host/log.js";
import type { ImpmContext } from "./contract.js";

/**
 * 注册 prompt 钩子。
 *
 * 只做取值与守卫，记录失败不影响宿主。
 */
export async function registerPromptHook(
    ctx: ImpmContext,
    onPrompt: (sessionID: string, text: string) => Promise<void> | void,
): Promise<void> {
    await ctx.session.hook("prompt", async (event) => {
        const sessionID = event.sessionID ? String(event.sessionID) : "";
        const text = event.prompt?.text ? String(event.prompt.text) : "";
        if (!sessionID || !text) return;
        try {
            await onPrompt(sessionID, text);
        } catch (error) {
            log("warn", `记录提问失败：${describe(error)}`);
        }
    });
}
```

创建 `src/plugin/events.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, log } from "../host/log.js";
import type { ImpmContext } from "./contract.js";

/** 事件循环消费的最小事件形状 */
export interface ImpmEvent {
    type: string;
    data?: unknown;
}

/** 事件消费者：recorder 与 heartbeat */
export interface EventConsumer {
    onEvent(event: ImpmEvent): Promise<void> | void;
}

/**
 * 启动事件消费循环。
 *
 * 单个消费者失败不影响其它消费者；取消信号触发后安静退出。
 */
export async function startEventLoop(
    ctx: ImpmContext,
    signal: AbortSignal,
    consumers: EventConsumer[],
): Promise<void> {
    try {
        for await (const event of ctx.event.subscribe({ signal })) {
            await Promise.all(
                consumers.map((consumer) =>
                    Promise.resolve(consumer.onEvent(event)).catch((error) =>
                        log("warn", `事件处理失败：${describe(error)}`),
                    ),
                ),
            );
        }
    } catch (error) {
        if (!signal.aborted) log("warn", `事件订阅中断：${describe(error)}`);
    }
}
```

- [ ] **Step 10: 新建编排层**

创建 `src/plugin/setup.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import { log } from "../host/log.js";
import { ensureInstalled, resolvePluginRoot } from "../host/install.js";
import { isSupported, readHostVersion } from "../host/version.js";
import type { HostVersion } from "../host/version.js";
import { createHeartbeatMonitor } from "../tools/heartbeat.js";
import { createPromptRecorder } from "../tools/prompt-recorder.js";
import { STATIC_TOOL_DEFS } from "../tools/tool-defs.js";
import type { ToolDef, ToolPorts } from "../tools/tool-defs.js";
import type { Cleanup, ImpmContext } from "./contract.js";
import { startEventLoop } from "./events.js";
import type { EventConsumer } from "./events.js";
import { registerPromptHook } from "./prompt-hook.js";
import { createSessionPort } from "./session-port.js";
import type { SessionPort } from "./session-port.js";
import { registerTools } from "./tools.js";

/** prompt-recorder 需要暴露的能力 */
export interface Recorder extends EventConsumer {
    tools: ToolDef[];
    onPrompt(sessionID: string, text: string): Promise<void> | void;
    dispose?(): void;
}

/** heartbeat 需要暴露的能力 */
export interface Heartbeat extends EventConsumer {
    tools: ToolDef[];
    dispose?(): void;
}

/** 测试缝：全部外部依赖可替换 */
export interface SetupDeps {
    readHostVersion(ctx: ImpmContext): HostVersion;
    isSupported(host: HostVersion): boolean;
    ensureInstalled(projectRoot: string, pluginRoot: string): Promise<void>;
    createSessionPort(ctx: ImpmContext): SessionPort;
    createPromptRecorder(projectRoot: string): Promise<Recorder>;
    createHeartbeatMonitor(projectRoot: string, port: SessionPort): Promise<Heartbeat>;
    startEventLoop(ctx: ImpmContext, signal: AbortSignal, consumers: EventConsumer[]): Promise<void>;
}

/** 默认实现 */
export const defaultDeps: SetupDeps = {
    readHostVersion,
    isSupported,
    ensureInstalled,
    createSessionPort,
    createPromptRecorder,
    createHeartbeatMonitor,
    startEventLoop,
};

/** 创建 setup 回调（依赖可注入） */
export function createSetup(deps: SetupDeps = defaultDeps) {
    return async function setup(ctx: ImpmContext): Promise<Cleanup | undefined> {
        // 1. 版本闸门：1.x 宿主只报错，不注册任何能力
        const host = deps.readHostVersion(ctx);
        if (!deps.isSupported(host)) {
            log("error", `impm 3.0.0 需要 opencode >= 2.0.0，当前 ${host.raw || "未知"}；已跳过全部功能注册`);
            return undefined;
        }
        if (Number.isNaN(host.major)) {
            log("warn", `无法识别 opencode 版本 "${host.raw}"，按 2.x 继续启动`);
        }

        // 2. 项目根目录与安装自检
        const projectRoot = String(ctx.location.directory);
        await deps.ensureInstalled(projectRoot, resolvePluginRoot(import.meta.url));

        // 3. 会话端口与数据层
        const sessionPort = deps.createSessionPort(ctx);
        const recorder = await deps.createPromptRecorder(projectRoot);
        const heartbeat = await deps.createHeartbeatMonitor(projectRoot, sessionPort);

        // 4. 工具注册：11 个静态 + 4 个动态
        const ports: ToolPorts = { projectRoot };
        await registerTools(ctx, [...STATIC_TOOL_DEFS, ...recorder.tools, ...heartbeat.tools], ports);

        // 5. prompt 钩子
        await registerPromptHook(ctx, (sessionID, text) => recorder.onPrompt(sessionID, text));

        // 6. 事件订阅与卸载
        const abort = new AbortController();
        const consumer = deps.startEventLoop(ctx, abort.signal, [recorder, heartbeat]);
        return () => {
            abort.abort();
            recorder.dispose?.();
            heartbeat.dispose?.();
            return consumer;
        };
    };
}
```

- [ ] **Step 11: 切换入口并删除 1.x 运行时**

用下面内容整体替换 `src/index.ts`：

```ts
/**
 * Copyright 2026 jenemy8023 <jenemy8023@163.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * opencode 2.x 插件入口。
 *
 * 3.0.0 起不再提供 1.x 的 `server` 入口；`setup` 内部还有版本闸门，
 * 在 1.x 宿主上只会打印错误并跳过注册。
 */

import type { PluginDefinition } from "./plugin/contract.js";
import { createSetup } from "./plugin/setup.js";

const plugin: PluginDefinition = { id: "impm", setup: createSetup() };

export default plugin;
```

删除文件：

```bash
git rm src/runtime/v1.ts src/runtime/v2.ts src/host/detect.ts src/host/session.ts src/host/plugin-types.ts
```

- [ ] **Step 12: 构建并修复类型错误**

Run: `npm run build`
Expected: 编译零错误。若报错，按“官方类型优先”原则修正：`ctx.session.interrupt` 只传 `{ sessionID, resume }`；工具 `execute` 入参声明为 `unknown`；`editor.add` 的 `input` 传 JSON Schema 字面量。

- [ ] **Step 13: 新增工具定义测试**

创建 `test/tool-defs.test.mjs`：

```js
// 工具定义形态测试：11 个静态工具的描述、参数与 schema 生成
import { test } from "node:test";
import assert from "node:assert/strict";

const { STATIC_TOOL_DEFS, toInputSchema, textResult } = await import("../dist/tools/tool-defs.js");

test("11 个静态工具的描述与参数完整", () => {
    assert.equal(STATIC_TOOL_DEFS.length, 11);
    for (const def of STATIC_TOOL_DEFS) {
        assert.ok(def.name.startsWith("impm_"), `${def.name} 命名不符合 impm_ 前缀`);
        assert.ok(def.description.length > 0, `${def.name} 缺少描述`);
        for (const [key, prop] of Object.entries(def.props)) {
            assert.ok(
                prop.type === "string" || prop.type === "array",
                `${def.name}.${key} 类型非法：${prop.type}`,
            );
            assert.ok(prop.description.length > 0, `${def.name}.${key} 缺少描述`);
        }
    }
});

test("数组参数生成 items 且保留描述", () => {
    const schema = toInputSchema({
        dirs: { type: "array", items: { type: "string" }, description: "源码目录" },
    });
    assert.deepEqual(schema.properties.dirs, {
        type: "array",
        items: { type: "string" },
        description: "源码目录",
    });
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
});

test("textResult 返回 content", () => {
    assert.deepEqual(textResult("完成"), { content: "完成" });
});
```

- [ ] **Step 14: 运行全部测试**

Run: `npm test`
Expected: `test/version-gate.test.mjs`、`test/setup.test.mjs`、`test/tool-defs.test.mjs` 全部 PASS（setup 含新增 4 个用例，tool-defs 含 3 个）。

- [ ] **Step 15: 校验无 1.x 残留**

Run（PowerShell）：

```powershell
Select-String -Path src\*.ts,src\**\*.ts -Pattern 'runV1|toV1Args|toV1Result|detectHost|hostMajor|chat\.message|DualVersionPlugin'
```

Expected: 无输出。

- [ ] **Step 16: 提交**

```bash
git add -A src test
git commit -m "refactor(plugin): 切换到 2.x 插件契约并删除 1.x 运行时"
```

---

### Task 3: prompt-recorder 换表到 `session_v2` / `session_message`

**Files:**
- Modify: `src/tools/prompt-recorder.ts`
- Test: `test/prompt-recorder.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `ToolDef`、`toInputSchema`、`textResult`；`openDb` / `SqliteHandle` 保持不变。
- Produces（导出，供测试与工具复用）：
  - `readSessionTokens(db: SqliteHandle, sessionID: string): TokenTotal | undefined`
  - `readSessionMessages(db: SqliteHandle, sessionID: string): SessionMessageRow[]`
  - `readUserMessages(db: SqliteHandle, sessionID: string): UserMessage[]`
  - `exportSession(projectRoot: string, dbPath: string, sessionID: string): Promise<string>`
  - 内部：`beforeTokens: Map<string, TokenTotal>`、`parseData(raw)`、`isMainSession(dbPath, sessionID)`。

- [ ] **Step 1: 写失败测试**

创建 `test/prompt-recorder.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { exportSession } from "../dist/tools/prompt-recorder.js";

/** 建一个最小 2.x 数据库，包含正常行、坏 JSON 行与未知 type 行 */
function createDb(dir) {
    const dbPath = join(dir, "opencode.db");
    const db = new DatabaseSync(dbPath);
    db.exec(`
        CREATE TABLE session_v2 (
            id TEXT PRIMARY KEY, parent_id TEXT, title TEXT,
            time_created INTEGER, time_updated INTEGER,
            tokens_input INTEGER, tokens_output INTEGER, tokens_reasoning INTEGER,
            tokens_cache_read INTEGER, tokens_cache_write INTEGER,
            agent TEXT, model TEXT
        );
        CREATE TABLE session_message (
            id TEXT PRIMARY KEY, session_id TEXT, type TEXT, seq INTEGER,
            time_created INTEGER, time_updated INTEGER, data TEXT
        );
    `);
    db.prepare(`INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        "ses_main", null, "测试会话", 1700000000000, 1700000060000, 120, 80, 10, 30, 5, "pm", "p/m",
    );
    const insert = db.prepare(`INSERT INTO session_message VALUES (?,?,?,?,?,?,?)`);
    insert.run("msg_1", "ses_main", "user", 1, 1700000001000, 1700000001000,
        JSON.stringify({ text: "第一个问题", metadata: { agent: "pm", model: "p/m" } }));
    insert.run("msg_2", "ses_main", "assistant", 2, 1700000002000, 1700000002000,
        JSON.stringify({ content: [{ type: "text", text: "回答内容" }] }));
    insert.run("msg_3", "ses_main", "user", 3, 1700000003000, 1700000003000,
        "{ 坏 JSON");
    insert.run("msg_4", "ses_main", "weird", 4, 1700000004000, 1700000004000,
        JSON.stringify({ foo: "bar" }));
    db.close();
    return dbPath;
}

test("导出 2.x 会话：读取用户提问并标注近似值", async () => {
    const dir = mkdtempSync(join(tmpdir(), "impm-recorder-"));
    const dbPath = createDb(dir);
    const message = await exportSession(dir, dbPath, "ses_main");
    assert.match(message, /已导出/);
    const file = message.match(/docs[\\/]prompts[\\/][^\s]+\.md/)?.[0];
    assert.ok(file, `导出信息应包含文件路径：${message}`);
    const content = readFileSync(join(dir, file), "utf8");
    assert.match(content, /第一个问题/);
    assert.match(content, /会话聚合增量，近似值/);
});

test("坏 JSON 与未知 type 不中断导出", async () => {
    const dir = mkdtempSync(join(tmpdir(), "impm-recorder-"));
    const dbPath = createDb(dir);
    const message = await exportSession(dir, dbPath, "ses_main");
    assert.match(message, /已导出/);
});

test("1.x 老会话返回明确提示而不是抛错", async () => {
    const dir = mkdtempSync(join(tmpdir(), "impm-recorder-"));
    const dbPath = createDb(dir);
    const message = await exportSession(dir, dbPath, "ses_old_v1");
    assert.match(message, /1\.x 历史会话/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && node --test test/prompt-recorder.test.mjs`
Expected: FAIL，`exportSession` 未被导出或仍查旧表 `session`。

- [ ] **Step 3: 确认时间单位**

Run（只读，指向本机真实库）：

```powershell
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.USERPROFILE+'/.local/share/opencode/opencode.db',{readOnly:true});console.log(db.prepare('SELECT time_created, tokens_input FROM session_v2 LIMIT 1').get())"
```

Expected: `time_created` 为毫秒级时间戳（约 `1.7e12`）。若为秒级，后续格式化处统一 `* 1000`。

- [ ] **Step 4: 替换会话与消息查询**

在 `src/tools/prompt-recorder.ts` 中做以下替换（其余辅助函数保持不动）：

1. `SessionRow` 增加 `time_updated`，保留 token 五列。
2. `querySessionTree` 的 SQL 改为：

```sql
SELECT id, parent_id, title, time_created, time_updated,
       tokens_input, tokens_output, tokens_reasoning,
       tokens_cache_read, tokens_cache_write
FROM session_v2
```

3. 删除 `MessageRow`、`PartRow`、`readSessionMessages` 的旧实现与 `readAssistantCosts`、`buildWindowCosts`，新增：

```ts
/** 2.x 消息行 */
export interface SessionMessageRow {
    id: string;
    type: string;
    seq: number;
    time_created: number;
    time_updated: number;
    data: string;
}

/** 用户提问（2.x 消息解析结果） */
export interface UserMessage {
    text: string;
    time: number;
    agent: string;
    model: string;
}

/** 安全解析 data 列：坏 JSON 与非对象一律跳过 */
function parseData(raw: string): Record<string, unknown> | undefined {
    try {
        const value = JSON.parse(raw) as unknown;
        if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
        return value as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

/** 读取某会话的全部 2.x 消息 */
export function readSessionMessages(db: SqliteHandle, sessionID: string): SessionMessageRow[] {
    return db.db
        .prepare(
            `SELECT id, type, seq, time_created, time_updated, data
             FROM session_message WHERE session_id = ? ORDER BY seq ASC`,
        )
        .all(sessionID) as SessionMessageRow[];
}

/** 读取用户提问：只取 type="user" 且有文本的行 */
export function readUserMessages(db: SqliteHandle, sessionID: string): UserMessage[] {
    const result: UserMessage[] = [];
    for (const row of readSessionMessages(db, sessionID)) {
        if (row.type !== "user") continue;
        const data = parseData(row.data);
        if (!data) continue;
        const text = typeof data.text === "string" ? data.text : "";
        if (!text.trim()) continue;
        const metadata = (data.metadata ?? {}) as Record<string, unknown>;
        result.push({
            text,
            time: Number(row.time_created),
            agent: typeof metadata.agent === "string" ? metadata.agent : "",
            model: typeof metadata.model === "string" ? metadata.model : "",
        });
    }
    return result;
}

/** 读取会话级 token 聚合 */
export function readSessionTokens(db: SqliteHandle, sessionID: string): TokenTotal | undefined {
    const row = db.db
        .prepare(
            `SELECT tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write
             FROM session_v2 WHERE id = ?`,
        )
        .get(sessionID) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
    return {
        input: num(row.tokens_input),
        output: num(row.tokens_output),
        reasoning: num(row.tokens_reasoning),
        cacheRead: num(row.tokens_cache_read),
        cacheWrite: num(row.tokens_cache_write),
    };
}
```

- [ ] **Step 5: 每轮 token 改为聚合增量**

1. 在模块级新增快照表与差值函数：

```ts
/** 每个会话在 prompt 到达时的 token 快照，按 sessionID 存放 */
const beforeTokens = new Map<string, TokenTotal>();

/** 计算两次聚合快照的正向差值 */
function subtractTokens(after: TokenTotal, before: TokenTotal): TokenTotal {
    const diff = (a: number, b: number): number => Math.max(0, a - b);
    return {
        input: diff(after.input, before.input),
        output: diff(after.output, before.output),
        reasoning: diff(after.reasoning, before.reasoning),
        cacheRead: diff(after.cacheRead, before.cacheRead),
        cacheWrite: diff(after.cacheWrite, before.cacheWrite),
    };
}
```

2. 把 `finalizeTokens` 的 token 来源替换为增量：保留原函数中“解析 `prompts.md` → 定位该会话最近一条待统计行 → 回填 4 列”的文件操作，只把 `totals` 的计算替换为：

```ts
const before = beforeTokens.get(sessionId);
beforeTokens.delete(sessionId);
const db = await openDb(dbPath);
let totals: TokenTotal;
try {
    const after = readSessionTokens(db, sessionId);
    if (!after) return;
    totals = before ? subtractTokens(after, before) : after;
} finally {
    db.close();
}
```

3. 删除 `readAssistantCosts` 的调用点与 `emptyTotal` / `addTotal` 的调用点（函数本身若已无引用一并删除）。

- [ ] **Step 6: 主会话判定与 prompt 记录**

1. 两处 `SELECT parent_id FROM session WHERE id = ?` 改为：

```sql
SELECT parent_id FROM session_v2 WHERE id = ?
```

2. 新增：

```ts
/** 判断是否为主会话（无 parent_id） */
async function isMainSession(dbPath: string, sessionID: string): Promise<boolean> {
    const db = await openDb(dbPath);
    try {
        const row = db.db
            .prepare(`SELECT parent_id FROM session_v2 WHERE id = ?`)
            .get(sessionID) as { parent_id?: string | null } | undefined;
        if (!row) return false;
        return !row.parent_id;
    } catch {
        return false;
    } finally {
        db.close();
    }
}
```

3. 把 `onPrompt` 实现替换为“先拍快照、再记录”：

```ts
/** prompt 到达：拍 token 快照并写入 prompts.md */
async function onPrompt(sessionID: string, text: string): Promise<void> {
    const dbPath = defaultDbPath();
    if (!(await isMainSession(dbPath, sessionID))) return;
    const db = await openDb(dbPath);
    try {
        const snapshot = readSessionTokens(db, sessionID);
        if (snapshot) beforeTokens.set(sessionID, snapshot);
    } finally {
        db.close();
    }
    await appendPromptRow(projectRoot, sessionID, Date.now(), text);
    await refreshExport(sessionID);
}
```

`createPromptRecorder` 返回对象的 `onPrompt` 改为 `onPrompt`（不再经 `chatMessage`），并删除 `chatMessage` 函数。

- [ ] **Step 7: 重写 exportSession**

用下面实现替换原 `exportSession`（章节结构保持：标题 / 主会话 / 导出时间 / 会话数 / token 统计表 / 用户输入）：

```ts
/**
 * 导出单个 2.x 会话到 docs/prompts/prompt-{日期}-{sessionID}.md。
 *
 * 只读 `session_v2` / `session_message`；1.x 老会话直接给出提示。
 */
export async function exportSession(projectRoot: string, dbPath: string, sessionID: string): Promise<string> {
    const db = await openDb(dbPath);
    let session: SessionRow | undefined;
    let users: UserMessage[] = [];
    let totals: TokenTotal | undefined;
    try {
        session = db.db
            .prepare(
                `SELECT id, parent_id, title, time_created, time_updated,
                        tokens_input, tokens_output, tokens_reasoning,
                        tokens_cache_read, tokens_cache_write
                 FROM session_v2 WHERE id = ?`,
            )
            .get(sessionID) as SessionRow | undefined;
        if (!session) {
            return `未找到 2.x 会话 ${sessionID}：3.0.0 只支持 opencode 2.x，1.x 历史会话不再可导出。`;
        }
        users = readUserMessages(db, sessionID);
        totals = readSessionTokens(db, sessionID);
    } finally {
        db.close();
    }

    const lines: string[] = [];
    lines.push(`# 会话导出：${session.title || session.id}`);
    lines.push("");
    lines.push(`- 会话 ID：${session.id}`);
    lines.push(`- 父会话：${session.parent_id ?? "无"}`);
    lines.push(`- 导出时间：${formatTime(Date.now())}`);
    lines.push(`- 提问数量：${users.length}`);
    lines.push("");
    lines.push("## Token 统计（会话聚合增量，近似值）");
    lines.push("");
    lines.push("| 输入 | 输出 | 推理 | 缓存命中 | 缓存写入 |");
    lines.push("|---|---|---|---|---|");
    const total = totals ?? { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
    lines.push(
        `| ${total.input} | ${total.output} | ${total.reasoning} | ${total.cacheRead} | ${total.cacheWrite} |`,
    );
    lines.push("");
    lines.push("## 用户输入");
    lines.push("");
    for (const item of users) {
        lines.push(`### ${formatTime(item.time)}`);
        lines.push("");
        lines.push(escapeCell(item.text));
        lines.push("");
        if (item.agent || item.model) {
            lines.push(`- agent：${item.agent || "未知"}；model：${item.model || "未知"}`);
            lines.push("");
        }
    }

    const file = join(projectRoot, "docs", "prompts", `prompt-${formatDate(session.time_created)}-${sessionID}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${lines.join("\n")}\n`, "utf8");
    return `已导出 ${users.length} 条提问到 ${file}（token 为会话聚合增量，近似值）`;
}
```

- [ ] **Step 8: 同步工具说明文案**

`impm_prompt_export` / `impm_prompt_finalize` 的 `dbPath` 参数说明改为：`2.x 数据库路径，默认 ~/.local/share/opencode/opencode.db；仅支持 2.x 会话`。

- [ ] **Step 9: 运行测试**

Run: `npm test`
Expected: `test/prompt-recorder.test.mjs` 3 个用例 PASS，其余测试保持 PASS。

- [ ] **Step 10: 提交**

```bash
git add src/tools/prompt-recorder.ts test/prompt-recorder.test.mjs
git commit -m "feat(recorder): 提问记录与导出改用 opencode 2.x 数据表"
```

---

### Task 4: heartbeat 改用 2.x 事件与数据表

**Files:**
- Modify: `src/tools/heartbeat.ts`
- Test: `test/heartbeat.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `SessionPort`、`ImpmEvent`；Task 3 的 `openDb` / `readSessionTokens` 可选复用（本任务直接用 `session_v2` 单列查询）。
- Produces: `createHeartbeatMonitor(projectRoot, port)` 返回 `{ tools, onEvent, dispose? }`；内部 `failures: Map<string, { name: string; message: string; at: number }>`。

- [ ] **Step 1: 写失败测试**

创建 `test/heartbeat.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { createHeartbeatMonitor } from "../dist/tools/heartbeat.js";

/** 记录调用的假会话端口 */
function fakePort() {
    const calls = { interrupt: [], prompt: [] };
    return {
        calls,
        port: {
            interrupt: async (sessionID) => {
                calls.interrupt.push(sessionID);
                return { ok: true, detail: "" };
            },
            prompt: async (sessionID, text) => {
                calls.prompt.push([sessionID, text]);
                return { ok: true, detail: "" };
            },
            get: async () => undefined,
        },
    };
}

test("禁用后只暴露手动工具且可安全卸载", async () => {
    process.env.IMPM_HEARTBEAT_DISABLED = "1";
    const { port } = fakePort();
    const monitor = await createHeartbeatMonitor(tmpdir(), port);
    assert.equal(monitor.tools.length, 1);
    assert.equal(monitor.tools[0].name, "impm_heartbeat");
    assert.equal(typeof monitor.onEvent, "function");
    monitor.dispose?.();
    delete process.env.IMPM_HEARTBEAT_DISABLED;
});

test("2.x 事件载荷不抛错且不误中断会话", async () => {
    process.env.IMPM_HEARTBEAT_DISABLED = "1";
    const { port, calls } = fakePort();
    const monitor = await createHeartbeatMonitor(tmpdir(), port);
    const events = [
        { type: "session.status", data: { sessionID: "ses_a", status: { type: "busy" } } },
        { type: "session.step.started", data: { sessionID: "ses_a" } },
        { type: "session.step.ended", data: { sessionID: "ses_a", tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } } },
        { type: "session.tool.called", data: { sessionID: "ses_a", id: "call_1" } },
        { type: "session.execution.failed", data: { sessionID: "ses_a", error: { name: "UnknownError", message: "boom" } } },
        { type: "session.idle", data: { sessionID: "ses_a" } },
        { type: "unknown.event", data: {} },
    ];
    for (const event of events) {
        await monitor.onEvent(event);
    }
    assert.deepEqual(calls.interrupt, []);
    delete process.env.IMPM_HEARTBEAT_DISABLED;
    monitor.dispose?.();
});

test("旧事件名被忽略而不是异常", async () => {
    process.env.IMPM_HEARTBEAT_DISABLED = "1";
    const { port } = fakePort();
    const monitor = await createHeartbeatMonitor(tmpdir(), port);
    await monitor.onEvent({ type: "message.updated", properties: { info: { sessionID: "ses_a" } } });
    await monitor.onEvent({ type: "session.error", properties: { sessionID: "ses_a" } });
    delete process.env.IMPM_HEARTBEAT_DISABLED;
    monitor.dispose?.();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && node --test test/heartbeat.test.mjs`
Expected: FAIL，`createHeartbeatMonitor` 第二参数与返回值形态不符或事件不识别。

- [ ] **Step 3: 替换数据库查询**

在 `src/tools/heartbeat.ts` 中：

1. `latestDbActivity` 整体替换为：

```ts
/** DB 兜底：读取会话最后更新时间（毫秒） */
async function latestDbActivity(sessionID: string): Promise<number | undefined> {
    const db = await openDbForRead();
    if (!db) return undefined;
    try {
        const row = db.db
            .prepare(`SELECT time_updated FROM session_v2 WHERE id = ?`)
            .get(sessionID) as { time_updated?: number } | undefined;
        return typeof row?.time_updated === "number" ? row.time_updated : undefined;
    } catch {
        return undefined;
    } finally {
        db.close();
    }
}
```

2. `latestChildActivity` 的 SQL 分支替换为：

```sql
SELECT MAX(time_updated) AS t FROM session_v2 WHERE parent_id = ?
```

3. 删除 `lastAssistantError` 与 `sessionModel` 两个函数及其调用点。

4. `resolveParent` 改为“先问端口、再查 parent_id”：

```ts
/** 解析会话父级与目录；不在当前项目时从跟踪表移除 */
async function resolveParent(sessionID: string): Promise<void> {
    const entry = entries.get(sessionID);
    if (!entry || entry.resolving) return;
    if (entry.parentId !== undefined) return;
    entry.resolving = true;
    try {
        const location = await port.get(sessionID);
        const db = await openDbForRead();
        let parentId: string | null = null;
        try {
            if (db) {
                const row = db.db
                    .prepare(`SELECT parent_id FROM session_v2 WHERE id = ?`)
                    .get(sessionID) as { parent_id?: string | null } | undefined;
                parentId = row?.parent_id ?? null;
            }
        } finally {
            db?.close();
        }
        if (location?.directory && !sameProject(location.directory, projectRoot)) {
            entries.delete(sessionID);
            return;
        }
        entry.parentId = parentId;
        entry.directory = location?.directory ?? entry.directory;
    } finally {
        entry.resolving = false;
        entry.lastResolveAt = Date.now();
    }
}
```

5. 若原文件没有 `openDbForRead()`，新增：

```ts
/** 只读打开数据库；失败时静默返回 undefined（DB 兜底不是必需路径） */
async function openDbForRead(): Promise<SqliteHandle | undefined> {
    try {
        return await openDb(defaultDbPath());
    } catch {
        return undefined;
    }
}
```

- [ ] **Step 4: 用事件替代错误查询**

1. 模块级新增：

```ts
/** 最近一次执行失败（由 session.execution.failed 事件写入） */
const failures = new Map<string, { name: string; message: string; at: number }>();
```

2. 删除 `ABNORMAL_ERROR_NAMES` 的 DB 查询用法，保留常量用于分类；`handleIdleMaybeAbnormal` 改为读 `failures.get(sessionID)`：

```ts
const failure = failures.get(sessionID);
if (failure && ABNORMAL_ERROR_NAMES.has(failure.name) && Date.now() - failure.at < ENTRY_TTL_MS) {
    await recoverMain(sessionID, `异常结束：${failure.name}`);
}
```

- [ ] **Step 5: 替换事件处理**

1. `extractSessionId` 优先读 2.x 载荷：

```ts
/** 从 2.x 事件中提取 sessionID */
function extractSessionId(event: { type: string; data?: unknown }): string | undefined {
    const data = event.data as { sessionID?: unknown } | undefined;
    if (data && typeof data.sessionID === "string" && data.sessionID) return data.sessionID;
    return undefined;
}
```

2. `handleEvent` 整体替换为：

```ts
/** 处理 2.x 事件：活跃度、状态、失败与空闲 */
async function handleEvent(event: { type: string; data?: unknown }): Promise<void> {
    const sessionID = extractSessionId(event);
    if (!sessionID) return;
    await resolveParent(sessionID);

    switch (event.type) {
        case "session.status": {
            const status = (event.data as { status?: { type?: string } } | undefined)?.status;
            if (status?.type === "busy") touch(sessionID, event.type);
            else if (status?.type === "idle") markFinished(sessionID, event.type);
            return;
        }
        case "session.step.started":
        case "session.step.streamed":
        case "session.step.ended":
        case "session.tool.called":
        case "session.tool.progress":
        case "session.tool.success":
        case "session.tool.failed":
        case "session.text.delta":
        case "session.reasoning.delta":
        case "session.synthetic":
            touch(sessionID, event.type);
            return;
        case "session.execution.failed": {
            const error = (event.data as { error?: { name?: string; message?: string } } | undefined)?.error;
            failures.set(sessionID, {
                name: typeof error?.name === "string" ? error.name : "UnknownError",
                message: typeof error?.message === "string" ? error.message : "",
                at: Date.now(),
            });
            touch(sessionID, event.type);
            return;
        }
        case "session.idle":
            await handleIdleMaybeAbnormal(sessionID);
            markFinished(sessionID, event.type);
            return;
        default:
            return;
    }
}
```

- [ ] **Step 6: 运行测试**

Run: `npm test`
Expected: `test/heartbeat.test.mjs` 3 个用例 PASS；其余测试保持 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/tools/heartbeat.ts test/heartbeat.test.mjs
git commit -m "feat(heartbeat): 改用 opencode 2.x 事件与 session_v2 兜底查询"
```

---

### Task 5: 13 个 agent 重写为原生 2.x 权限规则

**Files:**
- Modify: `assets/agents/*.md`（13 个）
- Test: `test/frontmatter.test.mjs`
- Test helper: `test/helpers/frontmatter.mjs`

**Interfaces:**
- Consumes: 无。
- Produces: 13 个 agent 的 frontmatter 只含 `description` / `mode` / `permissions`（`model` 由 `opencode.json` 提供）。

**统一规则（所有 agent 相同）**

- frontmatter 结构固定为：

```yaml
---
description: <保留原有描述>
mode: <保留原值 primary 或 subagent>
permissions:
  - { action: "...", effect: "..." }
---
```

- 删除 `temperature` 与整个 `permission:` 映射。
- `write` 与 `edit` 合并为一条 `{ action: "edit", effect: "allow" }`。
- `bash` → `{ action: "shell", effect: "allow" }`。
- `todowrite` 直接删除。
- `task.<agent>` → `{ action: "subagent", resource: "<agent>", effect: "<原值>" }`。
- 规则顺序：先 `resource: "*"` 的 subagent 规则，再具体 subagent，最后普通 action（普通 action 按下列表格从左到右）。
- 不补默认拒绝基线；V1 未出现的 action 不写。

**逐 agent 规则表**

| agent | subagent 规则 | 普通 action（顺序） |
|---|---|---|
| `pm` | `ba, bee, cs, dba, dw, fee, sa, scm, sse, te, tl, ws` 全部 allow（无 `*`） | `edit, read, shell, grep, glob, websearch, webfetch, skill, question, impm_project_info, impm_isinit, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress, impm_task_manager, impm_context_builder, impm_project_analyzer, impm_git` |
| `ba` | `*` deny，再 `cs, ws` allow | `edit, read, shell, grep, glob, websearch, webfetch, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress` |
| `sa` | `*` deny，再 `cs, ws` allow | `edit, read, shell, grep, glob, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress, impm_project_analyzer` |
| `tl` | `*` deny | `edit, read, shell, grep, glob, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress, impm_task_manager, impm_context_builder` |
| `dba` | `*` deny | `edit, read, shell, grep, glob, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress` |
| `te` | `*` deny | `edit, read, shell, grep, glob, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress, impm_task_manager` |
| `scm` | `*` deny | `edit, read, shell, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_version, impm_progress, impm_git` |
| `dw` | `*` deny | `edit, read, skill, question, impm_project_info, impm_doc_reader, impm_doc_writer, impm_template_reader, impm_version, impm_progress, impm_git` |
| `cs` | `*` deny | `read, grep, glob, skill, question, impm_doc_reader, impm_progress` |
| `ws` | `*` deny | `websearch, webfetch, skill, question, impm_doc_reader, impm_progress` |
| `sse` | `*` deny，再 `cs, ws, dba` allow | `edit, read, shell, grep, glob, skill, question, impm_doc_reader, impm_context_builder, impm_progress` |
| `fee` | `*` deny，再 `cs, ws, dba` allow | 同 `sse` |
| `bee` | `*` deny，再 `cs, ws, dba` allow | 同 `sse` |

- [ ] **Step 1: 写测试辅助与失败测试**

创建 `test/helpers/frontmatter.mjs`：

```js
/** 解析本仓库用到的极简 YAML frontmatter：标量键 + permissions 的 flow mapping 列表 */
export function parseFrontmatter(text) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!match) throw new Error("缺少 frontmatter");
    const result = { permissions: [] };
    let inPermissions = false;
    for (const line of match[1].split(/\r?\n/)) {
        if (!line.trim()) continue;
        if (/^permissions:\s*$/.test(line)) {
            inPermissions = true;
            continue;
        }
        if (inPermissions && /^\s+-\s+/.test(line)) {
            result.permissions.push(parseFlowMapping(line.trim().slice(2)));
            continue;
        }
        inPermissions = false;
        const index = line.indexOf(":");
        result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
    return result;
}

/** 解析 `{ action: "read", effect: "allow" }` 形式的行内映射 */
function parseFlowMapping(text) {
    const body = text.replace(/^\{/, "").replace(/\}$/, "");
    const result = {};
    for (const part of body.split(",")) {
        const index = part.indexOf(":");
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim().replace(/^"/, "").replace(/"$/, "");
        result[key] = value;
    }
    return result;
}
```

创建 `test/frontmatter.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./helpers/frontmatter.mjs";

const AGENT_DIR = "assets/agents";
const COMMAND_DIR = "assets/commands";
const AGENT_FIELDS = new Set(["description", "mode", "model", "permissions"]);
const COMMAND_FIELDS = new Set(["description", "agent", "model", "subagent"]);
const EFFECTS = new Set(["allow", "ask", "deny"]);

test("13 个 agent 只含 2.x 字段", () => {
    const files = readdirSync(AGENT_DIR).filter((name) => name.endsWith(".md"));
    assert.equal(files.length, 13);
    for (const file of files) {
        const data = parseFrontmatter(readFileSync(join(AGENT_DIR, file), "utf8"));
        for (const key of Object.keys(data)) {
            assert.ok(AGENT_FIELDS.has(key), `${file} 含非法字段 ${key}`);
        }
        assert.ok(data.description, `${file} 缺少 description`);
        assert.ok(["primary", "subagent"].includes(data.mode), `${file} 的 mode 非法`);
        assert.ok(data.permissions.length > 0, `${file} 缺少 permissions`);
        for (const rule of data.permissions) {
            assert.ok(rule.action, `${file} 的规则缺少 action`);
            assert.ok(EFFECTS.has(rule.effect), `${file} 的 effect 非法：${rule.effect}`);
        }
    }
});

test("agent 权限规则满足“通配在前、具体在后”", () => {
    for (const file of readdirSync(AGENT_DIR).filter((name) => name.endsWith(".md"))) {
        const { permissions } = parseFrontmatter(readFileSync(join(AGENT_DIR, file), "utf8"));
        let specificSubagentSeen = false;
        let actionSeen = false;
        for (const rule of permissions) {
            if (rule.action === "*") {
                assert.equal(specificSubagentSeen || actionSeen, false, `${file} 的通配 action 应排在最前`);
            } else if (rule.action === "subagent") {
                if (rule.resource === "*") {
                    assert.equal(specificSubagentSeen || actionSeen, false, `${file} 的 resource 通配应排在具体规则前`);
                } else {
                    assert.equal(actionSeen, false, `${file} 的 subagent 规则应排在普通 action 前`);
                    specificSubagentSeen = true;
                }
            } else {
                actionSeen = true;
            }
        }
    }
});

test("66 个命令只用 subagent 字段", () => {
    const files = readdirSync(COMMAND_DIR).filter((name) => name.endsWith(".md"));
    assert.equal(files.length, 66);
    for (const file of files) {
        const data = parseFrontmatter(readFileSync(join(COMMAND_DIR, file), "utf8"));
        for (const key of Object.keys(data)) {
            assert.ok(COMMAND_FIELDS.has(key), `${file} 含非法字段 ${key}`);
        }
        assert.equal(data.subagent, "false", `${file} 缺少 subagent: false`);
    }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && node --test test/frontmatter.test.mjs`
Expected: FAIL，agent 含 `temperature` / `permission` 非法字段；命令缺 `subagent`。

- [ ] **Step 3: 重写 pm 与 sse（作为两个范式）**

`assets/agents/pm.md` 的 frontmatter 替换为：

```yaml
---
description: <保留原有描述>
mode: primary
permissions:
  - { action: "subagent", resource: "ba", effect: "allow" }
  - { action: "subagent", resource: "bee", effect: "allow" }
  - { action: "subagent", resource: "cs", effect: "allow" }
  - { action: "subagent", resource: "dba", effect: "allow" }
  - { action: "subagent", resource: "dw", effect: "allow" }
  - { action: "subagent", resource: "fee", effect: "allow" }
  - { action: "subagent", resource: "sa", effect: "allow" }
  - { action: "subagent", resource: "scm", effect: "allow" }
  - { action: "subagent", resource: "sse", effect: "allow" }
  - { action: "subagent", resource: "te", effect: "allow" }
  - { action: "subagent", resource: "tl", effect: "allow" }
  - { action: "subagent", resource: "ws", effect: "allow" }
  - { action: "edit", effect: "allow" }
  - { action: "read", effect: "allow" }
  - { action: "shell", effect: "allow" }
  - { action: "grep", effect: "allow" }
  - { action: "glob", effect: "allow" }
  - { action: "websearch", effect: "allow" }
  - { action: "webfetch", effect: "allow" }
  - { action: "skill", effect: "allow" }
  - { action: "question", effect: "allow" }
  - { action: "impm_project_info", effect: "allow" }
  - { action: "impm_isinit", effect: "allow" }
  - { action: "impm_doc_reader", effect: "allow" }
  - { action: "impm_doc_writer", effect: "allow" }
  - { action: "impm_template_reader", effect: "allow" }
  - { action: "impm_version", effect: "allow" }
  - { action: "impm_progress", effect: "allow" }
  - { action: "impm_task_manager", effect: "allow" }
  - { action: "impm_context_builder", effect: "allow" }
  - { action: "impm_project_analyzer", effect: "allow" }
  - { action: "impm_git", effect: "allow" }
---
```

`assets/agents/sse.md` 的 frontmatter 替换为：

```yaml
---
description: <保留原有描述>
mode: subagent
permissions:
  - { action: "subagent", resource: "*", effect: "deny" }
  - { action: "subagent", resource: "cs", effect: "allow" }
  - { action: "subagent", resource: "ws", effect: "allow" }
  - { action: "subagent", resource: "dba", effect: "allow" }
  - { action: "edit", effect: "allow" }
  - { action: "read", effect: "allow" }
  - { action: "shell", effect: "allow" }
  - { action: "grep", effect: "allow" }
  - { action: "glob", effect: "allow" }
  - { action: "skill", effect: "allow" }
  - { action: "question", effect: "allow" }
  - { action: "impm_doc_reader", effect: "allow" }
  - { action: "impm_context_builder", effect: "allow" }
  - { action: "impm_progress", effect: "allow" }
---
```

- [ ] **Step 4: 按规则表重写剩余 11 个 agent**

`ba`、`sa`、`tl`、`dba`、`te`、`scm`、`dw`、`cs`、`ws`、`fee`、`bee` 逐个按“逐 agent 规则表”生成，格式与上面两个范式完全一致（`fee`、`bee` 的规则与 `sse` 完全相同，仅 `description` 与正文不同）。13 个文件的正文（frontmatter 之后的全部内容）必须逐字保留。

- [ ] **Step 5: 运行测试**

Run: `node --test test/frontmatter.test.mjs`
Expected: agent 两个用例 PASS；命令用例仍 FAIL（Task 6 处理）。

- [ ] **Step 6: 提交**

```bash
git add assets/agents test/frontmatter.test.mjs test/helpers/frontmatter.mjs
git commit -m "feat(assets): 13 个 agent 改为 opencode 2.x 权限规则"
```

### Task 6: 命令、模型预设与仓库配置迁到 2.x

**Files:**
- Modify: `assets/commands/*.md`（66 个）
- Modify: `scripts/agent-models.json`
- Modify: `opencode.json`
- Test: `test/frontmatter.test.mjs`（Task 5 已写，命令用例当前失败）

**Interfaces:**
- Consumes: Task 5 的 `test/frontmatter.test.mjs` 命令用例（字段集合 `{description, agent, model, subagent}`，禁止 `subtask`/`template`/`tools`）。
- Produces: `scripts/agent-models.json` 中每个预设的 agent 条目为 `{ model, variant }`，供 Task 7 的 `applyAgentConfig` 读取；仓库根 `opencode.json` 为纯 2.x 形态，供 Task 7 的 installer 幂等合并。

- [ ] **Step 1: 确认命令用例当前失败**

Run: `node --test test/frontmatter.test.mjs`
Expected: agent 相关用例 PASS；命令相关用例 FAIL，失败信息包含 `subtask`。

- [ ] **Step 2: 批量替换 66 个命令的 frontmatter**

```bash
node -e "const fs=require('node:fs');const path=require('node:path');const dir='assets/commands';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md'));let n=0;for(const f of files){const p=path.join(dir,f);const s=fs.readFileSync(p,'utf8');const next=s.replace(/^subtask: false$/m,'subagent: false');if(next!==s){fs.writeFileSync(p,next,'utf8');n++;}}console.log('替换文件数:',n);if(n!==66){process.exit(1);}"
```

Expected: `替换文件数: 66`，退出码 0。只替换 frontmatter 中的那一行，正文（含 `subtask` 以外的任何文本）不动。

- [ ] **Step 3: 校验无残留且字段正确**

Run: `Select-String -Path assets/commands/*.md -Pattern '^subtask:'`
Expected: 无输出。

Run: `Select-String -Path assets/commands/*.md -Pattern '^subagent: false$' | Measure-Object | Select-Object -ExpandProperty Count`
Expected: `66`。

Run: `node --test test/frontmatter.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 4: 模型预设改用 variant**

把 `scripts/agent-models.json` 中所有 `"reasoning_effort":` 改为 `"variant":`（值保持不变，`max` 保留，交给 Task 7 的 `variantOf` 归一为 `high`）：

```bash
node -e "const fs=require('node:fs');const p='scripts/agent-models.json';const s=fs.readFileSync(p,'utf8');const n=(s.match(/\"reasoning_effort\":/g)||[]).length;if(n!==65){console.error('预期 65 处，实际',n);process.exit(1);}fs.writeFileSync(p,s.replace(/\"reasoning_effort\":/g,'\"variant\":'),'utf8');console.log('已替换',n,'处');"
```

Expected: `已替换 65 处`（5 个预设 × 13 个 agent）。

- [ ] **Step 5: 仓库根 `opencode.json` 迁移为 2.x 形态**

用以下内容整体覆盖 `opencode.json`（`max` 档按 2.x 规则降为 `high`，其余 `low`/`high` 原样）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-browser"
  ],
  "mcp": {
    "servers": {
      "browsermcp": {
        "type": "local",
        "command": [
          "npx",
          "-y",
          "@browsermcp/mcp@0.1.3"
        ]
      }
    }
  },
  "agents": {
    "ba": { "model": "opencode-go/glm-5.2#high" },
    "bee": { "model": "opencode-go/deepseek-v4-pro#high" },
    "cs": { "model": "opencode-go/deepseek-v4-flash#low" },
    "dba": { "model": "opencode-go/glm-5.2#high" },
    "dw": { "model": "opencode-go/deepseek-v4-flash#high" },
    "fee": { "model": "opencode-go/deepseek-v4-flash#high" },
    "pm": { "model": "opencode-go/deepseek-v4-flash#low" },
    "sa": { "model": "opencode-go/glm-5.2#high" },
    "scm": { "model": "opencode-go/deepseek-v4-flash#low" },
    "sse": { "model": "opencode-go/deepseek-v4-pro#high" },
    "te": { "model": "opencode-go/deepseek-v4-flash#high" },
    "tl": { "model": "opencode-go/deepseek-v4-pro#high" },
    "ws": { "model": "opencode-go/deepseek-v4-flash#low" }
  }
}
```

- [ ] **Step 6: 校验配置文件**

Run: `node -e "const c=require('./opencode.json');const bad=[];if('plugin' in c)bad.push('plugin');if('agent' in c)bad.push('agent');for(const [n,a] of Object.entries(c.agents)){if(!a.model.includes('#'))bad.push(n);}if(!c.mcp||!c.mcp.servers)bad.push('mcp.servers');if(bad.length){console.error('不合规:',bad);process.exit(1);}console.log('opencode.json 2.x 合规');"`
Expected: `opencode.json 2.x 合规`。

- [ ] **Step 7: 全量测试**

Run: `npm test`
Expected: 现有测试全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add assets/commands scripts/agent-models.json opencode.json
git commit -m "feat(assets): 命令与模型预设改为 opencode 2.x 形态"
```

---

### Task 7: installer 与卸载脚本去掉双版本分支

**Files:**
- Modify: `scripts/install-core.mjs`
- Modify: `scripts/uninstall.mjs`
- Modify: `scripts/install.mjs`（仅注释）
- Modify: `scripts/install.ps1`（仅注释）
- Modify: `src/types/install-core.d.ts`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: Task 6 的 `{ model, variant }` 预设格式；Task 1/2 的 `ensureInstalled(projectRoot, pluginRoot)` 会以 `runInstall({ pluginRoot, projectRoot, version })` 调用。
- Produces: `runInstall(options)` 只接受 `{ pluginRoot, projectRoot, version, agentType?, opencodeDirOverride? }`；生成 `plugins` / `agents` 两个键；manifest 为 `{ installedVersion, everInstalled, pluginNames, pkgJsonTypeModule }`（无 `hostMajor`）。

- [ ] **Step 1: 写失败的测试**

创建 `test/install.test.mjs`：

```js
// 安装脚本行为测试：断言只生成 opencode 2.x 配置键，且重复执行幂等
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 延迟导入：install-core 是 ESM，测试运行时直接加载源文件
const { runInstall } = await import("../scripts/install-core.mjs");

/** 在临时目录执行一次安装，返回该目录 */
function installInto(projectRoot, agentType = "opencode-go-balance") {
    const ok = runInstall({
        pluginRoot: PLUGIN_ROOT,
        projectRoot,
        version: "3.0.0",
        agentType,
    });
    assert.equal(ok, true, "runInstall 应返回 true");
}

test("安装只生成 2.x 配置键，manifest 无 hostMajor", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "impm-install-"));
    try {
        installInto(projectRoot);

        const config = JSON.parse(readFileSync(join(projectRoot, "opencode.json"), "utf8"));
        assert.ok(Array.isArray(config.plugins), "应写入 plugins 数组");
        assert.ok(config.plugins.includes("opencode-impm-cn"));
        assert.equal(config.plugin, undefined, "不应写入 1.x 的 plugin 键");
        assert.ok(config.agents && typeof config.agents === "object", "应写入 agents");
        assert.equal(config.agent, undefined, "不应写入 1.x 的 agent 键");
        for (const [name, entry] of Object.entries(config.agents)) {
            assert.match(entry.model, /#/, `agents.${name}.model 应带 variant`);
        }
        assert.ok(config.mcp === undefined || config.mcp.servers, "mcp 若存在必须用 servers");

        const manifest = JSON.parse(
            readFileSync(join(projectRoot, ".opencode", "impm-manifest.json"), "utf8"),
        );
        assert.equal(manifest.installedVersion, "3.0.0");
        assert.equal("hostMajor" in manifest, false, "manifest 不应再有 hostMajor");

        const shim = readFileSync(join(projectRoot, ".opencode", "plugins", "impm.js"), "utf8");
        assert.match(shim, /\.\/impm\/dist\/index\.js/);
        assert.ok(existsSync(join(projectRoot, ".opencode", "package.json")));
    } finally {
        rmSync(projectRoot, { recursive: true, force: true });
    }
});

test("重复执行结果一致（幂等）", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "impm-install-"));
    try {
        installInto(projectRoot);
        const first = readFileSync(join(projectRoot, "opencode.json"), "utf8");
        installInto(projectRoot);
        const second = readFileSync(join(projectRoot, "opencode.json"), "utf8");
        assert.equal(second, first, "第二次安装不应改变配置");
    } finally {
        rmSync(projectRoot, { recursive: true, force: true });
    }
});

test("遗留 1.x 配置键被清理", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "impm-install-"));
    try {
        writeFileSync(
            join(projectRoot, "opencode.json"),
            JSON.stringify(
                {
                    plugin: ["opencode-browser"],
                    agent: { pm: { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "low" } },
                },
                null,
                2,
            ),
            "utf8",
        );
        installInto(projectRoot);
        const config = JSON.parse(readFileSync(join(projectRoot, "opencode.json"), "utf8"));
        assert.equal(config.plugin, undefined);
        assert.equal(config.agent, undefined);
        assert.match(config.agents.pm.model, /#/);
    } finally {
        rmSync(projectRoot, { recursive: true, force: true });
    }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/install.test.mjs`
Expected: FAIL，至少一条断言失败（当前仍写入 `plugin`/`agent`，manifest 仍含 `hostMajor`）。

- [ ] **Step 3: `scripts/install-core.mjs` 去掉双键常量与宿主探测**

1. 删除 `AGENT_CONFIG_KEYS`、`PLUGIN_CONFIG_KEYS` 两个常量，替换为：

```js
/** opencode 2.x 配置键 */
const AGENT_KEY = "agents";
const PLUGIN_KEY = "plugins";
```

2. 删除 `detectHostMajor` 函数整体（含其文档注释）。
3. `variantOf` 保留，签名语义改为“把预设 variant 归一为 2.x 合法值”：

```js
/**
 * 预设 variant 归一化
 *
 * 2.x 没有 `max` 档，统一降为 `high`；空值按 `medium` 处理。
 */
export function variantOf(variant) {
    const value = String(variant || "").toLowerCase();
    if (!value) {
        return "medium";
    }
    if (value === "max") {
        return "high";
    }
    return value;
}
```

- [ ] **Step 4: 改写 `applyAgentConfig` 只写 `agents`**

把 `clear` 分支改为只处理 `AGENT_KEY`，并顺带删除遗留的 `config.agent`：

```js
    if (agentType === "clear") {
        let cleaned = 0;
        const bucket = config[AGENT_KEY];
        if (bucket && typeof bucket === "object") {
            for (const name of cleanAgents) {
                const entry = bucket[name];
                if (!entry || typeof entry !== "object") {
                    continue;
                }
                if ("model" in entry) {
                    delete entry.model;
                }
                if ("reasoning_effort" in entry) {
                    delete entry.reasoning_effort;
                }
                if (Object.keys(entry).length === 0) {
                    delete bucket[name];
                }
                cleaned++;
            }
            if (Object.keys(bucket).length === 0) {
                delete config[AGENT_KEY];
            }
        }
        // 清掉 1.x 遗留键
        delete config.agent;
        console.log(`  agent-type=clear：已清理 ${cleaned} 个 impm 管理的 agent 模型配置`);
        return;
    }
```

写入分支改为：

```js
    config[AGENT_KEY] = config[AGENT_KEY] || {};
    let synced = 0;
    let preserved = 0;
    let downgraded = 0;
    for (const [name, setting] of Object.entries(preset.agents)) {
        const existing = config[AGENT_KEY][name];
        if (agentType === "custom" && existing && existing.model) {
            preserved++;
            continue;
        }
        // 2.x 形态：思考深度并入模型引用（provider/model#variant）
        const variant = variantOf(setting.variant);
        if (variant !== String(setting.variant || "").toLowerCase()) {
            downgraded++;
        }
        config[AGENT_KEY][name] = {
            ...(existing || {}),
            model: `${setting.model}#${variant}`,
        };
        synced++;
    }
    // 清掉 1.x 遗留键
    delete config.agent;

    const msg = [`  已按预设 ${agentType} 为 ${synced} 个 agent 写入模型配置（agents）`];
    if (preserved > 0) {
        msg.push(`，保留 ${preserved} 个既有 custom 配置`);
    }
    if (downgraded > 0) {
        msg.push(`，${downgraded} 个 max 档降级为 high variant（2.x 无 max variant）`);
    }
    console.log(msg.join(""));
```

- [ ] **Step 5: `updateOpenCodeConfig` 与 `runInstall` 去掉 hostMajor**

`updateOpenCodeConfig` 签名改为：

```js
function updateOpenCodeConfig(projectRoot, agentType, assetsDir, pluginRoot, manifest = null) {
```

注册插件部分改为只写 `PLUGIN_KEY` 并清理遗留键：

```js
    if (!isSelfInstall) {
        config[PLUGIN_KEY] = mergePluginEntries(config[PLUGIN_KEY]);
        // 清掉 1.x 遗留键
        delete config.plugin;
        console.log(
            `  配置文件已更新: ${configPath}（${PLUGIN_KEY}: ${DEFAULT_PLUGINS.join(", ")}）`,
        );
    } else {
        console.log(`  本地自安装：跳过 ${PLUGIN_KEY} 注册`);
    }
```

`runInstall` 改为：

```js
export function runInstall({ pluginRoot, projectRoot, version, agentType = "", opencodeDirOverride = "" }) {
    const assetsDir = join(pluginRoot, "assets");
    const distDir = join(pluginRoot, "dist");
    const opencodeDir = opencodeDirOverride || join(projectRoot, ".opencode");
```

删除 `console.log(`宿主: opencode ${detectedMajor}.x`)` 这一行，以及所有 `hostMajor` / `detectedMajor` 引用；manifest 构造改为：

```js
    if (!manifest) {
        manifest = {
            installedVersion: version || "",
            everInstalled: everByDir,
            pluginNames: [],
            pkgJsonTypeModule: false,
        };
    } else {
        manifest.installedVersion = version || manifest.installedVersion || "";
        // 迁移：删除 2.0.x 写入的 hostMajor
        delete manifest.hostMajor;
        for (const dir of ASSET_DIRS) {
            mergeEver(manifest, dir, everByDir[dir]);
        }
    }
```

- [ ] **Step 6: `scripts/uninstall.mjs` 清理 2.x 键**

在清理插件键的位置补 `plugins` 分支并删除遗留 `plugin`：

```js
// 2.x 形态
if (Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter((p) => pluginEntryName(p) !== PACKAGE_NAME);
    if (config.plugins.length === 0) {
        delete config.plugins;
    }
}
// 1.x 遗留
delete config.plugin;
```

在清理 agent 键的位置补 `agents` 分支并删除遗留 `agent`：

```js
// 2.x 形态
if (config.agents && typeof config.agents === "object") {
    for (const name of managedAgents) {
        if (config.agents[name]) {
            delete config.agents[name];
        }
    }
    if (Object.keys(config.agents).length === 0) {
        delete config.agents;
    }
}
// 1.x 遗留
delete config.agent;
```

其中 `managedAgents` 沿用文件内既有的“impm 管理的 agent 名集合”变量；若不存在，直接复用现循环里使用的那份名单。

- [ ] **Step 7: 同步类型声明与脚本注释**

`src/types/install-core.d.ts` 的 `RunInstallOptions` 保持 `{ pluginRoot, projectRoot, version, agentType?, opencodeDirOverride? }`，确认无 `hostMajor`（若存在删除）。

`scripts/install.mjs` 与 `scripts/install.ps1` 顶部注释中的 “model + reasoning_effort” 改为 “model + variant”；两文件均无 `--host` 参数，不需要改逻辑。

- [ ] **Step 8: 校验脚本无 1.x 残留**

Run: `Select-String -Path scripts/*.mjs,scripts/*.ps1 -Pattern 'hostMajor|detectHostMajor|AGENT_CONFIG_KEYS|PLUGIN_CONFIG_KEYS|reasoning_effort'`
Expected: 无输出（`uninstall.mjs` 中清理 `reasoning_effort` 的兼容代码也应随 Step 6 一并删除）。

- [ ] **Step 9: 运行安装测试**

Run: `node --test test/install.test.mjs`
Expected: 3 个用例全部 PASS。

- [ ] **Step 10: `.opencode/` 出库校验**

Run: `git ls-files .opencode`
Expected: 无输出。若为空，说明自安装产物本来就不入库，只需确认 `.gitignore` 含 `.opencode/`：

Run: `Select-String -Path .gitignore -Pattern '^\.opencode/'`
Expected: 命中 1 行。

若 `git ls-files .opencode` 有输出，则执行：

```bash
git rm -r --cached .opencode
```

- [ ] **Step 11: 全量测试并提交**

Run: `npm test`
Expected: 全部 PASS。

```bash
git add scripts/install-core.mjs scripts/uninstall.mjs scripts/install.mjs scripts/install.ps1 src/types/install-core.d.ts test/install.test.mjs .gitignore
git commit -m "feat(install): 安装与卸载脚本只处理 opencode 2.x 配置"
```

---

### Task 8: 文档与变更记录

**Files:**
- Modify: `readme.md`
- Modify: `CHANGELOG.md`
- Modify: `agent.md`
- Modify: `deploy.md`

**Interfaces:**
- Consumes: Task 1–7 的最终行为（3.0.0、仅 2.x、`plugins`/`agents`、`permissions` 规则、无 `--host` 参数）。
- Produces: 用户可见的迁移指引与权限模型说明，供 Task 9 的验收清单核对。

- [ ] **Step 1: `CHANGELOG.md` 新增 3.0.0 段落**

在文件顶部（`## [2.0.1]` 之前）插入：

```markdown
## [3.0.0] - 2026-10-29

### 破坏性变更

- **仅支持 opencode >= 2.0.0**：删除全部 1.x 兼容代码，插件入口只导出 `{ id, setup }`，1.x 宿主加载时会打印错误并跳过注册。
- **配置只写 2.x 键**：安装脚本只生成 `plugins` 与 `agents`，不再写 `plugin` / `agent`。
- **agent 权限改为有序规则列表**：`permission` 映射 → `permissions` 数组；`bash` → `shell`，`write`/`edit` 合并为 `edit`，`task` → `subagent`，`todowrite` 随 2.x 移除。
- **命令 frontmatter**：`subtask` → `subagent`。
- **数据层只读 2.x 表**：prompt 记录与 heartbeat 改读 `session_v2` / `session_message`，1.x 时代的历史会话不再可导出。
- **每轮 token 为近似值**：2.x 不提供逐消息用量，改用会话聚合增量，导出中标注“会话聚合增量，近似值”。
- **模型预设**：`reasoning_effort` → `variant`；`max` 档降为 `high`（2.x 无 `max`）。

### 迁移步骤

1. 升级 opencode 到 >= 2.0.0，并确认：`opencode --version`。
2. 升级插件：`npm i -g opencode-impm-cn@3`；项目内安装的，更新依赖后重跑安装脚本。
3. 若手改过 `opencode.json`：`plugin` 改 `plugins`，`agent` 改 `agents`，每个 agent 的 `model` 写成 `provider/model#variant`，删除 `reasoning_effort`。
4. 若手改过 `.opencode/agents/*.md`：`permission` 映射改为 `permissions` 规则列表，删除 `temperature`。
5. 若手改过 `.opencode/commands/*.md`：`subtask` 改为 `subagent`。
6. 重新执行安装脚本以刷新 `.opencode/` 下的 agents、commands、skills 与插件副本。
```

- [ ] **Step 2: `readme.md` 改为 2.x-only**

逐项修改：

1. 前置条件：只保留 `opencode >= 2.0.0` 与 `Node.js >= 22.5.0`，删除 1.18.29 与“1.x 停在 1.1.2”的说明。
2. 安装说明：只保留 `plugins` 写法；删除 `"plugin": [...]` 与 1.x 分支文案。
3. 新增小节“从 2.x 升级到 3.0.0”，内容为 CHANGELOG 迁移步骤的第 3–6 步。
4. 模型预设表：列名 `reasoning_effort` 改为 `variant`，并注明 `max` 会自动降为 `high`。
5. 项目结构树：把 `src/runtime/`、`src/host/detect.ts`、`src/host/session.ts`、`src/host/plugin-types.ts` 替换为 `src/plugin/`（`contract.ts`、`setup.ts`、`location.ts`、`tools.ts`、`prompt-hook.ts`、`events.ts`、`session-port.ts`）与 `src/host/version.ts`。
6. 架构章节：把“双形态入口”替换为“单一 2.x 入口 `{ id, setup }`，`@opencode/plugin` 仅作类型引用”。

- [ ] **Step 3: `agent.md` 权限说明改为 2.x 规则**

把“权限模型”小节替换为：

```markdown
## 权限模型

13 个 agent 使用 opencode 2.x 的有序规则列表（`permissions`），规则自上而下匹配，**最后匹配者胜**。

- 通配规则（`action: "*"` 或 `resource: "*"`）放在最前面，具体规则放在后面。
- 同一范围内 `deny` 在前、`allow` 在后。
- `bash` 已由 `shell` 取代；`write` / `edit` / `patch` 合并为 `edit`，编辑类权限取更严格的一档。
- `task` 已由 `subagent` 取代，资源为被调用的 agent id。
- `todowrite` 在 2.x 不存在，已从全部 agent 中移除。
- `temperature` 不再写入 agent frontmatter：温度属于模型/variant 配置。
```

同时把文档中“支持 opencode 1.x 与 2.x”的表述改为“仅支持 opencode >= 2.0.0”。

- [ ] **Step 4: `deploy.md` 同步脚本参数**

删除 `--host` / `-Host` 相关参数说明与示例，补充“安装脚本只写 `plugins` / `agents`”。

- [ ] **Step 5: 校验文档无 1.x 安装说明**

Run: `Select-String -Path readme.md,agent.md,deploy.md -Pattern '1\.18\.29|1\.1\.2|"plugin"|reasoning_effort|subtask'`
Expected: 仅允许出现“删除 `reasoning_effort`”“`subtask` 改为 `subagent`”这类迁移说明；不得出现安装用法。

- [ ] **Step 6: 提交**

```bash
git add readme.md CHANGELOG.md agent.md deploy.md
git commit -m "docs: 更新 3.0.0 文档与迁移指引"
```

---

### Task 9: 收尾验收与真机冒烟

**Files:**
- Modify: `docs/superpowers/plans/2026-10-29-opencode-2-only-refactor.md`（仅勾选验收项时不需要改动文件，此处不改代码）

**Interfaces:**
- Consumes: Task 1–8 的全部产物。
- Produces: 可发布的 3.0.0 工作树。

- [ ] **Step 1: 构建**

Run: `npm run build`
Expected: 退出码 0，无 TypeScript 报错。

- [ ] **Step 2: 校验 dist 无运行时依赖**

Run: `Select-String -Path dist/*.js,dist/**/*.js -Pattern '@opencode/plugin'`
Expected: 无输出。

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: `# pass` 计数与用例总数一致，`# fail 0`。

- [ ] **Step 4: 1.x 残留符号扫描**

```bash
Select-String -Path src/**/*.ts,assets/**/*.md,scripts/*.mjs,scripts/*.ps1,opencode.json -Pattern 'runV1|runV2|toV1Args|toV1Result|toV2Input|toV2Result|adaptDynamicTool|detectHost|hostMajor|DualVersionPlugin|chat\.message|^subtask:|^  permission:|reasoning_effort'
```

Expected: 无输出。若命中，逐条修掉后回到 Step 1。

- [ ] **Step 5: 资产数量校验**

Run: `(Get-ChildItem assets/agents/*.md).Count; (Get-ChildItem assets/commands/*.md).Count`
Expected: `13` 与 `66`。

- [ ] **Step 6: 临时项目安装冒烟**

```bash
node --input-type=module -e "import { mkdtempSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; import { runInstall } from './scripts/install-core.mjs'; const dir = mkdtempSync(join(tmpdir(), 'impm-smoke-')); runInstall({ pluginRoot: process.cwd(), projectRoot: dir, version: '3.0.0', agentType: 'opencode-go-balance' }); console.log(readFileSync(join(dir, 'opencode.json'), 'utf8')); console.log('临时目录:', dir);"
```

Expected: 输出的配置只含 `plugins` / `agents` / `mcp.servers`，每个 `agents[*].model` 带 `#`。

- [ ] **Step 7: 真机冒烟（需人工确认）**

在 opencode 2.1.4 中打开本项目，确认：

1. 插件加载无报错；
2. 工具列表可见 15 个 `impm_*` 工具；
3. 调用 `impm_project_info` 返回项目信息；
4. 调用 `impm_prompt_record` 能记录当前会话；
5. 调用 `impm_heartbeat`（`action: "status"`）返回状态；
6. 提一个问题后 `docs/prompts/prompts.md` 新增一行，token 列标注为近似值。

- [ ] **Step 8: 最终提交与打标签**

```bash
git add -A
git commit -m "chore: impm 3.0.0 仅支持 opencode 2.x"
git tag v3.0.0
```

---

## 自审记录

**1. 规格覆盖**

| Spec 章节 | 落地任务 |
|---|---|
| §4 目标架构 / §5 契约层 | Task 1、Task 2 Step 8–14 |
| §6 启动流程 | Task 2 Step 9（`setup.ts`） |
| §7 版本闸门 | Task 1（`host/version.ts`）、Task 2 Step 15 |
| §8 工具层 | Task 2 Step 4–6、`test/tool-defs.test.mjs` |
| §9 钩子与事件 | Task 2 Step 10–11、`test/setup.test.mjs` |
| §10 会话端口 | Task 2 Step 8、Task 4 |
| §11 自安装 | Task 2 Step 3（`host/install.ts`）、Task 7 |
| §12 日志 | Task 2 Step 2 |
| §13 prompt-recorder 换表 | Task 3 |
| §14 heartbeat | Task 4 |
| §15 agents | Task 5 |
| §16 commands | Task 6 Step 2–3 |
| §17 预设与配置 | Task 6 Step 4–6 |
| §18 installer | Task 7 |
| §19 `.opencode/` 出库 | Task 7 Step 10 |
| §20 包元数据 | Task 1 Step 1–2 |
| §21 测试策略 | Task 1–7 各自的测试步骤 |
| §22 文档 | Task 8 |
| §23 迁移指引 | Task 8 Step 1 |
| §24 风险 | Task 1（契约推导）、Task 2 Step 15（`tsc` 兜底）、Task 9 |
| §25 验收标准 | Task 9 |
| §26 实施顺序 | Task 1–9 顺序一致 |

**2. 占位符扫描**：已确认无 `TBD` / `TODO` / “实现时补充”一类表述；每个代码步骤都给出了完整可粘贴内容或精确的替换锚点。

**3. 测试文件数量**：最终共 7 个测试文件（`setup`、`version-gate`、`tool-defs`、`prompt-recorder`、`heartbeat`、`frontmatter`、`install`）。Spec §21 列了其中 5 个；`prompt-recorder` 与 `heartbeat` 单独成文件是覆盖增强（两者各有独立数据层），不属于范围扩张。

**4. 类型一致性**

- `ToolDef` 只在 `tool-defs.ts` 定义一次，`setup.ts`、`prompt-recorder.ts`、`heartbeat.ts` 均按 `{ name, description, props, run }` 使用。
- `SessionPort` 由 `plugin/session-port.ts` 定义，`heartbeat.ts` 与 `setup.ts` 只 `import type`，签名统一为 `interrupt(sessionID)` / `prompt(sessionID, text)` / `get(sessionID)`。
- `Cleanup` 统一来自 `plugin/contract.ts`（等价于官方 `Cleanup`），`setup.ts` 返回 `Cleanup | undefined`。
- `HostVersion` 的 `major: number`（不可解析时为 `NaN`）在 `isSupported` 与测试中一致。

**5. Review Focus 归属**

| Review Focus | 测试位置 |
|---|---|
| 版本缺失/非数字 | `test/setup.test.mjs`（Task 2 Step 1 的 `app.version` 用例、Step 14） |
| 工具非对象入参 | `test/setup.test.mjs`（Task 2 Step 1、Step 14） |
| cleanup 重复调用 | `test/setup.test.mjs`（Task 2 Step 1、Step 14） |
| `session_message.data` 坏 JSON | `test/prompt-recorder.test.mjs`（Task 3） |
| 1.x 老会话不存在 | `test/prompt-recorder.test.mjs`（Task 3） |

