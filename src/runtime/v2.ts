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
 * opencode 2.x 插件运行时
 *
 * 对应 2.x 的插件契约：插件 default 导出 `{ id, setup(ctx) }`，`setup` 通过上下文
 * 领域 API 注册工具、钩子与事件订阅，并可返回 cleanup 函数。
 *
 * 与 1.x 的关键差异（均由本模块屏蔽）：
 * | 能力 | 1.x | 2.x |
 * |------|------|------|
 * | 工具注册 | 返回 `tool` map | `ctx.tool.transform(editor => editor.add(...))` |
 * | 工具入参 | `args`（属性表） | `input`（完整 JSON Schema） |
 * | 工具结果 | `string` / `{output}` | `{content}` |
 * | 提问记录 | `"chat.message"` 钩子 | `ctx.session.hook("prompt", ...)` |
 * | 事件流 | `event` 钩子 | `ctx.event.subscribe({signal})` 异步迭代 |
 * | 清理 | `dispose` 钩子 | `setup` 返回的 cleanup 函数 |
 * | 工具工作目录 | `context.directory` | `ctx.session.get().location.directory` |
 * | 取消 | `context.abort` | `context.signal` |
 */

import { join } from "node:path";
import { STATIC_TOOL_DEFS, toV2Input, toV2Result, adaptDynamicTool } from "../tools/tool-defs.js";
import type { ToolPorts } from "../tools/tool-defs.js";
import { createPromptRecorder } from "../tools/prompt-recorder.js";
import { createHeartbeatMonitor } from "../tools/heartbeat.js";
import { bindStructuredLogger, log } from "../host/log.js";
import { detectHost } from "../host/detect.js";
import { createV2SessionPort } from "../host/session.js";
import { ensureInstalled, resolvePluginRoot } from "../host/install.js";

/** opencode 2.x 工具执行上下文（仅本插件用到的部分） */
export interface V2ToolContext {
    sessionID?: string;
    agent?: string;
    messageID?: string;
    id?: string;
    signal?: AbortSignal;
    progress?: (update: Record<string, unknown>) => Promise<unknown>;
}

/** opencode 2.x prompt 钩子事件（仅本插件用到的部分） */
export interface V2PromptEvent {
    sessionID?: string;
    messageID?: string;
    prompt?: { text?: string };
}

/** opencode 2.x 插件上下文（仅本插件用到的部分） */
export interface V2Context {
    app?: { version?: string; name?: string; channel?: string };
    location?: { directory?: string; project?: { id?: string; directory?: string } };
    session?: {
        get?: (input: { sessionID: string }) => Promise<{
            location?: { directory?: string };
            subpath?: string;
        } | null>;
        interrupt?: (input: { sessionID: string; continue?: boolean }) => Promise<unknown>;
        prompt?: (input: { sessionID: string; text: string }) => Promise<unknown>;
        /** 会话域钩子注册入口（prompt / context / compaction 等） */
        hook?: (
            name: string,
            handler: (event: V2PromptEvent) => Promise<void> | void,
        ) => Promise<unknown>;
    };
    tool?: {
        transform: (
            callback: (editor: {
                add: (tool: Record<string, unknown>) => void;
            }) => void,
        ) => Promise<unknown>;
    };
    event?: {
        subscribe: (options?: { signal?: AbortSignal }) => AsyncIterable<unknown>;
    };
}

/**
 * 解析工具的工作目录
 *
 * 2.x 的工具执行上下文**不再提供** `directory`（1.x 有），需经会话信息解析：
 * `ctx.session.get().location.directory` + `subpath`；解析失败回落插件加载目录。
 *
 * @param ctx 2.x 插件上下文
 * @returns 工作目录绝对路径
 */
async function resolveLocation(ctx: V2Context, sessionID?: string): Promise<string> {
    const fallback = ctx.location?.directory || process.cwd();
    if (!sessionID) {
        return fallback;
    }
    try {
        const session = await ctx.session?.get?.({ sessionID });
        const directory = session?.location?.directory;
        if (!directory) {
            return fallback;
        }
        return session?.subpath ? join(directory, session.subpath) : directory;
    } catch {
        return fallback;
    }
}

/**
 * opencode 2.x 插件 setup 入口
 *
 * @param ctx 2.x 插件上下文
 * @returns cleanup 函数（插件卸载时终止事件订阅与定时器）
 */
