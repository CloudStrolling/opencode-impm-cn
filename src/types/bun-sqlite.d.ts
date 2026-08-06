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
 * bun:sqlite 模块类型声明
 * 仅 Bun 运行时存在，Node 环境下不会加载；
 * 声明用于让 TypeScript 编译通过 prompt-recorder 的动态导入。
 */
declare module "bun:sqlite" {
    export class Database {
        constructor(path: string, options?: { readonly?: boolean });
        prepare(sql: string): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown };
        close(): void;
    }
}
