---
name: impm-tools-vulnscan
description: 根据当前项目使用的语言和生态，使用 OSV.dev API 接口查询所使用的中间件和三方包是否含有已知的漏洞，并在 docs 目录下生成漏洞探查报告
---

# impm-tools-vulnscan 技能

## 触发词
漏洞探查、漏洞扫描、vulnscan、安全扫描、依赖安全、vulnerability scan、CVE

## 何时使用
需要对当前项目的所有第三方依赖（中间件、三方包）进行已知漏洞探查时使用。可独立执行，也可在版本收尾阶段追加执行。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-tools-vulnscan，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对漏洞探查报告已生成且内容完整，全部正确后才能结束。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接报告路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| OSV API 地址 | 漏洞查询批量接口 | 固定值：https://api.osv.dev/v1/querybatch |

## 生态文件映射表
| 依赖文件 | OSV Ecosystem | 包名格式 | 版本提取方式 |
|---|---|---|---|
| `package.json` | npm | package.json dependencies + devDependencies 的 key | value 中的版本号（去 ^~） |
| `package-lock.json` | npm | packages 的依赖名 | version 字段 |
| `yarn.lock` | npm | yarn.lock 解析的包名 | version 字段 |
| `requirements.txt` | PyPI | 包名（去掉 extras） | == 后的版本号 |
| `pyproject.toml` | PyPI | dependencies 列表中的包名 | 版本约束中的版本号 |
| `Pipfile.lock` | PyPI | default + develop 中的包名 | version 字段 |
| `pom.xml` | Maven | groupId:artifactId | 未指定版本号则跳过（可能由 parent 管理） |
| `build.gradle` | Maven | implementation/api 的依赖声明 | 版本号 |
| `go.mod` | Go | require 中的模块路径 | 版本号 |
| `go.sum` | Go | 模块路径 | 版本号 |
| `*.csproj` | NuGet | PackageReference 的 Include | Version 属性 |
| `packages.lock.json` | NuGet | packages 节点的包名 | version 字段 |
| `Gemfile.lock` | RubyGems | specs 中的 gem 名称 | 版本号 |
| `Cargo.lock` | crates.io | packages 中的 name | version 字段 |
| `composer.lock` | Packagist | packages + packages-dev 中的 name | version 字段 |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 本技能为只读探查：只读取依赖文件和调用外部 API，不得修改任何代码、配置与其他文档。
3. API 查询失败时必须如实记录失败原因，不得编造查询结果。
4. 若项目根目录不存在任何已知依赖文件，终止本技能并提示用户先安装依赖。
5. 所有文档路径必须用 {项目英文缩写} 拼接，不得臆造文件名。
6. 使用 impm_* 工具获取信息，不得编造工具返回结果。
7. 全程使用简体中文。

## 执行步骤
### 步骤 1：获取项目信息
1. 调用 impm_project_info 读取 docs/project.md，获得项目中文名称与项目英文缩写；若 docs/project.md 不存在（项目未初始化），终止本技能并提示先执行 /impm-init 完成初始化。

### 步骤 2：检测依赖文件并提取依赖清单
1. 使用 Glob 扫描项目根目录，查找已知依赖文件：
   - `package.json`、`package-lock.json`、`yarn.lock`
   - `requirements.txt`、`pyproject.toml`、`Pipfile.lock`
   - `pom.xml`、`build.gradle`
   - `go.mod`、`go.sum`
   - `*.csproj`、`packages.lock.json`
   - `Gemfile.lock`
   - `Cargo.lock`
   - `composer.lock`