export async function runV2(ctx: V2Context): Promise<() => void> {
    // 2.x 无结构化日志端点，明确不绑定 sink，日志统一走 console
    bindStructuredLogger(undefined);

    const host = await detectHost(ctx);
    const projectRoot = ctx.location?.project?.directory || ctx.location?.directory || "";
    const sessionPort = createV2SessionPort(ctx);
    const ports: ToolPorts = { projectRoot, sessionPort };

    log("info", `impm 插件已加载（opencode ${host.version || "未知版本"}）`, {
        projectRoot,
    });

    // 启动时自检安装：插件版本或宿主主版本变化时重跑安装（资产/config 键按版本分支）
    await ensureInstalled(projectRoot, host.major, resolvePluginRoot(import.meta.url));

    // 内置功能：prompt-recorder（提问记录 + 对话导出，含钩子与 3 个手动工具）
    const promptRecorder = await createPromptRecorder(projectRoot);

    // 内置功能：heartbeat（subagent 心跳检测与自动重启）
    // 注：P3 将改为注入 SessionPort/ActivityPort
    const heartbeat = await createHeartbeatMonitor(projectRoot, ctx);

    // ── 工具注册 ────────────────────────────────────────────────
    // 2.x 的 ctx.tool.transform 是可重放的状态编辑：回调必须同步、廉价、无一次性副作用。
    // 本插件的工具定义是纯静态字面量，满足该约束。
    const registration = ctx.tool?.transform((editor) => {
        // 11 个静态工具：schema 由单一属性表派生
        for (const def of STATIC_TOOL_DEFS) {
            editor.add({
                name: def.name,
                description: def.description,
                input: toV2Input(def.props),
                execute: async (input: Record<string, unknown>, toolContext: V2ToolContext) => {
                    const workdir = await resolveLocation(ctx, toolContext?.sessionID);
                    return toV2Result(def.run(input, { ...ports, projectRoot: workdir }));
                },
            });
        }

        // 4 个工厂动态工具：复用 1.x 形态定义，仅适配 schema 与结果封装
        for (const [name, def] of Object.entries(promptRecorder.tool)) {
            editor.add(adaptDynamicTool(name, def));
        }
        for (const [name, def] of Object.entries(heartbeat.tool)) {
            editor.add(adaptDynamicTool(name, def));
        }
    });
    void registration;

    // ── prompt 钩子：用户提问时自动记录 ──────────────────────────
    // 2.x 的 prompt 钩子在持久化入库前触发，且**非 exactly-once**（并发提交可能多次触发），
    // 故 recorder 内部需幂等去重（见 P2.2）。
    //
    // 当前把 2.x 事件适配为 1.x chat.message 的载荷形态复用既有记录逻辑；
    // P2.1 会把该逻辑下沉为平台无关的 onPrompt(sessionID, text)。
    const hookRegistrar = ctx.session?.hook;
    if (typeof hookRegistrar === "function") {
        await hookRegistrar.call(ctx.session, "prompt", (event: V2PromptEvent) => {
            const text = event?.prompt?.text ?? "";
            if (!text) {
                return;
            }
            return promptRecorder.chatMessage(
                { sessionID: event.sessionID, messageID: event.messageID },
                { parts: [{ type: "text", text }] },
            );
        });
    } else {
        log("warn", "opencode 2.x 上下文缺少 session.hook，用户提问自动记录不可用");
    }

    // ── 事件订阅：主会话回合结束回填 token、导出对话；心跳检测与卡死重启 ──
    // 2.x 的事件流是 live-only（无 replay、无自动重连），必须在 cleanup 中 abort。
    const controller = new AbortController();
    const subscribe = ctx.event?.subscribe;
    if (typeof subscribe === "function") {
        void (async () => {
            try {
                for await (const event of subscribe.call(ctx.event, { signal: controller.signal })) {
                    await handleV2Event(event, promptRecorder, heartbeat);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    log("warn", `opencode 2.x 事件订阅异常结束: ${(err as Error)?.message ?? err}`);
                }
            }
        })();
    } else {
        log("warn", "opencode 2.x 上下文缺少 event.subscribe，事件型内置功能不可用");
    }

    return () => {
        controller.abort();
    };
}

/**
 * 处理 2.x 事件流中的单个事件
 *
 * 复用 1.x 内置功能的处理入口；两个内置功能对载荷做多形态防御解析，
 * V2 事件结构差异由其内部的 extractSessionId 等函数吸收。
 *
 * @param event 事件对象
 * @param promptRecorder prompt 记录器
 * @param heartbeat 心跳监控器
 */
async function handleV2Event(
    event: unknown,
    promptRecorder: { event?: (input: { event: unknown }) => Promise<unknown> },
    heartbeat: { event?: (input: { event: unknown }) => Promise<unknown> },
): Promise<void> {
    const payload = { event };
    await Promise.all([
        promptRecorder.event?.(payload),
        heartbeat.event?.(payload),
    ]);
}