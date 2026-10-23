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
 * 自定义工具的单一属性表与双形态 schema 派生
 *
 * opencode 1.x 与 2.x 的工具入参 schema 形态不同：
 * - 1.x：工具定义的 `args` 直接是「属性名 → JSON-Schema 分片」的映射
 * - 2.x：工具定义的 `input` 必须是完整 JSON Schema（`type:"object"` + `properties` + `additionalProperties`）
 *
 * 为避免两版本各维护一份描述（易漂移），本模块以**单一属性表** `STATIC_TOOL_DEFS`
 * 为唯一事实来源，由 `toV1Args()` / `toV2Input()` 分别派生两种形态。
 *
 * prompt-recorder 的 3 个工具与 heartbeat 的 1 个工具由各自工厂动态创建、
 * 已自带 1.x 形态定义，通过 `adaptDynamicTool()` 适配为 2.x 形态。
 */

import { projectInfoDefinition, projectInfoExecute, isInitDefinition, isInitExecute } from "./project-state.js";
import { docReaderDefinition, docReaderExecute } from "./doc-reader.js";
import { docWriterDefinition, docWriterExecute } from "./doc-writer.js";
import { templateReaderDefinition, templateReaderExecute } from "./template-reader.js";
import { versionDefinition, versionExecute } from "./version.js";
import { progressDefinition, progressExecute } from "./progress.js";
import { taskManagerDefinition, taskManagerExecute } from "./task-manager.js";
import { contextBuilderDefinition, contextBuilderExecute } from "./context-builder.js";
import { projectAnalyzerDefinition, projectAnalyzerExecute } from "./project-analyzer.js";
import { gitHelperDefinition, gitHelperExecute } from "./git-helper.js";
import type { SessionPort } from "../host/session.js";

/** 单个参数的 JSON-Schema 分片 */
export interface PropSchema {
    type: "string" | "array";
    items?: { type: "string" };
    description: string;
}

/** 参数表：参数名 → JSON-Schema 分片 */
export type PropSchemas = Record<string, PropSchema>;

/** opencode 2.x 工具入参的完整 JSON Schema */
export interface V2InputSchema {
    type: "object";
    properties: PropSchemas;
    additionalProperties: false;
}

/** 工具执行所需的平台无关端口 */
export interface ToolPorts {
    /** 项目根目录（宿主注入，供未显式传参时兜底） */
    projectRoot: string;
    /** 会话控制端口（heartbeat 等功能使用） */
    sessionPort?: SessionPort;
}

/** 工具业务执行体：接收已装配的参数与端口 */
export type ToolRunner = (args: Record<string, unknown>, ports: ToolPorts) => unknown;

/** 工具定义 */
export interface ToolDef {
    /** 工具名（两版本一致，避免模型行为漂移） */
    name: string;
    /** 工具描述（两版本一致） */
    description: string;
    /** 参数表（唯一事实来源） */
    props: PropSchemas;
    /** 业务执行体 */
    run: ToolRunner;
}

/** 便捷构造：字符串参数 */
function str(description: string): PropSchema {
    return { type: "string", description };
}

/** 便捷构造：字符串数组参数 */
function arr(description: string): PropSchema {
    return { type: "array", items: { type: "string" }, description };
}

/** 文档类型枚举说明（doc_reader / doc_writer 共用） */
const DOC_TYPE_DESC =
    "文档类型：project | sad | urs | prd | dbd | api | lld | testcase | task | sql | review | context | cs | ws | ui-test-record | regression-unit | regression-api | regression | rtm | apifox-openapi | apifox-postman | openapi | swagger | readme | agent | deploy-build | deploy-deploy";

const PROJECT_ROOT_DESC = "项目根目录的绝对路径";
const PROJECT_NAME_DESC = "项目英文缩写（可选，不传时自动从 docs/project.md 或版本目录推断）";

/** 把模型可能传入的「数组或逗号分隔字符串」统一为字符串数组 */
function toArrayArg(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return undefined;
}

/**
 * 11 个静态工具的单一属性表
 *
 * 参数名、描述、默认值兜底逻辑均与改造前逐字一致，确保 1.x 下行为零回归，
 * 同时作为 2.x 的 schema 来源。
 */
