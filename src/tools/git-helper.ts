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
 * impm_git 工具
 * 封装常用 git 操作：
 *   init：git init
 *   status：工作区状态
 *   branch：创建并切换分支
 *   checkout：切换到分支（不存在时创建）
 *   commit：暂存全部并提交
 *   merge：切回主分支后 squash 合并开发分支
 *   current-branch：当前分支名
 *   pull：拉取最新代码
 *   log：最近提交记录
 */

import * as git from "../utils/git.js";

export const gitHelperDefinition = {
    description:
        "git 操作封装：init（初始化仓库）、status（工作区状态）、branch（创建并切换分支）、checkout（切换分支）、commit（暂存全部并提交）、merge（切回主分支后 squash 合并分支）、current-branch（当前分支）、pull（拉取）、log（提交记录）。流程中的版本分支创建、提交与合并时使用。",
};

export function gitHelperExecute(args: {
    projectRoot: string;
    action: string;
    branchName?: string;
    message?: string;
}) {
    const root = args.projectRoot;
    const action = args.action;
    /** 安全执行包装：捕获异常并统一返回 { success, output | error } 结果结构 */
    const safe = <T>(fn: () => T): { success: boolean; output?: T; error?: string } => {
        try {
            return { success: true, output: fn() };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    };

    switch (action) {
        case "init":
            return safe(() => git.gitInit(root));
        case "status":
            return safe(() => git.getStatus(root));
        case "branch": {
            const branchName = args.branchName?.trim();
            if (!branchName) {
                return { success: false, error: "缺少必填参数 branchName（分支名称）。" };
            }
            return safe(() => git.createBranch(root, branchName));
        }
        case "checkout": {
            const branchName = args.branchName?.trim();
            if (!branchName) {
                return { success: false, error: "缺少必填参数 branchName（分支名称）。" };
            }
            return safe(() => git.switchBranch(root, branchName));
        }
        case "commit": {
            const message = args.message?.trim();
            if (!message) {
                return { success: false, error: "缺少必填参数 message（提交消息）。" };
            }
            return safe(() => {
                git.addFiles(root);
                return git.commit(root, message);
            });
        }
        case "merge": {
            const branchName = args.branchName?.trim();
            if (!branchName) {
                return { success: false, error: "缺少必填参数 branchName（要合并的分支名称）。" };
            }
            return safe(() => {
                const outputs: string[] = [];
                for (const main of ["main", "master"]) {
                    try {
                        outputs.push(git.switchBranch(root, main));
                        break;
                    } catch {
                        // 尝试下一个默认主分支名
                    }
                }
                outputs.push(git.mergeBranch(root, branchName));
                outputs.push(`当前分支：${git.getCurrentBranch(root)}`);
                outputs.push(`工作区状态：\n${git.getStatus(root)}`);
                return outputs.join("\n");
            });
        }
        case "current-branch":
            return safe(() => git.getCurrentBranch(root));
        case "pull":
            return safe(() => git.pull(root));
        case "log":
            return safe(() => git.getLog(root));
        default:
            return {
                success: false,
                error: `未知 action：${action}（应为 init/status/branch/checkout/commit/merge/current-branch/pull/log）。`,
            };
    }
}
