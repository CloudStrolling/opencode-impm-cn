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
 * opencode 1.x 插件运行时
 *
 * 对应 1.x 的插件契约：导出一个异步函数，返回 `{ tool, "chat.message", event }`。
 * 行为与改造前 `src/index.ts` 完全一致，1.x 下零回归。
 */

import { STATIC_TOOL_DEFS, toV1Args, toV1Result } from "../tools/tool-defs.js";
import type { ToolPorts } from "../tools/tool-defs.js";
import { createPromptRecorder } from "../tools/prompt-recorder.js";
import { createHeartbeatMonitor } from "../tools/heartbeat.js";
import { bindStructuredLogger } from "../host/log.js";
import { detectHost } from "../host/detect.js";
import { createV1SessionPort } from "../host/session.js";
import { ensureInstalled, resolvePluginRoot } from "../host/install.js";
import type { SessionPort } from "../host/session.js";

/** opencode 1.x 插件上下文（仅本插件用到的部分） */
export interface V1PluginInput {
    project?: { path?: string };
    directory?: string;
    /** SDK 客户端：结构化日志、版本探测、会话中止与消息注入 */
    client?: unknown;
}

/** opencode 1.x 工具定义形态 */
interface V1ToolDef {
    description: string;
    args: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

/**
 * opencode 1.x 插件入口
 *
 * 由 `dist/index.js` 的 default 导出对象的 `server` 字段引用。
 *
 * @param context 1.x 插件上下文
 * @returns 工具注册表与钩子
 */
export async function runV1(context: V1PluginInput) {
    // 绑定 1.x 结构化日志（2.x 无此端点，不绑定）
    const client = context.client as
        | { app?: { log?: (arg: unknown) => Promise<unknown> } }
        | undefined;
    const appLog = client?.app?.log;
    if (typeof appLog === "function") {
        bindStructuredLogger((entry) => appLog.call(client!.app, { body: entry }));
    }

    const host = await detectHost(context);
    const projectRoot = context.project?.path || context.directory || "";
    const sessionPort: SessionPort = createV1SessionPort(context);

    // 启动时自检安装：插件版本或宿主主版本变化时自动同步 assets 与 opencode.json
    await ensureInstalled(projectRoot, host.major, resolvePluginRoot(import.meta.url));

    // 内置功能：prompt-recorder（提问记录 + 对话导出，含钩子与 3 个手动工具）
    const promptRecorder = await createPromptRecorder(projectRoot);

    // 内置功能：heartbeat（subagent 心跳检测与自动重启，含钩子与 1 个手动工具）
    // 注：P3 将把这里的 client 直连改为 SessionPort/ActivityPort 注入
    const heartbeat = await createHeartbeatMonitor(projectRoot, context.client);

    /** 合并多个 event 钩子处理器：任一失败不影响其他（各钩子内部已自行捕获） */
    const combinedEvent = async (input: { event: unknown }): Promise<void> => {
        await Promise.all([promptRecorder.event(input), heartbeat.event(input)]);
    };

    const ports: ToolPorts = { projectRoot, sessionPort };

    /** 11 个静态工具 + 4 个工厂动态工具 → 1.x 形态工具 map */
    const tools: Record<string, V1ToolDef> = {};
    for (const def of STATIC_TOOL_DEFS) {
        tools[def.name] = {
            description: def.description,
            args: toV1Args(def.props),
            async execute(args: Record<string, unknown>) {
                return toV1Result(def.run(args, ports));
            },
        };
    }

    // prompt-recorder 内置功能工具（提问记录 / 重算 token 并回填 / 导出对话快照）
    tools.impm_prompt_record = promptRecorder.tool.impm_prompt_record;
    tools.impm_prompt_finalize = promptRecorder.tool.impm_prompt_finalize;
    tools.impm_prompt_export = promptRecorder.tool.impm_prompt_export;
    // heartbeat 内置功能工具（查看状态 / 立即扫描 / 查看告警）
    tools.impm_heartbeat = heartbeat.tool.impm_heartbeat;

    return {
        /** chat.message 钩子：用户提问时自动记录到 prompts.md */
        "chat.message": promptRecorder.chatMessage,
        /** 事件钩子：主会话回合结束时回填 token、导出对话；subagent 心跳检测与卡死自动重启 */
        event: combinedEvent,
        tool: tools,
    };
}