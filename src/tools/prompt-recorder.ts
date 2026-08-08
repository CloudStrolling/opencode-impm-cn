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
 * impm 插件内置功能：impm-prompt-recorder
 *
 * 两项能力（随 impm 插件整体分发，不独立成插件）：
 * 1. 用户提问自动记录：chat.message 钩子在用户提问时立即把提示词追加到
 *    docs/prompts/prompts.md 表格（session_id、提问时间、提示词内容、
 *    输入token、输出token、缓存命中、缓存写入），会话结束（session.idle）
 *    时按"提问窗口"聚合该次提问的对话消耗（该提问之后、下一次提问之前
 *    的助手消息 + 该时段创建的子会话）回填后 4 列。
 * 2. 对话导出：将主会话与全部子会话的完整对话（含思考与回答）导出到
 *    docs/prompts/prompt-{年月日}-{session_id}.md，文件开头记录整个
 *    会话的累计 token 消耗统计，并在每次提问/会话结束时持续更新。
 *
 * 数据源（钩子 + SQLite 混合，不使用 opencode SDK）：
 * - 提问内容：chat.message 钩子（output.parts 中的 text part）
 * - 对话内容：直读 opencode SQLite 数据库的 message / part 表（data JSON）
 * - 当前对话消耗：message 表 assistant 消息 data.tokens（含 cache.read/write）
 * - 整会话累计消耗：session 表 tokens_* 列，按 parent_id 递归聚合主会话
 *   与全部子孙会话（opencode 官方 API 的 Session 类型不含 token 字段）
 *
 * 触发：chat.message（提问时记录并刷新导出）+ event（session.idle 时
 * 回填/导出），幂等。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** prompts.md 表头 */
const TABLE_HEADER = [
    "| session_id | 提问时间 | 提示词内容 | 输入token | 输出token | 缓存命中 | 缓存写入 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
].join("\n");

/** 提问窗口匹配容差：prompts.md 提问时间与 DB 消息时间的最大允许偏差（5 分钟） */
const TIME_TOLERANCE_MS = 5 * 60 * 1000;

/** 创建字符串参数 schema（与套件工具风格一致） */
function createStringSchema(description: string) {
    return { type: "string" as const, description };
}

