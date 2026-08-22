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
 * 项目信息工具：解析 docs/project.md 的关键字段，推断项目英文缩写。
 */

import { existsSync, readFileSync } from "fs";
import { readdirSync } from "fs";
import { join } from "path";
import { compareVersions } from "./version.js";
import { docsRoot, scanVersionDirs } from "./paths.js";

export interface ProjectInfo {
    nameCn: string;
    nameEn: string;
    abbrev: string;
    language: string;
    type: string;
    description: string;
    database: string;
}

/** project.md 字段名 → 解析正则映射表（逐行匹配） */
const FIELD_MAP: Array<[keyof ProjectInfo, RegExp]> = [
    ["nameCn", /^\*{0,2}项目中文名称\*{0,2}\s*[:：]\s*(.+)$/],
    ["nameEn", /^\*{0,2}项目英文名称\*{0,2}\s*[:：]\s*(.+)$/],
    ["abbrev", /^\*{0,2}项目英文缩写\*{0,2}\s*[:：]\s*(\S+)$/],
    ["language", /^\*{0,2}编程语言\*{0,2}\s*[:：]\s*(.+)$/],
    ["type", /^\*{0,2}项目类型\*{0,2}\s*[:：]\s*(.+)$/],
    ["description", /^\*{0,2}总体介绍\*{0,2}\s*[:：]\s*(.+)$/],
    ["database", /^\*{0,2}数据库产品\*{0,2}\s*[:：]\s*(.+)$/],
];

/** 读取 docs/project.md 并解析关键字段 */
export function readProjectInfo(projectRoot: string): ProjectInfo {
    const file = join(docsRoot(projectRoot), "project.md");
    if (!existsSync(file)) {
        throw new Error(
            "docs/project.md 不存在。请先执行 /impm-init-project（或 /impm-init）完成项目初始化。",
        );
    }
    const content = readFileSync(file, "utf8");
    const info: ProjectInfo = {
        nameCn: "",
        nameEn: "",
        abbrev: "",
        language: "",
        type: "",
        description: "",
        database: "",
    };
    for (const line of content.split(/\r?\n/)) {
        for (const [key, re] of FIELD_MAP) {
            const m = re.exec(line.trim());
            if (m) {
                info[key] = m[1].trim();
            }
        }
    }
    // 文档中未填写缩写时，尝试从版本目录名（docs/{缩写}-v{x.y.z}）反推
    if (!info.abbrev) {
        const inferred = inferAbbrevFromDirs(projectRoot);
        if (inferred) {
            info.abbrev = inferred;
        }
    }
    return info;
}

/** 从版本目录名推断缩写：docs/{缩写}-v{x.y.z} */
export function inferAbbrevFromDirs(projectRoot: string): string | null {
    const docs = docsRoot(projectRoot);
    if (!existsSync(docs)) {
        return null;
    }
    for (const name of readdirSync(docs)) {
        // 缩写大小写不敏感，与 resolveAbbrev 允许的字符集对齐
        const m = /^([a-z0-9_-]+)-v\d+\.\d+\.\d+$/i.exec(name);
        if (m) {
            return m[1];
        }
    }
    return null;
}

/**
 * 解析项目英文缩写，优先级：
 *   1. projectName 参数（若为 ASCII 标识符，如 impm）
 *   2. docs/project.md 中填写的项目英文缩写
 *   3. 从版本目录名推断（docs/{缩写}-v{x.y.z}）
 */
export function resolveAbbrev(
    projectRoot: string,
    projectName?: string,
): string {
    if (projectName && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(projectName.trim())) {
        return projectName.trim();
    }
    try {
        const info = readProjectInfo(projectRoot);
        if (info.abbrev) {
            return info.abbrev;
        }
    } catch {
        // project.md 不存在，继续尝试其他方式
    }
    const inferred = inferAbbrevFromDirs(projectRoot);
    if (inferred) {
        return inferred;
    }
    throw new Error(
        "无法确定项目英文缩写：请提供 projectName（项目英文缩写）参数，或先执行 /impm-init-project 生成 docs/project.md。",
    );
}

/** 不抛异常的缩写解析（解析失败返回 null） */
export function resolveAbbrevSafe(
    projectRoot: string,
    projectName?: string,
): string | null {
    try {
        return resolveAbbrev(projectRoot, projectName);
    } catch {
        return null;
    }
}

/** 获取当前最新版本号（无版本目录时返回 null） */
export function latestVersion(
    projectRoot: string,
    abbrev: string,
): string | null {
    const versions = scanVersionDirs(projectRoot, abbrev);
    if (versions.length === 0) {
        return null;
    }
    let max = versions[0];
    for (const v of versions.slice(1)) {
        if (compareVersions(v, max) > 0) {
            max = v;
        }
    }
    return max;
}

/** 项目信息转为展示文本 */
export function formatProjectInfo(info: ProjectInfo): string {
    return [
        `项目中文名称：${info.nameCn || "（未填写）"}`,
        `项目英文名称：${info.nameEn || "（未填写）"}`,
        `项目英文缩写：${info.abbrev || "（未填写）"}`,
        `编程语言：${info.language || "（未填写）"}`,
        `项目类型：${info.type || "（未填写）"}`,
        `数据库产品：${info.database || "（未填写）"}`,
    ].join("\n");
}