export const STATIC_TOOL_DEFS: ToolDef[] = [
    {
        name: "impm_project_info",
        description: projectInfoDefinition.description,
        props: { projectRoot: str(PROJECT_ROOT_DESC) },
        run: (args, ports) =>
            projectInfoExecute({ projectRoot: (args.projectRoot as string) || ports.projectRoot }),
    },
    {
        name: "impm_isinit",
        description: isInitDefinition.description,
        props: { projectRoot: str(PROJECT_ROOT_DESC) },
        run: (args, ports) =>
            isInitExecute({ projectRoot: (args.projectRoot as string) || ports.projectRoot }),
    },
    {
        name: "impm_doc_reader",
        description: docReaderDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            docType: str(DOC_TYPE_DESC),
            projectName: str(PROJECT_NAME_DESC),
            version: str("版本号（可选，不传则自动获取最新版本）"),
            taskId: str(
                "任务编号（context/cs/ws 文档必填；testcase 传此参数时读取任务目录内 testcase.md）",
            ),
            target: str("读取位置：version=版本目录（默认），main=docs 根目录的合并版文档"),
        },
        run: (args, ports) =>
            docReaderExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                docType: args.docType as string,
                projectName: args.projectName as string | undefined,
                version: args.version as string | undefined,
                taskId: args.taskId as string | undefined,
                target: args.target as "version" | "main" | undefined,
            }),
    },
    {
        name: "impm_doc_writer",
        description: docWriterDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            docType: str(DOC_TYPE_DESC),
            projectName: str(PROJECT_NAME_DESC),
            version: str("版本号（可选，不传则自动使用最新版本）"),
            taskId: str(
                "任务编号（context/cs/ws 文档必填；testcase 传此参数时写入任务目录内 testcase.md）",
            ),
            target: str("写入位置：version=版本目录（默认），main=docs 根目录的合并版文档"),
            expectedBase: str(
                "并发冲突检测基准：写入前读取到的最新全文（可选）。若写入时文件已被其他任务修改（当前内容 ≠ expectedBase），拒绝写入并返回冲突错误，需重新读取合并后再写回",
            ),
            content: str("文档内容（Markdown 或 JSON 文本）"),
        },
        run: (args, ports) =>
            docWriterExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                docType: args.docType as string,
                projectName: args.projectName as string | undefined,
                version: args.version as string | undefined,
                taskId: args.taskId as string | undefined,
                target: args.target as "version" | "main" | undefined,
                expectedBase: args.expectedBase as string | undefined,
                content: args.content as string,
            }),
    },
    {
        name: "impm_template_reader",
        description: templateReaderDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            templateName: str("模板名称（如 PROJECT-TEMPLATE.MD、TASK-TEMPLATE.json，可不带扩展名）"),
        },
        run: (args, ports) =>
            templateReaderExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                templateName: args.templateName as string,
            }),
    },
    {
        name: "impm_version",
        description: versionDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            action: str(
                "操作类型：current=获取当前最新版本号，next=计算下一个版本号（z 值+1），init=创建版本目录",
            ),
            hintVersion: str("提示版本号（用户或提示词中已指定版本号时优先使用）"),
            projectName: str("项目英文缩写（可选，不传时自动推断）"),
        },
        run: (args, ports) =>
            versionExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                action: args.action as "current" | "next" | "init",
                hintVersion: args.hintVersion as string | undefined,
                projectName: args.projectName as string | undefined,
            }),
    },
    {
        name: "impm_progress",
        description: progressDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            action: str(
                "操作类型：init=创建进度表，add=插入新行，finalize=结算最后一行耗时与token，check=查询步骤状态与整体进度，list=列出全部记录",
            ),
            stepName: str("步骤名称（技能名，如 impm-init-urs；add/check 时必填）"),
            status: str(
                "步骤状态（如 已完成、执行中、无需数据库、{任务编号}-已完成；add 时使用，默认已完成）",
            ),
            version: str("版本号"),
            projectName: str("项目英文缩写（可选，不传时自动推断）"),
            dbPath: str("opencode 数据库路径（可选，默认 ~/.local/share/opencode/opencode.db）"),
        },
        run: (args, ports) =>
            progressExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                action: args.action as "init" | "add" | "finalize" | "check" | "list",
                stepName: args.stepName as string | undefined,
                status: args.status as string | undefined,
                version: args.version as string | undefined,
                projectName: args.projectName as string | undefined,
                dbPath: args.dbPath as string | undefined,
            }),
    },
    {
        name: "impm_task_manager",
        description: taskManagerDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            projectName: str("项目英文缩写（可选，不传时自动推断）"),
            version: str("版本号"),
            action: str(
                "操作类型：init=初始化任务清单，query=查询任务，next=获取下一个可执行任务，update=更新任务状态",
            ),
            taskId: str("任务编号（query/update 时使用）"),
            status: str("新状态（update 时使用）：未完成 | 执行中 | 已完成"),
            taskListJson: str("任务清单 JSON 字符串（init 时必填）"),
        },
        run: (args, ports) =>
            taskManagerExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                projectName: args.projectName as string | undefined,
                version: args.version as string | undefined,
                action: args.action as "init" | "query" | "next" | "update",
                taskId: args.taskId as string | undefined,
                status: args.status as string | undefined,
                taskListJson: args.taskListJson as string | undefined,
            }),
    },
    {
        name: "impm_context_builder",
        description: contextBuilderDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            projectName: str(PROJECT_NAME_DESC),
            version: str("版本号（可选，不传则自动使用最新版本）"),
            taskId: str("任务编号"),
        },
        run: (args, ports) =>
            contextBuilderExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                projectName: args.projectName as string | undefined,
                version: args.version as string | undefined,
                taskId: args.taskId as string,
            }),
    },
    {
        name: "impm_project_analyzer",
        description: projectAnalyzerDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            sourceDirs: arr(
                "要扫描的源代码目录（相对项目根目录，如 src、app；不传时自动扫描排除系统目录后的顶层目录）",
            ),
            excludeDirs: arr("额外排除的目录名（逗号分隔亦可）"),
        },
        run: (args, ports) =>
            projectAnalyzerExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                sourceDirs: toArrayArg(args.sourceDirs),
                excludeDirs: toArrayArg(args.excludeDirs),
            }),
    },
    {
        name: "impm_git",
        description: gitHelperDefinition.description,
        props: {
            projectRoot: str(PROJECT_ROOT_DESC),
            action: str(
                "操作类型：init=初始化仓库，status=查看状态，branch=创建并切换分支，checkout=切换分支，commit=暂存全部并提交，merge=切回主分支后 squash 合并，current-branch=当前分支，pull=拉取，log=提交记录",
            ),
            branchName: str("分支名称（branch/checkout/merge 时使用）"),
            message: str("提交消息（commit 时必填）"),
        },
        run: (args, ports) =>
            gitHelperExecute({
                projectRoot: (args.projectRoot as string) || ports.projectRoot,
                action: args.action as string,
                branchName: args.branchName as string | undefined,
                message: args.message as string | undefined,
            }),
    },
];

