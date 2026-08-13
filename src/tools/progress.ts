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
 * impm_progress 工具
 * 版本进度表 version_progress.md 管理：
 *   - init：创建进度表（表头：步骤序号 | 步骤名称 | 步骤状态 | 启动时间 |
 *     总耗时(秒) | 输入token | 输出token | 命中缓存 | 存入缓存 | 总token），
 *     可选写入首行（首行同时记录启动时间）
 *   - add：在表格第一行位置插入新行（序号为当前最大序号 +1，启动时间=当前时间）；
 *     若存在上一行且尚未结算，则以当前时间为上一行结束时间计算总耗时（秒），
 *     并从 opencode 数据库按时间窗口（上一行启动时间 ~ 当前时间）查询
 *     该步骤主会话与全部子会话（subagent）消耗的 token，回填 token 五列
 *   - check：查询某步骤的最新状态与整体进度
 *   - list：列出全部进度记录
 *
 * 文件位置：docs/{缩写}-v{版本号}/version_progress.md
 * token 数据源：opencode SQLite 数据库（message 表 assistant 消息
 * data.tokens，含缓存命中 cache.read / 缓存写入 cache.write，
 * 思考 token 并入输出列）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { progressFilePath, normalizeVersion } from "../utils/paths.js";
import { latestVersion, resolveAbbrev } from "../utils/project.js";
import { defaultDbPath, openDb } from "./prompt-recorder.js";
import { withFileLock } from "../utils/file-lock.js";

/** 流程中全部已知步骤名（技能名），用于校验 add/check 的 stepName */
export const KNOWN_STEP_NAMES: string[] = [
    "impm",
    "impm-init",
    "impm-init-isinit",
    "impm-init-git",
    "impm-init-project",
    "impm-init-version",
    "impm-init-urs",
    "impm-init-prd",
    "impm-init-sad",
    "impm-init-dbd",
    "impm-init-api",
    "impm-init-lld",
    "impm-init-task",
    "impm-init-testcase",
    "impm-init-commit",
    "impm-docs",
    "impm-version-create",
    "impm-urs-create",
    "impm-prd-create",
    "impm-sad-update",
    "impm-dbd-create",
    "impm-api-create",
    "impm-lld-create",
    "impm-task-create",
    "impm-analysis-commit",
    "impm-coding",
    "impm-task-coding",
    "impm-task-coding-context",
    "impm-task-coding-cs",
    "impm-task-coding-ws",
    "impm-task-coding-dbd",
    "impm-task-coding-api",
    "impm-task-coding-testcase",
    "impm-task-coding-code",
    "impm-task-coding-writetest",
    "impm-task-coding-runtest",
    "impm-task-coding-gitcommit",
    "impm-finish",
    "impm-regression-test",
    "impm-coding-comment",
    "impm-coding-review",
    "impm-apifox",
    "impm-project-update",
    "impm-doc-merge",
    "impm-doc-update",
    "impm-deploy-update",
    "impm-git-merge",
    "impm-sprint",
    "impm-sprint-requirement",
    "impm-sprint-version-task",
    "impm-sprint-code",
    "impm-sprint-test",
    "impm-sprint-summary",
];

/** 历史/别名步骤名 → 规范步骤名 */
const STEP_ALIASES: Record<string, string> = {
    "impm-sad-create": "impm-sad-update",
};

/** 步骤名规范化：历史别名映射到规范步骤名 */
function normalizeStepName(stepName: string): string {
    const key = stepName.trim();
    const aliased = STEP_ALIASES[key];
    return aliased ?? key;
}

/** 是否为流程已知步骤名 */
function isKnownStep(stepName: string): boolean {
    return KNOWN_STEP_NAMES.includes(stepName);
}

export interface ProgressRow {
    seq: number;
    stepName: string;
    status: string;
    /** 启动时间 yyyy-MM-dd HH:mm:ss（本地时区） */
    startTime?: string;
    /** 总耗时（秒，整数；下一行插入时结算） */
    duration?: string;
    /** 输入 token */
    input?: number;
    /** 输出 token（含思考 token） */
    output?: number;
    /** 缓存命中（cache read） */
    cacheRead?: number;
    /** 缓存写入（cache write） */
    cacheWrite?: number;
    /** 总 token（输入+输出+思考+缓存命中+缓存写入） */
    total?: number;
}

