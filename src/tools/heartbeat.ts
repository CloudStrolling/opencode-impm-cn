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
 * impm 插件内置功能：impm-heartbeat（subagent 与 PM 主会话心跳检测及自动重启）
 *
 * 解决的问题：
 * 1. subagent 子会话卡死：PM 通过 task 工具并发派发 subagent 执行技能时，个别
 *    子会话可能因 LLM 服务无响应、网络中断等原因"未结束但长时间无任何活动"，
 *    导致主流程无限等待。监测到后自动中止（abort）该子会话并记录告警，task 工具
 *    随即向 PM 返回失败结果，PM 按调度规则重新派发同一任务（重启该 skill）。
 * 2. PM 主会话卡死 / 异常中止：主会话运行中长时间无活动（自身与全部子会话均无
 *    心跳），或回合以错误收场（session.error 后转 idle、assistant 消息携带
 *    error 字段）。监测确认后自动中止残留回合，并通过 client.session.chat 向
 *    主会话注入「当前版本号 + 继续执行」消息，重启此前的命令流程。
 *
 * 工作原理（事件钩子 + 定时扫描 + SQLite 直读 + OpenCode 客户端）：
 * 1. 活动信号：event 钩子监听 message.updated / message.part.updated /
 *    session.status(busy)，每次事件刷新对应会话的最近活动时间；
 * 2. 会话分类：直读 opencode SQLite 的 session 表获取 parent_id，有父会话的
 *    即为 subagent 子会话，否则为主会话；
 * 3. 卡死判定（子会话）：最近活动距今超过阈值（默认 10 分钟）即判定卡死，
 *    中止前再用 SQLite 中 message/part 的最新时间兜底复核一次防误判；
 * 4. 卡死判定（主会话）：自身静默超阈值且其全部子会话近期也无活动才判定卡死
 *    （PM 等待 task 返回属健康状态）；权限审批等待不做特殊区分（用户决策）；
 * 5. 异常中止判定（主会话）：收到 session.idle 时查最后一条 assistant 消息的
 *    error 字段——UnknownError/ProviderAuthError 等视为异常中止；MessageAbortedError
 *    为人为或插件主动中止，不算故障；
 * 6. 恢复动作：子会话卡死 → 仅 abort（由 PM 重派）；主会话卡死/异常中止 →
 *    abort + chat 注入续跑指令（带当前版本号），最多重试 IMMP_HEARTBEAT_MAX_NUDGES
 *    次（默认 2 次），超过后仅告警等待人工介入。全部处理记录追加到
 *    docs/prompts/heartbeat.md。
 *
 * 环境变量配置：
 * - IMPM_HEARTBEAT_DISABLED=1          关闭心跳检测（默认开启）
 * - IMPM_HEARTBEAT_TIMEOUT_MS          卡死判定阈值，默认 600000（10 分钟）
 * - IMPM_HEARTBEAT_INTERVAL_MS         扫描间隔，默认 60000（60 秒）
 * - IMPM_HEARTBEAT_MAIN_RECOVER=0      关闭主会话自动恢复（默认开启）
 * - IMPM_HEARTBEAT_MAX_NUDGES          主会话自动恢复次数上限，默认 2
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultDbPath, openDb } from "./prompt-recorder.js";
import { versionExecute } from "./version.js";

/** 同一子会话的最大中止尝试次数（首次 + 超时后重试一次），超过后放弃并仅告警 */
const MAX_ABORT_ATTEMPTS = 2;

/** 跟踪条目最长保留时间：超过后无论是否结束都清理（防内存泄漏） */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

/** parent_id 解析失败后的最小重试间隔（子会话行落库可能晚于首事件） */
const RESOLVE_RETRY_MS = 30 * 1000;

/** 异常中止的错误名（非 MessageAbortedError 即异常） */
const ABNORMAL_ERROR_NAMES = new Set([
    "UnknownError",
    "ProviderAuthError",
    "MessageOutputLengthError",
]);

