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
 * impm 插件内置功能：impm-heartbeat（subagent 心跳检测与自动重启）
 *
 * 解决的问题：PM 通过 task 工具并发派发 subagent 执行技能时，个别子会话可能因
 * LLM 服务无响应、网络中断、权限等待被忽略等原因"卡死"——会话未结束但长时间
 * 无任何活动，导致主流程无限等待。本功能对每个运行中的 subagent 子会话做心跳
 * 监测，超时判定卡死后自动中止（abort）该子会话并记录告警，task 工具随即向
 * PM 返回失败结果，PM 按调度规则用原提示词重新派发同一任务，即实现"重启该
 * skill 与 subagent"。
 *
 * 工作原理（事件钩子 + 定时扫描 + SQLite 直读 + OpenCode 客户端）：
 * 1. 活动信号：event 钩子监听 message.updated / message.part.updated，
 *    每次事件刷新对应会话的最近活动时间（流式输出、工具调用均算活动）；
 * 2. 会话分类：直读 opencode SQLite 的 session 表获取 parent_id，有父会话的
 *    即为 subagent 子会话；查不到时按未解析处理并在扫描时持续重试；
 * 3. 卡死判定：定时扫描全部未结束的已跟踪子会话，「最近活动距今」超过阈值
 *    （默认 10 分钟）即判定卡死；中止前再用 SQLite 中 message/part 的最新
 *    时间兜底复核一次，避免事件负载形态变化导致的误判；
 * 4. 自动重启：调用 OpenCode 客户端 client.session.abort 中止卡死子会话
 *    （兼容新旧两种 SDK 参数形态），并把告警记录追加到 docs/prompts/heartbeat.md；
 * 5. 主会话保护：PM 主会话长时间无活动只告警不自动中止（避免破坏交互式回合），
 *    可用 IMPM_HEARTBEAT_ABORT_MAIN=1 开启自动中止。
 *
 * 环境变量配置：
 * - IMPM_HEARTBEAT_DISABLED=1        关闭心跳检测（默认开启）
 * - IMPM_HEARTBEAT_TIMEOUT_MS        卡死判定阈值，默认 600000（10 分钟）
 * - IMPM_HEARTBEAT_INTERVAL_MS       扫描间隔，默认 60000（60 秒）
 * - IMPM_HEARTBEAT_ABORT_MAIN=1      允许自动中止卡死的 PM 主会话（默认否）
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultDbPath, openDb } from "./prompt-recorder.js";

/** 同一子会话的最大中止尝试次数（首次 + 超时后重试一次），超过后放弃并仅告警 */
const MAX_ABORT_ATTEMPTS = 2;

/** 跟踪条目最长保留时间：超过后无论是否结束都清理（防内存泄漏） */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

/** parent_id 解析失败后的最小重试间隔（子会话行落库可能晚于首事件） */
const RESOLVE_RETRY_MS = 30 * 1000;

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
    firstSeen: number;
    lastActivity: number;
    lastEvent: string;
    /** 已收到 session.idle / session.error，会话已结束 */
    finished: boolean;
    /** 已执行的中止尝试次数 */
    abortAttempts: number;
    /** 上次判定卡死的时间（触发后重置宽限期，防止每轮扫描重复触发） */
    lastStallAt: number;
    /** 上次尝试解析 parent_id 的时间（失败退避） */
    lastResolveAt: number;
    /** 正在解析 parent_id（防重复查询） */
    resolving: boolean;
}

/** parent_id 是否已解析确定（null 也算已确定 = 主会话） */
function parentResolved(e: TrackEntry): boolean {
    return e.parentId !== undefined;
}

/** 中止结果 */
interface AbortResult {
    ok: boolean;
    detail: string;
}

/** OpenCode 客户端最小接口（仅用到 session.abort，兼容新旧参数形态） */
interface OpencodeClientLike {
    session?: {
        abort?: (arg: unknown) => Promise<unknown>;
    };
}

/**
 * 创建 subagent 心跳检测功能（event 钩子 + 定时扫描 + impm_heartbeat 工具）
 * @param projectRoot 项目根目录（告警文件写入 docs/prompts/heartbeat.md）
 * @param client OpenCode 注入的 SDK 客户端（用于中止卡死子会话；缺失时降级为仅告警）
 */
