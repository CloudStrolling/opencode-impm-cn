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
 * 插件包根目录定位与资产自愈安装
 *
 * 编译产物位于 `{包根}/dist/**`，但 `dist/` 下的模块深度会随代码组织变化
 * （早期为 `dist/index.js`，引入 runtime/ 后为 `dist/runtime/v1.js`），
 * 因此不能按固定层级 `join(__dirname, "../..")` 推导包根。
 *
 * 改为从当前模块所在目录逐级向上查找「name 为 opencode-impm-cn 的 package.json」，
 * 命中即为插件包根目录；未命中时回退到两级父目录并保持旧行为。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { log } from "./log.js";
import type { HostMajor } from "./detect.js";

/** 插件包名（用于识别包根 package.json） */
const PACKAGE_NAME = "opencode-impm-cn";

/** 最多向上查找的层级 */
const MAX_LOOKUP_DEPTH = 5;

/** 向上查找包根 package.json 是否为本插件 */
function isPluginPackageJson(filePath: string): boolean {
    try {
        const pkg = JSON.parse(readFileSync(filePath, "utf-8")) as { name?: string };
        return pkg.name === PACKAGE_NAME;
    } catch {
        return false;
    }
}

/**
 * 解析插件包根目录（含 assets/、dist/、scripts/、package.json）
 *
 * @param fromUrl 调用方模块的 import.meta.url
 * @returns 插件包根目录绝对路径
 */
export function resolvePluginRoot(fromUrl: string): string {
    let dir = dirname(fileURLToPath(fromUrl));
    const root = parse(dir).root;

    for (let depth = 0; depth < MAX_LOOKUP_DEPTH; depth++) {
        if (isPluginPackageJson(join(dir, "package.json"))) {
            return dir;
        }
        if (dir === root) {
            break;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }

    // 回退：dist/<子目录>/x.js → 上溯两级
    return dirname(dirname(dir));
}

/**
 * 读取当前插件版本号
 *
 * @param pluginRoot 插件包根目录
 * @returns 版本号，读取失败返回空串
 */
export function getPluginVersion(pluginRoot: string): string {
    try {
        const pkg = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf-8")) as {
            version?: string;
        };
        return pkg.version || "";
    } catch {
        return "";
    }
}

/** 安装清单中与宿主版本相关的字段 */
interface ManifestLike {
    installedVersion?: string;
    hostMajor?: number;
}

/**
 * 确保目标项目已安装 impm 资产（agents/commands/skills）
 *
 * 双条件自检：插件版本一致 **且** 宿主主版本一致才跳过（零开销）。
 * 任一变化（首次安装 / 插件升级 / 用户从 1.x 跨到 2.x）都重跑完整安装，
 * 使 opencode.json 的 `plugin`/`plugins`、`agent`/`agents` 键与当前宿主匹配。
 *
 * 背景：opencode 通过 npm 自动安装插件时（ignoreScripts:true）不会执行 postinstall，
 * 因此本插件必须在入口函数启动时自检，保证 assets 始终与插件版本同步。
 *
 * @param projectRoot 目标项目根目录（assets 复制到其 .opencode/）
 * @param hostMajor 宿主主版本号
 * @param pluginRoot 插件包根目录
 */
export async function ensureInstalled(
    projectRoot: string,
    hostMajor: HostMajor,
    pluginRoot: string,
): Promise<void> {
    if (!projectRoot) {
        return;
    }
    try {
        const manifestPath = join(projectRoot, ".opencode", "impm-manifest.json");
        const currentVersion = getPluginVersion(pluginRoot);

        // 读取已安装版本（manifest 不存在或损坏视为首次安装）
        let installedVersion = "";
        let installedHostMajor = 0;
        if (existsSync(manifestPath)) {
            try {
                const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestLike;
                installedVersion = m.installedVersion || "";
                installedHostMajor = m.hostMajor || 0;
            } catch {
                /* 忽略损坏清单，按首次安装处理 */
            }
        }

        // 版本一致且宿主主版本一致 → 跳过
        if (installedVersion === currentVersion && installedHostMajor === hostMajor) {
            return;
        }

        // 动态加载安装核心逻辑执行完整安装
        const corePath = pathToFileURL(join(pluginRoot, "scripts", "install-core.mjs")).href;
        const core = (await import(corePath)) as {
            runInstall: (opts: {
                pluginRoot: string;
                projectRoot: string;
                version: string;
                agentType?: string;
                hostMajor?: HostMajor;
            }) => boolean;
        };
        core.runInstall({
            pluginRoot,
            projectRoot,
            version: currentVersion,
            hostMajor,
        });
    } catch (err) {
        // 安装失败不阻断插件加载：记录警告，插件其余功能照常可用
        log("warn", `自动安装资产失败（将在下次启动重试）: ${(err as Error)?.message ?? err}`);
    }
}