/** 读取正数环境变量，非法或缺省时使用 fallback */
function envPositiveInt(name: string, fallback: number): number {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** 是否禁用心跳检测 */
function isDisabled(): boolean {
    return process.env.IMPM_HEARTBEAT_DISABLED === "1";
}

/** 毫秒 → 中文可读时长（如 25秒 / 3分05秒 / 1小时02分） */
function formatDuration(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) {
        return `${s}秒`;
    }
    const m = Math.floor(s / 60);
    if (m < 60) {
        return `${m}分${String(s % 60).padStart(2, "0")}秒`;
    }
    return `${Math.floor(m / 60)}小时${String(m % 60).padStart(2, "0")}分`;
}

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss（本地时区） */
function formatTime(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 从事件 properties 中多路径提取 sessionID：
 * 兼容 opencode 不同版本的事件负载形态
 * （message.updated: { info }、message.part.updated: { part }，部分版本带顶层字段）
 */
function extractSessionId(props: unknown): string | undefined {
    if (!props || typeof props !== "object") {
        return undefined;
    }
    const p = props as Record<string, unknown>;
    const info = p.info as Record<string, unknown> | undefined;
    const part = p.part as Record<string, unknown> | undefined;
    const message = p.message as Record<string, unknown> | undefined;
    const candidates = [
        p.sessionID,
        p.sessionId,
        info?.sessionID,
        info?.sessionId,
        part?.sessionID,
        part?.sessionId,
        message?.sessionID,
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c) {
            return c;
        }
    }
    return undefined;
}

/** 单个被跟踪会话的心跳状态 */
interface TrackEntry {
    sessionId: string;
    /** 父会话 ID：string=子会话；null=主会话；undefined=尚未解析成功（扫描时重试） */
    parentId: string | null | undefined;
    /** 会话归属目录（SQLite session.directory，用于只监控本项目会话） */
    directory: string | null;
    firstSeen: number;
    lastActivity: number;
    lastEvent: string;
    /** 已收到 session.idle / session.error，会话已结束 */
    finished: boolean;
    /** 已执行的中止尝试次数（子会话口径） */
    abortAttempts: number;
    /** 主会话自动恢复（注入续跑消息）已执行次数 */
    nudges: number;
    /** 上次判定卡死的时间（触发后重置宽限期，防止每轮扫描重复触发） */
    lastStallAt: number;
    /** 上次自动恢复的时间（冷却期控制） */
    lastRecoverAt: number;
    /** 上次尝试解析 parent_id 的时间（失败退避） */
    lastResolveAt: number;
    /** 正在解析 parent_id（防重复查询） */
    resolving: boolean;
}

/** parent_id 是否已解析确定（null 也算已确定 = 主会话） */
function parentResolved(e: TrackEntry): boolean {
    return e.parentId !== undefined;
}

/** 动作结果 */
interface OpResult {
    ok: boolean;
    detail: string;
}

/** OpenCode 客户端最小接口（仅用到 session.abort / session.chat，兼容新旧参数形态） */
interface OpencodeClientLike {
    session?: {
        abort?: (arg: unknown) => Promise<unknown>;
        chat?: (arg: unknown, body?: unknown) => Promise<unknown>;
    };
}

/**
 * 创建心跳检测功能（event 钩子 + 定时扫描 + impm_heartbeat 工具）
 * @param projectRoot 项目根目录（告警文件写入 docs/prompts/heartbeat.md）
 * @param client OpenCode 注入的 SDK 客户端（用于中止与唤醒会话；缺失时降级为仅告警）
 */
