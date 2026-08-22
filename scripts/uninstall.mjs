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
 * opencode-impm-cn 卸载脚本
 *
 * 完整卸载本插件，仅清理本插件安装时写入的内容，保留用户自定义：
 *   - 删除 .opencode/plugins/impm/ 目录与入口文件 plugins/impm.js
 *   - 按安装清单 .opencode/impm-manifest.json（累积历史清单，everInstalled 只增不减）
 *     精确删除 agents/commands/skills 下本插件安装过的文件（含历史已改名/移除项）；
 *     无清单时回退启发式（与 assets 同名的 agent、impm* 命名的命令与技能目录），保留用户其他文件
 *   - 从 opencode.json 的 plugin 列表移除 impm 历史注册（保留 opencode-browser
 *     及其它在安装前已存在/用户添加的插件）
 *   - 清理 opencode.json 的 agent 键中 impm 管理的 agent（当前 assets ∪ 清单历史）的
 *     model/reasoning_effort 字段（保留用户自定义的其他 agent 条目）
 *   - 若清单记录 install 曾写入 type:module，回滚 .opencode/package.json
 *   - 最后删除安装清单文件本身
 *
 * 使用方式（与安装脚本一致）：
 *   node scripts/uninstall.mjs                     # 卸载当前目录
 *   node scripts/uninstall.mjs --target /path/proj  # 卸载指定项目
 *   node scripts/uninstall.mjs --global             # 卸载全局安装（~/.config/opencode）
 */

import {
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

// 路径常量：插件根目录、可分发资源目录
const PLUGIN_ROOT = resolve(__dirname, "..");
const ASSETS_DIR = join(PLUGIN_ROOT, "assets");

// 本插件 install 时注册的插件名；卸载时仅移除 PACKAGE_NAME，保留 opencode-browser
const PACKAGE_NAME = "opencode-impm-cn";

/** 全局安装目标：opencode 全局配置目录 */
const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "opencode");

/** 从 assets/agents 收集本插件归属的 agent 名（无清单时的兜底） */
function collectManagedAgents() {
    const agentsDir = join(ASSETS_DIR, "agents");
    if (!existsSync(agentsDir)) {
        return [];
    }
    return readdirSync(agentsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
}

/** 安装清单路径：{opencodeDir}/impm-manifest.json */
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

/** 回滚 .opencode/package.json 中 install 写入的 type:module（清单已确定系本脚本写入时调用） */
function rollbackPkgJsonTypeModule(opencodeDir) {
    const pkgPath = join(opencodeDir, "package.json");
    if (!existsSync(pkgPath)) {
        return;
    }
    try {
        const pkg = readJsonFile(pkgPath);
        if (pkg && typeof pkg === "object" && pkg.type === "module") {
            delete pkg.type;
            if (Object.keys(pkg).length === 0) {
                rmSync(pkgPath, { force: true });
                console.log("  回滚 .opencode/package.json（移除 install 写入的 type:module，文件已空则删除）");
            } else {
                writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
                console.log("  回滚 .opencode/package.json（移除 install 写入的 type:module）");
            }
        }
    } catch {
        // 解析失败则不动，避免破坏用户文件
    }
}

/** 去除 UTF-8 BOM（Windows 编辑器常写入 BOM，直接 JSON.parse 会失败） */
function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 JSON 文件（自动去除 BOM） */
function readJsonFile(filePath) {
    return JSON.parse(stripBom(readFileSync(filePath, "utf-8")));
}

/** 解析目标项目：--global 优先，其次 --target，其次 INIT_CWD，最后回退到当前目录 */
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
    if (initCwd && resolve(initCwd) !== PLUGIN_ROOT) {
        return resolve(initCwd);
    }

    return process.cwd();
}

/** 删除 impm 归属的 skills（优先按累积清单精确删除；无清单时按 impm/impm-/template 前缀兜底） */
function removeImpmSkills(skillsDir, managedNames = null) {
    if (!existsSync(skillsDir)) {
        return 0;
    }
    let count = 0;
    const names = managedNames && managedNames.length > 0
        ? managedNames
        : null;
    for (const name of readdirSync(skillsDir)) {
        const owned = names
            ? names.includes(name)
            : name === "impm" || name.startsWith("impm-") || name === "template";
        if (!owned) {
            continue;
        }
        rmSync(join(skillsDir, name), { recursive: true, force: true });
        count++;
    }
    return count;
}

/** 删除 impm 归属的 commands（优先按累积清单精确删除；无清单时按 impm 前缀兜底） */
function removeImpmCommands(commandsDir, managedNames = null) {
    if (!existsSync(commandsDir)) {
        return 0;
    }
    let count = 0;
    for (const name of readdirSync(commandsDir)) {
        const isManaged = managedNames && managedNames.length > 0
            ? managedNames.includes(name)
            : name.replace(/\.(md|txt)$/, "").startsWith("impm");
        if (!isManaged) {
            continue;
        }
        rmSync(join(commandsDir, name), { recursive: true, force: true });
        count++;
    }
    return count;
}

/** 删除 impm 归属的 agents（优先按累积清单精确删除；无清单时按 assets 同名兜底） */
function removeImpmAgents(agentsDir, managedFiles = null) {
    if (!existsSync(agentsDir)) {
        return 0;
    }
    const managed = managedFiles && managedFiles.length > 0
        ? managedFiles
        : collectManagedAgents().map((n) => `${n}.md`);
    let count = 0;
    for (const name of managed) {
        const file = join(agentsDir, name);
        if (existsSync(file)) {
            rmSync(file, { force: true });
            count++;
        }
    }
    return count;
}

