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
 *
 * 并发写入冲突检测（expectedBase）：
 *   编码开发阶段 PM 按阶段波次并发派发子步骤 subagent，多个任务可能同时写同一份
 *   版本目录共享文档（如 testcase/dbd/api/ui-test-record、api-test 脚本）。写入方在
 *   读取到的最新全文基础上合并后写回，可传 expectedBase=读取到的最新全文；若写入时
 *   发现文件已被其他任务修改（当前内容 ≠ expectedBase），则拒绝写入并返回冲突错误
 *   （含当前最新内容），写入方据此重新读取合并后再写回，避免基于旧快照覆盖他人内容。
 *   不传 expectedBase 时保持原有直接覆盖行为（任务私有文件不受影响）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getDocPath, FIXED_PATH_DOC_TYPES, type DocType } from "../utils/paths.js";
import {
    latestVersion,
    resolveAbbrev,
    resolveAbbrevSafe,
} from "../utils/project.js";
import { withFileLock } from "../utils/file-lock.js";

export const docWriterDefinition = {
    description:
        "写入项目管理文档：按标准路径将内容写入 docs 下的文档（project、sad、urs、prd、dbd、api、lld、testcase、task、sql、review、context、cs、ws、ui-test-record、regression-unit、regression-api、regression、rtm、apifox-openapi、apifox-postman 等），自动创建目录。docType 为 task 时校验 JSON 合法性。可选 expectedBase=写入前读取到的最新全文，用于并发冲突检测（文件已被其他任务修改时拒绝写入并返回冲突错误，避免覆盖他人内容）。",
};

export async function docWriterExecute(args: {
    projectRoot: string;
    docType: string;
    content: string;
    projectName?: string;
    version?: string;
    taskId?: string;
    target?: "version" | "main";
    expectedBase?: string;
}) {
    try {
        const docType = args.docType as DocType;
        if (args.content === undefined || args.content === null) {
            return { success: false, error: "缺少必填参数 content（文档内容）。" };
        }
        const content = String(args.content);
        const target = args.target === "main" ? "main" : "version";

        // 固定路径文档（project/sad/readme/agent/deploy）无需版本目录，其余文档需解析缩写与版本号
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

        // 并发写入冲突检测 + 写入整体包在文件锁内执行，保证「读-比较-写」原子性，
        // 消除 TOCTOU 窗口：两个写入者在锁定后依序进入，后者才能看到前者的修改。
        return await withFileLock(path, () => {
            // expectedBase 存在且文件已存在时，若当前内容与写入方基于的旧快照不一致，
            // 说明已被其他并行任务修改，拒绝写入并返回最新内容供重新合并（避免旧快照整体覆盖）
            if (args.expectedBase !== undefined && existsSync(path)) {
                const current = readFileSync(path, "utf8");
                if (current !== args.expectedBase) {
                    return {
                        success: false,
                        conflict: true,
                        error: `并发写入冲突：文档已被其他任务修改，基于旧快照的写入被拒绝。请重新读取该文档最新内容，合并本任务内容后再调用 impm_doc_writer 写回（expectedBase 传最新全文）。文档：${path}`,
                        path,
                        docType,
                        abbrev,
                        version,
                        current,
                    };
                }
            }

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
        });
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