/** 数字左补零 */
function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss（本地时区） */
function formatTime(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 毫秒时间戳 → YYYYMMDD（本地时区） */
function formatDate(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** 转义表格字符：| → \|，换行 → <br> */
function escapeCell(text: string): string {
    return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

/** 计算默认 opencode 数据目录下的数据库路径 */
function defaultDbPath(): string {
    if (process.env.OPENCODE_DATA) {
        return join(process.env.OPENCODE_DATA, "opencode.db");
    }
    const home =
        process.env.HOME ||
        process.env.USERPROFILE ||
        join(process.env.HOMEDRIVE || "", process.env.HOMEPATH || "");
    return join(home, ".local", "share", "opencode", "opencode.db");
}

/** session 表行（SQLite 直读） */
interface SessionRow {
    id: string;
    parent_id: string | null;
    title: string;
    time_created: number;
    tokens_input: number | null;
    tokens_output: number | null;
    tokens_reasoning: number | null;
    tokens_cache_read: number | null;
    tokens_cache_write: number | null;
}

/** message 表行（data 为 JSON 字符串） */
interface MessageRow {
    id: string;
    session_id: string;
    time_created: number;
    data: string;
}

/** part 表行（data 为 JSON 字符串） */
interface PartRow {
    id: string;
    message_id: string;
    session_id: string;
    time_created: number;
    data: string;
}

/** token 消耗统计（一个口径：输出与思考分开记，汇总时合并） */
interface TokenTotal {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
}

/** 数据库操作句柄（兼容 node:sqlite 与 bun:sqlite） */
interface SqliteHandle {
    db: {
        prepare(sql: string): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown };
        close(): void;
    };
    close(): void;
}

/**
 * 打开只读数据库：优先 node:sqlite，失败回退 bun:sqlite
 * （兼容 Node ≥22.5 与 Bun 两种插件运行时）
 */
async function openDb(dbPath: string): Promise<SqliteHandle> {
    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        return {
            db,
            close() {
                try {
                    db.close();
                } catch {
                    /* 忽略重复关闭 */
                }
            },
        };
    } catch (err) {
        try {
            const { Database } = await import("bun:sqlite");
            const db = new Database(dbPath, { readonly: true });
            return {
                db,
                close() {
                    try {
                        db.close();
                    } catch {
                        /* 忽略重复关闭 */
                    }
                },
            };
        } catch (err2) {
            throw new Error(
                `无法打开 opencode 数据库: ${dbPath} (${String(err)} / ${String(err2)})`,
            );
        }
    }
}

/** 查询主会话及全部子孙会话（按 parent_id 递归） */
function querySessionTree(db: SqliteHandle["db"], rootId: string): SessionRow[] {
    const rows = db
        .prepare(
            "SELECT id, parent_id, title, time_created, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write FROM session",
        )
        .all() as SessionRow[];
    const byId = new Map<string, SessionRow>();
    const children = new Map<string | null, SessionRow[]>();
    for (const r of rows) {
        byId.set(r.id, r);
        const list = children.get(r.parent_id) || [];
        list.push(r);
        children.set(r.parent_id, list);
    }
    const result: SessionRow[] = [];
    const seen = new Set<string>();
    const visit = (id: string): void => {
        if (seen.has(id)) {
            return;
        }
        seen.add(id);
        const r = byId.get(id);
        if (!r) {
            return;
        }
        result.push(r);
        for (const c of children.get(id) || []) {
            visit(c.id);
        }
    };
    visit(rootId);
    return result;
}

/**
 * 聚合某会话及其全部子孙会话的累计 token（SQLite session 表直读，
 * 即"整个 session 消耗"，用于导出文件开头的统计）
 */
async function collectSessionTokens(dbPath: string, sessionId: string): Promise<TokenTotal> {
    const opened = await openDb(dbPath);
    try {
        const sessions = querySessionTree(opened.db, sessionId);
        const total: TokenTotal = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
        for (const r of sessions) {
            total.input += Number(r.tokens_input) || 0;
            total.output += Number(r.tokens_output) || 0;
            total.reasoning += Number(r.tokens_reasoning) || 0;
            total.cacheRead += Number(r.tokens_cache_read) || 0;
            total.cacheWrite += Number(r.tokens_cache_write) || 0;
        }
        return total;
    } finally {
        opened.close();
    }
}

/** 解析 prompts.md 已有数据行（跳过表头），返回原始行与 7 列二维数组 */
function parsePromptRows(text: string): Array<{ raw: string; cols: string[] }> {
    const rows: Array<{ raw: string; cols: string[] }> = [];
    for (const raw of String(text).replace(/^\uFEFF/, "").split(/\r?\n/)) {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
            continue;
        }
        const parts = trimmed.slice(1, -1).split("|").map((c) => c.trim());
        if (parts.length < 7 || parts[0] === "session_id") {
            continue;
        }
        // 提示词内容（第 3 列）可能含转义 \| 被拆开，从右取 4 列 token，其余合并回左侧
        const left = parts.slice(0, parts.length - 4);
        rows.push({
            raw: trimmed,
            cols: [
                left[0],
                left[1],
                left.slice(2).join("|"),
                parts[parts.length - 4],
                parts[parts.length - 3],
                parts[parts.length - 2],
                parts[parts.length - 1],
            ],
        });
    }
    return rows;
}

/** 返回该项目的 prompts.md 文件路径，并确保目录存在 */
function promptsFile(projectRoot: string): string {
    const dir = join(projectRoot, "docs", "prompts");
    mkdirSync(dir, { recursive: true });
    return join(dir, "prompts.md");
}

/**
 * 追加一行提问记录到 prompts.md（幂等：按 session_id+提问时间去重）
 * 后 4 列先写"待统计"，由 finalizeTokens 在会话结束时回填
 */
function appendPromptRow(projectRoot: string, sessionId: string, timeMs: number, prompt: string): number {
    const text = prompt.trim();
    if (!text) {
        return 0;
    }
    const timeStr = formatTime(timeMs);
    const file = promptsFile(projectRoot);
    const rows = existsSync(file)
        ? parsePromptRows(readFileSync(file, "utf8"))
        : [];
    if (rows.some((r) => r.cols[0] === sessionId && r.cols[1] === timeStr)) {
        return 0;
    }
    let content = "";
    if (existsSync(file)) {
        content = readFileSync(file, "utf8");
    } else {
        content = `# 提问记录\n\n${TABLE_HEADER}\n`;
    }
    const body = content.endsWith("\n") ? content : `${content}\n`;
    writeFileSync(file, `${body}| ${sessionId} | ${timeStr} | ${escapeCell(text)} | 待统计 | 待统计 | 待统计 | 待统计 |\n`, "utf8");
    return 1;
}

