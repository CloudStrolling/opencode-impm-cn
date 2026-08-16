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
 * opencode-impm-cn 安装脚本
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
 *             opencode-go-optimize / custom
 *   - 每个预设对应一套 agent 的 model + reasoning_effort 设置，定义在 scripts/agent-models.json。
 *   - 传入数据不存在时报错退出。
 *   - custom 预设为手工维护：安装时若目标 opencode.json 已有该 agent 的模型配置则保留，
 *     仅对缺失的 agent 按预设补齐（更新插件不影响 custom 手工设置）。
 *   - 不传 --agent-type：清理 opencode.json 中 impm 管理的 agent 模型配置，不写入任何设置。
 *
 * 幂等安装：
 *   - assets 复制前会清空目标目录；
 *   - 插件 dist 复制前会整体删除旧的 plugins/impm 目录与入口文件，避免残留废弃文件。
 */

import {
    cpSync,
    mkdirSync,
    existsSync,
    readdirSync,
    readFileSync,
    writeFileSync,
    rmSync,
} from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 路径常量：插件根目录、可分发资源目录、TypeScript 编译产物目录
const PLUGIN_ROOT = resolve(__dirname, "..");
const ASSETS_DIR = join(PLUGIN_ROOT, "assets");
const DIST_DIR = join(PLUGIN_ROOT, "dist");

const ASSET_DIRS = ["commands", "agents", "skills"];
const PACKAGE_NAME = "opencode-impm-cn";
/** 安装时默认注册的插件（impm 套件 + 浏览器插件，供 UI/网络相关技能使用） */
const DEFAULT_PLUGINS = [PACKAGE_NAME, "opencode-browser"];

/** 全局安装目标：opencode 全局配置目录 */
const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "opencode");

/** --agent-type 可选值 */
const AGENT_TYPES = [
    "opencode-zen-free",
    "opencode-go-lite",
    "opencode-go-balance",
    "opencode-go-optimize",
    "custom",
];

/** 去除 UTF-8 BOM（Windows 编辑器常写入 BOM，直接 JSON.parse 会失败） */
function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 JSON 文件（自动去除 BOM） */
function readJsonFile(filePath) {
    return JSON.parse(stripBom(readFileSync(filePath, "utf-8")));
}

/** 读取 assets/agents 下所有已定义的 agent 名（impm 管理的 agent） */
function collectAgents() {
    const agentsDir = join(ASSETS_DIR, "agents");
    if (!existsSync(agentsDir)) {
        return [];
    }

    const agents = [];
    for (const file of readdirSync(agentsDir)) {
        if (file.endsWith(".md")) {
            agents.push(file.replace(/\.md$/, ""));
        }
    }
    return agents;
}

