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
 * opencode-impm 插件入口（opencode 1.x / 2.x 双版本）
 *
 * 采用 opencode 官方迁移指南给出的「一个包同时支持 V1 与 V2」形态：
 * default 导出一个对象，V1 宿主读取其 `server()`，V2 宿主读取 `id` + `setup(ctx)`。
 * 两套 API 相互独立，本入口不做任何跨版本翻译。
 *
 * ```ts
 * export default { ...Plugin.define({ id, setup }), server }
 * ```
 *
 * 实现说明：
 * - **不调用 `Plugin.define`**：它在 2.x 中是 identity function，直接展开对象即可；
 * - **不 import `@opencode/plugin`**（连类型也不 import）：编译期与运行期均零依赖，
 *   1.x 用户无需安装 2.x 的包，且在无法解析该包的网络环境下仍可正常构建。
 *   2.x 契约以本地结构类型描述（见 `host/plugin-types.ts`，与官方类型结构兼容）。
 * - **宿主最低版本 1.18.29**：官方对 V1 object entrypoint 的硬性要求。
 *
 * 使用方式：
 * 1. opencode 1.x：`opencode.json` 中配置 `"plugin": ["opencode-impm-cn"]`
 * 2. opencode 2.x：`opencode.jsonc` 中配置 `"plugins": ["opencode-impm-cn"]`
 *    或执行 `opencode plugin add opencode-impm-cn`
 * 3. 本地模式：`scripts/install.mjs` 复制 assets 到 .opencode/ 并注册插件
 */

import { runV1 } from "./runtime/v1.js";
import type { V1PluginInput } from "./runtime/v1.js";
import { runV2 } from "./runtime/v2.js";
import type { V2Context } from "./runtime/v2.js";
import type { DualVersionPlugin } from "./host/plugin-types.js";

/**
 * 插件标识
 *
 * 2.x 要求每个插件具备稳定 id，用于 `ctx.storage` 作用域与插件状态识别；
 * 1.x 忽略该字段。
 */
const IMPM_PLUGIN_ID = "impm";

/**
 * 2.x 插件定义
 *
 * 手写对象字面量而非调用 `Plugin.define`：保持零依赖。
 */
const definition = {
    id: IMPM_PLUGIN_ID,
    setup: (ctx: V2Context) => runV2(ctx),
};

/**
 * 双版本插件导出
 *
 * - 2.x：读取 `id` 与 `setup(ctx)`
 * - 1.x（≥1.18.29）：读取 `server(input)` 并使用其返回的 `{tool, "chat.message", event}`
 */
const plugin: DualVersionPlugin = {
    ...definition,
    server: (input: unknown) => runV1(input as V1PluginInput),
};

export default plugin;