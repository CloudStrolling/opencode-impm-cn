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
 * impm_project_info / impm_isinit 工具
 *
 * - impm_project_info：读取 docs/project.md 解析项目基本信息。
 * - impm_isinit：检查项目是否已初始化（project.md / sad.md 是否存在），
 *   并判断是否为空项目（除系统目录外无任何源码文件）。
 */

import { existsSync } from "fs";
import { join } from "path";
import { EXCLUDED_DIRS, listFilesRecursive } from "../utils/paths.js";
import { formatProjectInfo, readProjectInfo } from "../utils/project.js";

export const projectInfoDefinition = {
    description:
        "读取项目基本信息：从 docs/project.md 解析项目中文名称、英文名称、英文缩写、编程语言、项目类型、总体介绍。初始化阶段获取项目英文缩写、确定初始化方式时使用。",
};

export function projectInfoExecute(args: { projectRoot: string }) {
    try {
        const info = readProjectInfo(args.projectRoot);
        return {
            success: true,
            ...info,
            formatted: formatProjectInfo(info),
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export const isInitDefinition = {
    description:
        "检查项目是否已初始化：判断 docs/project.md 与 docs/sad.md 是否存在且非空，并扫描项目根目录判断是否为空项目（排除 node_modules、.git、docs 等系统目录后无任何文件）。初始化阶段判定项目类型（空项目/存量项目）时使用。",
};

export function isInitExecute(args: { projectRoot: string }) {
    try {
        const root = args?.projectRoot?.trim();
        if (!root) {
            return {
                success: false,
                error: "缺少必填参数 projectRoot（项目根目录的绝对路径）。",
            };
        }
        const projectMdPath = join(root, "docs", "project.md");
        const sadMdPath = join(root, "docs", "sad.md");

        const projectMdExists = existsSync(projectMdPath);
        const sadMdExists = existsSync(sadMdPath);

        let files: string[] = [];
        try {
            files = listFilesRecursive(root).filter((f) => {
                if (typeof f !== "string") {
                    return false;
                }
                const parts = f.split(/[\\/]/);
                return !parts.some((p) => EXCLUDED_DIRS.includes(p));
            });
        } catch {
            files = [];
        }

        return {
            success: true,
            initialized: projectMdExists && sadMdExists,
            projectMd: projectMdExists,
            sadMd: sadMdExists,
            emptyProject: files.length === 0,
            sourceFileCount: files.length,
            hint:
                projectMdExists && sadMdExists
                    ? "项目已初始化，直接进入对应流程阶段。"
                    : "项目未初始化，需执行 /impm-init 完成初始化；空项目按标准结构写入，存量项目按存量代码反推补全。",
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
