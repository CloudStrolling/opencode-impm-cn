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
 * opencode 2.x 插件契约的本地结构类型
 *
 * 官方 2.x 插件包为 `@opencode/plugin`，其 `Plugin` 类型形如：
 * ```ts
 * export default Plugin.define({ id: "example", async setup(ctx) { ... } })
 * ```
 *
 * 本项目**刻意不 import 该包**（连 type-only 也不 import），原因有二：
 * 1. 运行时零依赖：1.x 用户安装本插件时不应被要求安装 2.x 的包；
 * 2. 构建可用性：`@opencode/plugin` 仅在 2.x 下存在，部分网络环境无法从 npm
 *    解析该包，若编译期硬依赖它会使 `npm install && npm run build` 直接失败。
 *
 * 本文件以结构类型描述本插件实际用到的最小契约面，语义与官方类型一致。
 * 官方类型可用时可直接 `import type { Plugin } from "@opencode/plugin"` 替换
 * （二者结构兼容）。
 */

import type { V2Context } from "../runtime/v2.js";

/** opencode 2.x 插件清理函数：插件卸载时调用，用于终止事件订阅与定时器 */
export type V2Cleanup = () => void;

/** opencode 2.x 插件定义 */
export interface PluginDefinitionV2 {
    /** 稳定且唯一的插件 id，用于 ctx.storage 作用域与插件状态识别 */
    id: string;
    /** 插件初始化：注册工具、钩子、transform 与事件订阅；可返回清理函数 */
    setup: (ctx: V2Context) => Promise<V2Cleanup | void> | V2Cleanup | void;
}

/**
 * V1/V2 双版本插件导出
 *
 * - 2.x 宿主读取 `id` 与 `setup(ctx)`，忽略 `server`
 * - 1.x（≥1.18.29）宿主读取 `server(input)`，忽略 `id` 与 `setup`
 */
export interface DualVersionPlugin extends PluginDefinitionV2 {
    /** opencode 1.x 插件入口 */
    server: (input: unknown) => Promise<unknown>;
}