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
 *   - 删除 assets 安装的 agents/commands/skills 下「本插件归属」的文件/目录
 *     （与 assets 同名的 agent、impm* 命名的命令与技能目录），保留用户其他文件
 *   - 从 opencode.json 的 plugin 列表移除 opencode-impm-cn（保留 opencode-browser
 *     及其它在安装前已存在/用户添加的插件）
 *   - 清理 opencode.json 的 agent 键中 impm 管理的 agent 的 model/reasoning_effort
 *     字段（保留用户自定义的其他 agent 条目）
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

/** 从 assets/agents 收集本插件归属的 agent 名 */
function collectManagedAgents() {
    const agentsDir = join(ASSETS_DIR, "agents");
    if (!existsSync(agentsDir)) {
        return [];
    }
    return readdirSync(agentsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
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

/** 删除 impm 归属的 skills（目录名为 impm 或 impm- 前缀） */
function removeImpmSkills(skillsDir) {
    if (!existsSync(skillsDir)) {
        return 0;
    }
    let count = 0;
    for (const name of readdirSync(skillsDir)) {
        if (name === "impm" || name.startsWith("impm-") || name === "template") {
            rmSync(join(skillsDir, name), { recursive: true, force: true });
            count++;
        }
    }
    return count;
}

/** 删除 impm 归属的 commands（文件名为 impm 或 impm- 前缀） */
function removeImpmCommands(commandsDir) {
    if (!existsSync(commandsDir)) {
        return 0;
    }
    let count = 0;
    for (const name of readdirSync(commandsDir)) {
        const base = name.replace(/\.(md|txt)$/, "");
        if (base === "impm" || base.startsWith("impm")) {
            rmSync(join(commandsDir, name), { recursive: true, force: true });
            count++;
        }
    }
    return count;
}

/** 删除 impm 归属的 agents（与 assets/agents 同名的 .md 文件） */
function removeImpmAgents(agentsDir) {
    if (!existsSync(agentsDir)) {
        return 0;
    }
    const managed = collectManagedAgents();
    let count = 0;
    for (const name of managed) {
        const file = join(agentsDir, `${name}.md`);
        if (existsSync(file)) {
            rmSync(file, { force: true });
            count++;
        }
    }
    return count;
}

/** 从 opencode.json 移除 impm 的 plugin 注册，并清理 impm 管理的 agent 模型配置 */
function updateOpenCodeConfig(projectRoot) {
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

    // 1) 移除本插件注册名（保留其余插件，含 opencode-browser）
    if (Array.isArray(config.plugin)) {
        config.plugin = config.plugin.filter((p) => p !== PACKAGE_NAME);
        if (config.plugin.length === 0) {
            delete config.plugin;
        }
        console.log(`  已从 plugin 列表移除 ${PACKAGE_NAME}`);
    }

    // 2) 清理 impm 管理的 agent 模型配置（保留用户自定义 agent 及其他字段）
    const managedAgents = collectManagedAgents();
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
    const agentsRemoved = removeImpmAgents(join(opencodeDir, "agents"));
    const commandsRemoved = removeImpmCommands(join(opencodeDir, "commands"));
    const skillsRemoved = removeImpmSkills(join(opencodeDir, "skills"));
    console.log(
        `  已删除 impm 归属资源: agents ${agentsRemoved} 个、commands ${commandsRemoved} 个、skills ${skillsRemoved} 个`,
    );

    // 3) 清理 opencode.json（plugin 注册 + agent 模型配置，保留用户自定义）
    console.log("更新 opencode.json 配置...");
    updateOpenCodeConfig(targetRoot);

    console.log("");
    console.log("============================================");
    console.log("  卸载完成！");
    console.log("  已移除插件及其注册/模型配置，用户自定义内容均被保留。");
    console.log("============================================");
}

main();