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
 * impm_task_manager 工具
 * 任务清单 {缩写}-task-v{版本号}.json 管理：
 *   - init：校验并写入任务清单（taskListJson）
 *   - query：查询任务（taskId 指定时返回单个任务，否则返回清单摘要）
 *   - next：返回下一个可执行任务（未完成且上游任务全部已完成）
 *   - update：更新任务状态（未完成 | 执行中 | 已完成）
 *
 * 任务状态：未完成 | 执行中 | 已完成
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getDocPath } from "../utils/paths.js";
import { resolveAbbrev } from "../utils/project.js";
import { withFileLock } from "../utils/file-lock.js";

/** 任务合法状态集合 */
export const TASK_STATUSES = ["未完成", "执行中", "已完成"] as const;

/** 任务条目：id/status 为必填字段，title、userStoryId、apiId、upstreamTaskIds 等其余字段透传 */
export interface TaskItem {
    id: string;
    title: string;
    status: string;
    [key: string]: unknown;
}

/** 任务清单文件路径（沿用标准文档路径规则） */
function taskFilePath(projectRoot: string, abbrev: string, version: string): string {
    return getDocPath(projectRoot, abbrev, version, "task");
}

export interface TaskListFile {
    payload: Record<string, unknown>;
    tasks: TaskItem[];
}

/** 读取任务清单：兼容纯数组与 { payload, tasks } 两种存储形态，分离附加信息与任务数组 */
function readTaskList(file: string): TaskListFile {
    const data = JSON.parse(readFileSync(file, "utf8"));
    const tasks = Array.isArray(data) ? data : data?.tasks;
    if (!Array.isArray(tasks)) {
        throw new Error("任务清单格式非法：应为任务数组或包含 tasks 数组的对象。");
    }
    const payload =
        Array.isArray(data) || data === null || typeof data !== "object"
            ? {}
            : { ...data, tasks: undefined };
    delete payload.tasks;
    return { payload, tasks: tasks as TaskItem[] };
}

/** 写回任务清单：保留附加信息（payload）并序列化任务数组 */
function writeTaskList(
    file: string,
    payload: Record<string, unknown>,
    tasks: TaskItem[],
): void {
    writeFileSync(
        file,
        JSON.stringify({ ...payload, tasks }, null, 4) + "\n",
        "utf8",
    );
}

/** 判断任务的上游依赖是否全部完成（上游任务不存在时视为已完成） */
function upstreamDone(task: TaskItem, tasks: TaskItem[]): boolean {
    const upstream: unknown[] = (task.upstreamTaskIds ?? []) as unknown[];
    for (const id of upstream) {
        const up = tasks.find((t) => t.id === String(id));
        if (!up) {
            continue;
        }
        if (up.status !== "已完成") {
            return false;
        }
    }
    return true;
}