2. 若未找到任何已知依赖文件，终止本技能并提示「项目根目录未检测到已知依赖文件，无法执行漏洞探查」。
3. 对找到的每个依赖文件，按「生态文件映射表」解析出包名和版本号：
   - **package.json**：读取 `dependencies` 和 `devDependencies` 对象，取每个 key 和其 value 中的版本号（去掉 `^`、`~`、`>=` 等前缀，取第一个数字版本）。
   - **package-lock.json**：读取 `packages` 对象（跳过空字符串的根条目），取每个条目的 `version` 字段；若包名以 `.pnpm/` 开头则跳过。
   - **yarn.lock**：读取文件内容，匹配格式 `\"package-name\":\n  version \"x.y.z\"` 的行，提取包名和版本号。
   - **requirements.txt**：逐行解析，忽略注释和空行，格式为 `package[extras]==version` 或 `package==version`，取 `==` 后的版本号；若无 `==` 则跳过该行（无法确定版本）。
   - **pyproject.toml**：读取 `[project.dependencies]` 或 `[tool.poetry.dependencies]` 中的依赖声明，提取包名和版本号。
   - **pom.xml**：读取 `<dependency>` 节点，取 `<groupId>:<artifactId>` 作为包名，若有 `<version>` 则取版本号；无 `<version>` 的跳过（版本由 parent BOM 管理，无法确定）。scope 为 `test`、`provided`、`system` 的跳过。
   - **build.gradle**：匹配 `implementation`、`api`、`compile` 声明，解析 `group:name:version` 格式；仅有 `group:name`（无版本）的跳过。
   - **go.mod**：读取 `require` 块中的模块路径和版本号。
   - **go.sum**：作为 go.mod 的补充，仅取 go.mod 中未包含的模块。
   - **csproj**：匹配 `<PackageReference Include=\"name\" Version=\"x.y.z\" />` 格式。
   - **packages.lock.json**：读取 `libraries` 节点中 `|` 分隔的包名和版本。
   - **Gemfile.lock**：读取 `specs:` 下的 gem 声明，格式为 `gem-name (x.y.z)`。
   - **Cargo.lock**：读取 `[[package]]` 节点，取 `name` 和 `version` 字段（跳过 name 为 `\"\"` 的根包）。
   - **composer.lock**：读取 `packages` 和 `packages-dev` 数组，取每个条目的 `name` 和 `version`。
4. 将所有提取到的依赖按 OSV Ecosystem 分组，去重后形成查询清单，记录总包数。

### 步骤 3：调用 OSV.dev API 批量查询
1. 对步骤 2 的依赖清单，按 OSV Ecosystem 构造查询请求：
   - 使用 `POST https://api.osv.dev/v1/querybatch` 接口。
   - 每次请求最多包含 100 个查询项（API 单次限制）。
   - 查询项格式：
     ```json
     {
       "package": {
         "name": "包名",
         "ecosystem": "Ecosystem"
       },
       "version": "版本号"
     }
     ```
2. 使用 Bash 工具执行 curl 命令发送请求：
   ```bash
   curl -s -X POST "https://api.osv.dev/v1/querybatch" \
     -H "Content-Type: application/json" \
     -d '{"queries": [...]}'
   ```
3. 若依赖总数超过 100 个，分批发送请求（每批 100 个），将所有响应结果合并。
4. 处理分页：若响应中某个查询项包含 `next_page_token`，需发送后续请求获取剩余结果（携带对应查询的 `page_token`），直到所有 `next_page_token` 为空。
5. 记录每个查询的响应结果：
   - `vulns` 为空数组或不存在 → 该包无已知漏洞
   - `vulns` 非空 → 提取每个漏洞的 `id` 和 `modified` 字段
6. 汇总有漏洞的包清单和无漏洞的包清单。

### 步骤 4：生成漏洞探查报告
1. 读取漏洞探查报告模板：调用 impm_template_reader 读取 VULNSCAN-TEMPLATE.MD 模板内容。
2. 按模板格式生成报告内容：
   - **表头信息**：项目名称、探查日期、探查人（TL）、依赖文件来源列表、扫描包总数、有漏洞包数、漏洞总数。
   - **漏洞明细表**：按生态分组，每条记录包含：包名、生态、版本、漏洞 ID、修改时间。按修改时间倒序排列（最新的在前）。
   - **无漏洞依赖清单**：列出所有无漏洞的包名、生态、版本。
   - **建议**：根据漏洞数量和严重程度给出简要建议（如及时升级、关注高危漏洞等）。
3. 确定报告写入路径：使用 impm_version action=current 检查是否存在版本目录。若存在版本目录（如 docs/{项目英文缩写}-v{版本号}/），将报告写入该版本目录；否则写入 docs 根目录。报告文件名固定为 `{项目英文缩写}-vulnscan.md`。
4. 使用 Write 工具将报告写入确定的路径（注：impm_doc_writer 暂不支持 vulnscan 类型，直接使用 Write 工具写入）。
5. 核对文件存在且内容完整：表头信息齐全、漏洞明细与无漏洞清单不遗漏。

## 交付物
- docs/{项目英文缩写}-vulnscan.md（漏洞探查报告）

## 完成后提示
- 向用户汇报探查结果摘要：扫描包总数、有漏洞包数、漏洞总数、报告路径。
- 若存在已知漏洞，提示用户关注并及时升级受影响的依赖。
- 若为独立命令运行，向用户汇报报告位置与漏洞摘要。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
