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
 * 统一日志出口
 *
 * opencode 1.x 提供结构化日志端点 `client.app.log()`，但 opencode 2.x 已移除
 * 该端点（V2 服务 API 无 app 资源、无 /api/log），仅能退回 console。
 * 本模块屏蔽该差异：V1 runtime 启动时绑定结构化 sink，V2 不绑定，走 console。
 */

/** 日志级别，与 V1 client.app.log 的 level 取值保持一致 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** 结构化日志条目 */
export interface LogEntry {
    service: string;
    level: LogLevel;
    message: string;
    extra?: Record<string, unknown>;
}

/** 结构化日志 sink（由 V1 runtime 绑定；未绑定时退回 console） */
type StructuredSink = (entry: LogEntry) => Promise<unknown>;

const SERVICE = "opencode-impm";

let structuredSink: StructuredSink | undefined;

/**
 * 绑定结构化日志 sink
 * @param sink V1 client.app.log 的包装函数；传 undefined 解绑
 */
export function bindStructuredLogger(sink?: StructuredSink): void {
    structuredSink = sink;
}

/** console 级别与输出方法的映射 */
const CONSOLE_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error",
};

/**
 * 输出一条日志
 *
 * 结构化 sink 绑定时优先走 sink（V1），失败则回落 console；
 * 未绑定时直接走 console（V2）。
 *
 * @param level 日志级别
 * @param message 日志正文
 * @param extra 附加字段（会一并输出到 console）
 */
export function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    const entry: LogEntry = extra ? { service: SERVICE, level, message, extra } : { service: SERVICE, level, message };

    if (structuredSink) {
        try {
            const result = structuredSink(entry);
            if (result && typeof (result as Promise<unknown>).catch === "function") {
                void (result as Promise<unknown>).catch(() => {
                    /* 结构化日志失败不影响插件功能 */
                });
            }
            return;
        } catch {
            /* sink 抛错则退回 console */
        }
    }

    const method = CONSOLE_METHOD[level];
    const text = extra ? `[impm] ${message} ${safeStringify(extra)}` : `[impm] ${message}`;
    console[method](text);
}

/** 附加字段的安全序列化（循环引用等异常不应导致日志本身抛错） */
function safeStringify(value: Record<string, unknown>): string {
    try {
        return JSON.stringify(value);
    } catch {
        return "[unserializable]";
    }
}