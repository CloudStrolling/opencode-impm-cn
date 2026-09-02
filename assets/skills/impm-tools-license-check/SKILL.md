---
name: impm-tools-license-check
description: 检查所有开源依赖的许可证声明，检测依赖库 License 类型，检测 Copyleft（GPL/AGPL）传染性冲突，最终在 docs 目录下给出完整的检测报告
---

# impm-tools-license-check 技能

## 触发词
许可证检查、license check、开源合规、License 检测、copyleft 检查、GPL 检测、AGPL 检测、开源许可证、license compliance、tools-license-check

## 何时使用
需要对当前项目的所有第三方依赖进行开源许可证合规检查，检测各依赖的许可证类型，识别 Copyleft（GPL/AGPL）传染性冲突风险，并输出检测报告时使用。可独立执行，也可在阶段4代码审核后追加执行。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-tools-license-check，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对检测报告已生成且内容完整，全部正确后才能结束。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
|---|---|---|
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接报告路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| ClearlyDefined API | 许可证查询 API | 固定值：https://api.clearlydefined.io/definitions |

## 许可证分类体系
| 分类 | 许可证列表 | 风险等级 | 说明 |
|---|---|---|---|
| 宽松型 | MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, CC0-1.0, Unlicense, 0BSD, BlueOak-1.0.0 | 无风险 | 可自由使用，无传染性 |
| 弱 Copyleft | LGPL-2.0, LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-1.0, EPL-2.0, CPL-1.0 | 低风险 | 修改该库需开源该库，不传染主项目（动态链接时） |
| 强 Copyleft | GPL-2.0, GPL-3.0, AGPL-3.0 | 高风险 | 传染性：使用/链接即要求整个项目以相同许可证开源 |
| 禁止商业 | SSPL-1.0, BSL-1.1, BUSL-1.1, SSPL | 高风险 | 商业使用受限 |
| 未识别 | 无法确定许可证类型 | 中风险 | 需人工确认，可能存在合规风险 |

## 生态文件映射表
| 依赖文件 | 生态 | 本地 license 获取方式 | API 查询格式 |
|---|---|---|---|
| `package.json` | npm | `node_modules/{pkg}/package.json` 的 `license` 字段 | npm/{pkg}/{version} |
| `package-lock.json` | npm | `node_modules/{pkg}/package.json` 的 `license` 字段 | npm/{pkg}/{version} |
| `requirements.txt` | PyPI | `{site-packages}/{pkg}-{version}.dist-info/METADATA` 的 `License:` 字段 | pypi/{pkg}/{version} |
| `pyproject.toml` | PyPI | `{site-packages}/{pkg}-{version}.dist-info/METADATA` 的 `License:` 字段 | pypi/{pkg}/{version} |
| `pom.xml` | Maven | `{m2_repo}/{group}/{artifact}/{version}/{artifact}-{version}.pom` 的 license 节点 | maven/{group}/{artifact}/{version} |
| `go.mod` | Go | Go 模块代理 `https://proxy.golang.org/{module}/@v/{version}.mod` 的 license | go/{module}/{version} |
| `*.csproj` | NuGet | NuGet API 查询 | nuget/{pkg}/{version} |
| `Cargo.lock` | crates.io | crates.io API 查询 | crates/{pkg}/{version} |
| `Gemfile.lock` | RubyGems | RubyGems API 查询 | gem/{pkg}/{version} |
| `composer.lock` | Packagist | Packagist API 查询 | composer/{pkg}/{version} |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 本技能为只读探查：只读取依赖文件、本地元数据文件和调用外部 API，不得修改任何代码、配置与其他文档。
3. API 查询失败时必须如实记录失败原因，不得编造查询结果。
4. 若项目根目录不存在任何已知依赖文件，终止本技能并提示用户先安装依赖。
5. 所有文档路径必须用 {项目英文缩写} 拼接，不得臆造文件名。
6. 使用 impm_* 工具获取信息，不得编造工具返回结果。
7. 全程使用简体中文。
8. 许可证识别必须基于实际证据（本地元数据或 API 返回），禁止臆测或编造许可证类型。

## 执行步骤
### 步骤 1：获取项目信息
1. 调用 impm_project_info 读取 docs/project.md，获得项目中文名称与项目英文缩写；若 docs/project.md 不存在（项目未初始化），终止本技能并提示先执行 /impm-init 完成初始化。

### 步骤 2：检测项目自身许可证
1. 检查项目根目录下是否存在 `LICENSE`、`LICENSE.md`、`LICENSE.txt`、`COPYING`、`COPYING.md` 等许可证文件。
2. 若存在，读取文件内容，识别许可证类型（匹配 SPDX 标准许可证标识符）。
3. 同时检查 `package.json` 的 `license` 字段（若存在），与 LICENSE 文件比对一致性。
4. 记录项目自身许可证类型，作为后续传染性冲突检测的基准。