/**
 * 派生 opencode 1.x 形态的入参 schema
 *
 * 1.x 的 `args` 即属性表本身（宿主按属性名逐个校验）。
 *
 * @param props 参数表
 * @returns 1.x 形态 args
 */
export function toV1Args(props: PropSchemas): PropSchemas {
    return { ...props };
}

/**
 * 派生 opencode 2.x 形态的入参 schema
 *
 * 2.x 要求完整 JSON Schema。官方示例统一带 `additionalProperties:false`，
 * 与其保持一致以获得最严格的参数校验。
 *
 * @param props 参数表
 * @returns 2.x 形态 input
 */
export function toV2Input(props: PropSchemas): V2InputSchema {
    return {
        type: "object",
        properties: { ...props },
        additionalProperties: false,
    };
}

/**
 * 工具执行结果归一化为字符串
 *
 * @param result 业务执行结果
 * @returns 文本形态结果
 */
export function toText(result: unknown): string {
    if (typeof result === "string") {
        return result;
    }
    if (result && typeof result === "object") {
        const output = (result as Record<string, unknown>).output;
        if (typeof output === "string") {
            return output;
        }
    }
    return JSON.stringify(result, null, 2);
}

/**
 * 包装为 opencode 1.x 工具结果
 *
 * 1.18+ 的工具桥接层（tool/registry.ts）只接受 `string` 或 `{output:string}`，
 * 其余字段一律丢弃；返回普通对象会导致 output=undefined 并触发 truncate 层崩溃。
 *
 * @param result 业务执行结果
 * @returns 1.x 形态结果
 */
export function toV1Result(result: unknown): unknown {
    if (typeof result === "string") {
        return result;
    }
    if (result && typeof result === "object") {
        const output = (result as Record<string, unknown>).output;
        if (typeof output === "string") {
            return result;
        }
    }
    return { output: JSON.stringify(result, null, 2) };
}

/**
 * 包装为 opencode 2.x 工具结果
 *
 * 2.x 的 `Tool.Result` 为 `{ output?, content?, metadata? }`，
 * 纯字符串不再被直接接受，统一返回 `{ content }`。
 *
 * @param result 业务执行结果
 * @returns 2.x 形态结果
 */
export function toV2Result(result: unknown): { content: string } {
    return { content: toText(result) };
}

/** 由工厂动态创建的 1.x 形态工具定义 */
export interface DynamicToolDef {
    description?: string;
    args?: Record<string, { type: string; items?: { type: string }; description: string }>;
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

/**
 * 把工厂动态创建的 1.x 工具适配为 2.x 形态
 *
 * prompt-recorder 的 3 个工具与 heartbeat 的 1 个工具由各自工厂创建，
 * 已自带 1.x 形态定义；此处仅做 schema 与结果封装适配，业务逻辑不动。
 *
 * @param name 工具名
 * @param def 1.x 形态定义
 * @returns 2.x 形态工具定义
 */
export function adaptDynamicTool(
    name: string,
    def: DynamicToolDef,
): {
    name: string;
    description: string;
    input: V2InputSchema;
    execute: (input: Record<string, unknown>) => Promise<{ content: string }>;
} {
    const props = (def.args ?? {}) as PropSchemas;
    return {
        name,
        description: def.description ?? name,
        input: toV2Input(props),
        execute: async (input: Record<string, unknown>) => toV2Result(await def.execute(input)),
    };
}