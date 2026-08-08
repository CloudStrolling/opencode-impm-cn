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
 * git 命令封装：统一通过 execSync 执行，错误信息中文友好。
 */

import { execSync } from "child_process";

/** 执行 git 命令并返回去空白后的输出；失败时抛出含命令信息的中文错误 */
function gitExec(cwd: string, command: string): string {
    try {
        return execSync(`git ${command}`, {
            cwd,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`git 命令执行失败: ${command}\n${message}`);
    }
}

/** 是否在 git 仓库内 */
export function isGitRepo(cwd: string): boolean {
    try {
        gitExec(cwd, "rev-parse --is-inside-work-tree");
        return true;
    } catch {
        return false;
    }
}

/** git init */
export function gitInit(cwd: string): string {
    return gitExec(cwd, "init");
}

/** 创建并切换到分支 */
export function createBranch(cwd: string, branchName: string): string {
    return gitExec(cwd, `checkout -b ${branchName}`);
}

/** 切换到已存在的分支 */
export function switchBranch(cwd: string, branchName: string): string {
    return gitExec(cwd, `checkout ${branchName}`);
}

/** 当前分支名 */
export function getCurrentBranch(cwd: string): string {
    return gitExec(cwd, "rev-parse --abbrev-ref HEAD");
}

/** 拉取最新代码 */
export function pull(cwd: string): string {
    return gitExec(cwd, "pull");
}

/** 添加文件（默认全部） */
export function addFiles(cwd: string, files: string[] = ["-A"]): void {
    gitExec(cwd, `add ${files.join(" ")}`);
}

/** 提交 */
export function commit(cwd: string, message: string): string {
    const safe = message.replace(/"/g, "'");
    return gitExec(cwd, `commit -m "${safe}"`);
}

/** 合并分支（squash） */
export function mergeBranch(cwd: string, branchName: string): string {
    return gitExec(cwd, `merge --squash ${branchName}`);
}

/** 工作区状态（短格式） */
export function getStatus(cwd: string): string {
    return gitExec(cwd, "status --short");
}

/** 提交记录 */
export function getLog(cwd: string, count = 30): string {
    return gitExec(cwd, `log --oneline -${count}`);
}