/** 生成任务清单摘要：总数、按状态计数、未完成任务列表 */
function summaryOf(tasks: TaskItem[]) {
    const byStatus: Record<string, number> = {};
    for (const t of tasks) {
        const s = TASK_STATUSES.includes(t.status as (typeof TASK_STATUSES)[number])
            ? t.status
            : "未完成";
        byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return {
        total: tasks.length,
        byStatus,
        pending: tasks
            .filter((t) => t.status !== "已完成")
            .map((t) => ({ id: t.id, title: t.title })),
    };
}

export const taskManagerDefinition = {
    description:
        "任务清单管理：action=init 校验并写入任务清单 JSON（taskListJson）；action=query 查询任务（传 taskId 返回单个任务，否则返回清单摘要与未完成任务）；action=next 返回下一个可执行任务（未完成且上游任务全部已完成）；action=update 更新任务状态（未完成/执行中/已完成）。任务调度与状态跟踪时使用。",
};

export async function taskManagerExecute(args: {
    projectRoot: string;
    action: "init" | "query" | "next" | "update";
    taskId?: string;
    status?: string;
    taskListJson?: string;
    version?: string;
    projectName?: string;
}) {
    try {
        const abbrev = resolveAbbrev(args.projectRoot, args.projectName);
        const version = args.version?.trim();
        if (!version) {
            return { success: false, error: "缺少必填参数 version（版本号）。" };
        }
        const file = taskFilePath(args.projectRoot, abbrev, version);
        const action = args.action;

        if (action === "init") {
            // 读-改-写加锁：防止并发初始化任务清单时互相覆盖
            return await withFileLock(file, async () => {
                // 防误覆盖：任务清单已存在时不支持重跑 init 覆盖，避免丢失已更新的任务状态
                if (existsSync(file)) {
                    return {
                        success: false,
                        action,
                        error: `任务清单已存在：${file}。如需重建请先在版本目录中确认并手动处理，避免覆盖已更新的任务状态。`,
                    };
                }
                const raw = args.taskListJson ?? "";
                let data: unknown;
                try {
                    data = JSON.parse(raw);
                } catch {
                    return {
                        success: false,
                        action,
                        error: "taskListJson JSON 解析失败，请检查 JSON 语法。",
                    };
                }
                const tasks = Array.isArray(data) ? data : (data as { tasks?: unknown })?.tasks;
                if (!Array.isArray(tasks) || tasks.length === 0) {
                    return {
                        success: false,
                        action,
                        error: "任务清单为空或格式非法：需为任务数组，或包含非空 tasks 数组的对象。",
                    };
                }
                const seen = new Set<string>();
                const normalized: TaskItem[] = [];
                const payload: Record<string, unknown> =
                    data !== null && typeof data === "object" && !Array.isArray(data)
                        ? { ...data }
                        : {};
                delete payload.tasks;
                if (!payload.projectName) {
                    payload.projectName = abbrev;
                }
                payload.version = version;
                for (const t of tasks as Array<Record<string, unknown>>) {
                    if (!t || typeof t.id !== "string" && typeof t.id !== "number") {
                        return {
                            success: false,
                            action,
                            error: "任务缺少 id 字段：每个任务必须包含 id。",
                        };
                    }
                    const id = String(t.id);
                    if (seen.has(id)) {
                        return {
                            success: false,
                            action,
                            error: `任务 id 重复：${id}。`,
                        };
                    }
                    seen.add(id);
                    const status = TASK_STATUSES.includes(t.status as (typeof TASK_STATUSES)[number])
                        ? (t.status as string)
                        : "未完成";
                    normalized.push({ ...t, id, status } as TaskItem);
                }
                mkdirSync(dirname(file), { recursive: true });
                writeTaskList(file, payload, normalized);
                return {
                    success: true,
                    action,
                    path: file,
                    count: normalized.length,
                    message: `已写入 ${normalized.length} 个任务。`,
                };
            });
        }

        if (!existsSync(file)) {
            return {
                success: false,
                action,
                error: `任务清单不存在：${file}。请先执行 /impm-task-create 生成任务清单。`,
            };
        }

        const list = readTaskList(file);
        const tasks = list.tasks;

        if (action === "query") {
            if (args.taskId) {
                const task = tasks.find((t) => t.id === args.taskId);
                if (!task) {
                    return {
                        success: false,
                        action,
                        error: `任务不存在：#${args.taskId}。`,
                    };
                }
                return { success: true, action, task };
            }
            return { success: true, action, path: file, ...summaryOf(tasks), tasks };
        }

        if (action === "next") {
            // 排除「执行中」任务：避免并发调度时同一任务被重复派发给多个执行者
            const candidate = tasks.find(
                (t) => t.status !== "已完成" && t.status !== "执行中" && upstreamDone(t, tasks),
            );
            if (!candidate) {
                return {
                    success: true,
                    action,
                    task: null,
                    message: "无待执行任务：所有任务均已完成，或剩余任务的上下游依赖未就绪。",
                };
            }
            return {
                success: true,
                action,
                task: candidate,
                message: `下一个可执行任务：#${candidate.id} ${candidate.title ?? ""}`,
            };
        }

        if (action === "update") {
            // 读-改-写加锁：并发任务状态更新（PM 标记执行中 / scm 标记已完成）串行化，防止互相覆盖
            return await withFileLock(file, async () => {
                const taskId = args.taskId;
                const status = args.status?.trim();
                if (!taskId) {
                    return { success: false, action, error: "缺少必填参数 taskId（任务编号）。" };
                }
                if (!status || !TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
                    return {
                        success: false,
                        action,
                        error: `status 非法：${status ?? ""}（应为：未完成/执行中/已完成）。`,
                    };
                }
                const lockedList = readTaskList(file);
                const lockedTasks = lockedList.tasks;
                const task = lockedTasks.find((t) => t.id === taskId);
                if (!task) {
                    return {
                        success: false,
                        action,
                        error: `任务不存在：#${taskId}。`,
                    };
                }
                task.status = status;
                writeTaskList(file, lockedList.payload, lockedTasks);
                return {
                    success: true,
                    action,
                    task,
                    message: `任务 #${taskId} 状态已更新为「${status}」。`,
                };
            });
        }

        return { success: false, error: `未知 action：${action}（应为 init/query/next/update）` };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
