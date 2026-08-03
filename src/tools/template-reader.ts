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
 * impm_template_reader 工具
 * 按模板名读取模板文件，搜索顺序：
 *   1. 项目根/.opencode/skills/template/
 *   2. 项目根/assets/skills/template/
 *   3. 插件安装目录/assets/skills/template/
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

export const templateReaderDefinition = {
    description:
        "读取模板文件：按模板名从 .opencode/skills/template、assets/skills/template 或插件内置目录读取模板内容（如 PROJECT-TEMPLATE.MD、TASK-TEMPLATE.json 等）。生成各类文档前读取模板时使用。",
};

function matchTemplate(dir: string, base: string): string | null {
    if (!existsSync(dir)) {
        return null;
    }
    for (const name of readdirSync(dir)) {
        if (name.toLowerCase() === base.toLowerCase()) {
            return join(dir, name);
        }
        const [stem] = name.split(".");
        if (stem?.toLowerCase() === base.toLowerCase()) {
            return join(dir, name);
        }
    }
    return null;
}

function listTemplates(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir).filter((n) => !n.startsWith("."));
}

export function templateReaderExecute(args: {
    projectRoot: string;
    templateName: string;
}) {
    try {
        const name = (args.templateName ?? "").trim();
        if (!name) {
            return { success: false, error: "缺少必填参数 templateName（模板名称）。" };
        }
        const base = name.split(".")[0];

        const searchDirs = [
            join(args.projectRoot, ".opencode", "skills", "template"),
            join(args.projectRoot, "assets", "skills", "template"),
            fileURLToPath(new URL("../../assets/skills/template/", import.meta.url)),
        ];

        for (const dir of searchDirs) {
            const found = matchTemplate(dir, base);
            if (found) {
                return {
                    success: true,
                    path: found,
                    templateName: base,
                    content: readFileSync(found, "utf8"),
                };
            }
        }

        const available = new Set<string>();
        for (const dir of searchDirs) {
            for (const t of listTemplates(dir)) {
                available.add(t);
            }
        }
        return {
            success: false,
            error: `模板不存在：${name}`,
            available: [...available],
            hint: "请从可用模板中选择，或确认模板已放入 .opencode/skills/template/ 目录。",
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
