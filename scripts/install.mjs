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
 *   - 维护累积安装清单 .opencode/impm-manifest.json（everInstalled 只增不减），
 *     安装时按清单精确清理历史已移除/更名的残留（含 agents 等非 impm 前缀命名项）；
 *   - 首次安装（无清单）时按启发式清理（commands/skills 按 impm* 前缀、各目录按与源同名）；
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

/** 安装清单文件路径：{opencodeDir}/impm-manifest.json */
function manifestPath(opencodeDir) {
    return join(opencodeDir, "impm-manifest.json");
}

/** 读取安装清单；不存在或损坏返回 null */
function loadManifest(opencodeDir) {
    const file = manifestPath(opencodeDir);
    if (!existsSync(file)) {
        return null;
    }
    try {
        const m = readJsonFile(file);
        if (!m || typeof m !== "object") {
            return null;
        }
        m.everInstalled = m.everInstalled || { agents: [], commands: [], skills: [] };
        for (const key of Object.keys(m.everInstalled)) {
            if (!Array.isArray(m.everInstalled[key])) {
                m.everInstalled[key] = [];
            }
        }
        m.pluginNames = Array.isArray(m.pluginNames) ? m.pluginNames : [];
        m.pkgJsonTypeModule = !!m.pkgJsonTypeModule;
        return m;
    } catch {
        return null;
    }
}

/** 保存安装清单 */
function saveManifest(opencodeDir, manifest) {
    writeFileSync(
        manifestPath(opencodeDir),
        JSON.stringify(manifest, null, 2) + "\n",
        "utf-8",
    );
}

/** 将一批名称并入历史清单（只增不减，保证跨版本更名/移除仍可被清理） */
function mergeEver(manifest, key, names) {
    const set = new Set(manifest.everInstalled[key] || []);
    for (const n of names) {
        set.add(n);
    }
    manifest.everInstalled[key] = [...set];
}

/** 判断某目录条目是否 impm 归属，决定是否清理：commands/skills 含 impm* 前缀探测 */
function isImpmOwned(dirType, name, srcNames, everSet) {
    if (srcNames.has(name) || everSet.has(name)) {
        return true;
    }
    // commands/skills 全部以 impm 或 impm- 命名，可用前缀兜底；
    // agents 以角色名（ba/sa/...）命名，不做前缀探测，避免误删用户自建 agent
    return (dirType === "commands" || dirType === "skills") && name.startsWith("impm");
}

/** 判断插件注册项是否为 impm 历史注册残留（兼容字符串名与对象 {name,entry} 形式） */
function isStaleImpmPlugin(p) {
    if (typeof p === "string") {
        return p === PACKAGE_NAME || p.toLowerCase().includes("impm");
    }
    if (p && typeof p === "object") {
        const n = String(p.name || p.entry || "");
        return n.toLowerCase().includes("impm");
    }
    return false;
}

