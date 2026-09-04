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
 * scripts/install-core.mjs 模块类型声明
 *
 * install-core.mjs 是 ESM 安装核心逻辑（与 install.mjs CLI 入口共用），
 * 插件入口（src/index.ts）在启动时动态 import 它以执行版本感知的资产同步。
 * 该文件位于 src 之外，无法通过 rootDir 静态引用，故在此声明其导出类型。
 */

/** runInstall 参数 */
export interface RunInstallOptions {
    /** 插件包根目录（含 assets/、dist/、scripts/） */
    pluginRoot: string;
    /** 目标项目根目录（assets 复制到 projectRoot/.opencode/） */
    projectRoot: string;
    /** 当前插件版本号（写入 manifest） */
    version: string;
    /** agent 模型预设类型（空=不调整 agent 配置） */
    agentType?: string;
}

declare module "*/install-core.mjs" {
    export function runInstall(options: {
        pluginRoot: string;
        projectRoot: string;
        version: string;
        agentType?: string;
    }): boolean;
    export function loadManifest(
        opencodeDir: string,
    ): null | Record<string, unknown>;
    export function saveManifest(
        opencodeDir: string,
        manifest: Record<string, unknown>,
    ): void;
    export const AGENT_TYPES: string[];
}