/** 从 opencode.json 移除 impm 的 plugin 注册，并清理 impm 管理的 agent 模型配置 */
function updateOpenCodeConfig(projectRoot, manifest = null) {
    const configPath = join(projectRoot, "opencode.json");
    if (!existsSync(configPath)) {
        console.log(`  未找到配置文件，跳过配置清理: ${configPath}`);
        return;
    }

    let config;
    try {
        config = readJsonFile(configPath);
    } catch {
        console.warn(`  opencode.json 解析失败，跳过配置清理: ${configPath}`);
        return;
    }

    // 1) 移除 impm 的历史插件注册（累积清单记录名 + PACKAGE_NAME + impm 相关字符串/对象 entry），保留其余插件（含 opencode-browser）
    const stalePluginNames = new Set(
        manifest && manifest.pluginNames.length > 0
            ? manifest.pluginNames
            : [PACKAGE_NAME],
    );
    if (Array.isArray(config.plugin)) {
        const before = config.plugin.length;
        config.plugin = config.plugin.filter((p) => {
            if (typeof p === "string") {
                return !stalePluginNames.has(p) && !p.toLowerCase().includes("impm");
            }
            if (p && typeof p === "object") {
                const n = String(p.name || p.entry || "");
                return !n.toLowerCase().includes("impm");
            }
            return true;
        });
        if (config.plugin.length === 0) {
            delete config.plugin;
        }
        console.log(`  已从 plugin 列表移除 impm 插件注册（剩余 ${config.plugin?.length ?? 0} 项）`);
    }

    // 2) 清理 impm 管理的 agent 模型配置（当前 assets ∪ 累积清单历史 agent，agent 文件去 .md 转键）
    const historicalAgents = manifest && manifest.everInstalled.agents
        ? manifest.everInstalled.agents.map((f) => f.replace(/\.md$/i, ""))
        : [];
    const managedAgents = [...new Set([...collectManagedAgents(), ...historicalAgents])].filter(Boolean);
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
    console.log(`  已清理 ${cleaned} 个 impm 管理的 agent 模型配置`);

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** 卸载主流程 */
function main() {
    const args = process.argv.slice(2);
    const isGlobal = args.includes("--global");
    const targetRoot = resolveTargetProject(args);

    console.log("============================================");
    console.log("  opencode-impm-cn 卸载脚本");
    console.log("============================================");
    console.log("");
    console.log(`目标项目: ${targetRoot}${isGlobal ? "（全局）" : ""}`);
    console.log("");

    const opencodeDir = isGlobal ? targetRoot : join(targetRoot, ".opencode");

    // 读取安装清单：有则按清单精确删除历史残留（改名/移除项），无则回退启发式
    const manifest = loadManifest(opencodeDir);
    if (manifest) {
        console.log("读取安装清单 -> 按累积历史清单精确清理");
    } else {
        console.log("未找到安装清单 -> 使用启发式清理（impm* 前缀 / 当前 assets 集合）");
    }

    // 1) 删除插件编译产物与入口文件
    let removed = 0;
    const pluginDest = join(opencodeDir, "plugins", "impm");
    const pluginEntry = join(opencodeDir, "plugins", "impm.js");
    if (existsSync(pluginDest)) {
        rmSync(pluginDest, { recursive: true, force: true });
        console.log(`  删除插件目录 -> ${pluginDest}`);
        removed++;
    }
    if (existsSync(pluginEntry)) {
        rmSync(pluginEntry, { force: true });
        console.log(`  删除插件入口 -> ${pluginEntry}`);
        removed++;
    }
    if (removed === 0) {
        console.log("  未发现插件编译产物（可能已卸载）");
    }

    // 2) 删除 assets 安装的资源（仅 impm 归属，保留用户其他文件）
    console.log("清理 agents/commands/skills 中 impm 归属的资源...");
    const agentsRemoved = removeImpmAgents(
        join(opencodeDir, "agents"),
        manifest ? manifest.everInstalled.agents : null,
    );
    const commandsRemoved = removeImpmCommands(
        join(opencodeDir, "commands"),
        manifest ? manifest.everInstalled.commands : null,
    );
    const skillsRemoved = removeImpmSkills(
        join(opencodeDir, "skills"),
        manifest ? manifest.everInstalled.skills : null,
    );
    console.log(
        `  已删除 impm 归属资源: agents ${agentsRemoved} 个、commands ${commandsRemoved} 个、skills ${skillsRemoved} 个`,
    );

    // 3) 回滚 .opencode/package.json 中由 install 写入的 type:module（仅在清单记录确系本脚本写入时）
    if (manifest && manifest.pkgJsonTypeModule) {
        rollbackPkgJsonTypeModule(opencodeDir);
    }

    // 4) 清理 opencode.json（plugin 注册 + agent 模型配置，保留用户自定义）
    console.log("更新 opencode.json 配置...");
    updateOpenCodeConfig(targetRoot, manifest);

    // 5) 删除安装清单本身
    if (manifest) {
        try {
            rmSync(manifestPath(opencodeDir), { force: true });
            console.log(`  已删除安装清单 -> ${manifestPath(opencodeDir)}`);
        } catch {
            /* 忽略删除失败 */
        }
    }

    console.log("");
    console.log("============================================");
    console.log("  卸载完成！");
    console.log("  已移除插件及其注册/模型配置，用户自定义内容均被保留。");
    console.log("============================================");
}

main();