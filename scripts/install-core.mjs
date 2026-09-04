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
 * opencode-impm-cn 安装核心逻辑
 *
 * 供 CLI 入口（install.mjs）和插件入口（src/index.ts → ensureInstalled）共用。
 * 职责：同步 assets、维护累积清单、清理过时文件、更新 opencode.json 配置。
 *
 * 设计原则：
 *   - 所有路径由调用方传入，本模块不依赖 __dirname 计算外部路径
 *   - agentType 为空时跳过 opencode.json 中 agent 模型配置的调整
 *   - 幂等：版本相同时 runInstall 直接返回，零开销
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
import { join, resolve } from "node:path";

const ASSET_DIRS = ["commands", "agents", "skills"];
const PACKAGE_NAME = "opencode-impm-cn";
/** 安装时默认注册的插件（impm 套件 + 浏览器插件，供 UI/网络相关技能使用） */
const DEFAULT_PLUGINS = [PACKAGE_NAME, "opencode-browser"];

/** --agent-type 可选值 */
export const AGENT_TYPES = [
    "opencode-zen-free",
    "opencode-go-lite",
    "opencode-go-balance",
    "opencode-go-optimize",
    "custom",
    "clear",
];

// ─── 文件工具 ───────────────────────────────────────────────────

/** 去除 UTF-8 BOM（Windows 编辑器常写入 BOM，直接 JSON.parse 会失败） */
function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 JSON 文件（自动去除 BOM） */
function readJsonFile(filePath) {
    return JSON.parse(stripBom(readFileSync(filePath, "utf-8")));
}

/** 递归复制目录 */
function copyDirRecursive(src, dest) {
    if (!existsSync(src)) {
        console.warn(`  跳过：源目录不存在 ${src}`);
        return;
    }
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src, { withFileTypes: true })) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
            cpSync(srcPath, destPath);
        }
    }
}

// ─── 清单管理 ───────────────────────────────────────────────────

/** 安装清单文件路径 */
function manifestPath(opencodeDir) {
    return join(opencodeDir, "impm-manifest.json");
}