/** 从 SQLite 读取某会话的全部消息（含 parts），按时间排序 */
function readSessionMessages(db: SqliteHandle["db"], sessionId: string): Array<{
    id: string;
    sessionId: string;
    role: string;
    timeCreated: number;
    info: Record<string, unknown>;
    parts: Array<{ id: string; type: string; data: Record<string, unknown>; timeCreated: number }>;
}> {
    const messages = db
        .prepare("SELECT id, session_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created")
        .all(sessionId) as MessageRow[];
    const parts = db
        .prepare("SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created")
        .all(sessionId) as PartRow[];

    const partsByMessage = new Map<string, Array<{ id: string; type: string; data: Record<string, unknown>; timeCreated: number }>>();
    for (const p of parts) {
        let data: Record<string, unknown> = {};
        try {
            data = JSON.parse(p.data);
        } catch {
            /* 忽略解析失败 */
        }
        const list = partsByMessage.get(p.message_id) || [];
        list.push({ id: p.id, type: String(data.type || ""), data, timeCreated: p.time_created });
        partsByMessage.set(p.message_id, list);
    }

    const result: Array<{
        id: string;
        sessionId: string;
        role: string;
        timeCreated: number;
        info: Record<string, unknown>;
        parts: Array<{ id: string; type: string; data: Record<string, unknown>; timeCreated: number }>;
    }> = [];
    for (const m of messages) {
        let info: Record<string, unknown> = {};
        try {
            info = JSON.parse(m.data);
        } catch {
            /* 忽略解析失败 */
        }
        result.push({
            id: m.id,
            sessionId: m.session_id,
            role: String(info.role || ""),
            timeCreated: m.time_created,
            info,
            parts: partsByMessage.get(m.id) || [],
        });
    }
    return result;
}

/** 读取某会话全部 user 消息（按时间排序），提取文本 */
function readUserMessages(db: SqliteHandle["db"], sessionId: string): Array<{ time: number; text: string }> {
    return readSessionMessages(db, sessionId)
        .filter((m) => m.role === "user")
        .map((m) => ({
            time: m.timeCreated,
            text: m.parts
                .filter((p) => p.type === "text" && !p.data.synthetic)
                .map((p) => String(p.data.text || ""))
                .join("\n")
                .trim(),
        }))
        .filter((m) => m.text)
        .sort((a, b) => a.time - b.time);
}

/** 读取某会话全部 assistant 消息的 token 统计（message.data.tokens，含时间） */
function readAssistantCosts(db: SqliteHandle["db"], sessionId: string): Array<{ time: number; cost: TokenTotal }> {
    const out: Array<{ time: number; cost: TokenTotal }> = [];
    for (const m of readSessionMessages(db, sessionId)) {
        if (m.role !== "assistant") {
            continue;
        }
        const t = (m.info.tokens || {}) as {
            input?: number;
            output?: number;
            reasoning?: number;
            cache?: { read?: number; write?: number };
        };
        out.push({
            time: m.timeCreated,
            cost: {
                input: Number(t.input) || 0,
                output: Number(t.output) || 0,
                reasoning: Number(t.reasoning) || 0,
                cacheRead: Number(t.cache?.read) || 0,
                cacheWrite: Number(t.cache?.write) || 0,
            },
        });
    }
    return out;
}

/** 空 token 统计 */
function emptyTotal(): TokenTotal {
    return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
}

/** 累加两个 token 统计 */
function addTotal(a: TokenTotal, b: TokenTotal): TokenTotal {
    return {
        input: a.input + b.input,
        output: a.output + b.output,
        reasoning: a.reasoning + b.reasoning,
        cacheRead: a.cacheRead + b.cacheRead,
        cacheWrite: a.cacheWrite + b.cacheWrite,
    };
}

/**
 * 按"提问窗口"计算各次提问的当前对话消耗：
 * 窗口 i = [第 i 次提问时间, 第 i+1 次提问时间)；
 * 窗口内消耗 = 该时段内主会话 assistant 消息 tokens + 该时段内创建的子会话累计 tokens
 */
