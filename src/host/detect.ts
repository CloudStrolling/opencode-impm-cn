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
 * 宿主（opencode 宿主程序）版本探测
 *
 * opencode 1.x 与 2.x 的插件上下文结构完全不同，本模块把两者归一为
 * `HostVersion`，使上层 runtime 与工具层无需感知宿主版本。
 *
 * 探测路径（无需条件 import，不产生对任一版本包的运行时依赖）：
 * - opencode 2.x：插件上下文直接提供 `ctx.app.version`（同步、零网络）
 * - opencode 1.x：插件上下文的 SDK client 提供 `client.app.get()` → `data.version`
 *
 * 探测失败时降级为 1（与改造前行为一致），且绝不抛异常——版本探测失败不应
 * 阻断插件加载。
 */

import { log } from "./log.js";

/** 宿主主版本号 */
export type HostMajor = 1 | 2;

/** 宿主版本信息 */
export interface HostVersion {
    /** 主版本号：1 = opencode 1.x，2 = opencode 2.x */
    major: HostMajor;
    /** 完整版本字符串（探测失败时为空串） */
    version: string;
}

/**
 * 从版本字符串解析主版本号
 *
 * 容忍 `2`、`2.0`、`v2.0.0`、`2.0.0-beta.1`、`2.0.0+build` 等形态。
 * 无法解析时返回 null，由调用方决定降级策略。
 *
 * @param version 版本字符串
 * @returns 主版本号，无法识别时 null
 */
export function parseMajor(version: string): HostMajor | null {
    if (typeof version !== "string") {
        return null;
    }
    const match = /^\s*v?(\d+)/.exec(version);
    if (!match) {
        return null;
    }
    const major = Number(match[1]);
    if (major >= 2) {
        return 2;
    }
    if (major >= 1) {
        return 1;
    }
    return null;
}

/**
 * 探测宿主版本
 *
 * @param input 插件上下文：V2 为 `ctx`（含 app.version），V1 为 PluginInput（含 client.app.get）
 * @returns 宿主版本；探测失败降级为 `{ major: 1, version: "" }`
 */
export async function detectHost(input: unknown): Promise<HostVersion> {
    const fromContext = readContextAppVersion(input);
    if (fromContext) {
        return { major: parseMajor(fromContext) ?? 1, version: fromContext };
    }

    const fromClient = await readClientAppVersion(input);
    if (fromClient) {
        return { major: parseMajor(fromClient) ?? 1, version: fromClient };
    }

    log("warn", "无法探测 opencode 宿主版本，按 1.x 兼容模式运行", {
        hint: "如为 opencode 2.x 请反馈此告警",
    });
    return { major: 1, version: "" };
}

/**
 * 读取 V2 上下文的 app.version
 *
 * opencode 2.x 插件上下文的 `app` 形如 `{ name, version, channel }`。
 *
 * @param input 插件上下文
 * @returns 版本字符串，不存在时 null
 */
function readContextAppVersion(input: unknown): string | null {
    const app = (input as { app?: { version?: unknown } } | undefined)?.app;
    const version = app?.version;
    return typeof version === "string" && version ? version : null;
}

/**
 * 读取 V1 上下文的 client.app.get()
 *
 * opencode 1.x 的 SDK client 提供 `app.get()`，返回 `{ data: { version, ... } }`。
 * 该调用可能失败（老版本无此端点、网络异常等），一律吞掉并降级。
 *
 * @param input 插件上下文
 * @returns 版本字符串，取不到时 null
 */
async function readClientAppVersion(input: unknown): Promise<string | null> {
    const client = (input as { client?: { app?: { get?: () => Promise<unknown> } } } | undefined)?.client;
    const get = client?.app?.get;
    if (typeof get !== "function") {
        return null;
    }
    try {
        const response = (await get.call(client!.app)) as { data?: { version?: unknown } } | undefined;
        const version = response?.data?.version;
        return typeof version === "string" && version ? version : null;
    } catch {
        return null;
    }
}