export async function createHeartbeatMonitor(
    projectRoot: string,
    client?: unknown,
) {
    const enabled = !isDisabled();
    const timeoutMs = envPositiveInt("IMPM_HEARTBEAT_TIMEOUT_MS", 10 * 60 * 1000);
    const intervalMs = envPositiveInt("IMPM_HEARTBEAT_INTERVAL_MS", 60 * 1000);
    const abortMain = process.env.IMPM_HEARTBEAT_ABORT_MAIN === "1";

    /** 会话跟踪表：sessionId → 心跳状态 */
    const entries = new Map<string, TrackEntry>();
    let scanning = false; // 扫描互斥锁

    /** 告警文件路径（docs/prompts/heartbeat.md），并确保目录存在 */
    const alertFile = (): string => {
        const dir = join(projectRoot, "docs", "prompts");
        mkdirSync(dir, { recursive: true });
        return join(dir, "heartbeat.md");
    };

    /** 追加一条卡死告警记录到 heartbeat.md（文件不存在时先写表头说明） */
    function appendAlert(row: string[]): void {
        try {
            const file = alertFile();
            if (!existsSync(file)) {
                const header = [
                    "# Subagent 心跳检测记录（impm-heartbeat 自动生成）",
                    "",
                    "> 当 PM 派发的 subagent 子会话未结束且连续无活动超过阈值时，",
                    "> 判定卡死并由插件自动中止（abort）。PM 收到对应 task 失败结果后，",
                    "> 应立即用原提示词重新派发该 subagent 任务（重启该 skill），",
                    "> 重派次数计入该任务的重试上限。",
                    "",
                    "| 检测时间 | 卡死子会话 | 父会话 | 无活动时长 | 最近事件 | 处理动作 |",
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
                            "UNION ALL SELECT MAX(time_created) AS t FROM part WHERE session_id = ?" +
                        ")",
                    )
                    .get(sessionId, sessionId) as { latest: number | null } | undefined;
                return row?.latest ?? null;
            } finally {
                opened.close();
            }
        } catch {
            return null;
        }
    }

    /** 异步解析会话的 parent_id（SQLite 直读，失败保持未解析状态待下次重试） */
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
                    .prepare("SELECT parent_id FROM session WHERE id = ?")
                    .get(sessionId) as { parent_id: string | null } | undefined;
                const cur = entries.get(sessionId);
                // 行存在才更新归属；行尚未落库则保持未解析，由扫描按退避间隔重试
                if (cur && !parentResolved(cur) && row) {
                    cur.parentId = row.parent_id;
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

    /** 刷新会话最近活动时间（不存在则新建跟踪条目并异步解析其父会话） */
    function touch(sessionId: string, eventName: string): void {
        const now = Date.now();
        let e = entries.get(sessionId);
        if (!e) {
            e = {
                sessionId,
                parentId: undefined,
                firstSeen: now,
                lastActivity: now,
                lastEvent: eventName,
                finished: false,
                abortAttempts: 0,
                lastStallAt: 0,
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
    async function abortSession(sessionId: string): Promise<AbortResult> {
        const c = (client || {}) as OpencodeClientLike;
        const fn = c.session?.abort;
        if (typeof fn !== "function") {
            return {
                ok: false,
                detail: "OpenCode 客户端不可用（缺少 session.abort），无法自动中止，请人工处理",
            };
        }
        try {
            await fn.call(c.session, sessionId);
            return { ok: true, detail: "client.session.abort(id) 成功" };
        } catch (err1) {
            try {
                await fn.call(c.session, { path: { id: sessionId } });
                return { ok: true, detail: "client.session.abort({ path }) 成功" };
            } catch (err2) {
                const msg =
                    (err2 as Error)?.message || String(err2) || String(err1) || "未知错误";
                return { ok: false, detail: `中止失败：${msg}` };
            }
        }
    }

    /** 处理一次卡死判定：DB 兜底复核 → 告警 → 尝试中止 → 记录 → 重置宽限期 */
    async function handleStall(e: TrackEntry, idleMs: number): Promise<void> {
        e.lastStallAt = Date.now();
        const isChild = !!e.parentId;

        // 中止前用数据库最新消息/部件时间做最终复核，防止事件形态变化造成误判
        const dbLatest = await latestDbActivity(e.sessionId);
        if (dbLatest !== null && Date.now() - dbLatest < timeoutMs * 0.8) {
            e.lastActivity = Math.max(e.lastActivity, dbLatest);
            console.warn(
                `[impm][heartbeat] ${isChild ? "子会话" : "主会话"} ${e.sessionId} 数据库显示近期仍有写入（${formatDuration(Date.now() - dbLatest)} 前），视为活跃，跳过本次卡死判定`,
            );
            return;
        }

        const label = isChild ? "subagent 子会话" : "主会话";
        console.error(
            `[impm][heartbeat] 检测到${label} ${e.sessionId} 卡死：未结束且无活动已达 ${formatDuration(idleMs)}（最近事件: ${e.lastEvent}）`,
        );
        let action = "仅告警（未启用自动中止）";
        if (isChild || abortMain) {
            if (e.abortAttempts < MAX_ABORT_ATTEMPTS) {
                e.abortAttempts += 1;
                const r = await abortSession(e.sessionId);
                action = r.ok
                    ? `已自动中止（第 ${e.abortAttempts} 次），等待 PM 重新派发`
                    : r.detail;
            } else {
                action = `已达最大中止尝试次数（${MAX_ABORT_ATTEMPTS}），请人工介入`;
            }
        }
        appendAlert([
            formatTime(Date.now()),
            `\`${e.sessionId}\``,
            e.parentId ? `\`${e.parentId}\`` : "（主会话）",
            formatDuration(idleMs),
            e.lastEvent,
            action,
        ]);
        // 触发后重置宽限期：下一轮扫描不会立即重复判定
        e.lastActivity = Math.max(e.lastActivity, Date.now());
    }

    /** 扫描全部跟踪条目：解析归属、判定卡死、清理过期与已结束条目 */
    async function scan(): Promise<string[]> {
        if (scanning || !enabled) {
            return [];
        }
        scanning = true;
        const reports: string[] = [];
        try {
            const now = Date.now();
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
                const idleMs = now - e.lastActivity;
                if (
                    idleMs >= timeoutMs &&
                    now - e.lastStallAt >= timeoutMs &&
                    e.abortAttempts <= MAX_ABORT_ATTEMPTS
                ) {
                    await handleStall(e, idleMs);
                    reports.push(
                        `${e.parentId ? "子会话(subagent)" : "主会话"} \`${sid}\` 无活动 ${formatDuration(idleMs)}`,
                    );
                }
            }
        } finally {
            scanning = false;
        }
        return reports;
    }

    /**
     * event 钩子：跟踪会话活动与结束信号
     * 关心事件：message.updated / message.part.updated（活动）、
     * session.idle / session.error（结束）
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
                case "session.idle":
                case "session.error": {
                    const sid =
                        extractSessionId(props) ||
                        ((props as Record<string, unknown> | undefined)?.info as
                            | Record<string, unknown>
                            | undefined)?.id;
                    if (typeof sid === "string" && sid) {
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
                `- ${kind} \`${e.sessionId}\`：${e.finished ? "已结束" : "运行中"}，无活动 ${formatDuration(Date.now() - e.lastActivity)}，最近事件 ${e.lastEvent}${e.abortAttempts ? `，已中止尝试 ${e.abortAttempts} 次` : ""}`,
            );
        }
        return [
            `心跳检测：${enabled ? "已启用" : "已禁用"}；卡死阈值 ${formatDuration(timeoutMs)}；扫描间隔 ${formatDuration(intervalMs)}；自动中止主会话：${abortMain ? "是" : "否"}`,
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
                    "subagent 心跳检测工具：status=查看当前跟踪的会话心跳状态与配置；check=立即执行一次卡死扫描并返回报告；alerts=读取 docs/prompts/heartbeat.md 最近告警记录",
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
