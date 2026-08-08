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
 * impm 标准路径工具：统一所有文档、脚本、部署文件的路径与命名规则。
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/** 文档类型枚举：决定文档存放路径与命名规则 */
export type DocType =
    | "project"
    | "sad"
    | "urs"
    | "prd"
    | "dbd"
    | "api"
    | "lld"
    | "testcase"
    | "task"
    | "sql"
    | "review"
    | "context"
    | "cs"
    | "ws"
    | "ui-test-record"
    | "regression-unit"
    | "regression-api"
    | "readme"
    | "agent"
    | "deploy-build"
    | "deploy-deploy";

/** 需要版本目录的文档类型 */
export const VERSIONED_DOC_TYPES: DocType[] = [
    "urs",
    "prd",
    "dbd",
    "api",
    "lld",
    "testcase",
];

/** 任务目录内文档类型 */
export const TASK_DOC_TYPES: DocType[] = ["context", "cs", "ws"];

/** 统一版本号格式：去掉 v 前缀，保留 x.y.z */
export function normalizeVersion(version: string): string {
    return version.replace(/^[vV]/, "").trim();
}

/** docs 目录 */
export function docsRoot(projectRoot: string): string {
    return join(projectRoot, "docs");
}

/** 版本目录：docs/{缩写}-v{版本号} */
export function versionDir(
    projectRoot: string,
    abbrev: string,
    version: string,
): string {
    return join(docsRoot(projectRoot), `${abbrev}-v${normalizeVersion(version)}`);
}

/** 任务目录：docs/{缩写}-v{版本号}/task_{任务编号} */
export function taskDir(
    projectRoot: string,
    abbrev: string,
    version: string,
    taskId: string,
): string {
    return join(versionDir(projectRoot, abbrev, version), `task_${taskId}`);
}

/** 版本进度文件：docs/{缩写}-v{版本号}/version_progress.md */
export function progressFilePath(
    projectRoot: string,
    abbrev: string,
    version: string,
): string {
    return join(versionDir(projectRoot, abbrev, version), "version_progress.md");
}

/**
 * 按文档类型返回标准文件路径。
 * docType 为 task 类型文档时返回 {缩写}-task-v{版本}.json；
 * docType 为 context/cs/ws 时必须提供 taskId；
 * docType 为 testcase 且提供 taskId 时返回任务目录内 testcase.md。
 */
export function getDocPath(
    projectRoot: string,
    abbrev: string,
    version: string,
    docType: DocType,
    opts: { taskId?: string; target?: "version" | "main" } = {},
): string {
    const { taskId, target = "version" } = opts;
    switch (docType) {
        case "project":
            return join(docsRoot(projectRoot), "project.md");
        case "sad":
            return join(docsRoot(projectRoot), "sad.md");
        case "readme":
            return join(projectRoot, "readme.md");
        case "agent":
            return join(projectRoot, "agent.md");
        case "deploy-build":
            return join(projectRoot, "deploy", "build.md");
        case "deploy-deploy":
            return join(projectRoot, "deploy", "deploy.md");
        case "context":
        case "cs":
        case "ws":
            if (!taskId) {
                throw new Error(`docType=${docType} 必须提供 taskId`);
            }
            return join(taskDir(projectRoot, abbrev, version, taskId), `${docType}.md`);
        case "testcase":
            if (taskId) {
                return join(taskDir(projectRoot, abbrev, version, taskId), "testcase.md");
            }
            return target === "main"
                ? join(docsRoot(projectRoot), `${abbrev}-testcase.md`)
                : join(
                      versionDir(projectRoot, abbrev, version),
                      `${abbrev}-testcase-v${normalizeVersion(version)}.md`,
                  );
        case "urs":
        case "prd":
        case "dbd":
        case "api":
        case "lld":
            return target === "main"
                ? join(docsRoot(projectRoot), `${abbrev}-${docType}.md`)
                : join(
                      versionDir(projectRoot, abbrev, version),
                      `${abbrev}-${docType}-v${normalizeVersion(version)}.md`,
                  );
        case "sql":
            return target === "main"
                ? join(docsRoot(projectRoot), `${abbrev}-dbd.sql`)
                : join(
                      versionDir(projectRoot, abbrev, version),
                      `${abbrev}-dbd-v${normalizeVersion(version)}.sql`,
                  );
        case "task":
            return join(
                versionDir(projectRoot, abbrev, version),
                `${abbrev}-task-v${normalizeVersion(version)}.json`,
            );
        case "review":
            return join(versionDir(projectRoot, abbrev, version), `${abbrev}-review.md`);
        case "ui-test-record":
            return join(
                versionDir(projectRoot, abbrev, version),
                `${abbrev}-ui-test-record-v${normalizeVersion(version)}.md`,
            );
        case "regression-unit":
            return join(versionDir(projectRoot, abbrev, version), "regression-unit-test.md");
        case "regression-api":
            return join(versionDir(projectRoot, abbrev, version), "regression-api-test.md");
        default:
            throw new Error(`未知文档类型: ${docType}`);
    }
}

/** 版本目录名正则：{项目英文缩写}-v{版本号} */
const VERSION_DIR_RE = /^([a-z0-9_-]+)-v(\d+\.\d+\.\d+)$/;

/** 扫描 docs 下的版本目录，返回版本号列表（不含 v 前缀），按升序 */
export function scanVersionDirs(
    projectRoot: string,
    abbrev?: string,
): string[] {
    const docs = docsRoot(projectRoot);
    if (!existsSync(docs)) {
        return [];
    }
    const versions: string[] = [];
    for (const name of readdirSync(docs)) {
        const m = VERSION_DIR_RE.exec(name);
        if (!m) {
            continue;
        }
        if (abbrev && m[1] !== abbrev) {
            continue;
        }
        versions.push(m[2]);
    }
    return versions;
}

/** 判断目录是否为空（无任何文件） */
export function isDirEmpty(dir: string): boolean {
    if (!existsSync(dir)) {
        return true;
    }
    // 忽略隐藏文件后无任何条目即视为空目录
    const entries = readdirSync(dir).filter((n) => !n.startsWith("."));
    return entries.length === 0;
}

/** 递归列出目录下所有文件（防御性：跳过非法条目，限制递归深度防止符号链接/交接点循环） */
export function listFilesRecursive(dir: string, depth = 0): string[] {
    if (typeof dir !== "string" || !dir || !existsSync(dir) || depth > 64) {
        return [];
    }
    const files: string[] = [];
    for (const name of readdirSync(dir)) {
        if (typeof name !== "string") {
            continue;
        }
        const full = join(dir, name);
        try {
            if (statSync(full).isDirectory()) {
                files.push(...listFilesRecursive(full, depth + 1));
            } else {
                files.push(full);
            }
        } catch {
            // 忽略无法访问的条目
        }
    }
    return files;
}

export { existsSync };
