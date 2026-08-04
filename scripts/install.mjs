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
 *
 * 检测逻辑：
 *   - 如果 --target 参数指定了路径，安装到该路径
 *   - 如果 INIT_CWD 环境变量存在且不等于当前包目录，安装到 INIT_CWD（npm 依赖安装场景）
 *   - 否则，安装到当前工作目录（本地开发安装场景）
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
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_ROOT = resolve(__dirname, "..");
const ASSETS_DIR = join(PLUGIN_ROOT, "assets");
const DIST_DIR = join(PLUGIN_ROOT, "dist");

const ASSET_DIRS = ["commands", "agents", "skills"];
const PACKAGE_NAME = "opencode-impm-cn";

function resolveTargetProject(args) {
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
        if (!plugins.includes(PACKAGE_NAME)) {
            plugins.push(PACKAGE_NAME);
        }
        config.plugin = plugins;
        console.log(`  配置文件已更新: ${configPath}（plugin: ${PACKAGE_NAME}）`);
    } else {
        console.log("  本地自安装：跳过 config.plugin 注册（本地插件由 .opencode/plugins/ 自动加载）");
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function main() {
    const args = process.argv.slice(2);
    const targetRoot = resolveTargetProject(args);

    console.log("============================================");
    console.log("  opencode-impm-cn 安装脚本");
    console.log("============================================");
    console.log("");
    console.log(`插件目录: ${PLUGIN_ROOT}`);
    console.log(`资源目录: ${ASSETS_DIR}`);
    console.log(`目标项目: ${targetRoot}`);
    console.log("");

    if (!existsSync(ASSETS_DIR)) {
        console.error("错误：资源目录不存在，请确保在 opencode-impm-cn 插件目录中运行此脚本");
        console.error(`       ${ASSETS_DIR}`);
        process.exit(1);
    }

    const opencodeDir = join(targetRoot, ".opencode");

    for (const dir of ASSET_DIRS) {
        const srcDir = join(ASSETS_DIR, dir);
        const destDir = join(opencodeDir, dir);

        if (!existsSync(srcDir)) {
            console.warn(`  跳过：资源目录不存在 ${srcDir}`);
            continue;
        }

        console.log(`复制 ${dir}/ -> .opencode/${dir}/ ...`);
        // clean=true：先清空目标目录再复制，避免重复安装残留旧文件（幂等安装）
        copyDirRecursive(srcDir, destDir, true);
    }

    const pluginDest = join(opencodeDir, "plugins", "impm");
    if (existsSync(DIST_DIR)) {
        console.log("安装本地插件 -> .opencode/plugins/impm/ ...");

        const pluginDestDir = join(pluginDest, "dist");
        mkdirSync(pluginDestDir, { recursive: true });

        if (existsSync(join(PLUGIN_ROOT, "package.json"))) {
            cpSync(
                join(PLUGIN_ROOT, "package.json"),
                join(pluginDest, "package.json"),
            );
        }
        copyDirRecursive(DIST_DIR, pluginDestDir);
    } else {
        console.warn(`  跳过：dist 目录不存在（请先执行 npm run build）: ${DIST_DIR}`);
    }

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