/** token 窗口统计（输出列合并思考 token） */
interface TokenStats {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
}

/** 毫秒时间戳 → yyyy-MM-dd HH:mm:ss（本地时区） */
function formatTime(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 数字单元格：空串/缺省 → undefined */
function toNum(v: string | undefined): number | undefined {
    if (v === undefined || v.trim() === "") {
        return undefined;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

/** 解析单行数据行（兼容旧 3 列与新版 10 列格式） */
function parseRow(cells: string[]): ProgressRow | null {
    if (cells.length < 3) {
        return null;
    }
    const seq = Number(cells[0]);
    if (!Number.isInteger(seq) || seq <= 0) {
        return null;
    }
    const row: ProgressRow = {
        seq,
        stepName: cells[1],
        status: cells[2],
    };
    if (cells.length >= 4) {
        row.startTime = cells[3] || undefined;
    }
    if (cells.length >= 5) {
        row.duration = cells[4] || undefined;
    }
    if (cells.length >= 6) {
        row.input = toNum(cells[5]);
    }
    if (cells.length >= 7) {
        row.output = toNum(cells[6]);
    }
    if (cells.length >= 8) {
        row.cacheRead = toNum(cells[7]);
    }
    if (cells.length >= 9) {
        row.cacheWrite = toNum(cells[8]);
    }
    if (cells.length >= 10) {
        row.total = toNum(cells[9]);
    }
    return row;
}

/** 解析进度表文本为数据行数组（跳过表头与分隔行） */
function parseRows(content: string): ProgressRow[] {
    const rows: ProgressRow[] = [];
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
            continue;
        }
        if (/^\|\s*步骤序号/.test(trimmed)) {
            continue;
        }
        const cells = trimmed
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
        const row = parseRow(cells);
        if (row) {
            rows.push(row);
        }
    }
    return rows;
}

/** 渲染进度表 Markdown 文本（标题 + 表头 + 数据行） */
function buildFile(abbrev: string, version: string, rows: ProgressRow[]): string {
    const lines = [
        `# 版本进度 - ${abbrev}-v${normalizeVersion(version)}`,
        "",
        "| 步骤序号 | 步骤名称 | 步骤状态 | 启动时间 | 总耗时(秒) | 输入token | 输出token | 命中缓存 | 存入缓存 | 总token |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ];
    for (const row of rows) {
        lines.push(
            `| ${row.seq} | ${row.stepName} | ${row.status} | ${row.startTime ?? ""} | ${row.duration ?? ""} | ${row.input ?? ""} | ${row.output ?? ""} | ${row.cacheRead ?? ""} | ${row.cacheWrite ?? ""} | ${row.total ?? ""} |`,
        );
    }
    return lines.join("\n") + "\n";
}

/**
 * 按时间窗口查询该项目消耗的 token：
 * 汇总 [startMs, endMs) 内属于该项目（session.directory 匹配项目根目录）的
 * 全部 assistant 消息 token（主会话 + 全部子会话/subagent），
 * 查询失败（数据库不可读等）时返回 null。
 */
async function queryWindowTokens(
    dbPath: string,
    projectRoot: string,
    startMs: number,
    endMs: number,
): Promise<TokenStats | null> {
    try {
        const opened = await openDb(dbPath);
        try {
            // Windows 下 projectRoot 为反斜杠，数据库内为正斜杠，统一后小写比较
            const dir = projectRoot
                .replace(/\\/g, "/")
                .replace(/\/+$/, "")
                .toLowerCase();
            const rows = opened.db
                .prepare(
                    `SELECT m.data FROM message m
                     JOIN session s ON s.id = m.session_id
                     WHERE LOWER(s.directory) = ? AND m.time_created >= ? AND m.time_created < ?`,
                )
                .all(dir, startMs, endMs) as Array<{ data: string }>;
            let input = 0;
            let output = 0;
            let reasoning = 0;
            let cacheRead = 0;
            let cacheWrite = 0;
            for (const r of rows) {
                let info: Record<string, unknown> = {};
                try {
                    info = JSON.parse(r.data);
                } catch {
                    continue;
                }
                if (info.role !== "assistant") {
                    continue;
                }
                const t = (info.tokens || {}) as {
                    input?: number;
                    output?: number;
                    reasoning?: number;
                    cache?: { read?: number; write?: number };
                };
                input += Number(t.input) || 0;
                output += Number(t.output) || 0;
                reasoning += Number(t.reasoning) || 0;
                cacheRead += Number(t.cache?.read) || 0;
                cacheWrite += Number(t.cache?.write) || 0;
            }
            return {
                input,
                output: output + reasoning,
                cacheRead,
                cacheWrite,
                total: input + output + reasoning + cacheRead + cacheWrite,
            };
        } finally {
            opened.close();
        }
    } catch {
        return null;
    }
}

/**
 * 结算一行：以 endMs 为结束时间计算总耗时（秒），并查询该时间窗口的 token
 * 回填 5 个 token 列。仅当该行已有启动时间且尚未结算（总耗时空缺）时执行。
 */
async function finalizeRow(
    row: ProgressRow,
    dbPath: string,
    projectRoot: string,
    endMs: number,
): Promise<{ duration: number; tokens: TokenStats | null } | null> {
    if (!row.startTime || row.duration !== undefined) {
        return null;
    }
    const startMs = Date.parse(row.startTime);
    if (Number.isNaN(startMs)) {
        return null;
    }
    const duration = Math.max(0, Math.round((endMs - startMs) / 1000));
    const tokens = await queryWindowTokens(dbPath, projectRoot, startMs, endMs);
    row.duration = String(duration);
    if (tokens) {
        row.input = tokens.input;
        row.output = tokens.output;
        row.cacheRead = tokens.cacheRead;
        row.cacheWrite = tokens.cacheWrite;
        row.total = tokens.total;
    }
    return { duration, tokens };
}

export const progressDefinition = {
    description:
        "版本进度管理：action=init 创建版本进度文件 version_progress.md（10 列表格：步骤序号、步骤名称、步骤状态、启动时间、总耗时(秒)、输入token、输出token、命中缓存、存入缓存、总token）；action=add 在表格第一行插入新行（序号自动为当前最大序号+1，启动时间=当前时间），若存在上一行且尚未结算，则以当前时间为上一行结束时间计算总耗时，并从 opencode 数据库查询该步骤及 subagent 子会话消耗的 token 回填其 token 五列；action=finalize 在流程退出前结算当前最后一行（最近一个步骤）的总耗时与 token（无进度表时静默跳过，幂等）；action=check 查询某步骤的最新状态与整体进度；action=list 列出全部进度记录。记录与核对流程步骤状态时使用。",
};

export async function progressExecute(args: {
    projectRoot: string;
    action: "init" | "add" | "finalize" | "check" | "list";
    stepName?: string;
    status?: string;
    version?: string;
    projectName?: string;
    dbPath?: string;
}): Promise<Record<string, unknown>> {
    try {
        const abbrev = resolveAbbrev(args.projectRoot, args.projectName);
        // 未显式传 version 时自动使用 docs 下最新版本目录（与 impm_doc_writer 行为一致）
        let version = args.version?.trim() || "";
        if (!version) {
            version = latestVersion(args.projectRoot, abbrev) ?? "";
            if (!version) {
                return {
                    success: false,
                    error: "缺少必填参数 version（版本号），且未找到版本目录（docs/{缩写}-v{x.y.z}）。请先执行 /impm-init 或 /impm-version-create 创建版本目录。",
                };
            }
        }
        const file = progressFilePath(args.projectRoot, abbrev, version);
        const action = args.action;
        const stepName = args.stepName ? normalizeStepName(args.stepName) : "";
        const status = args.status?.trim() || "已完成";
        const dbPath = (args.dbPath && args.dbPath.trim()) || defaultDbPath();

        if (action === "init") {
            // 读-改-写加锁：并发初始化进度表时串行化
            return await withFileLock(file, async () => {
                if (existsSync(file)) {
                    return {
                        success: false,
                        action,
                        error: `version_progress.md 已存在：${file}。如需追加记录请使用 action=add。`,
                    };
                }
                const rows: ProgressRow[] = [];
                if (stepName) {
                    if (!isKnownStep(stepName)) {
                        return {
                            success: false,
                            action,
                            error: `未知步骤名：${stepName}。已知步骤：${KNOWN_STEP_NAMES.join("、")}`,
                        };
                    }
                    rows.push({ seq: 1, stepName, status, startTime: formatTime(Date.now()) });
                }
                mkdirSync(dirname(file), { recursive: true });
                writeFileSync(file, buildFile(abbrev, version, rows), "utf8");
                return {
                    success: true,
                    action,
                    path: file,
                    rows,
                    message: rows.length
                        ? `已创建进度表并写入首行（1 | ${stepName} | ${status} | 启动时间 ${rows[0].startTime}）。`
                        : "已创建进度表（表头：步骤序号 | 步骤名称 | 步骤状态 | 启动时间 | 总耗时(秒) | 输入token | 输出token | 命中缓存 | 存入缓存 | 总token）。",
                };
            });
        }

        if (!existsSync(file)) {
            if (action === "finalize") {
                // 无进度表（如热修复流程）时静默跳过，不视为错误
                return {
                    success: true,
                    action,
                    skipped: true,
                    message: "version_progress.md 不存在，无需结算。",
                };
            }
            return {
                success: false,
                action,
                error: `version_progress.md 不存在：${file}。请先执行 /impm-init 或 /impm-version-create 创建版本目录与进度表（impm_version action=init + impm_progress action=init）。`,
            };
        }

        const content = readFileSync(file, "utf8");
        const rows = parseRows(content);

        if (action === "list") {
            return { success: true, action, path: file, rows, total: rows.length };
        }

        if (action === "check") {
            if (!stepName) {
                return { success: false, action, error: "缺少必填参数 stepName（步骤名称）。" };
            }
            const matched = rows.filter((r) => r.stepName === stepName);
            const distinctSteps = new Set(rows.map((r) => r.stepName));
            const doneSteps = new Set(
                rows.filter((r) => r.status === "已完成").map((r) => r.stepName),
            );
            return {
                success: true,
                action,
                path: file,
                stepName,
                latestStatus: matched.length ? matched[matched.length - 1].status : null,
                rows: matched,
                summary: {
                    totalRows: rows.length,
                    distinctSteps: distinctSteps.size,
                    doneSteps: doneSteps.size,
                    doneRatio: distinctSteps.size
                        ? Math.round((doneSteps.size / distinctSteps.size) * 100)
                        : 0,
                },
            };
        }

        if (action === "finalize") {
            // 结算当前最后一行（最近一个步骤）：以当前时间为结束时间
            // 计算总耗时并从 opencode 数据库查询该步骤窗口的 token 回填
            // （读-改-写加锁并持锁内重读最新内容，防止并发任务写进度表丢行）
            return await withFileLock(file, async () => {
                const lockedRows = parseRows(readFileSync(file, "utf8"));
                if (lockedRows.length === 0) {
                    return {
                        success: true,
                        action,
                        path: file,
                        skipped: true,
                        message: "进度表为空，无需结算。",
                    };
                }
                const prev = lockedRows[0];
                const settled = await finalizeRow(prev, dbPath, args.projectRoot, Date.now());
                if (!settled) {
                    return {
                        success: true,
                        action,
                        path: file,
                        skipped: true,
                        seq: prev.seq,
                        stepName: prev.stepName,
                        message: `最后一行（${prev.stepName}）无需结算（无启动时间或已结算）。`,
                    };
                }
                writeFileSync(file, buildFile(abbrev, version, lockedRows), "utf8");
                let msg = `已结算最后一行（${prev.stepName} | 总耗时 ${settled.duration} 秒`;
                msg += settled.tokens
                    ? ` | 输入 ${settled.tokens.input} | 输出 ${settled.tokens.output} | 缓存命中 ${settled.tokens.cacheRead} | 缓存写入 ${settled.tokens.cacheWrite} | 总token ${settled.tokens.total}`
                    : "，token 查询失败";
                msg += "）。";
                return {
                    success: true,
                    action,
                    path: file,
                    seq: prev.seq,
                    stepName: prev.stepName,
                    duration: settled.duration,
                    tokens: settled.tokens,
                    message: msg,
                };
            });
        }

        if (action === "add") {
            // 读-改-写加锁并持锁内重读最新内容：并发任务/子步骤同时记录进度时串行化，避免丢行
            return await withFileLock(file, async () => {
                const lockedRows = parseRows(readFileSync(file, "utf8"));
                if (!stepName) {
                    return { success: false, action, error: "缺少必填参数 stepName（步骤名称）。" };
                }
                if (!isKnownStep(stepName)) {
                    return {
                        success: false,
                        action,
                        error: `未知步骤名：${stepName}。已知步骤：${KNOWN_STEP_NAMES.join("、")}`,
                    };
                }
                const now = Date.now();
                // 上一行（当前表格第一行）尚未结算时，以当前时间为结束时间结算
                // 总耗时与 token（该步骤窗口内的主会话 + subagent 子会话消耗）
                let finalized: {
                    seq: number;
                    stepName: string;
                    duration: number;
                    tokens: TokenStats | null;
                } | null = null;
                if (lockedRows.length > 0) {
                    const prev = lockedRows[0];
                    const settled = await finalizeRow(prev, dbPath, args.projectRoot, now);
                    if (settled) {
                        finalized = {
                            seq: prev.seq,
                            stepName: prev.stepName,
                            duration: settled.duration,
                            tokens: settled.tokens,
                        };
                    }
                }
                const duplicate = lockedRows.some(
                    (r) => r.stepName === stepName && r.status === status,
                );
                if (duplicate) {
                    let msg = `已存在相同记录（${stepName} | ${status}），未重复插入。`;
                    if (finalized) {
                        msg += `已结算上一行（${finalized.stepName} | 总耗时 ${finalized.duration} 秒`;
                        msg += finalized.tokens
                            ? ` | 输入 ${finalized.tokens.input} | 输出 ${finalized.tokens.output} | 缓存命中 ${finalized.tokens.cacheRead} | 缓存写入 ${finalized.tokens.cacheWrite} | 总token ${finalized.tokens.total}`
                            : "，token 查询失败";
                        msg += "）。";
                    }
                    return {
                        success: true,
                        action,
                        path: file,
                        duplicate: true,
                        seq: lockedRows.find((r) => r.stepName === stepName && r.status === status)?.seq,
                        finalized,
                        message: msg,
                    };
                }
                const maxSeq = lockedRows.reduce((m, r) => Math.max(m, r.seq), 0);
                const newRow: ProgressRow = {
                    seq: maxSeq + 1,
                    stepName,
                    status,
                    startTime: formatTime(now),
                };
                const newRows = [newRow, ...lockedRows];
                writeFileSync(file, buildFile(abbrev, version, newRows), "utf8");
                let msg = `已插入新行（序号 ${newRow.seq}，${stepName} | ${status}，启动时间 ${newRow.startTime}）。`;
                if (finalized) {
                    msg += `已结算上一行（${finalized.stepName} | 总耗时 ${finalized.duration} 秒`;
                    msg += finalized.tokens
                        ? ` | 输入 ${finalized.tokens.input} | 输出 ${finalized.tokens.output} | 缓存命中 ${finalized.tokens.cacheRead} | 缓存写入 ${finalized.tokens.cacheWrite} | 总token ${finalized.tokens.total}`
                        : "，token 查询失败";
                    msg += "）。";
                }
                return {
                    success: true,
                    action,
                    path: file,
                    seq: newRow.seq,
                    stepName,
                    status,
                    startTime: newRow.startTime,
                    finalized,
                    message: msg,
                };
            });
        }

        return { success: false, error: `未知 action：${action}（应为 init/add/check/list）` };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
