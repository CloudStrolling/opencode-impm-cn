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
 * 会话控制端口（中止 / 注入消息）
 *
 * heartbeat 功能需要「中止卡死子会话」与「向主会话注入续跑指令」两项能力，
 * 两个宿主的实现完全不同：
 *
 * | 能力 | opencode 1.x                    | opencode 2.x                                |
 * |------|---------------------------------|---------------------------------------------|
 * | 中止 | `client.session.abort(id)`      | `ctx.session.interrupt({sessionID, continue:false})` |
 * | 注入 | `client.session.chat(id, body)`  | `ctx.session.prompt({sessionID, text})`     |
 *
 * 本模块以 `SessionPort` 屏蔽该差异。所有实现均容忍宿主 API 缺失，
 * 失败只返回 `ok:false` 而不抛异常——心跳检测不能因接口差异而崩溃。
 */

import { log } from "./log.js";

/** 操作结果 */
export interface OpResult {
    ok: boolean;
    detail: string;
}

/** 会话控制端口 */
export interface SessionPort {
    /** 中止指定会话 */
    abort(sessionId: string): Promise<OpResult>;
    /** 向指定会话注入用户消息（唤醒） */
    prompt(sessionId: string, text: string): Promise<OpResult>;
}

/** opencode 1.x SDK client 的最小结构（仅本模块用到的部分） */
interface V1ClientLike {
    session?: {
        abort?: (arg: unknown, body?: unknown) => Promise<unknown>;
        chat?: (arg: unknown, body?: unknown) => Promise<unknown>;
    };
}

/** opencode 2.x 插件上下文的最小结构（仅本模块用到的部分） */
interface V2CtxLike {
    session?: {
        interrupt?: (input: { sessionID: string; continue?: boolean }) => Promise<unknown>;
        prompt?: (input: { sessionID: string; text: string }) => Promise<unknown>;
    };
}

/** 从错误对象提取可读信息 */
function errorMessage(...candidates: unknown[]): string {
    for (const candidate of candidates) {
        const message = (candidate as Error)?.message;
        if (message) {
            return message;
        }
        if (typeof candidate === "string" && candidate) {
            return candidate;
        }
        if (candidate !== undefined && candidate !== null) {
            return String(candidate);
        }
    }
    return "未知错误";
}

/**
 * 创建 opencode 1.x 会话端口
 *
 * 1.x SDK 在不同小版本间存在 `abort(id)` 与 `abort({path:{id}})` 两种签名，
 * 与既有实现保持一致：先试新形态，失败回退旧形态。
 *
 * @param input V1 插件上下文（含 client）
 * @returns 会话端口
 */
export function createV1SessionPort(input: unknown): SessionPort {
    const client = (input as { client?: V1ClientLike } | undefined)?.client ?? {};

    return {
        async abort(sessionId: string): Promise<OpResult> {
            const fn = client.session?.abort;
            if (typeof fn !== "function") {
                return { ok: false, detail: "OpenCode 客户端不可用（缺少 session.abort）" };
            }
            try {
                await fn.call(client.session, sessionId);
                return { ok: true, detail: "abort(id)" };
            } catch (err1) {
                try {
                    await fn.call(client.session, { path: { id: sessionId } });
                    return { ok: true, detail: "abort({path})" };
                } catch (err2) {
                    return { ok: false, detail: `中止失败：${errorMessage(err2, err1)}` };
                }
            }
        },

        async prompt(sessionId: string, text: string): Promise<OpResult> {
            const fn = client.session?.chat;
            if (typeof fn !== "function") {
                return { ok: false, detail: "OpenCode 客户端不可用（缺少 session.chat）" };
            }
            const body = { parts: [{ type: "text", text }] };
            try {
                await fn.call(client.session, sessionId, body);
                return { ok: true, detail: "chat(id,body)" };
            } catch (err1) {
                try {
                    await fn.call(client.session, { path: { id: sessionId } }, body);
                    return { ok: true, detail: "chat({path},body)" };
                } catch (err2) {
                    return { ok: false, detail: `注入消息失败：${errorMessage(err2, err1)}` };
                }
            }
        },
    };
}

/**
 * 创建 opencode 2.x 会话端口
 *
 * V2 中止会话的语义是 `interrupt({sessionID, continue})`：`continue:false`
 * 表示中止且不恢复执行；V1 插件 API 中不存在 abort，必须走此路径。
 * 注意 V2 插件层字段名为 `continue`，而 HTTP 层为 query `resume`，此处按插件层取值。
 *
 * @param ctx V2 插件上下文
 * @returns 会话端口
 */
export function createV2SessionPort(ctx: unknown): SessionPort {
    const v2 = ctx as V2CtxLike | undefined;

    return {
        async abort(sessionId: string): Promise<OpResult> {
            const fn = v2?.session?.interrupt;
            if (typeof fn !== "function") {
                return { ok: false, detail: "opencode 2.x 上下文不可用（缺少 session.interrupt）" };
            }
            try {
                await fn.call(v2!.session, { sessionID: sessionId, continue: false });
                return { ok: true, detail: "interrupt({continue:false})" };
            } catch (err) {
                log("warn", "opencode 2.x 中止会话失败", {
                    sessionId,
                    error: errorMessage(err),
                });
                return { ok: false, detail: `中止失败：${errorMessage(err)}` };
            }
        },

        async prompt(sessionId: string, text: string): Promise<OpResult> {
            const fn = v2?.session?.prompt;
            if (typeof fn !== "function") {
                return { ok: false, detail: "opencode 2.x 上下文不可用（缺少 session.prompt）" };
            }
            try {
                await fn.call(v2!.session, { sessionID: sessionId, text });
                return { ok: true, detail: "session.prompt" };
            } catch (err) {
                log("warn", "opencode 2.x 注入会话消息失败", {
                    sessionId,
                    error: errorMessage(err),
                });
                return { ok: false, detail: `注入消息失败：${errorMessage(err)}` };
            }
        },
    };
}

/**
 * 按宿主版本创建会话端口
 *
 * @param major 宿主主版本号
 * @param input 插件上下文
 * @returns 会话端口
 */
export function createSessionPort(major: 1 | 2, input: unknown): SessionPort {
    return major === 2 ? createV2SessionPort(input) : createV1SessionPort(input);
}

/**
 * 空会话端口：宿主未提供任何会话 API 时使用，所有操作返回失败而不抛异常
 */
export const NULL_SESSION_PORT: SessionPort = {
    async abort(): Promise<OpResult> {
        return { ok: false, detail: "会话控制不可用（宿主未提供会话 API）" };
    },
    async prompt(): Promise<OpResult> {
        return { ok: false, detail: "会话控制不可用（宿主未提供会话 API）" };
    },
};