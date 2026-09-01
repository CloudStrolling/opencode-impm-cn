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
 * impm_doc_reader 工具
 * 从标准路径读取需求/PRD/SAD/DBD/API/LLD/任务等文档。
 *
 * docType 取值：
 *   project | sad | urs | prd | dbd | api | lld | testcase | task | sql | review
 *   context | cs | ws | ui-test-record | regression-unit | regression-api | rtm
 *   apifox-openapi | apifox-postman
 *   readme | agent | deploy-build | deploy-deploy
 *
 * docType 为 context/cs/ws 时必须提供 taskId；
 * docType 为 testcase 且提供 taskId 时读取任务目录内 testcase.md；
 * target=main 时读取 docs 根目录下的合并版文档。
 */

import { existsSync, readFileSync } from "fs";
import { basename, dirname } from "path";
import { FIXED_PATH_DOC_TYPES, getDocPath, type DocType } from "../utils/paths.js";
import {
    latestVersion,
    resolveAbbrev,
    resolveAbbrevSafe,
} from "../utils/project.js";

export const docReaderDefinition = {
    description:
        "读取项目管理文档：按标准路径读取 docs 下的文档（project、sad、urs、prd、dbd、api、lld、testcase、task、sql、review、context、cs、ws、ui-test-record、regression-unit、regression-api、rtm、apifox-openapi、apifox-postman 等）。读取任务清单（task）时返回任务摘要与完整内容。",
};

/** 解析任务清单 JSON，返回摘要：总数、按状态计数、未完成任务列表；解析失败返回 null */
function parseTaskSummary(content: string) {
    try {
        const data = JSON.parse(content);
        const tasks = Array.isArray(data) ? data : data?.tasks ?? [];
        const byStatus: Record<string, number> = {};
        const pending: string[] = [];
        for (const t of tasks) {
            const s = t.status ?? "未完成";
            byStatus[s] = (byStatus[s] ?? 0) + 1;
            if (s !== "已完成") {
                pending.push(`#${t.id} ${t.title ?? ""}`.trim());
            }
        }
        return {
            total: tasks.length,
            byStatus,
            pending,
        };
    } catch {
        return null;
    }
}

export function docReaderExecute(args: {
    projectRoot: string;
    docType: string;
    projectName?: string;
    version?: string;
    taskId?: string;
    target?: "version" | "main";
}) {
    try {
        const docType = args.docType as DocType;
        const target = args.target === "main" ? "main" : "version";

        const needsVersion = !FIXED_PATH_DOC_TYPES.includes(docType);
        let abbrev = "";
        let version = args.version;
        if (needsVersion) {
            abbrev = resolveAbbrev(args.projectRoot, args.projectName);
            if (!version) {
                version = latestVersion(args.projectRoot, abbrev) ?? undefined;
                if (!version) {
                    return {
                        success: false,
                        error: `未找到版本目录（docs/${abbrev}-v{x.y.z}）。请先执行 /impm-init 或 /impm-version-create 创建版本目录。`,
                    };
                }
            }
        } else {
            abbrev = resolveAbbrevSafe(args.projectRoot, args.projectName) ?? "";
        }
        version = version ?? "";

        const path = getDocPath(args.projectRoot, abbrev, version, docType, {
            taskId: args.taskId,
            target,
        });

        if (!existsSync(path)) {
            return {
                success: false,
                error: `文档不存在：${path}`,
                hint: `标准路径应为：${basename(dirname(path))}/${basename(path)}。请确认文档类型、版本号与任务编号是否正确，或先执行对应技能生成该文档。`,
            };
        }

        const content = readFileSync(path, "utf8");
        const result: Record<string, unknown> = {
            success: true,
            path,
            docType,
            abbrev,
            version,
            content,
        };
        if (docType === "task") {
            const summary = parseTaskSummary(content);
            if (summary) {
                result.taskSummary = summary;
            }
        }
        return result;
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
