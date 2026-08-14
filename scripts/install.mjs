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
 * 模型配置同步：
 *   - 安装时会将 assets/agents 下定义的 agent 的模型与思考深度写入对应的
 *     opencode.json（全局安装写全局配置，非全局安装写项目配置）的 agent 键。
 *   - 每个 agent 按角色职责与成本综合配置（见 AGENT_MODEL_MAP），
 *     模型均来自 opencode-go provider，思考深度为 low/medium/high/max。
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

/**
 * 各 agent 的默认模型与思考深度（模型均来自 opencode-go provider）。
 * 综合角色职责、执行频率与成本权衡：
 *   - 高负载角色（架构/设计/复杂编码）配较强模型 + high/max；
 *   - 文档/查询/轻量执行角色配低成本模型 + low/medium；
 *   - 编码工程师优先代码专项模型（kimi-k2.7-code）或性价比模型（deepseek-v4-pro）。
 */
const AGENT_MODEL_MAP = {
    pm:  { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "low" },  // 编排调度、决策判断
    scm: { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "low" },    // git/版本管理，轻量执行
    ba:  { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "high" },  // 需求文档撰写
    sa:  { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "max" },    // 系统架构设计
    tl:  { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "high" },    // 详细设计/API/代码审核
    dba: { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "max" },  // 数据库设计
    te:  { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "high" },  // 测试用例/测试代码
    cs:  { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "low" },  // 本地代码查询
    ws:  { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "low" },  // 网络资料查询
    sse: { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "high" },    // 复杂业务编码
    fee: { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "high" },    // 前端编码
    bee: { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "max" },    // 后端编码
    dw:  { model: "opencode-go/deepseek-v4-flash", reasoning_effort: "high" },  // 文档编写
};

/** 读取 assets/agents 下所有已定义的 agent 名 */
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

/** 为每个 agent 在目标 opencode.json 的 agent 键写入对应模型与思考深度 */
function syncAgentModels(config) {
    const agents = collectAgents();
    if (agents.length === 0) {
        return;
    }

    config.agent = config.agent || {};
    let synced = 0;
    for (const name of agents) {
        const setting = AGENT_MODEL_MAP[name];
        if (!setting) {
            continue;
        }
        config.agent[name] = {
            ...(config.agent[name] || {}),
            model: setting.model,
            reasoning_effort: setting.reasoning_effort,
        };
        synced++;
    }
    console.log(`  已为 ${synced} 个 agent 写入模型配置（按角色分配 opencode-go 模型）`);
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
            pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
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

/** 更新目标 opencode.json：补 $schema、注册插件、同步各 agent 模型配置 */
function updateOpenCodeConfig(projectRoot) {
    const configPath = join(projectRoot, "opencode.json");

    let config = {};
    if (existsSync(configPath)) {
        try {
            config = JSON.parse(readFileSync(configPath, "utf-8"));
        } catch {
            console.warn("  opencode.json 解析失败，将重新创建");
        }
    }

    config["$schema"] =
        config["$schema"] || "https://opencode.ai/config.json";

    const isSelfInstall = resolve(projectRoot) === PLUGIN_ROOT;
    if (!isSelfInstall) {
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

    syncAgentModels(config);

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** 安装主流程：解析目标项目 → 复制 assets 资源 → 安装插件编译产物 → 生成入口文件 → 更新配置 */
function main() {
    const args = process.argv.slice(2);
    const isGlobal = args.includes("--global");
    const targetRoot = resolveTargetProject(args);

    console.log("============================================");
    console.log("  opencode-impm-cn 安装脚本");
    console.log("============================================");
    console.log("");
    console.log(`插件目录: ${PLUGIN_ROOT}`);
    console.log(`目标项目: ${targetRoot}${isGlobal ? "（全局安装）" : ""}`);
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
    if (existsSync(DIST_DIR)) {
        console.log("安装本地插件 -> .../plugins/impm/ ...");

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
        const pluginEntry = join(opencodeDir, "plugins", "impm.js");
        writeFileSync(pluginEntry, 'export { default } from "./impm/dist/index.js";\n', "utf-8");
        console.log("生成插件入口文件 -> .../plugins/impm.js");
    } else {
        console.warn(`  跳过：dist 目录不存在（请先执行 npm run build）: ${DIST_DIR}`);
    }

    // 确保 opencodeDir/package.json 声明 ESM（入口文件 impm.js 使用 export 语法）
    ensureOpenCodePackageJson(opencodeDir);

    console.log("");

    console.log("更新 opencode.json 配置...");
    updateOpenCodeConfig(targetRoot);

    console.log("");
    console.log("============================================");
    console.log("  安装完成！");
    console.log("  使用 /impm 命令启动AI项目经理全流程开发。");
    console.log("============================================");
}

main();