/** 读取安装清单；不存在或损坏返回 null */
export function loadManifest(opencodeDir) {
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
export function saveManifest(opencodeDir, manifest) {
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

// ─── 资源同步 ───────────────────────────────────────────────────

/** 判断某目录条目是否 impm 归属，决定是否清理 */
function isImpmOwned(dirType, name, srcNames, everSet) {
    if (srcNames.has(name) || everSet.has(name)) {
        return true;
    }
    return (dirType === "commands" || dirType === "skills") && name.startsWith("impm");
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

// ─── 配置更新 ───────────────────────────────────────────────────

/** 判断解析后的路径是否相同（Windows 大小写不敏感文件系统忽略大小写比较） */
function sameResolvedPath(a, b) {
    const pa = resolve(a);
    const pb = resolve(b);
    return process.platform === "win32"
        ? pa.toLowerCase() === pb.toLowerCase()
        : pa === pb;
}

/** 读取 assets/agents 下所有已定义的 agent 名 */
function collectAgents(assetsDir) {
    const agentsDir = join(assetsDir, "agents");
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
function loadAgentPresets(pluginRoot) {
    const presetsPath = join(pluginRoot, "scripts", "agent-models.json");
    if (!existsSync(presetsPath)) {
        return null;
    }
    try {
        return readJsonFile(presetsPath);
    } catch {
        return null;
    }
}

/** 应用 agent 模型配置到目标 opencode.json */
function applyAgentConfig(config, agentType, assetsDir, pluginRoot, extraManagedAgents = []) {
    if (!agentType) {
        return;
    }

    const currentAgents = collectAgents(assetsDir);
    const cleanAgents = [...new Set([...currentAgents, ...extraManagedAgents])].filter(Boolean);

    if (agentType === "clear") {
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
        console.log(`  agent-type=clear：已清理 ${cleaned} 个 impm 管理的 agent 模型配置`);
        return;
    }

    if (currentAgents.length === 0) {
        return;
    }

    const presets = loadAgentPresets(pluginRoot);
    if (!presets) {
        return;
    }
    const preset = presets[agentType];
    if (!preset || !preset.agents) {
        console.error(`错误：未知的 agent-type "${agentType}"，可选值：${AGENT_TYPES.join(", ")}`);
        return;
    }

    config.agent = config.agent || {};
    let synced = 0;
    let preserved = 0;
    for (const [name, setting] of Object.entries(preset.agents)) {
        const existing = config.agent[name];
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

/** 确保 .opencode/package.json 声明 type: module */
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

/** 判断插件注册项是否为 impm 历史注册残留 */
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

/** 更新目标 opencode.json：补 $schema、注册插件、应用 agent 模型预设 */
function updateOpenCodeConfig(projectRoot, agentType, assetsDir, pluginRoot, manifest = null) {
    const configPath = join(projectRoot, "opencode.json");
    mkdirSync(projectRoot, { recursive: true });

    let config = {};
    if (existsSync(configPath)) {
        try {
            config = readJsonFile(configPath);
        } catch {
            console.warn("  opencode.json 解析失败，将重新创建");
        }
    }

    config["$schema"] = config["$schema"] || "https://opencode.ai/config.json";

    const isSelfInstall = sameResolvedPath(pluginRoot, projectRoot);

    if (!isSelfInstall) {
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
        console.log("  本地自安装：跳过 config.plugin 注册");
    }

    const extraAgents = manifest
        ? manifest.everInstalled.agents.map((f) => f.replace(/\.md$/i, ""))
        : [];
    applyAgentConfig(config, agentType, assetsDir, pluginRoot, extraAgents);

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ─── 主入口 ─────────────────────────────────────────────────────

/**
 * 执行完整的安装流程
 *
 * @param {object} options
 * @param {string} options.pluginRoot   - 插件包根目录（含 assets/、dist/、scripts/）
 * @param {string} options.projectRoot  - 目标项目根目录（assets 复制到 projectRoot/.opencode/）
 * @param {string} options.version      - 当前插件版本号（写入 manifest）
 * @param {string} [options.agentType]  - agent 模型预设类型（空=不调整 agent 配置）
 */
export function runInstall({ pluginRoot, projectRoot, version, agentType = "" }) {
    const assetsDir = join(pluginRoot, "assets");
    const distDir = join(pluginRoot, "dist");
    const opencodeDir = join(projectRoot, ".opencode");

    console.log("============================================");
    console.log("  opencode-impm-cn 安装");
    console.log("============================================");
    console.log("");
    console.log(`插件目录: ${pluginRoot}`);
    console.log(`目标项目: ${projectRoot}`);
    console.log(`版本: ${version || "（未知）"}`);
    if (agentType) {
        console.log(`agent-type: ${agentType}`);
    }
    console.log("");

    if (!existsSync(assetsDir)) {
        console.error("错误：资源目录不存在");
        console.error(`       ${assetsDir}`);
        return false;
    }

    // 读取历史累积清单（无则视为首次安装）
    let manifest = loadManifest(opencodeDir);

    // 同步资源目录
    for (const dir of ASSET_DIRS) {
        const srcDir = join(assetsDir, dir);
        const destDir = join(opencodeDir, dir);

        if (!existsSync(srcDir)) {
            console.warn(`  跳过：资源目录不存在 ${srcDir}`);
            continue;
        }

        console.log(`复制 ${dir}/ -> ${destDir}/ ...`);
        syncAssetDir(dir, srcDir, destDir, manifest ? manifest.everInstalled[dir] : null);
    }

    // 累积清单
    const everByDir = {};
    for (const dir of ASSET_DIRS) {
        const srcDir = join(assetsDir, dir);
        everByDir[dir] = existsSync(srcDir) ? readdirSync(srcDir) : [];
    }
    if (!manifest) {
        manifest = { installedVersion: version || "", everInstalled: everByDir, pluginNames: [], pkgJsonTypeModule: false };
    } else {
        manifest.installedVersion = version || manifest.installedVersion || "";
        for (const dir of ASSET_DIRS) {
            mergeEver(manifest, dir, everByDir[dir]);
        }
    }

    // 安装本地插件（仅非自安装场景）
    const isSelfInstall = sameResolvedPath(pluginRoot, projectRoot);

    if (!isSelfInstall) {
        const pluginDest = join(opencodeDir, "plugins", "impm");
        const pluginEntry = join(opencodeDir, "plugins", "impm.js");
        if (existsSync(distDir)) {
            console.log("安装本地插件 -> .../plugins/impm/ ...");

            if (existsSync(pluginDest)) {
                rmSync(pluginDest, { recursive: true, force: true });
            }
            if (existsSync(pluginEntry)) {
                rmSync(pluginEntry, { force: true });
            }

            const pluginDestDir = join(pluginDest, "dist");
            mkdirSync(pluginDestDir, { recursive: true });

            if (existsSync(join(pluginRoot, "package.json"))) {
                cpSync(
                    join(pluginRoot, "package.json"),
                    join(pluginDest, "package.json"),
                );
            }
            copyDirRecursive(distDir, pluginDestDir);

            writeFileSync(pluginEntry, 'export { default } from "./impm/dist/index.js";\n', "utf-8");
            console.log("生成插件入口文件 -> .../plugins/impm.js");
        } else {
            console.warn(`  跳过：dist 目录不存在: ${distDir}`);
        }
    }

    // 确保 ESM 声明
    const setTypeModule = ensureOpenCodePackageJson(opencodeDir);
    if (setTypeModule) {
        manifest.pkgJsonTypeModule = true;
    }

    console.log("");
    console.log("更新 opencode.json 配置...");
    if (!isSelfInstall && !manifest.pluginNames.includes(PACKAGE_NAME)) {
        manifest.pluginNames.push(PACKAGE_NAME);
    }
    updateOpenCodeConfig(projectRoot, agentType, assetsDir, pluginRoot, manifest);

    // 保存清单
    saveManifest(opencodeDir, manifest);
    console.log(`安装清单已保存 -> ${manifestPath(opencodeDir)}`);

    console.log("");
    console.log("============================================");
    console.log("  安装完成！");
    console.log("  使用 /impm 命令启动AI项目经理全流程开发。");
    console.log("============================================");

    return true;
}