### 步骤 3：检测依赖文件并提取依赖清单
1. 使用 Glob 扫描项目根目录，查找已知依赖文件：
   - `package.json`、`package-lock.json`、`yarn.lock`
   - `requirements.txt`、`pyproject.toml`、`Pipfile.lock`
   - `pom.xml`、`build.gradle`
   - `go.mod`、`go.sum`
   - `*.csproj`、`packages.lock.json`
   - `Gemfile.lock`
   - `Cargo.lock`
   - `composer.lock`
2. 若未找到任何已知依赖文件，终止本技能并提示「项目根目录未检测到已知依赖文件，无法执行许可证检查」。
3. 对找到的每个依赖文件，按「生态文件映射表」解析出包名和版本号：
   - **package.json**：读取 `dependencies` 和 `devDependencies` 对象，取每个 key 和其 value 中的版本号（去掉 `^`、`~`、`>=` 等前缀，取第一个数字版本）。
   - **package-lock.json**：读取 `packages` 对象（跳过空字符串的根条目），取每个条目的 `version` 字段；若包名以 `.pnpm/` 开头则跳过。
   - **yarn.lock**：读取文件内容，匹配格式 `"package-name":\n  version "x.y.z"` 的行，提取包名和版本号。
   - **requirements.txt**：逐行解析，忽略注释和空行，格式为 `package[extras]==version` 或 `package==version`，取 `==` 后的版本号；若无 `==` 则跳过该行。
   - **pyproject.toml**：读取 `[project.dependencies]` 或 `[tool.poetry.dependencies]` 中的依赖声明，提取包名和版本号。
   - **pom.xml**：读取 `<dependency>` 节点，取 `<groupId>:<artifactId>` 作为包名，若有 `<version>` 则取版本号；无 `<version>` 的跳过。scope 为 `test`、`provided`、`system` 的跳过。
   - **build.gradle**：匹配 `implementation`、`api`、`compile` 声明，解析 `group:name:version` 格式。
   - **go.mod**：读取 `require` 块中的模块路径和版本号。
   - **go.sum**：作为 go.mod 的补充，仅取 go.mod 中未包含的模块。
   - **csproj**：匹配 `<PackageReference Include="name" Version="x.y.z" />` 格式。
   - **packages.lock.json**：读取 `libraries` 节点中 `|` 分隔的包名和版本。
   - **Gemfile.lock**：读取 `specs:` 下的 gem 声明，格式为 `gem-name (x.y.z)`。
   - **Cargo.lock**：读取 `[[package]]` 节点，取 `name` 和 `version` 字段（跳过 name 为 `""` 的根包）。
   - **composer.lock**：读取 `packages` 和 `packages-dev` 数组，取每个条目的 `name` 和 `version`。
4. 将所有提取到的依赖按生态分组，去重后形成查询清单，记录总包数。

### 步骤 4：本地优先获取许可证信息
1. 对步骤 3 的依赖清单，按生态逐包尝试本地获取许可证：
   - **npm 生态**：检查 `node_modules/{pkg}/package.json` 是否存在，若存在读取 `license` 字段。若为数组（如 `["MIT", "Apache-2.0"]`）则取第一个。同时检查 `node_modules/{pkg}/LICENSE*`、`node_modules/{pkg}/COPYING*` 文件名作为补充识别。
   - **PyPI 生态**：检查 `{site-packages}/{pkg}-{version}.dist-info/METADATA` 文件，读取 `License:` 字段；或检查 `{site-packages}/{pkg}-{version}.dist-info/license_files/` 目录下的许可证文件名。
   - **Maven 生态**：检查本地 Maven 仓库 `{user_home}/.m2/repository/{group_path}/{artifact}/{version}/{artifact}-{version}.pom` 中的 `<licenses><license>` 节点。
   - **Go 生态**：检查模块缓存 `{gopath}/pkg/mod/{module}@{version}/LICENSE` 文件名。
   - 其他生态：若本地无法直接获取，跳过本地步骤，统一走 API 查询。
2. 记录每个依赖的本地许可证获取结果：已获取 / 未获取。
3. 统计本地已获取和未获取的包数量。