export async function createHeartbeatMonitor(
    projectRoot: string,
    client?: unknown,
) {
    const enabled = !isDisabled();
    const timeoutMs = envPositiveInt("IMPM_HEARTBEAT_TIMEOUT_MS", 10 * 60 * 1000);
    const intervalMs = envPositiveInt("IMPM_HEARTBEAT_INTERVAL_MS", 60 * 1000);
    const mainRecover = process.env.IMPM_HEARTBEAT_MAIN_RECOVER !== "0";
    const maxNudges = envPositiveInt("IMPM_HEARTBEAT_MAX_NUDGES", 2);

    /** 会话跟踪表：sessionId → 心跳状态 */
    const entries = new Map<string, TrackEntry>();
    let scanning = false; // 扫描互斥锁

    /** 告警文件路径（docs/prompts/heartbeat.md），并确保目录存在 */
    const alertFile = (): string => {
        const dir = join(projectRoot, "docs", "prompts");
        mkdirSync(dir, { recursive: true });
        return join(dir, "heartbeat.md");
    };

    /** 追加一条告警记录到 heartbeat.md（文件不存在时先写表头说明） */
    function appendAlert(row: string[]): void {
        try {
            const file = alertFile();
            if (!existsSync(file)) {
                const header = [
                    "# 心跳检测记录（impm-heartbeat 自动生成）",
                    "",
                    "> impm 插件对 PM 主会话与其派发的 subagent 子会话做心跳监测：",
                    "> - 子会话未结束且连续无活动超过阈值 → 判定卡死并自动中止（abort），",
                    ">   由 PM 收到 task 失败结果后用原提示词重新派发（重启该 skill）；",
                    "> - 主会话运行中静默超阈值（且全部子会话也无活动）或回合异常中止 →",
                    ">   自动中止残留回合并向主会话注入「当前版本号 + 继续执行」消息，",
                    ">   重启此前的命令流程（次数受 IMPM_HEARTBEAT_MAX_NUDGES 限制）。",
                    "",
                    "| 检测时间 | 会话 | 归属 | 触发原因 | 无活动时长 | 处理动作 |",
                    "| --- | --- | --- | --- | --- | --- |",
                    "",
                ].join("\n");
                appendFileSync(file, header, "utf8");
            }
            appendFileSync(file, `| ${row.join(" | ")} |\n`, "utf8");
        } catch (err) {
            console.error("[impm][heartbeat] 写入告警文件失败:", String(err));
        }
    }

    /**
     * SQLite 兜底复核：返回该会话在数据库中 message/part 的最新时间戳。
     * 用于中止前的最终确认——若数据库显示近期仍有写入，说明会话仍活跃，
     * 只是插件未识别出事件负载形态，应视为心跳正常而非卡死。查不到返回 null。
     */
    async function latestDbActivity(sessionId: string): Promise<number | null> {
        try {
            const opened = await openDb(defaultDbPath());
            try {
                const row = opened.db
                    .prepare(
                        "SELECT MAX(t) AS latest FROM (" +
                            "SELECT MAX(time_created) AS t FROM message WHERE session_id = ? " +
                            "UNION ALL SELECT MAX(time_updated) AS t FROM message WHERE session_id = ? " +
                            "UNION ALL SELECT MAX(time_created) AS t FROM part WHERE session_id = ? " +
                            "UNION ALL SELECT MAX(time_updated) AS t FROM part WHERE session_id = ?" +
                        ")",
                    )
                    .get(sessionId, sessionId, sessionId, sessionId) as
                        { latest: number | null } | undefined;
                return row?.latest ?? null;
            } finally {
                opened.close();
            }
        } catch {
            return null;
        }
    }

    /**
     * 主会话健康复核：其全部子会话（parent_id=主会话）在数据库中的最近活动时间。
     * PM 静默但子会话仍在干活属于健康等待，不应判定卡死。查不到返回 null。
     */
    async function latestChildActivity(mainId: string): Promise<number | null> {
        // 先看内存跟踪表（实时性最好）
        let best = 0;
        for (const e of entries.values()) {
            if (e.parentId === mainId && !e.finished) {
                best = Math.max(best, e.lastActivity);
            }
        }
        try {
            const opened = await openDb(defaultDbPath());
            try {
                const row = opened.db
                    .prepare(
                        "SELECT MAX(t) AS latest FROM (" +
                            "SELECT m.time_updated AS t FROM message m JOIN session c ON m.session_id = c.id WHERE c.parent_id = ? " +
                            "UNION ALL SELECT p.time_updated AS t FROM part p JOIN session c ON p.session_id = c.id WHERE c.parent_id = ?" +
                        ")",
                    )
                    .get(mainId, mainId) as { latest: number | null } | undefined;
                best = Math.max(best, row?.latest ?? 0);
            } finally {
                opened.close();
            }
        } catch {
            /* 数据库不可读时仅用内存信号 */
        }
        return best > 0 ? best : null;
    }

    /** 读取会话最后一次 assistant 消息携带的 error 名称（无错误返回 null） */
    async function lastAssistantError(sessionId: string): Promise<string | null> {
        try {
            const opened = await openDb(defaultDbPath());
            try {
                const row = opened.db
                    .prepare(
                        "SELECT json_extract(data,'$.error') AS err FROM message " +
                            "WHERE session_id = ? AND json_extract(data,'$.role') = 'assistant' " +
                            "ORDER BY time_created DESC LIMIT 1",
                    )
                    .get(sessionId) as { err: string | null } | undefined;
                if (!row?.err) {
                    return null;
                }
                try {
                    const parsed = JSON.parse(row.err) as { name?: string };
                    return parsed.name || row.err;
                } catch {
                    return row.err;
                }
            } finally {
                opened.close();
            }
        } catch {
            return null;
        }
    }

    /** 读取会话使用的模型信息（session.model 列 JSON 或最后一条 assistant 消息） */
    async function sessionModel(
        sessionId: string,
    ): Promise<{ providerID: string; modelID: string } | null> {
        try {
            const opened = await openDb(defaultDbPath());
            try {
                const row = opened.db
                    .prepare("SELECT model FROM session WHERE id = ?")
                    .get(sessionId) as { model: string | null } | undefined;
                if (row?.model) {
                    try {
                        const m = JSON.parse(row.model) as {
                            id?: string;
                            providerID?: string;
                        };
                        if (m.id && m.providerID) {
                            return { providerID: m.providerID, modelID: m.id };
                        }
                    } catch {
                        /* 落入下方兜底 */
                    }
                }
                const msg = opened.db
                    .prepare(
                        "SELECT json_extract(data,'$.providerID') AS p, json_extract(data,'$.modelID') AS m " +
                            "FROM message WHERE session_id = ? AND json_extract(data,'$.role')='assistant' " +
                            "ORDER BY time_created DESC LIMIT 1",
                    )
                    .get(sessionId) as { p: string | null; m: string | null } | undefined;
                if (msg?.p && msg?.m) {
                    return { providerID: msg.p, modelID: msg.m };
                }
            } finally {
                opened.close();
            }
        } catch {
            /* 忽略 */
        }
        return null;
    }

    /** 异步解析会话的 parent_id 与归属目录（SQLite 直读，失败保持未解析待重试） */
    async function resolveParent(sessionId: string): Promise<void> {
        const e = entries.get(sessionId);
        if (!e || e.resolving || parentResolved(e)) {
            return;
        }
        e.resolving = true;
        e.lastResolveAt = Date.now();
        try {
            const opened = await openDb(defaultDbPath());
            try {
                const row = opened.db
                    .prepare("SELECT parent_id, directory FROM session WHERE id = ?")
                    .get(sessionId) as
                        { parent_id: string | null; directory: string | null }
                        | undefined;
                const cur = entries.get(sessionId);
                if (cur && !parentResolved(cur) && row) {
                    cur.parentId = row.parent_id;
                    cur.directory = row.directory ?? null;
                    // 只监控本项目会话：目录已知且不匹配时丢弃（避免多项目同实例误伤）
                    if (!sameProject(row.directory)) {
                        entries.delete(sessionId);
                    }
                }
            } finally {
                opened.close();
            }
        } catch {
            /* 数据库暂不可读：保持未解析，下次扫描重试 */
        } finally {
            const cur = entries.get(sessionId);
            if (cur) {
                cur.resolving = false;
            }
        }
    }

    /** 目录归一化后比较是否同一项目（Windows 下忽略大小写与路径分隔符差异） */
    function sameProject(directory: string | null | undefined): boolean {
        if (directory === null || directory === undefined) {
            return true; // 未知目录不排除（老版本可能无该列）
        }
        const norm = (s: string): string => s.replace(/\\/g, "/").replace(/\/+$/, "");
        const a = norm(projectRoot);
        const b = norm(directory);
        return process.platform === "win32"
            ? a.toLowerCase() === b.toLowerCase()
            : a === b;
    }

    /** 刷新会话最近活动时间（不存在则新建跟踪条目并异步解析其父会话） */
    function touch(sessionId: string, eventName: string): void {
        const now = Date.now();
        let e = entries.get(sessionId);
        if (!e) {
            e = {
                sessionId,
                parentId: undefined,
                directory: null,
                firstSeen: now,
                lastActivity: now,
                lastEvent: eventName,
                finished: false,
                abortAttempts: 0,
                nudges: 0,
                lastStallAt: 0,
                lastRecoverAt: 0,
                lastResolveAt: 0,
                resolving: false,
            };
            entries.set(sessionId, e);
            void resolveParent(sessionId);
            return;
        }
        // 有活动即恢复心跳；曾判卡死但仍在跑（中止失败等场景）则顺延宽限期
        e.lastActivity = now;
        e.lastEvent = eventName;
        e.finished = false;
    }

    /** 标记会话结束（session.idle / session.error），随后由扫描清理 */
    function markFinished(sessionId: string, eventName: string): void {
        const e = entries.get(sessionId);
        if (!e) {
            return;
        }
        e.finished = true;
        e.lastEvent = eventName;
    }

    /** 中止指定会话：优先新版 SDK 形态 abort(id)，失败回退旧版 abort({ path }) */
    async function abortSession(sessionId: string): Promise<OpResult> {
        const c = (client || {}) as OpencodeClientLike;
        const fn = c.session?.abort;
        if (typeof fn !== "function") {
            return {
                ok: false,
                detail: "OpenCode 客户端不可用（缺少 session.abort）",
            };
        }
        try {
            await fn.call(c.session, sessionId);
            return { ok: true, detail: "abort(id)" };
        } catch (err1) {
            try {
                await fn.call(c.session, { path: { id: sessionId } });
                return { ok: true, detail: "abort({path})" };
            } catch (err2) {
                const msg =
                    (err2 as Error)?.message || String(err2) || String(err1) || "未知错误";
                return { ok: false, detail: `中止失败：${msg}` };
            }
        }
    }

    /** 向指定会话注入用户消息（唤醒）：优先 chat(id, body)，回退 chat({path,body}) */
    async function chatSession(
        sessionId: string,
        body: Record<string, unknown>,
    ): Promise<OpResult> {
        const c = (client || {}) as OpencodeClientLike;
        const fn = c.session?.chat;
        if (typeof fn !== "function") {
            return {
                ok: false,
                detail: "OpenCode 客户端不可用（缺少 session.chat）",
            };
        }
        try {
            await fn.call(c.session, sessionId, body);
            return { ok: true, detail: "chat(id,body)" };
        } catch (err1) {
            try {
                await fn.call(c.session, { path: { id: sessionId }, body });
                return { ok: true, detail: "chat({path},body)" };
            } catch (err2) {
                const msg =
                    (err2 as Error)?.message || String(err2) || String(err1) || "未知错误";
                return { ok: false, detail: `注入消息失败：${msg}` };
            }
        }
    }

    /**
     * 构建主会话续跑指令（注入的用户消息文本）。
     * 包含当前版本号（docs 下最新版本目录，可能为空），要求 PM 续接被中断的命令流程。
     */
    function buildNudgeText(reason: string): string {
        let versionInfo = "未找到版本目录（如流程需要版本号，请先通过 impm_version 推断）";
        try {
            const r = versionExecute({ projectRoot, action: "current" }) as {
                success?: boolean;
                version?: string | null;
            };
            if (r?.success && r.version) {
                versionInfo = r.version;
            }
        } catch {
            /* 保持默认文案 */
        }
        return [
            `【impm-heartbeat 自动恢复】你之前的回合因${reason}中断，系统已自动中止残留处理并要求你继续。`,
            `当前版本号：${versionInfo}。`,
            "请立即重启此前被中断的命令流程：先用 impm_version（action=current）核对版本号，再对照 version_progress.md 找到最后一个未完成的步骤，从该步骤继续调度执行（subagent 技能与任务派发照常进行）；已完成且产出完好的步骤不要重复执行。无需向用户再次确认，直接继续。",
        ].join("\n");
    }

    /**
     * 主会话自动恢复链：判定卡死/异常中止后 → abort 清场 → chat 注入续跑指令。
     * 受 IMPM_HEARTBEAT_MAX_NUDGES 次数限制，超过后仅告警等待人工介入。
     * @returns 处理描述（用于告警记录）
     */
    async function recoverMain(e: TrackEntry, reason: string): Promise<string> {
        if (e.nudges >= maxNudges) {
            e.lastStallAt = Date.now();
            return `已达自动恢复次数上限（${maxNudges}），请人工介入`;
        }
        e.nudges += 1;
        e.lastRecoverAt = Date.now();
        console.error(
            `[impm][heartbeat] 主会话 ${e.sessionId} ${reason}，执行自动恢复（第 ${e.nudges}/${maxNudges} 次）：中止残留回合并注入续跑指令`,
        );
        // 1. 清场：若仍有挂起回合则中止（已 idle 时 abort 幂等无害）
        const ab = await abortSession(e.sessionId);
        // 2. 组装续跑指令（带模型信息；缺模型信息时仍尝试无模型字段注入）
        const model = await sessionModel(e.sessionId);
        const text = buildNudgeText(reason);
        const body: Record<string, unknown> = { parts: [{ type: "text", text }] };
        if (model) {
            body.providerID = model.providerID;
            body.modelID = model.modelID;
        }
        // 3. 注入；紧随 abort 之后会话可能仍在收尾，短暂等待后重试一次
        let sent = await chatSession(e.sessionId, body);
        if (!sent.ok) {
            await new Promise((r) => setTimeout(r, 3000));
            sent = await chatSession(e.sessionId, body);
        }
        // 4. 记录
        const action = `abort(${ab.ok ? "成功" : ab.detail}) + 注入续跑指令(${sent.ok ? "成功" : sent.detail})，第 ${e.nudges}/${maxNudges} 次`;
        if (!sent.ok) {
            console.error(`[impm][heartbeat] 主会话 ${e.sessionId} 续跑指令注入失败：${sent.detail}，请人工介入`);
        }
        // 恢复后给一个完整阈值周期的观察窗口
        e.lastActivity = Math.max(e.lastActivity, Date.now());
        e.lastStallAt = Date.now();
        return action;
    }

    /** 处理一次子会话卡死：DB 兜底复核 → 告警 → 尝试中止 → 记录 → 重置宽限期 */
    async function handleChildStall(e: TrackEntry, idleMs: number): Promise<void> {
        e.lastStallAt = Date.now();

        // 中止前用数据库最新消息/部件时间做最终复核，防止事件形态变化造成误判
        const dbLatest = await latestDbActivity(e.sessionId);
        if (dbLatest !== null && Date.now() - dbLatest < timeoutMs * 0.8) {
            e.lastActivity = Math.max(e.lastActivity, dbLatest);
            console.warn(
                `[impm][heartbeat] 子会话 ${e.sessionId} 数据库显示近期仍有写入（${formatDuration(Date.now() - dbLatest)} 前），视为活跃，跳过本次卡死判定`,
            );
            return;
        }

        console.error(
            `[impm][heartbeat] 检测到 subagent 子会话 ${e.sessionId} 卡死：未结束且无活动已达 ${formatDuration(idleMs)}（最近事件: ${e.lastEvent}）`,
        );
        let action = "仅告警（客户端不可用）";
        if (e.abortAttempts < MAX_ABORT_ATTEMPTS) {
            e.abortAttempts += 1;
            const r = await abortSession(e.sessionId);
            action = r.ok
                ? `已自动中止（第 ${e.abortAttempts} 次），等待 PM 重新派发`
                : r.detail;
        } else {
            action = `已达最大中止尝试次数（${MAX_ABORT_ATTEMPTS}），请人工介入`;
        }
        appendAlert([
            formatTime(Date.now()),
            `\`${e.sessionId}\``,
            "subagent 子会话",
            "卡死（未结束且超时无活动）",
            formatDuration(idleMs),
            action,
        ]);
        // 触发后重置宽限期：下一轮扫描不会立即重复判定
        e.lastActivity = Math.max(e.lastActivity, Date.now());
    }

    /** 扫描全部跟踪条目：两轮处理——先清卡死的子会话，再复核主会话（避免误判健康等待） */
    async function scan(): Promise<string[]> {
        if (scanning || !enabled) {
            return [];
        }
        scanning = true;
        const reports: string[] = [];
        try {
            const now = Date.now();
            // 第一轮：归属解析、过期清理、子会话卡死处理
            for (const [sid, e] of Array.from(entries.entries())) {
                if (e.finished || now - e.firstSeen > ENTRY_TTL_MS) {
                    entries.delete(sid);
                    continue;
                }
                if (!parentResolved(e)) {
                    // 子会话行可能晚于首事件落库：按退避间隔持续补解析
                    if (!e.resolving && now - e.lastResolveAt >= RESOLVE_RETRY_MS) {
                        void resolveParent(sid);
                    }
                    continue;
                }
                if (e.parentId === null) {
                    continue; // 主会话留到第二轮
                }
                const idleMs = now - e.lastActivity;
                if (
                    idleMs >= timeoutMs &&
                    now - e.lastStallAt >= timeoutMs &&
                    e.abortAttempts <= MAX_ABORT_ATTEMPTS
                ) {
                    await handleChildStall(e, idleMs);
                    reports.push(`子会话(subagent) \`${sid}\` 无活动 ${formatDuration(idleMs)}`);
                }
            }
            // 第二轮：主会话卡死 / 异常中止处理
            for (const [, e] of Array.from(entries.entries())) {
                if (e.finished || !parentResolved(e) || e.parentId !== null) {
                    continue;
                }
                const now2 = Date.now();
                // 健康复核：任一子会话近期有活动 → PM 在等 task 返回，刷新主会话心跳
                const childLatest = await latestChildActivity(e.sessionId);
                if (childLatest !== null && childLatest > now2 - timeoutMs) {
                    e.lastActivity = Math.max(e.lastActivity, childLatest);
                    continue;
                }
                const idleMs = now2 - e.lastActivity;
                if (idleMs < timeoutMs || now2 - e.lastStallAt < timeoutMs) {
                    continue;
                }
                if (!mainRecover) {
                    console.error(
                        `[impm][heartbeat] 主会话 ${e.sessionId} 疑似卡死（无活动 ${formatDuration(idleMs)}），自动恢复已关闭，请人工检查`,
                    );
                    e.lastStallAt = now2;
                    appendAlert([
                        formatTime(now2),
                        `\`${e.sessionId}\``,
                        "PM 主会话",
                        "疑似卡死（自动恢复已关闭）",
                        formatDuration(idleMs),
                        "仅告警",
                    ]);
                    reports.push(`主会话 \`${e.sessionId}\` 无活动 ${formatDuration(idleMs)}（仅告警）`);
                    continue;
                }
                const reason = "运行中长时间无活动（疑似卡死）";
                const action = await recoverMain(e, reason);
                appendAlert([
                    formatTime(Date.now()),
                    `\`${e.sessionId}\``,
                    "PM 主会话",
                    reason,
                    formatDuration(idleMs),
                    action,
                ]);
                reports.push(`主会话 \`${e.sessionId}\` 无活动 ${formatDuration(idleMs)} → 已尝试自动恢复`);
            }
        } finally {
            scanning = false;
        }
        return reports;
    }

    /**
     * 主会话异常中止处理：idle 时检查最后一条 assistant 消息的 error 字段，
     * 非 MessageAbortedError 的错误（认证失败、未知错误、输出超限等）触发自动恢复。
     * 注意：必须在 markFinished 之前调用（依赖条目尚未被标记结束）；
     * 仅对已确认归属本项目的主会话生效，异步执行不阻塞事件总线。
     */
    function handleIdleMaybeAbnormal(sessionId: string): void {
        const e = entries.get(sessionId);
        if (!e || !parentResolved(e) || e.parentId !== null) {
            return; // 未跟踪 / 归属未解析 / 子会话：跳过
        }
        void (async () => {
            try {
                const errName = await lastAssistantError(sessionId);
                if (!errName || !ABNORMAL_ERROR_NAMES.has(errName)) {
                    return; // 正常结束或人为中止
                }
                const reason = `异常中止（${errName}）`;
                if (!mainRecover) {
                    console.error(`[impm][heartbeat] 主会话 ${sessionId} ${reason}，自动恢复已关闭，请人工检查`);
                    appendAlert([
                        formatTime(Date.now()),
                        `\`${sessionId}\``,
                        "PM 主会话",
                        reason,
                        "-",
                        "仅告警（自动恢复已关闭）",
                    ]);
                    return;
                }
                const action = await recoverMain(e, reason);
                console.error(`[impm][heartbeat] 主会话 ${sessionId} ${reason} → ${action}`);
                appendAlert([
                    formatTime(Date.now()),
                    `\`${sessionId}\``,
                    "PM 主会话",
                    reason,
                    "-",
                    action,
                ]);
            } catch (err) {
                console.error("[impm][heartbeat] 异常中止处理失败:", String(err));
            }
        })();
    }

    /**
     * event 钩子：跟踪会话活动与结束信号
     * 关心事件：message.updated / message.part.updated / session.status(busy)（活动）、
     * session.idle / session.error（结束与异常）
     */
    const event = async (input: { event?: unknown }): Promise<void> => {
        if (!enabled) {
            return;
        }
        try {
            const ev = input?.event as
                | { type?: string; properties?: unknown }
                | undefined;
            const type = ev?.type || "";
            const props = ev?.properties;
            switch (type) {
                case "message.updated":
                case "message.part.updated": {
                    const sid = extractSessionId(props);
                    if (sid) {
                        touch(sid, type);
                    }
                    break;
                }
                case "session.status": {
                    // v1.18+：{ sessionID, status: { type: "busy" | "idle", ... } }
                    const p = props as Record<string, unknown> | undefined;
                    const sid = extractSessionId(p);
                    const statusType = (p?.status as Record<string, unknown> | undefined)?.type;
                    if (sid && statusType === "busy") {
                        touch(sid, type);
                    } else if (sid && statusType === "idle") {
                        markFinished(sid, type);
                    }
                    break;
                }
                case "session.idle":
                case "session.error": {
                    const sid =
                        extractSessionId(props) ||
                        ((props as Record<string, unknown> | undefined)?.info as
                            | Record<string, unknown>
                            | undefined)?.id;
                    if (typeof sid === "string" && sid) {
                        // idle 需先做异常中止复核（依赖条目未标记结束），再标记结束
                        if (type === "session.idle") {
                            handleIdleMaybeAbnormal(sid);
                        }
                        markFinished(sid, type);
                    }
                    break;
                }
                default:
                    break;
            }
        } catch (err) {
            console.error("[impm][heartbeat] event 处理失败:", String(err));
        }
    };

    // 定时扫描；unref 保证不阻塞进程退出
    if (enabled) {
        const timer = setInterval(() => {
            void scan().catch((err) =>
                console.error("[impm][heartbeat] 扫描异常:", String(err)),
            );
        }, intervalMs);
        if (typeof timer.unref === "function") {
            timer.unref();
        }
    }

    /** 渲染当前跟踪状态（status 动作输出） */
    function renderStatus(): string {
        const rows: string[] = [];
        for (const e of entries.values()) {
            const kind = e.parentId
                ? "子会话(subagent)"
                : e.parentId === null
                  ? "主会话"
                  : "归属未知";
            rows.push(
                `- ${kind} \`${e.sessionId}\`：${e.finished ? "已结束" : "运行中"}，无活动 ${formatDuration(Date.now() - e.lastActivity)}，最近事件 ${e.lastEvent}${e.abortAttempts ? `，已中止尝试 ${e.abortAttempts} 次` : ""}${e.nudges ? `，已自动恢复 ${e.nudges} 次` : ""}`,
            );
        }
        return [
            `心跳检测：${enabled ? "已启用" : "已禁用"}；卡死阈值 ${formatDuration(timeoutMs)}；扫描间隔 ${formatDuration(intervalMs)}；主会话自动恢复：${mainRecover ? `启用（上限 ${maxNudges} 次）` : "关闭"}`,
            `当前跟踪会话数：${entries.size}`,
            ...rows,
        ].join("\n");
    }

    return {
        event,

        /** 手动工具：status=查看跟踪状态，check=立即执行一次扫描，alerts=查看最近告警 */
        tool: {
            impm_heartbeat: {
                description:
                    "subagent/PM 心跳检测工具：status=查看当前跟踪的会话心跳状态与配置；check=立即执行一次卡死扫描并返回报告；alerts=读取 docs/prompts/heartbeat.md 最近告警记录",
                args: {
                    projectRoot: {
                        type: "string",
                        description: "项目根目录的绝对路径",
                    },
                    action: {
                        type: "string",
                        description: "操作类型：status | check | alerts",
                    },
                    limit: {
                        type: "number",
                        description: "alerts 时返回的最近记录条数（默认 20）",
                    },
                },
                async execute(args: Record<string, unknown>): Promise<string> {
                    const action = String(args.action || "status").toLowerCase();
                    if (action === "alerts") {
                        const file = alertFile();
                        if (!existsSync(file)) {
                            return "尚无心跳告警记录（docs/prompts/heartbeat.md 不存在）。";
                        }
                        const lines = readFileSync(file, "utf8")
                            .split(/\r?\n/)
                            .filter(Boolean);
                        const limit = Number(args.limit) > 0 ? Number(args.limit) : 20;
                        return lines.slice(-limit).join("\n");
                    }
                    if (action === "check") {
                        const reports = await scan();
                        return reports.length
                            ? `本次扫描发现并处理 ${reports.length} 项：\n- ${reports.join("\n- ")}`
                            : "本次扫描未发现卡死会话。";
                    }
                    return renderStatus();
                },
            },
        },
    };
}
