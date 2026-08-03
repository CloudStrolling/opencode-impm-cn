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
 *   - init：创建进度表（表头：步骤序号 | 步骤名称 | 步骤状态），可选写入首行
 *   - add：在表格第一行位置插入新行（序号为当前最大序号 +1）
 *   - check：查询某步骤的最新状态与整体进度
 *   - list：列出全部进度记录
 *
 * 文件位置：docs/{缩写}-v{版本号}/version_progress.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { progressFilePath, normalizeVersion } from "../utils/paths.js";
import { resolveAbbrev } from "../utils/project.js";

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
    "impm-project-update",
    "impm-doc-merge",
    "impm-doc-update",
    "impm-deploy-update",
    "impm-git-merge",
];

/** 历史/别名步骤名 → 规范步骤名 */
const STEP_ALIASES: Record<string, string> = {
    "impm-sad-create": "impm-sad-update",
};

function normalizeStepName(stepName: string): string {
    const key = stepName.trim();
    const aliased = STEP_ALIASES[key];
    return aliased ?? key;
}

function isKnownStep(stepName: string): boolean {
    return KNOWN_STEP_NAMES.includes(stepName);
}

export interface ProgressRow {
    seq: number;
    stepName: string;
    status: string;
}

const ROW_RE = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;
const HEADER_RE = /^\|\s*步骤序号/;

function parseRows(content: string): ProgressRow[] {
    const rows: ProgressRow[] = [];
    for (const line of content.split(/\r?\n/)) {
        if (ROW_RE.test(line) && !HEADER_RE.test(line)) {
            const m = ROW_RE.exec(line);
            if (m) {
                rows.push({
                    seq: parseInt(m[1], 10),
                    stepName: m[2].trim(),
                    status: m[3].trim(),
                });
            }
        }
    }
    return rows;
}

function buildFile(abbrev: string, version: string, rows: ProgressRow[]): string {
    const lines = [
        `# 版本进度 - ${abbrev}-v${normalizeVersion(version)}`,
        "",
        "| 步骤序号 | 步骤名称 | 步骤状态 |",
        "| --- | --- | --- |",
    ];
    for (const row of rows) {
        lines.push(`| ${row.seq} | ${row.stepName} | ${row.status} |`);
    }
    return lines.join("\n") + "\n";
}

export const progressDefinition = {
    description:
        "版本进度管理：action=init 创建版本进度文件 version_progress.md（3 列表格：步骤序号、步骤名称、步骤状态）；action=add 在表格第一行插入新行（序号自动为当前最大序号+1）；action=check 查询某步骤的最新状态与整体进度；action=list 列出全部进度记录。记录与核对流程步骤状态时使用。",
};

export function progressExecute(args: {
    projectRoot: string;
    action: "init" | "add" | "check" | "list";
    stepName?: string;
    status?: string;
    version?: string;
    projectName?: string;
}) {
    try {
        const abbrev = resolveAbbrev(args.projectRoot, args.projectName);
        const version = args.version?.trim();
        if (!version) {
            return { success: false, error: "缺少必填参数 version（版本号）。" };
        }
        const file = progressFilePath(args.projectRoot, abbrev, version);
        const action = args.action;
        const stepName = args.stepName ? normalizeStepName(args.stepName) : "";
        const status = args.status?.trim() || "已完成";

        if (action === "init") {
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
                rows.push({ seq: 1, stepName, status });
            }
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, buildFile(abbrev, version, rows), "utf8");
            return {
                success: true,
                action,
                path: file,
                rows,
                message: rows.length
                    ? `已创建进度表并写入首行（1 | ${stepName} | ${status}）。`
                    : "已创建进度表（表头：步骤序号 | 步骤名称 | 步骤状态）。",
            };
        }

        if (!existsSync(file)) {
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

        if (action === "add") {
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
            const duplicate = rows.some(
                (r) => r.stepName === stepName && r.status === status,
            );
            if (duplicate) {
                return {
                    success: true,
                    action,
                    path: file,
                    duplicate: true,
                    seq: rows.find((r) => r.stepName === stepName && r.status === status)?.seq,
                    message: `已存在相同记录（${stepName} | ${status}），未重复插入。`,
                };
            }
            const maxSeq = rows.reduce((m, r) => Math.max(m, r.seq), 0);
            const newRow: ProgressRow = { seq: maxSeq + 1, stepName, status };
            const newRows = [newRow, ...rows];
            writeFileSync(file, buildFile(abbrev, version, newRows), "utf8");
            return {
                success: true,
                action,
                path: file,
                seq: newRow.seq,
                stepName,
                status,
                message: `已插入新行（序号 ${newRow.seq}，${stepName} | ${status}）。`,
            };
        }

        return { success: false, error: `未知 action：${action}（应为 init/add/check/list）` };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