function buildWindowCosts(
    db: SqliteHandle["db"],
    sessionId: string,
): TokenTotal[] {
    const users = readUserMessages(db, sessionId);
    if (users.length === 0) {
        return [];
    }
    const windows = users.map(() => emptyTotal());
    // 助手消息归属：时间不早于该提问、早于下一提问 → 该窗口
    for (const a of readAssistantCosts(db, sessionId)) {
        let idx = -1;
        for (let k = 0; k < users.length; k++) {
            if (users[k].time <= a.time) {
                idx = k;
            }
        }
        if (idx >= 0) {
            windows[idx] = addTotal(windows[idx], a.cost);
        }
    }
    // 子会话归属：按其创建时间落在哪个窗口
    const children = querySessionTree(db, sessionId).filter((s) => s.parent_id);
    for (const c of children) {
        let idx = -1;
        for (let k = 0; k < users.length; k++) {
            if (users[k].time <= c.time_created) {
                idx = k;
            }
        }
        if (idx >= 0) {
            windows[idx].input += Number(c.tokens_input) || 0;
            windows[idx].output += Number(c.tokens_output) || 0;
            windows[idx].reasoning += Number(c.tokens_reasoning) || 0;
            windows[idx].cacheRead += Number(c.tokens_cache_read) || 0;
            windows[idx].cacheWrite += Number(c.tokens_cache_write) || 0;
        }
    }
    return windows;
}

/**
 * 回填 prompts.md 每行提问的"当前对话消耗"（提问窗口口径，幂等）
 * 行与 DB user 消息按时间最近匹配（容差 TIME_TOLERANCE_MS）
 */
async function finalizeTokens(
    projectRoot: string,
    dbPath: string,
    sessionId: string,
): Promise<{ updated: number }> {
    const file = promptsFile(projectRoot);
    if (!existsSync(file)) {
        return { updated: 0 };
    }
    const opened = await openDb(dbPath);
    try {
        const users = readUserMessages(opened.db, sessionId);
        const windows = buildWindowCosts(opened.db, sessionId);
        if (users.length === 0 || windows.length === 0) {
            return { updated: 0 };
        }
        // 为每个 user 消息计算一次最近行匹配（同一 user 可匹配多行时取最近的）
        const lines = String(readFileSync(file, "utf8")).replace(/^\uFEFF/, "").split(/\r?\n/);
        const out: string[] = [];
        let updated = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
                out.push(line);
                continue;
            }
            const parts = trimmed.slice(1, -1).split("|").map((c) => c.trim());
            if (parts.length < 7 || parts[0] === "session_id") {
                out.push(line);
                continue;
            }
            const rowSession = parts[0];
            if (rowSession !== sessionId) {
                out.push(line);
                continue;
            }
            const rowTime = Date.parse(parts[1]);
            if (Number.isNaN(rowTime)) {
                out.push(line);
                continue;
            }
            // 找时间差最小的 user 消息
            let bestIdx = -1;
            let bestDiff = TIME_TOLERANCE_MS;
            for (let k = 0; k < users.length; k++) {
                const diff = Math.abs(users[k].time - rowTime);
                if (diff <= bestDiff) {
                    bestDiff = diff;
                    bestIdx = k;
                }
            }
            if (bestIdx < 0) {
                out.push(line);
                continue;
            }
            const w = windows[bestIdx];
            const left = parts.slice(0, parts.length - 4).map((s) => s.trim()).join(" | ");
            out.push(
                `| ${left} | ${w.input} | ${w.output + w.reasoning} | ${w.cacheRead} | ${w.cacheWrite} |`,
            );
            updated += 1;
        }
        if (updated > 0) {
            writeFileSync(file, out.join("\n"), "utf8");
        }
        return { updated };
    } finally {
        opened.close();
    }
}

