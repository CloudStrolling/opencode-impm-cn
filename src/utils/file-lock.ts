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
 * 文件写锁工具：基于目录锁（mkdir 的原子性）实现同进程/跨进程的文件写入互斥。
 *
 * 编码开发阶段 PM 按阶段波次并发派发多个任务的子步骤 subagent，这些 subagent
 * 会同时向 version_progress.md、任务清单 JSON 等共享文件执行「读-改-写」；
 * 若不加锁，两个并发调用可能同时读到旧内容并各自写回，造成进度行/任务状态
 * 丢失（last-write-wins 覆盖）。withFileLock 保证「读-改-写」全流程持有锁，
 * 从而避免并发丢失更新。
 *
 * 锁实现：
 *   - 锁文件：{file}.lock 目录，mkdir 原子性保证同一时刻仅一个持有者；
 *   - 等待：被占用时按间隔重试，直到超时（默认 60s）；
 *   - 心跳：持锁期间周期性刷新锁目录 mtime，避免长临界区被误判为过期锁；
 *   - 过期锁：mtime 超过 STALE_LOCK_MS（默认 30s）视为进程异常退出残留，自动清理后重试；
 *   - 释放：fn 执行完毕（无论成败）后删除锁目录。
 */

import { mkdirSync, rmSync, statSync, utimesSync } from "fs";
import { dirname } from "path";

/** 锁等待总超时（毫秒） */
const DEFAULT_TIMEOUT_MS = 60_000;
/** 过期锁判定阈值（毫秒）：超过该时长视为进程异常退出残留 */
const STALE_LOCK_MS = 30_000;
/** 锁心跳间隔（毫秒）：持锁期间刷新锁目录 mtime，须小于 STALE_LOCK_MS */
const HEARTBEAT_INTERVAL_MS = 10_000;
/** 锁重试间隔（毫秒） */
const RETRY_INTERVAL_MS = 120;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 在持有文件锁的情况下执行 fn，返回 fn 的结果。
 * @param file 目标文件路径（锁目录为其 + ".lock"）
 * @param fn 临界区函数（可为同步或异步；临界区内必须重新读取最新文件内容再写回）
 * @param timeoutMs 锁等待超时（毫秒，默认 60000）
 */
export async function withFileLock<T>(
    file: string,
    fn: () => T | Promise<T>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
    const lockDir = `${file}.lock`;
    // 确保锁目录的父目录存在（目标文件所在的版本目录可能尚未创建），
    // 否则 mkdirSync 抛 ENOENT，会被误判为"锁被占用"造成死循环
    mkdirSync(dirname(lockDir), { recursive: true });
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (Date.now() > deadline) {
            throw new Error(`文件写锁等待超时（${timeoutMs}ms）：${lockDir}`);
        }
        try {
            mkdirSync(lockDir);
            break;
        } catch (err) {
            const code = (err as NodeJS.ErrnoException)?.code;
            if (code === "ENOENT") {
                // 父目录被并发删除等极端情况：重建父目录后重试
                mkdirSync(dirname(lockDir), { recursive: true });
                await sleep(RETRY_INTERVAL_MS);
                continue;
            }
            if (code !== "EEXIST") {
                // 非"已存在"错误直接抛出，避免死循环
                throw err;
            }
            // 锁被占用：先尝试清理过期锁，否则等待重试
            let stale = false;
            try {
                stale = Date.now() - statSync(lockDir).mtimeMs > STALE_LOCK_MS;
            } catch {
                // 锁目录恰好消失（竞争窗口），直接重试获取
                await sleep(RETRY_INTERVAL_MS);
                continue;
            }
            if (stale) {
                try {
                    rmSync(lockDir, { recursive: true, force: true });
                } catch {
                    // 清理失败，稍后重试
                }
                continue;
            }
            await sleep(RETRY_INTERVAL_MS);
        }
    }
    // 持锁期间周期刷新锁目录 mtime（心跳）
    // 防止临界区执行超过 STALE_LOCK_MS 时，被其他进程当过期锁清理，破坏互斥。
    // 进程崩溃时心跳随之停止，锁 mtime 停止刷新，30s 后仍会被正确清理。
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
        heartbeat = setInterval(() => {
            const now = new Date();
            try {
                utimesSync(lockDir, now, now);
            } catch {
                // 锁目录可能已被清理或不可写，忽略，交由过期清理逻辑处理
            }
        }, HEARTBEAT_INTERVAL_MS);
        return await fn();
    } finally {
        if (heartbeat) {
            clearInterval(heartbeat);
        }
        try {
            rmSync(lockDir, { recursive: true, force: true });
        } catch {
            // 忽略释放失败（锁目录可能已被过期清理）
        }
    }
}