/** 读取 scripts/agent-models.json 预设定义文件 */
function loadAgentPresets() {
    const presetsPath = join(__dirname, "agent-models.json");
    if (!existsSync(presetsPath)) {
        console.error(`错误：预设模型配置文件不存在 ${presetsPath}`);
        process.exit(1);
    }
    try {
        return readJsonFile(presetsPath);
    } catch (err) {
        console.error(`错误：预设模型配置文件解析失败 ${presetsPath}：${err.message}`);
        process.exit(1);
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

/**
 * 应用 agent 模型配置到目标 opencode.json：
 *   - 未指定 agent-type：清理 impm 管理的 agent 的模型配置（model/reasoning_effort），
 *     其余字段与用户自定义 agent 保留；清理后 key 为空则整体删除该 agent。
 *   - 指定 agent-type：按预设为各 agent 写入 model + reasoning_effort；
 *     custom 预设跳过已存在的模型配置（保留手工设置）。
 */
function applyAgentConfig(config, agentType) {
    const managedAgents = collectAgents();
    if (managedAgents.length === 0) {
        return;
    }

    // 未指定 agent-type：仅清理 immp 管理的 agent 模型配置，不写入任何设置
    if (!agentType) {
        let cleaned = 0;
        if (config.agent && typeof config.agent === "object") {
            for (const name of managedAgents) {
                const entry = config.agent[name];
                if (!entry || typeof entry !== "object") {
                    continue;
                }
                let changed = false;
                if ("model" in entry) {
                    delete entry.model;
                    changed = true;
                }
                if ("reasoning_effort" in entry) {
                    delete entry.reasoning_effort;
                    changed = true;
                }
                if (changed && Object.keys(entry).length === 0) {
                    delete config.agent[name];
                }
                if (changed) {
                    cleaned++;
                }
            }
            if (Object.keys(config.agent).length === 0) {
                delete config.agent;
            }
        }
        console.log(`  未指定 agent-type：已清理 ${cleaned} 个 impm 管理的 agent 模型配置（保留其他自定义 agent）`);
        return;
    }

    // 指定 agent-type：加载预设并校验
    const presets = loadAgentPresets();
    const preset = presets[agentType];
    if (!preset || !preset.agents) {
        console.error(`错误：未知的 agent-type "${agentType}"，可选值：${AGENT_TYPES.join(", ")}`);
        process.exit(1);
    }

    config.agent = config.agent || {};
    let synced = 0;
    let preserved = 0;
    for (const [name, setting] of Object.entries(preset.agents)) {
        const existing = config.agent[name];
        // custom 预设：已存在的模型配置不覆盖（更新插件不影响手工维护的设置）
        if (agentType === "custom" && existing && existing.model) {
            preserved++;
            continue;
        }
        config.agent[name] = {
            ...(existing || {}),
            model: setting.model,
            reasoning_effort: setting.reasoning_effort,
        };
        synced++;
    }

    const msg = [`  已按预设 ${agentType} 为 ${synced} 个 agent 写入模型配置`];
    if (preserved > 0) {
        msg.push(`，保留 ${preserved} 个既有 custom 配置`);
    }
    console.log(msg.join(""));
}

/** 解析安装目标项目：--global 优先，其次 --target，其次 INIT_CWD（npm 依赖安装场景），最后回退到当前目录 */
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
        if (resolve(initCwd) !== PLUGIN_ROOT) {
            return resolve(initCwd);
        }
    }

    return process.cwd();
}

/** 递归复制目录；clean=true 时先清空目标目录再复制（保证重复安装幂等、不残留旧文件） */
function copyDirRecursive(src, dest, clean = false) {
    if (!existsSync(src)) {
        console.warn(`  跳过：源目录不存在 ${src}`);
        return;
    }

    if (clean && existsSync(dest)) {
        const entries = readdirSync(dest, { withFileTypes: true });
        for (const entry of entries) {
            const destPath = join(dest, entry.name);
            if (entry.isDirectory()) {
                rmSync(destPath, { recursive: true, force: true });
            } else {
                rmSync(destPath, { force: true });
            }
        }
    }

    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
            cpSync(srcPath, destPath);
        }
    }
}

/** 确保 .opencode/package.json 声明 type: module（插件入口文件 impm.js 按 ESM 解析） */
function ensureOpenCodePackageJson(opencodeDir) {
    const pkgPath = join(opencodeDir, "package.json");
    let pkg = {};
    if (existsSync(pkgPath)) {
        try {
            pkg = readJsonFile(pkgPath);
        } catch {
            console.warn(`  .opencode/package.json 解析失败，将重建`);
        }
    }
    if (pkg.type !== "module") {
        pkg.type = "module";
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        console.log("更新 .opencode/package.json（type: module，保证插件入口按 ESM 解析）");
    }
}