/** 渲染单个消息为 Markdown 行（含思考与回答） */
function renderMessage(msg: {
    role: string;
    timeCreated: number;
    info: Record<string, unknown>;
    parts: Array<{ id: string; type: string; data: Record<string, unknown>; timeCreated: number }>;
}): string[] {
    const lines: string[] = [];
    const role = msg.role === "user" ? "用户" : "助手";
    lines.push(`### ${role} ${formatTime(msg.timeCreated)}`);
    if (msg.role === "assistant") {
        const model = msg.info.modelID ? `${msg.info.providerID}/${msg.info.modelID}` : "";
        const agent = msg.info.agent ? ` | agent: ${msg.info.agent}` : "";
        lines.push(`> 模型: ${model || "未知"}${agent}`);
    }
    lines.push("");
    for (const p of msg.parts) {
        switch (p.type) {
            case "text":
                if (p.data.synthetic) {
                    break;
                }
                if (p.data.text && String(p.data.text).trim()) {
                    lines.push(String(p.data.text).trim());
                    lines.push("");
                }
                break;
            case "reasoning":
                if (p.data.text && String(p.data.text).trim()) {
                    lines.push("> **思考过程**");
                    lines.push(">");
                    lines.push(
                        String(p.data.text)
                            .trim()
                            .split(/\r?\n/)
                            .map((l) => `> ${l}`)
                            .join("\n"),
                    );
                    lines.push("");
                }
                break;
            case "tool":
                lines.push(`- 工具调用: \`${String(p.data.tool || "unknown")}\`（状态: ${String(p.data.state || "unknown")}）`);
                break;
            case "subtask":
                lines.push(`- 派遣子任务: **${String(p.data.agent || "?")}** — ${String(p.data.description || p.data.prompt || "")}`);
                break;
            case "step-start":
                lines.push(`- 步骤开始${p.data.snapshot ? "（含快照）" : ""}`);
                break;
            case "step-finish": {
                const t = p.data.tokens as { input?: number; output?: number; reasoning?: number } | undefined;
                const tok = t ? `tokens: ${t.input ?? 0}+${(t.output ?? 0) + (t.reasoning ?? 0)}` : "";
                lines.push(`- 步骤结束（原因: ${String(p.data.reason || "?")}${tok ? `, ${tok}` : ""}）`);
                break;
            }
            case "patch":
                lines.push(`- 文件补丁: ${((p.data.files as string[]) || []).join(", ") || String(p.data.hash || "?")}`);
                break;
            case "agent":
                lines.push(`- 子代理: ${String(p.data.name || "")}`);
                break;
            default:
                break;
        }
    }
    lines.push("");
    return lines;
}

/**
 * 导出主会话与全部子会话的对话快照到 docs/prompts/
 * 文件开头记录整个会话的累计 token 消耗统计（session 表口径，随导出持续更新）
 * 数据来源：SQLite message / part 表直读（含思考与回答）
 */
async function exportSession(
    projectRoot: string,
    dbPath: string,
    sessionId: string,
): Promise<{ exported: number; file: string }> {
    const opened = await openDb(dbPath);
    try {
        const sessions = querySessionTree(opened.db, sessionId);
        if (sessions.length === 0) {
            return { exported: 0, file: "" };
        }
        const main = sessions[0];
        const lines: string[] = [];
        lines.push(`# 对话记录${main.title ? `：${main.title}` : ""}`);
        lines.push("");
        lines.push(`- 主会话: ${main.id}`);
        lines.push(`- 导出时间: ${formatTime(Date.now())}`);
        lines.push(`- 会话数量: ${sessions.length}（主会话 + ${sessions.length - 1} 个子会话）`);
        lines.push("");

        // 整个会话的累计 token 消耗统计（开头位置，随导出持续更新）
        const totals = sessions.map((s) => ({
            id: s.id,
            title: s.title,
            isMain: !s.parent_id,
            input: Number(s.tokens_input) || 0,
            output: Number(s.tokens_output) || 0,
            reasoning: Number(s.tokens_reasoning) || 0,
            cacheRead: Number(s.tokens_cache_read) || 0,
            cacheWrite: Number(s.tokens_cache_write) || 0,
        }));
        const sum = totals.reduce<TokenTotal>(
            (acc, s) => ({
                input: acc.input + s.input,
                output: acc.output + s.output,
                reasoning: acc.reasoning + s.reasoning,
                cacheRead: acc.cacheRead + s.cacheRead,
                cacheWrite: acc.cacheWrite + s.cacheWrite,
            }),
            emptyTotal(),
        );
        lines.push("## token 消耗统计");
        lines.push("");
        lines.push("| 会话 | 输入token | 输出token（含思考） | 思考token | 缓存命中 | 缓存写入 |");
        lines.push("| --- | --- | --- | --- | --- | --- |");
        for (const s of totals) {
            const label = s.isMain ? "主会话" : "子会话";
            lines.push(
                `| ${label} \`${s.id}\`${s.title ? `（${s.title}）` : ""} | ${s.input} | ${s.output + s.reasoning} | ${s.reasoning} | ${s.cacheRead} | ${s.cacheWrite} |`,
            );
        }
        lines.push(
            `| **合计** | **${sum.input}** | **${sum.output + sum.reasoning}** | **${sum.reasoning}** | **${sum.cacheRead}** | **${sum.cacheWrite}** |`,
        );
        lines.push("");
        lines.push("## 会话树");
        lines.push("");
        for (const s of sessions) {
            lines.push(`- ${s.parent_id ? "子会话" : "主会话"} \`${s.id}\`${s.title ? `（${s.title}）` : ""}`);
        }
        lines.push("");
        for (const s of sessions) {
            lines.push(`## 会话 ${s.id}`);
            lines.push("");
            lines.push(`> 创建时间: ${formatTime(s.time_created)}${s.title ? ` | 标题: ${s.title}` : ""}`);
            lines.push("");
            if (s.parent_id) {
                lines.push(`> 子会话（父会话: ${s.parent_id}）`);
                lines.push("");
            }
            const messages = readSessionMessages(opened.db, s.id);
            for (const m of messages) {
                lines.push(...renderMessage(m));
            }
        }
        const dir = join(projectRoot, "docs", "prompts");
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `prompt-${formatDate(main.time_created)}-${main.id}.md`);
        writeFileSync(file, lines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
        return { exported: sessions.length, file };
    } finally {
        opened.close();
    }
}

