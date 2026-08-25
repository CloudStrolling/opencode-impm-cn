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
 * opencode-impm 插件入口
 *
 * 这是"我是项目经理"（AI项目经理）OpenCode插件的入口文件。
 * 插件注册了 15 个自定义工具：项目信息、初始化判定、文档读写、模板读取、
 * 版本管理、进度管理、任务调度、上下文构建、项目分析、git 操作，
 * 以及 prompt-recorder 内置功能的 3 个工具（提问记录、token 回填、对话导出）
 * 与 heartbeat 内置功能的 1 个工具（subagent 心跳检测与卡死重启）。
 *
 * 使用方式：
 * 1. npm 包模式：在 opencode.json 中配置 "plugin": ["opencode-impm"]
 * 2. 本地模式：通过 scripts/install.mjs 复制 assets 到 .opencode/，
 *    并在 opencode.json 中配置插件路径。
 */

import { projectInfoDefinition, projectInfoExecute, isInitDefinition, isInitExecute } from "./tools/project-state.js";
import { docReaderDefinition, docReaderExecute } from "./tools/doc-reader.js";
import { docWriterDefinition, docWriterExecute } from "./tools/doc-writer.js";
import { templateReaderDefinition, templateReaderExecute } from "./tools/template-reader.js";
import { versionDefinition, versionExecute } from "./tools/version.js";
import { progressDefinition, progressExecute } from "./tools/progress.js";
import { taskManagerDefinition, taskManagerExecute } from "./tools/task-manager.js";
import { contextBuilderDefinition, contextBuilderExecute } from "./tools/context-builder.js";
import { projectAnalyzerDefinition, projectAnalyzerExecute } from "./tools/project-analyzer.js";
import { gitHelperDefinition, gitHelperExecute } from "./tools/git-helper.js";
import { createPromptRecorder } from "./tools/prompt-recorder.js";
import { createHeartbeatMonitor } from "./tools/heartbeat.js";

/**
 * 创建 OpenCode 工具参数的 schema
 * @param description 参数的中文描述
 */
function createStringSchema(description: string) {
    return { type: "string" as const, description };
}

/** 创建 OpenCode 工具参数的数组 schema（字符串数组） */
function createArraySchema(description: string) {
    return {
        type: "array" as const,
        items: { type: "string" as const },
        description,
    };
}

/**
 * 工具结果适配：opencode v1.18+ 的插件工具桥接层（tool/registry.ts）只接受
 * string 或 { output: string } 两种结果形态，其余字段一律丢弃；
 * 返回普通对象会导致 output=undefined，进而触发 truncate 层 text.split 崩溃
 * （Cannot read properties of undefined (reading 'split')）。
 * 统一把对象结果序列化为 output 字符串。
 */
function toToolResult(result: unknown): unknown {
    if (typeof result === "string") {
        return result;
    }
    if (result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        if (typeof r.output === "string") {
            return result;
        }
    }
    return { output: JSON.stringify(result, null, 2) };
}

/** 包装工具定义：把 execute 返回结果统一转成 opencode 桥接层兼容形态 */
function wrapToolResult(def: {
    description?: string;
    args?: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}) {
    const execute = def.execute;
    return {
        ...def,
        execute: async (args: Record<string, unknown>) => toToolResult(await execute(args)),
    };
}

/** 插件运行上下文：OpenCode 注入的项目路径与工作区目录 */
interface ToolContext {
    project: { path: string };
    directory: string;
    /**
     * OpenCode SDK 客户端（新版插件上下文注入，旧版可能缺失）。
     * 心跳检测用它中止卡死会话（client.session.abort）并向主会话注入续跑指令
     * （client.session.chat）。
     */
    client?: {
        session?: {
            abort?: (arg: unknown) => Promise<unknown>;
            chat?: (arg: unknown, body?: unknown) => Promise<unknown>;
        };
    };
}

/**
 * 插件主函数 — OpenCode 在加载插件时自动调用
 * @param context OpenCode 运行上下文，包含项目路径、工作区等信息
 * @returns 返回工具注册表，OpenCode 会自动注册这些工具供 Agent 使用
 */