/** 更新目标 opencode.json：补 $schema、注册插件、应用 agent 模型预设 */
function updateOpenCodeConfig(projectRoot, agentType) {
    const configPath = join(projectRoot, "opencode.json");

    let config = {};
    if (existsSync(configPath)) {
        try {
            config = readJsonFile(configPath);
        } catch {
            console.warn("  opencode.json 解析失败，将重新创建");
        }
    }

    config["$schema"] =
        config["$schema"] || "https://opencode.ai/config.json";

    const isSelfInstall = resolve(projectRoot) === PLUGIN_ROOT;
    if (!isSelfInstall) {
        // 去重并保留既有插件（包含历史注册名），仅追加缺失的默认插件
        const plugins = Array.isArray(config.plugin) ? [...config.plugin] : [];
        for (const p of DEFAULT_PLUGINS) {
            if (!plugins.includes(p)) {
                plugins.push(p);
            }
        }
        config.plugin = plugins;
        console.log(`  配置文件已更新: ${configPath}（plugin: ${DEFAULT_PLUGINS.join(", ")}）`);
    } else {
        console.log("  本地自安装：跳过 config.plugin 注册（本地插件由 .opencode/plugins/ 自动加载）");
    }

    applyAgentConfig(config, agentType);

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** 安装主流程：解析目标项目 → 复制 assets 资源 → 安装插件编译产物 → 生成入口文件 → 更新配置 */
function main() {
    const args = process.argv.slice(2);
    const isGlobal = args.includes("--global");
    const agentType = resolveAgentType(args);
    const targetRoot = resolveTargetProject(args);

    console.log("============================================");
    console.log("  opencode-impm-cn 安装脚本");
    console.log("============================================");
    console.log("");
    console.log(`插件目录: ${PLUGIN_ROOT}`);
    console.log(`目标项目: ${targetRoot}${isGlobal ? "（全局安装）" : ""}`);
    console.log(`agent-type: ${agentType || "（未指定，将清理 impm 管理的 agent 模型配置）"}`);
    console.log("");

    if (!existsSync(ASSETS_DIR)) {
        console.error("错误：资源目录不存在，请确保在 opencode-impm-cn 插件目录中运行此脚本");
        console.error(`       ${ASSETS_DIR}`);
        process.exit(1);
    }

    // 全局安装时资源直接放入全局配置目录（agents/commands/skills），非全局安装放入项目 .opencode/
    const opencodeDir = isGlobal ? targetRoot : join(targetRoot, ".opencode");

    for (const dir of ASSET_DIRS) {
        const srcDir = join(ASSETS_DIR, dir);
        const destDir = join(opencodeDir, dir);

        if (!existsSync(srcDir)) {
            console.warn(`  跳过：资源目录不存在 ${srcDir}`);
            continue;
        }

        console.log(`复制 ${dir}/ -> ${destDir}/ ...`);
        // clean=true：先清空目标目录再复制，避免重复安装残留旧文件（幂等安装）
        copyDirRecursive(srcDir, destDir, true);
    }

    const pluginDest = join(opencodeDir, "plugins", "impm");
    const pluginEntry = join(opencodeDir, "plugins", "impm.js");
    if (existsSync(DIST_DIR)) {
        console.log("安装本地插件 -> .../plugins/impm/ ...");

        // 整体删除旧的插件目录与入口文件，彻底清除历史废弃/残留的编译产物与文件
        if (existsSync(pluginDest)) {
            rmSync(pluginDest, { recursive: true, force: true });
        }
        if (existsSync(pluginEntry)) {
            rmSync(pluginEntry, { force: true });
        }

        const pluginDestDir = join(pluginDest, "dist");
        mkdirSync(pluginDestDir, { recursive: true });

        if (existsSync(join(PLUGIN_ROOT, "package.json"))) {
            cpSync(
                join(PLUGIN_ROOT, "package.json"),
                join(pluginDest, "package.json"),
            );
        }
        copyDirRecursive(DIST_DIR, pluginDestDir);

        // opencode 只自动发现 plugins/ 下直接 *.js/*.ts 文件（不递归子目录），
        // 因此必须在根目录生成入口文件指向 dist 编译产物
        writeFileSync(pluginEntry, 'export { default } from "./impm/dist/index.js";\n', "utf-8");
        console.log("生成插件入口文件 -> .../plugins/impm.js");
    } else {
        console.warn(`  跳过：dist 目录不存在（请先执行 npm run build）: ${DIST_DIR}`);
    }

    // 确保 opencodeDir/package.json 声明 ESM（入口文件 impm.js 使用 export 语法）
    ensureOpenCodePackageJson(opencodeDir);

    console.log("");

    console.log("更新 opencode.json 配置...");
    updateOpenCodeConfig(targetRoot, agentType);

    console.log("");
    console.log("============================================");
    console.log("  安装完成！");
    console.log("  使用 /impm 命令启动AI项目经理全流程开发。");
    console.log("============================================");
}

main();