/**
 * 创建 prompt-recorder 功能（chat.message 钩子 + event 钩子 + 3 个工具）
 * @param projectRoot 项目根目录
 */
export async function createPromptRecorder(projectRoot: string) {
    let busy = false; // 事件处理互斥锁：防止 session.idle 并发重入
    let exporting = false; // 导出互斥锁：防止并发写导出文件

    /** 刷新导出文件（防止并发写） */
    const refreshExport = async (dbPath: string, sessionId: string): Promise<void> => {
        if (exporting) {
            return;
        }
        exporting = true;
        try {
            await exportSession(projectRoot, dbPath, sessionId);
        } catch (err) {
            console.error("[impm] prompt-recorder 导出刷新失败:", String(err));
        } finally {
            exporting = false;
        }
    };

    /**
     * chat.message 钩子：用户提问时立即记录到 prompts.md，并刷新导出文件
     * input: { sessionID, agent?, model?, messageID? }
     * output: { message: UserMessage, parts: Part[] }
     */
    const chatMessage = async (input: { sessionID?: string; messageID?: string }, output: { parts?: Array<{ type?: string; text?: string; synthetic?: boolean }> }): Promise<void> => {
        try {
            const sessionID = input?.sessionID;
            if (!sessionID) {
                return;
            }
            const prompt = (output?.parts || [])
                .filter((p) => p && p.type === "text" && !p.synthetic)
                .map((p) => p.text || "")
                .join("\n")
                .trim();
            if (!prompt) {
                return;
            }
            // 仅记录主会话提问：查 SQLite 判断该会话是否为子会话（查不到时视为主会话）
            try {
                const opened = await openDb(defaultDbPath());
                try {
                    const row = opened.db
                        .prepare("SELECT parent_id FROM session WHERE id = ?")
                        .get(sessionID) as { parent_id: string | null } | undefined;
                    if (row && row.parent_id) {
                        return;
                    }
                } finally {
                    opened.close();
                }
            } catch {
                /* 数据库不可读时仍记录，不阻塞主流程 */
            }
            const recorded = appendPromptRow(projectRoot, sessionID, Date.now(), prompt);
            if (recorded) {
                console.log(`[impm] prompt-recorder 记录提问：${sessionID}（${prompt.slice(0, 50)}...）`);
            }
            // 提问后即刷新导出文件（token 统计与对话内容跟随更新）
            await refreshExport(defaultDbPath(), sessionID);
        } catch (err) {
            console.error("[impm] prompt-recorder chat.message 处理失败:", String(err));
        }
    };

    /** event 钩子：主会话回合结束时回填 token 并导出对话 */
    const event = async (input: { event: unknown }): Promise<void> => {
        const eventData = input?.event as { type?: string; properties?: { sessionID?: string } } | undefined;
        if (!eventData || eventData.type !== "session.idle") {
            return;
        }
        const sessionId = eventData.properties?.sessionID;
        if (!sessionId || busy) {
            return;
        }
        busy = true;
        try {
            // 仅处理主会话（无父会话的根会话）；子会话由主会话统一导出
            const opened = await openDb(defaultDbPath());
            let isMain = true;
            try {
                const row = opened.db
                    .prepare("SELECT parent_id FROM session WHERE id = ?")
                    .get(sessionId) as { parent_id: string | null } | undefined;
                isMain = !row || !row.parent_id;
            } finally {
                opened.close();
            }
            if (!isMain) {
                return;
            }
            const r2 = await finalizeTokens(projectRoot, defaultDbPath(), sessionId);
            const r3 = await refreshExport(defaultDbPath(), sessionId);
            if (r2.updated || r3) {
                console.log(
                    `[impm] prompt-recorder 主会话 ${sessionId}：回填 ${r2.updated} 行 token，刷新导出文件`,
                );
            }
        } catch (err) {
            console.error("[impm] prompt-recorder 自动处理失败:", String(err));
        } finally {
            busy = false;
        }
    };

    return {
        chatMessage,
        event,
        tool: {
            /** 手动补录指定会话的用户提问到 prompts.md */
            impm_prompt_record: {
                description:
                    "将指定会话的用户提问补录到 docs/prompts/prompts.md 表格（幂等，重复运行不产生重复行）",
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    sessionID: createStringSchema("会话 ID（必填，主会话）"),
                },
                async execute(args: Record<string, unknown>): Promise<string> {
                    const root = (args.projectRoot as string) || projectRoot;
                    const sessionId = String(args.sessionID || "");
                    if (!sessionId) {
                        return "未指定 sessionID";
                    }
                    // 从 SQLite message/part 表提取该会话的用户提问并补录
                    let recorded = 0;
                    try {
                        const opened = await openDb(defaultDbPath());
                        try {
                            const messages = readSessionMessages(opened.db, sessionId);
                            for (const m of messages) {
                                if (m.role !== "user") {
                                    continue;
                                }
                                const text = m.parts
                                    .filter((p) => p.type === "text" && !p.data.synthetic)
                                    .map((p) => String(p.data.text || ""))
                                    .join("\n")
                                    .trim();
                                if (text) {
                                    recorded += appendPromptRow(root, sessionId, m.timeCreated, text);
                                }
                            }
                        } finally {
                            opened.close();
                        }
                    } catch (err) {
                        console.error("[impm] prompt-recorder 补录失败:", String(err));
                    }
                    return `已记录 ${recorded} 条提问（${root}/docs/prompts/prompts.md）`;
                },
            },
            /** 手动重算当前对话消耗并回填 prompts.md */
            impm_prompt_finalize: {
                description:
                    "按提问窗口重算指定会话各次提问的当前对话 token 消耗（该次提问之后的助手消息+子会话），回填 prompts.md 的输入/输出/缓存列",
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    sessionID: createStringSchema("会话 ID（必填，主会话）"),
                    dbPath: createStringSchema(
                        "opencode 数据库路径（可选，默认 ~/.local/share/opencode/opencode.db）",
                    ),
                },
                async execute(args: Record<string, unknown>): Promise<string> {
                    const root = (args.projectRoot as string) || projectRoot;
                    const dbPath = (args.dbPath as string) || defaultDbPath();
                    const result = await finalizeTokens(root, dbPath, String(args.sessionID || ""));
                    return `已回填 ${result.updated} 行 token 统计（${dbPath}）`;
                },
            },
            /** 手动导出会话对话快照 */
            impm_prompt_export: {
                description:
                    "导出指定会话（主会话 + 全部子会话，含思考与回答）到 docs/prompts/prompt-{年月日}-{session_id}.md，开头含整会话 token 消耗统计",
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    sessionID: createStringSchema("会话 ID（必填，主会话）"),
                    dbPath: createStringSchema(
                        "opencode 数据库路径（可选，默认 ~/.local/share/opencode/opencode.db）",
                    ),
                },
                async execute(args: Record<string, unknown>): Promise<string> {
                    const root = (args.projectRoot as string) || projectRoot;
                    const dbPath = (args.dbPath as string) || defaultDbPath();
                    const result = await exportSession(root, dbPath, String(args.sessionID || ""));
                    return `已导出 ${result.exported} 个会话 → ${result.file}`;
                },
            },
        },
    };
}