### 步骤 5：API 回退查询缺失的许可证信息
1. 对步骤 4 中本地未获取到许可证的依赖，构造 ClearlyDefined API 查询请求：
   - 接口：`POST https://api.clearlydefined.io/definitions`
   - 请求体格式（批量）：
     ```json
     {
       "coordinates": [
         "npm/{pkg}/{version}",
         "pypi/{pkg}/{version}",
         ...
       ]
     }
     ```
   - 单条查询接口：`GET https://api.clearlydefined.io/definitions/{type}/{provider}/{name}/{version}`
2. 使用 Bash 工具执行 curl 命令发送请求：
   ```bash
   curl -s -X POST "https://api.clearlydefined.io/definitions" \
     -H "Content-Type: application/json" \
     -d '{"coordinates": ["npm/package-name/1.0.0", ...]}'
   ```
3. 从响应中提取 `licensed.declared` 字段作为许可证标识（SPDX 格式）。
4. 若 API 查询失败（网络错误、包不存在等），在报告中标注「查询失败」并记录失败原因。
5. 将 API 返回的许可证信息与本地获取结果合并，形成最终的许可证清单。

### 步骤 6：许可证分类与 Copyleft 冲突检测
1. 对每个依赖的许可证，按「许可证分类体系」匹配分类和风险等级：
   - 精确匹配 SPDX 标准标识符（如 `MIT`、`Apache-2.0`、`GPL-3.0-only`）。
   - 模糊匹配：包含关键词的许可证（如包含 `GPL` 的归入强 Copyleft，包含 `LGPL` 的归入弱 Copyleft）。
   - 无法匹配的标记为「未识别」。
2. Copyleft 传染性冲突检测：
   - 读取步骤 2 中确定的项目自身许可证。
   - **场景一**：项目为非 Copyleft 许可证（MIT/Apache/BSD 等），依赖中存在 GPL-2.0/GPL-3.0 → 标记为**传染性冲突**（GPL 要求整体开源）。
   - **场景二**：项目为非 Copyleft 许可证，依赖中存在 AGPL-3.0 → 标记为**传染性冲突**（AGPL 要求网络交互也开源）。
   - **场景三**：项目为 GPL-2.0，依赖中存在 GPL-3.0 或 AGPL-3.0 → 标记为**版本不兼容冲突**（GPL-2.0 仅兼容 GPL-2.0+，不兼容 AGPL）。
   - **场景四**：项目为 GPL-3.0，依赖中存在 AGPL-3.0 → 标记为**传染性冲突**（AGPL 比 GPL 更严格）。
   - **弱 Copyleft 条件冲突**：LGPL/MPL 依赖若被静态链接（编译进二进制），也标记为条件冲突；若为动态链接则仅标注为需注意。
3. 区分直接依赖和传递依赖：
   - 直接依赖：在 `package.json`/`requirements.txt`/`pom.xml` 等主依赖文件中声明的包。
   - 传递依赖：仅出现在 lock 文件中、由直接依赖引入的包。
   - 传递依赖的 Copyleft 风险通常低于直接依赖，但在发布时仍需评估。

### 步骤 7：生成检测报告
1. 读取检测报告模板：调用 impm_template_reader（templateName=TOOLS-LICENSE-CHECK-TEMPLATE.MD）读取模板全文。
2. 按模板格式生成报告内容：
   - **探查概况**：项目名称、探查日期、探查人（TL）、依赖文件来源列表、扫描包总数、项目自身许可证。
   - **许可证分类统计表**：按宽松型/弱Copyleft/强Copyleft/禁止商业/未识别分组，统计各类包数。
   - **依赖许可证明细表**：每个依赖的包名、生态、版本、许可证标识、分类、风险等级、依赖类型（直接/传递）、获取方式（本地/API）。
   - **Copyleft 传染性冲突检测**：冲突依赖清单（若有），包含包名、版本、许可证、冲突类型、影响范围、修复建议。
   - **探查结论与建议**：总体合规评估、风险等级汇总、整改建议。
3. 确定报告写入路径：使用 impm_version action=current 检查是否存在版本目录。若存在版本目录（如 docs/{项目英文缩写}-v{版本号}/），将报告写入该版本目录；否则写入 docs 根目录。报告文件名固定为 `{项目英文缩写}-license-check.md`。
4. 使用 Write 工具将报告写入确定的路径。
5. 核对文件存在且内容完整：探查概况、分类统计、明细表、冲突检测、结论建议齐全。

## 交付物
- docs/{项目英文缩写}-license-check.md（开源许可证合规检查报告）

## 完成后提示
- 向用户汇报探查结果摘要：扫描包总数、各分类包数、Copyleft 冲突数（若有）、报告路径。
- 若存在强 Copyleft 传染性冲突，高亮提醒用户关注合规风险并给出整改建议。
- 若为独立命令运行，向用户汇报报告位置与合规检查摘要。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
