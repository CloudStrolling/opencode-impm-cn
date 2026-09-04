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
 * opencode-impm-cn 安装脚本（CLI 入口）
 *
 * 将 assets/ 下的 agents、commands、skills 复制到目标项目的 .opencode/ 目录，
 * 并将编译后的插件复制到 .opencode/plugins/impm/（opencode 自动加载本地插件）。
 *
 * 使用场景：
 *   1. 本地开发安装：npm install（postinstall 自动调用，安装到当前项目）
 *   2. 作为 npm 依赖安装：在消费方项目中 npm install opencode-impm-cn（postinstall 自动调用）
 *   3. 手动指定目标：node scripts/install.mjs --target /path/to/project
 *   4. 全局安装：node scripts/install.mjs --global（安装到 opencode 全局配置目录）
 *
 * 检测逻辑：
 *   - 如果 --global 参数存在，安装到 opencode 全局配置目录（~/.config/opencode）
 *   - 如果 --target 参数指定了路径，安装到该路径
 *   - 如果 INIT_CWD 环境变量存在且不等于当前包目录，安装到 INIT_CWD（npm 依赖安装场景）
 *   - 否则，安装到当前工作目录（本地开发安装场景）
 *
 * 模型配置预设（--agent-type）：
 *   - 可选值：opencode-zen-free / opencode-go-lite / opencode-go-balance /
 *             opencode-go-optimize / custom / clear
 *   - 每个预设对应一套 agent 的 model + reasoning_effort 设置，定义在 scripts/agent-models.json。
 *   - 传入数据不存在时报错退出。
 *   - custom 预设为手工维护：安装时若目标 opencode.json 已有该 agent 的模型配置则保留，
 *     仅对缺失的 agent 按预设补齐（更新插件不影响 custom 手工设置）。
 *   - clear 为特殊值：清理 opencode.json 中 impm 管理的 agent 模型配置，不写入任何设置。
 *   - 不传 --agent-type：完全不调整 opencode.json 中 agent 的设置。
 *
 * 幂等安装：
 *   - 维护累积安装清单 .opencode/impm-manifest.json（everInstalled 只增不减），
 *     安装时按清单精确清理历史已移除/更名的残留（含 agents 等非 impm 前缀命名项）；
 *   - 首次安装（无清单）时按启发式清理（commands/skills 按 impm* 前缀、各目录按与源同名）；
 *   - 插件 dist 复制前会整体删除旧的 plugins/impm 目录与入口文件，避免残留废弃文件。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { runInstall } from "./install-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_ROOT = resolve(__dirname, "..");

/** 全局安装目标：opencode 全局配置目录 */
const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "opencode");

/** 去除 UTF-8 BOM（Windows 编辑器常写入 BOM，直接 JSON.parse 会失败） */
function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 JSON 文件（自动去除 BOM） */
function readJsonFile(filePath) {
    return JSON.parse(stripBom(readFileSync(filePath, "utf-8")));
}

/** 读取当前插件版本号 */
function getCurrentVersion() {
    const pkgPath = join(PLUGIN_ROOT, "package.json");
    if (!existsSync(pkgPath)) {
        return "";
    }
    try {
        return readJsonFile(pkgPath).version || "";
    } catch {
        return "";
    }
}

/** 解析 --agent-type 参数（同时兼容 --agent_type 写法） */
function resolveAgentType(args) {
    for (const flag of ["--agent-type", "--agent_type"]) {
        const idx = args.indexOf(flag);
        if (idx !== -1 && idx + 1 < args.length) {
            return args[idx + 1];
        }
    }
    return "";
}

/** 解析后的路径是否相同：Windows（大小写不敏感文件系统）忽略大小写比较 */
function sameResolvedPath(a, b) {
    const pa = resolve(a);
    const pb = resolve(b);
    return process.platform === "win32"
        ? pa.toLowerCase() === pb.toLowerCase()
        : pa === pb;
}

/** 解析安装目标项目：--global 优先，其次 --target，其次 INIT_CWD（npm 依赖安装场景，排除插件自身目录），最后回退到当前目录 */
function resolveTargetProject(args) {
    if (args.includes("--global")) {
        return GLOBAL_CONFIG_DIR;
    }

    const targetIndex = args.indexOf("--target");
    if (targetIndex !== -1 && targetIndex + 1 < args.length) {
        const target = args[targetIndex + 1];
        return isAbsolute(target) ? target : resolve(process.cwd(), target);
    }

    const initCwd = process.env.INIT_CWD;
    if (initCwd) {
        if (!sameResolvedPath(initCwd, PLUGIN_ROOT)) {
            return resolve(initCwd);
        }
    }

    return process.cwd();
}

// ─── 主流程 ─────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    const isGlobal = args.includes("--global");
    const agentType = resolveAgentType(args);
    const targetRoot = resolveTargetProject(args);
    const version = getCurrentVersion();

    console.log("============================================");
    console.log("  opencode-impm-cn 安装脚本");
    console.log("============================================");
    console.log("");
    console.log(`插件目录: ${PLUGIN_ROOT}`);
    console.log(`目标项目: ${targetRoot}${isGlobal ? "（全局安装）" : ""}`);
    console.log(`agent-type: ${agentType || "（未指定，不调整 opencode.json 中 agent 的设置）"}`);
    console.log("");

    runInstall({
        pluginRoot: PLUGIN_ROOT,
        projectRoot: targetRoot,
        version,
        agentType,
    });
}

main();