/** 同步单个资源目录：清理 impm 归属残留后复制（保留用户/其他插件非 impm 内容） */
function syncAssetDir(dirType, srcDir, destDir, everList) {
    if (!existsSync(srcDir)) {
        console.warn(`  跳过：源目录不存在 ${srcDir}`);
        return;
    }
    const srcNames = new Set(readdirSync(srcDir));
    const everSet = new Set(everList || []);
    if (existsSync(destDir)) {
        for (const entry of readdirSync(destDir, { withFileTypes: true })) {
            if (!isImpmOwned(dirType, entry.name, srcNames, everSet)) {
                continue;
            }
            try {
                rmSync(join(destDir, entry.name), { recursive: true, force: true });
            } catch {
                /* 忽略清理失败 */
            }
        }
    }
    copyDirRecursive(srcDir, destDir);
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
 * @param extraManagedAgents 历史版本安装过、现已不在 assets 的 agent 名（来自累积清单），
 *                          清理时一并处理，避免改名的模型配置残留
 */
function applyAgentConfig(config, agentType, extraManagedAgents = []) {
    const currentAgents = collectAgents();
    if (currentAgents.length === 0) {
        return;
    }
    const cleanAgents = [...new Set([...currentAgents, ...extraManagedAgents])].filter(Boolean);

    // 未指定 agent-type：仅清理 immp 管理的 agent 模型配置，不写入任何设置
    if (!agentType) {
        let cleaned = 0;
        if (config.agent && typeof config.agent === "object") {
            for (const name of cleanAgents) {
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

/** 递归复制目录（不含清理逻辑；清理由 syncAssetDir 负责） */
function copyDirRecursive(src, dest) {
    if (!existsSync(src)) {
        console.warn(`  跳过：源目录不存在 ${src}`);
        return;
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

/** 确保 .opencode/package.json 声明 type: module（插件入口文件 impm.js 按 ESM 解析）；返回是否由本脚本写入 */
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
        return true;
    }
    return false;
}

/** 更新目标 opencode.json：补 $schema、注册插件、应用 agent 模型预设 */
function updateOpenCodeConfig(projectRoot, agentType, manifest = null) {
    const configPath = join(projectRoot, "opencode.json");
    // 目标目录可能尚未创建（--target 指向新目录），先确保存在以避免写入 ENOENT
    mkdirSync(projectRoot, { recursive: true });

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

    const isSelfInstall = sameResolvedPath(projectRoot, PLUGIN_ROOT);
    if (!isSelfInstall) {
        // 先移除 impm 的历史插件注册残留（不同版本注册名/对象 entry），再追加默认插件
        const plugins = Array.isArray(config.plugin)
            ? config.plugin.filter((p) => !isStaleImpmPlugin(p))
            : [];
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

    // 清理/写入 agent 模型配置时带上历史 agent 名（累积清单，文件名去 .md 转 agent 键），避免更名项残留
    const extraAgents = manifest
        ? manifest.everInstalled.agents.map((f) => f.replace(/\.md$/i, ""))
        : [];
    applyAgentConfig(config, agentType, extraAgents);

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

    // 读取历史累积清单（无则视为首次安装）
    let manifest = loadManifest(opencodeDir);

    for (const dir of ASSET_DIRS) {
        const srcDir = join(ASSETS_DIR, dir);
        const destDir = join(opencodeDir, dir);

        if (!existsSync(srcDir)) {
            console.warn(`  跳过：资源目录不存在 ${srcDir}`);
            continue;
        }

        console.log(`复制 ${dir}/ -> ${destDir}/ ...`);
        // 按累积清单（历史已装项）清理残留后复制；无清单（首次安装）时仅按 impm* 前缀/同名启发式清理
        syncAssetDir(dir, srcDir, destDir, manifest ? manifest.everInstalled[dir] : null);
    }

    // 累积清单：无则按当前 assets 初始化（只记 impm 归属，不含用户文件），有则并入本次安装项（只增不减）
    const everByDir = {};
    for (const dir of ASSET_DIRS) {
        const srcDir = join(ASSETS_DIR, dir);
        everByDir[dir] = existsSync(srcDir) ? readdirSync(srcDir) : [];
    }
    if (!manifest) {
        manifest = { everInstalled: everByDir, pluginNames: [], pkgJsonTypeModule: false };
    } else {
        for (const dir of ASSET_DIRS) {
            mergeEver(manifest, dir, everByDir[dir]);
        }
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

    // 确保 opencodeDir/package.json 声明 ESM（入口文件 impm.js 使用 export 语法）；
    // 记录是否由本脚本写入 type:module，供卸载时精确回滚
    const setTypeModule = ensureOpenCodePackageJson(opencodeDir);
    if (setTypeModule) {
        manifest.pkgJsonTypeModule = true;
    }

    console.log("");

    console.log("更新 opencode.json 配置...");
    const isSelfInstall = sameResolvedPath(targetRoot, PLUGIN_ROOT);
    if (!isSelfInstall && !manifest.pluginNames.includes(PACKAGE_NAME)) {
        manifest.pluginNames.push(PACKAGE_NAME);
    }
    updateOpenCodeConfig(targetRoot, agentType, manifest);

    // 保存累积清单（覆盖式全量写，供下次安装清理历史残留与卸载精确删除）
    saveManifest(opencodeDir, manifest);
    console.log(`安装清单已保存 -> ${manifestPath(opencodeDir)}`);

    console.log("");
    console.log("============================================");
    console.log("  安装完成！");
    console.log("  使用 /impm 命令启动AI项目经理全流程开发。");
    console.log("============================================");
}

main();