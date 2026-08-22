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
 * impm_context_builder 工具
 * 为编码任务收集相关需求信息，构建精简上下文：
 *   任务信息 + 对应用户故事（PRD）+ 项目信息（project.md）+ 系统架构相关章节（sad.md）
 */

import { existsSync, readFileSync } from "fs";
import { getDocPath } from "../utils/paths.js";
import { latestVersion, resolveAbbrev } from "../utils/project.js";

/** 转义正则特殊字符，用于字面量匹配 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const contextBuilderDefinition = {
    description:
        "构建任务编码上下文：按 taskId 汇总任务信息、对应用户故事（从 PRD 提取）、项目信息（project.md）与系统架构相关章节（sad.md），生成精简上下文 Markdown，供编码阶段使用。",
};

/** 按用户故事编号从 PRD 中提取对应章节 */
function extractUserStory(prdContent: string, userStoryId?: string): string {
    if (!userStoryId) {
        return "（任务未关联用户故事 userStoryId）";
    }
    const lines = prdContent.split(/\r?\n/);
    const idToken = userStoryId.trim().toLowerCase();
    // 单词边界精确匹配：避免 US-1 误命中 US-10 / US-12 等章节
    const idPattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(idToken)}([^a-z0-9]|$)`,
    );
    let start = -1;
    let startLevel = 0;
    for (let i = 0; i < lines.length; i++) {
        const m = /^(#{1,6})\s+(.*)$/.exec(lines[i].trim());
        if (m) {
            const heading = m[2].toLowerCase();
            if (start < 0 && idPattern.test(heading)) {
                start = i;
                startLevel = m[1].length;
                break;
            }
        }
    }
    if (start < 0) {
        return `（PRD 中未找到用户故事章节：${userStoryId}）`;
    }
    const block = [lines[start]];
    for (let i = start + 1; i < lines.length; i++) {
        const m = /^(#{1,6})\s+/.exec(lines[i].trim());
        if (m && m[1].length <= startLevel) {
            break;
        }
        block.push(lines[i]);
    }
    return block.join("\n").trim();
}

/** 从 SAD 提取与任务相关的架构章节 */
function extractSadSections(sadContent: string): string {
    const lines = sadContent.split(/\r?\n/);
    // 只保留标题含架构相关关键词的章节
    const KEYWORDS = /总体|架构|模块|接口|数据|技术|目录|流程|安全|部署|环境|设计|约束/;
    const sections: string[] = [];
    let current: string[] = [];
    let currentHeading = "";

    const flush = () => {
        if (currentHeading && current.length > 1) {
            sections.push(currentHeading + "\n" + current.slice(1).join("\n").trim());
        }
        current = [];
        currentHeading = "";
    };

    for (const line of lines) {
        const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
        if (m) {
            flush();
            if (KEYWORDS.test(m[2])) {
                currentHeading = line;
                current = [line];
            }
        } else if (currentHeading) {
            current.push(line);
        }
    }
    flush();

    if (sections.length === 0) {
        return "（sad.md 未找到与任务相关的架构章节）";
    }
    return sections.join("\n\n");
}

export function contextBuilderExecute(args: {
    projectRoot: string;
    taskId: string;
    version?: string;
    projectName?: string;
}) {
    try {
        const taskId = args.taskId?.trim();
        if (!taskId) {
            return { success: false, error: "缺少必填参数 taskId（任务编号）。" };
        }
        const abbrev = resolveAbbrev(args.projectRoot, args.projectName);
        let version = args.version?.trim();
        if (!version) {
            version = latestVersion(args.projectRoot, abbrev) ?? undefined;
            if (!version) {
                return {
                    success: false,
                    error: `未找到版本目录（docs/${abbrev}-v{x.y.z}）。请先执行 /impm-init 或 /impm-version-create 创建版本目录。`,
                };
            }
        }

        // 1. 任务信息
        const taskFile = getDocPath(args.projectRoot, abbrev, version, "task");
        if (!existsSync(taskFile)) {
            return {
                success: false,
                error: `任务清单不存在：${taskFile}。请先执行 /impm-task-create 生成任务清单。`,
            };
        }
        const taskList = JSON.parse(readFileSync(taskFile, "utf8"));
        const tasks = Array.isArray(taskList) ? taskList : taskList?.tasks ?? [];
        const task = tasks.find((t: { id: string }) => String(t.id) === taskId);
        if (!task) {
            return {
                success: false,
                error: `任务不存在：#${taskId}。`,
            };
        }

        // 2. 用户故事（PRD）
        let userStory = "（PRD 文档缺失）";
        const prdPath = getDocPath(args.projectRoot, abbrev, version, "prd");
        if (existsSync(prdPath)) {
            userStory = extractUserStory(readFileSync(prdPath, "utf8"), task.userStoryId);
        }

        // 3. 项目信息（project.md）
        let projectInfo = "（docs/project.md 缺失）";
        const projectPath = getDocPath(args.projectRoot, abbrev, version, "project");
        if (existsSync(projectPath)) {
            projectInfo = readFileSync(projectPath, "utf8");
        }

        // 4. 系统架构相关章节（sad.md）
        let sadSections = "（docs/sad.md 缺失）";
        const sadPath = getDocPath(args.projectRoot, abbrev, version, "sad");
        if (existsSync(sadPath)) {
            sadSections = extractSadSections(readFileSync(sadPath, "utf8"));
        }

        const context = [
            `# 任务上下文（#${task.id} ${task.title ?? ""}）`,
            "",
            "## 1. 任务信息",
            "",
            "```json",
            JSON.stringify(task, null, 2),
            "```",
            "",
            "## 2. 用户需求",
            "",
            userStory,
            "",
            "## 3. 项目信息",
            "",
            projectInfo,
            "",
            "## 4. 系统架构相关",
            "",
            sadSections,
            "",
        ].join("\n");

        return {
            success: true,
            context,
            task,
            taskType: task.taskType ?? "common",
            userStoryId: task.userStoryId ?? null,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
