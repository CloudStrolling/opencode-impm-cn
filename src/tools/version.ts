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
 * impm_version 工具
 * 版本号管理：current 获取当前最新版本号，next 计算下一个版本号（z 值 +1），
 * init 创建版本目录 docs/{缩写}-v{版本号}。
 * 版本目录名规范：{项目英文缩写}-v{x.y.z}（x.y.z 为版本号）。
 */

import { existsSync, mkdirSync } from "fs";
import { normalizeVersion, scanVersionDirs, versionDir } from "../utils/paths.js";
import { incrementPatch, isValidVersion } from "../utils/version.js";
import { latestVersion, resolveAbbrev } from "../utils/project.js";

export const versionDefinition = {
    description:
        "版本号管理：action=current 获取 docs 下当前最新版本号；action=next 在最大版本号 z 值上 +1（可传 hintVersion 指定版本号）；action=init 创建版本目录 docs/{项目英文缩写}-v{版本号}（传 hintVersion 时使用指定版本号，否则自动取下一个版本号）。创建版本目录、确定当前版本号时使用。",
};

function pickVersion(args: {
    projectRoot: string;
    abbrev: string;
    hintVersion?: string;
}): string | null {
    const latest = latestVersion(args.projectRoot, args.abbrev);
    const hint = args.hintVersion?.trim();
    if (hint) {
        const v = normalizeVersion(hint);
        if (isValidVersion(v)) {
            return v;
        }
        return null;
    }
    if (latest) {
        return incrementPatch(latest);
    }
    return "0.0.1";
}

export function versionExecute(args: {
    projectRoot: string;
    action: "current" | "next" | "init";
    hintVersion?: string;
    projectName?: string;
}) {
    try {
        const abbrev = resolveAbbrev(args.projectRoot, args.projectName);
        const action = args.action;

        if (action === "current") {
            const latest = latestVersion(args.projectRoot, abbrev);
            return {
                success: true,
                action,
                abbrev,
                version: latest,
                versionDir: latest
                    ? versionDir(args.projectRoot, abbrev, latest)
                    : null,
                versions: listAll(args.projectRoot, abbrev),
                message: latest
                    ? `当前最新版本号为 ${latest}。`
                    : "未找到版本目录，请执行 /impm-init 或 /impm-version-create 创建版本目录。",
            };
        }

        if (action === "next") {
            const next = pickVersion({
                projectRoot: args.projectRoot,
                abbrev,
                hintVersion: args.hintVersion,
            });
            if (!next) {
                return {
                    success: false,
                    action,
                    error: "hintVersion 版本号格式非法（应为 x.y.z）。",
                };
            }
            return {
                success: true,
                action,
                abbrev,
                version: next,
                versionDir: versionDir(args.projectRoot, abbrev, next),
                message: `下一个版本号为 ${next}。`,
            };
        }

        if (action === "init") {
            const version = pickVersion({
                projectRoot: args.projectRoot,
                abbrev,
                hintVersion: args.hintVersion,
            });
            if (!version) {
                return {
                    success: false,
                    action,
                    error: "hintVersion 版本号格式非法（应为 x.y.z）。",
                };
            }
            const dir = versionDir(args.projectRoot, abbrev, version);
            const existed = existsSync(dir);
            if (!existed) {
                mkdirSync(dir, { recursive: true });
            }
            return {
                success: true,
                action,
                abbrev,
                version,
                versionDir: dir,
                created: !existed,
                message: existed
                    ? `版本目录已存在：${dir}`
                    : `已创建版本目录：${dir}`,
            };
        }

        return { success: false, error: `未知 action：${action}（应为 current/next/init）` };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

function listAll(projectRoot: string, abbrev: string): string[] {
    return scanVersionDirs(projectRoot, abbrev).sort(compareDesc);
}

function compareDesc(a: string, b: string): number {
    return b.localeCompare(a, undefined, { numeric: true });
}
