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
 * impm_doc_writer 工具
 * 将文档内容写入标准路径，自动创建父目录。
 * docType 为 task 时自动校验 JSON 格式。
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getDocPath, type DocType } from "../utils/paths.js";
import {
    latestVersion,
    resolveAbbrev,
    resolveAbbrevSafe,
} from "../utils/project.js";

export const docWriterDefinition = {
    description:
        "写入项目管理文档：按标准路径将内容写入 docs 下的文档（project、sad、urs、prd、dbd、api、lld、testcase、task、sql、review、context、cs、ws 等），自动创建目录。docType 为 task 时校验 JSON 合法性。",
};

export function docWriterExecute(args: {
    projectRoot: string;
    docType: string;
    content: string;
    projectName?: string;
    version?: string;
    taskId?: string;
    target?: "version" | "main";
}) {
    try {
        const docType = args.docType as DocType;
        if (args.content === undefined || args.content === null) {
            return { success: false, error: "缺少必填参数 content（文档内容）。" };
        }
        const content = String(args.content);
        const target = args.target === "main" ? "main" : "version";

        // 固定路径文档（project/sad/readme/agent/deploy）无需版本目录，其余文档需解析缩写与版本号
        const needsVersion = !["project", "sad", "readme", "agent", "deploy-build", "deploy-deploy"].includes(docType);
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

        if (docType === "task") {
            try {
                const data = JSON.parse(content);
                const tasks = Array.isArray(data) ? data : data?.tasks;
                if (!Array.isArray(tasks) || tasks.length === 0) {
                    return {
                        success: false,
                        error: "task 文档 JSON 非法：内容需为任务数组，或包含非空 tasks 数组的对象。",
                    };
                }
            } catch {
                return { success: false, error: "task 文档 JSON 解析失败，请检查 JSON 语法。" };
            }
        }

        const path = getDocPath(args.projectRoot, abbrev, version, docType, {
            taskId: args.taskId,
            target,
        });
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content, "utf8");

        return {
            success: true,
            path,
            docType,
            abbrev,
            version,
            bytes: Buffer.byteLength(content, "utf8"),
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