export default async function impmPlugin(context: ToolContext) {
    const projectRoot = context.project?.path || context.directory;

    // 内置功能：prompt-recorder（提问记录 + 对话导出，含钩子与 3 个手动工具）
    const promptRecorder = await createPromptRecorder(projectRoot);

    // 内置功能：heartbeat（subagent 心跳检测与自动重启，含钩子与 1 个手动工具）
    const heartbeat = await createHeartbeatMonitor(projectRoot, context.client);

    /** 合并多个 event 钩子处理器：任一失败不影响其他（各钩子内部已自行捕获） */
    const combinedEvent = async (input: { event: unknown }): Promise<void> => {
        await Promise.all([promptRecorder.event(input), heartbeat.event(input)]);
    };

    const tools = {
            /** 项目信息读取工具 — 从 docs/project.md 解析项目基本信息 */
            impm_project_info: {
                description: projectInfoDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                },
                async execute(args: Record<string, unknown>) {
                    return projectInfoExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                    });
                },
            },

            /** 初始化判定工具 — 检查项目是否已初始化、是否为空项目 */
            impm_isinit: {
                description: isInitDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                },
                async execute(args: Record<string, unknown>) {
                    return isInitExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                    });
                },
            },

            /** 文档读取工具 — 从标准路径读取各类项目管理文档 */
            impm_doc_reader: {
                description: docReaderDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    docType: createStringSchema(
                        "文档类型：project | sad | urs | prd | dbd | api | lld | testcase | task | sql | review | context | cs | ws | ui-test-record | regression-unit | regression-api | apifox-openapi | apifox-postman | readme | agent | deploy-build | deploy-deploy",
                    ),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动从 docs/project.md 或版本目录推断）",
                    ),
                    version: createStringSchema(
                        "版本号（可选，不传则自动获取最新版本）",
                    ),
                    taskId: createStringSchema(
                        "任务编号（context/cs/ws 文档必填；testcase 传此参数时读取任务目录内 testcase.md）",
                    ),
                    target: createStringSchema(
                        "读取位置：version=版本目录（默认），main=docs 根目录的合并版文档",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    return docReaderExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        docType: args.docType as string,
                        projectName: args.projectName as string | undefined,
                        version: args.version as string | undefined,
                        taskId: args.taskId as string | undefined,
                        target: args.target as "version" | "main" | undefined,
                    });
                },
            },

            /** 文档写入工具 — 将文档内容写入标准路径，自动创建目录 */
            impm_doc_writer: {
                description: docWriterDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    docType: createStringSchema(
                        "文档类型：project | sad | urs | prd | dbd | api | lld | testcase | task | sql | review | context | cs | ws | ui-test-record | regression-unit | regression-api | apifox-openapi | apifox-postman | readme | agent | deploy-build | deploy-deploy",
                    ),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动从 docs/project.md 或版本目录推断）",
                    ),
                    version: createStringSchema(
                        "版本号（可选，不传则自动使用最新版本）",
                    ),
                    taskId: createStringSchema(
                        "任务编号（context/cs/ws 文档必填；testcase 传此参数时写入任务目录内 testcase.md）",
                    ),
                    target: createStringSchema(
                        "写入位置：version=版本目录（默认），main=docs 根目录的合并版文档",
                    ),
                    expectedBase: createStringSchema(
                        "并发冲突检测基准：写入前读取到的最新全文（可选）。若写入时文件已被其他任务修改（当前内容 ≠ expectedBase），拒绝写入并返回冲突错误，需重新读取合并后再写回",
                    ),
                    content: createStringSchema("文档内容（Markdown 或 JSON 文本）"),
                },
                async execute(args: Record<string, unknown>) {
                    return docWriterExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        docType: args.docType as string,
                        projectName: args.projectName as string | undefined,
                        version: args.version as string | undefined,
                        taskId: args.taskId as string | undefined,
                        target: args.target as "version" | "main" | undefined,
                        expectedBase: args.expectedBase as string | undefined,
                        content: args.content as string,
                    });
                },
            },

            /** 模板读取工具 — 读取标准模板内容 */
            impm_template_reader: {
                description: templateReaderDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    templateName: createStringSchema(
                        "模板名称（如 PROJECT-TEMPLATE.MD、TASK-TEMPLATE.json，可不带扩展名）",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    return templateReaderExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        templateName: args.templateName as string,
                    });
                },
            },

            /** 版本号管理工具 — 获取当前版本、计算下一个版本号、创建版本目录 */
            impm_version: {
                description: versionDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    action: createStringSchema(
                        "操作类型：current=获取当前最新版本号，next=计算下一个版本号（z 值+1），init=创建版本目录",
                    ),
                    hintVersion: createStringSchema(
                        "提示版本号（用户或提示词中已指定版本号时优先使用）",
                    ),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动推断）",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    return versionExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        action: args.action as "current" | "next" | "init",
                        hintVersion: args.hintVersion as string | undefined,
                        projectName: args.projectName as string | undefined,
                    });
                },
            },

            /** 版本进度管理工具 — 创建/记录/查询 version_progress.md */
            impm_progress: {
                description: progressDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    action: createStringSchema(
                        "操作类型：init=创建进度表，add=插入新行，finalize=结算最后一行耗时与token，check=查询步骤状态与整体进度，list=列出全部记录",
                    ),
                    stepName: createStringSchema(
                        "步骤名称（技能名，如 impm-init-urs；add/check 时必填）",
                    ),
                    status: createStringSchema(
                        "步骤状态（如 已完成、执行中、无需数据库、{任务编号}-已完成；add 时使用，默认已完成）",
                    ),
                    version: createStringSchema("版本号"),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动推断）",
                    ),
                    dbPath: createStringSchema(
                        "opencode 数据库路径（可选，默认 ~/.local/share/opencode/opencode.db）",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    return progressExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        action: args.action as "init" | "add" | "finalize" | "check" | "list",
                        stepName: args.stepName as string | undefined,
                        status: args.status as string | undefined,
                        version: args.version as string | undefined,
                        projectName: args.projectName as string | undefined,
                        dbPath: args.dbPath as string | undefined,
                    });
                },
            },

            /** 任务状态管理工具 — 初始化/查询/更新任务清单 */
            impm_task_manager: {
                description: taskManagerDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动推断）",
                    ),
                    version: createStringSchema("版本号"),
                    action: createStringSchema(
                        "操作类型：init=初始化任务清单，query=查询任务，next=获取下一个可执行任务，update=更新任务状态",
                    ),
                    taskId: createStringSchema("任务编号（query/update 时使用）"),
                    status: createStringSchema(
                        "新状态（update 时使用）：未完成 | 执行中 | 已完成",
                    ),
                    taskListJson: createStringSchema(
                        "任务清单 JSON 字符串（init 时必填）",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    return taskManagerExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        projectName: args.projectName as string | undefined,
                        version: args.version as string | undefined,
                        action: args.action as "init" | "query" | "next" | "update",
                        taskId: args.taskId as string | undefined,
                        status: args.status as string | undefined,
                        taskListJson: args.taskListJson as string | undefined,
                    });
                },
            },

            /** 上下文构建工具 — 为编码任务收集相关文档片段 */
            impm_context_builder: {
                description: contextBuilderDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    projectName: createStringSchema(
                        "项目英文缩写（可选，不传时自动推断）",
                    ),
                    version: createStringSchema(
                        "版本号（可选，不传时自动使用最新版本）",
                    ),
                    taskId: createStringSchema("任务编号"),
                },
                async execute(args: Record<string, unknown>) {
                    return contextBuilderExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        projectName: args.projectName as string | undefined,
                        version: args.version as string | undefined,
                        taskId: args.taskId as string,
                    });
                },
            },

            /** 项目结构分析工具 — 扫描源码目录，生成项目地图 */
            impm_project_analyzer: {
                description: projectAnalyzerDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    sourceDirs: createArraySchema(
                        "要扫描的源代码目录（相对项目根目录，如 src、app；不传时自动扫描排除系统目录后的顶层目录）",
                    ),
                    excludeDirs: createArraySchema(
                        "额外排除的目录名（逗号分隔亦可）",
                    ),
                },
                async execute(args: Record<string, unknown>) {
                    const toArray = (v: unknown): string[] | undefined => {
                        if (Array.isArray(v)) {
                            return v.map(String);
                        }
                        if (typeof v === "string" && v.trim()) {
                            return v.split(",").map((s) => s.trim()).filter(Boolean);
                        }
                        return undefined;
                    };
                    return projectAnalyzerExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        sourceDirs: toArray(args.sourceDirs),
                        excludeDirs: toArray(args.excludeDirs),
                    });
                },
            },

            /** Git 操作工具 — 封装分支创建/提交/合并/状态查询等常用操作 */
            impm_git: {
                description: gitHelperDefinition.description,
                args: {
                    projectRoot: createStringSchema("项目根目录的绝对路径"),
                    action: createStringSchema(
                        "操作类型：init=初始化仓库，status=查看状态，branch=创建并切换分支，checkout=切换分支，commit=暂存全部并提交，merge=切回主分支后 squash 合并，current-branch=当前分支，pull=拉取，log=提交记录",
                    ),
                    branchName: createStringSchema("分支名称（branch/checkout/merge 时使用）"),
                    message: createStringSchema("提交消息（commit 时必填）"),
                },
                async execute(args: Record<string, unknown>) {
                    return gitHelperExecute({
                        projectRoot: (args.projectRoot as string) || projectRoot,
                        action: args.action as string,
                        branchName: args.branchName as string | undefined,
                        message: args.message as string | undefined,
                    });
                },
            },

            /** 提问记录工具（prompt-recorder 内置功能）— 补录用户提问 */
            impm_prompt_record: promptRecorder.tool.impm_prompt_record,
            /** 提问记录工具（prompt-recorder 内置功能）— 重算 token 并回填 */
            impm_prompt_finalize: promptRecorder.tool.impm_prompt_finalize,
            /** 提问记录工具（prompt-recorder 内置功能）— 导出对话快照 */
            impm_prompt_export: promptRecorder.tool.impm_prompt_export,
            /** 心跳检测工具（heartbeat 内置功能）— 查看状态/立即扫描/查看告警 */
            impm_heartbeat: heartbeat.tool.impm_heartbeat,
        };

    return {
        /** chat.message 钩子：用户提问时自动记录到 prompts.md */
        "chat.message": promptRecorder.chatMessage,
        /** 事件钩子：主会话回合结束时回填 token、导出对话；subagent 心跳检测与卡死自动重启 */
        event: combinedEvent,
        tool: Object.fromEntries(
            Object.entries(tools).map(([id, def]) => [id, wrapToolResult(def)]),
        ),
    };
}

/**
 * 兼容 ESM 和 CommonJS 的导出方式
 * OpenCode 同时支持 default export 和 named export
 */
export { impmPlugin as plugin };
