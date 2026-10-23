# Spec: opencode-v2-dual-compat

## Requirements

### REQ-1 单包双版本入口

插件必须以**单一 npm 包**同时支持 opencode 1.x（≥ 1.18.29）与 2.x，两版本用户使用同一个包名、同一条安装命令。

- **R1.1** 包的 `default` 导出同时具备 V1 `server` 入口与 V2 `setup(ctx)` 入口，二者互不感知、互不翻译对方的钩子。
- **R1.2** V2 侧必须具备稳定且唯一的插件 `id`（`impm`），用于 `ctx.storage` 作用域与插件状态识别。
- **R1.3** 不得对 `@opencode/plugin` 产生运行时依赖：V2 类型仅经 `import type` 引入并在编译期擦除；该包只出现在 `devDependencies` 与 `peerDependencies`（optional）。
- **R1.4** V1 用户安装插件时，不得因缺少 `@opencode/plugin` 而报错或静默不加载。

### REQ-2 宿主版本探测与平台抽象

插件必须在运行时确定宿主主版本，并把两个版本的差异收敛到平台抽象层，业务工具层不感知宿主版本。

- **R2.1** V2 通过 `ctx.app.version`、V1 通过 `(await client.app.get()).data.version` 取得宿主版本；探测失败时按 V1 降级处理且不抛出异常。
- **R2.2** 统一抽象 `HostEnv`，至少暴露 `major`、`version`、`projectRoot`、会话控制端口。
- **R2.3** 会话控制抽象出 `abort(sessionId)` 与 `prompt(sessionId, text)`；V2 分别映射 `ctx.session.interrupt({sessionID, continue:false})` 与 `ctx.session.prompt()`，V1 保持 `client.session.abort()` 与 `client.session.chat()`。
- **R2.4** 工具业务层（`src/tools/*.ts`）不得直接引用 `client`、V2 `ctx` 或任何宿主专有字段。

### REQ-3 自定义工具双形态注册

15 个 `impm_*` 自定义工具必须在两个版本下均已注册、可被模型调用、返回正确结果。

- **R3.1** 工具名称、描述、参数语义在两版本下保持一致，避免模型行为漂移。
- **R3.2** V2 走 `ctx.tool.transform(editor => editor.add(...))`，`input` 为完整 JSON Schema（含 `type:"object"`、`properties`、`additionalProperties:false`）。
- **R3.3** V2 工具返回值符合 `Tool.Result` 形态（`{content}` 或 `{output}`），不得返回裸字符串。
- **R3.4** V1 工具返回值保持 `string` 或 `{output}` 形态，以满足 v1.18+ 工具桥接层约束。
- **R3.5** V2 `execute` 第二参为 `{sessionID, agent, messageID, id, signal, progress}`；实现不得依赖已移除的 `directory` / `abort` / `metadata` / `callID` 字段，工作目录须经 `ctx.session.get()` 或 `ctx.location.directory` 获取，取消须使用 `signal`。
- **R3.6** 工具参数 schema 由**单一属性表**派生，禁止为两个版本各维护一份描述。

### REQ-4 钩子与事件订阅迁移

prompt-recorder 与 heartbeat 的两个钩子必须在两版本下均生效。

- **R4.1** 用户提问记录：V1 用 `chat.message`、V2 用 `ctx.session.hook("prompt", ...)`；V2 取文本自 `event.prompt.text`。
- **R4.2** 事件处理：V1 用 `event: async ({event})`，V2 用 `for await (const e of ctx.event.subscribe({signal}))`。
- **R4.3** V2 的 `setup` 必须返回 cleanup 函数，在其中 `AbortController.abort()` 以终止事件订阅。
- **R4.4** prompt 记录必须幂等：V2 官方声明 prompt hook **非 exactly-once**（并发提交可能多次触发），须去重且重复触发不得产生重复记录。

### REQ-5 解除 SQLite 私有 schema 耦合

插件不得在 V2 下依赖 V1 的数据库表结构。

- **R5.1** 会话父子关系、工作目录、assistant 错误信息、token 用量四项数据，V2 下须经 `ctx.session.*` API 或事件流获得。
- **R5.2** 会话活跃时间在 V2 下由内存活跃表维护，数据源为 `ctx.tool.hook("execute.after")` 与事件流；不得轮询数据库。
- **R5.3** V1 保留现有 DB 查询作为回退实现，且 DB 不可用时插件其余功能不得中断。
- **R5.4** DB 路径解析须同时支持 `OPENCODE_DB`（V2）与 `OPENCODE_DATA`（V1）及默认路径。

### REQ-6 安装器与宿主配置

安装器必须按宿主版本写入正确的配置键，且用户跨版本升级后无需手工改配置。

- **R6.1** V1 写 `plugin` 数组与 `agent[name].{model, reasoning_effort}`；V2 写 `plugins` 数组与 `agents[name].model = "provider/model#variant"`。
- **R6.2** 采用双键并写策略：同时写入两套键，由各自宿主运行时忽略不认识的键。
- **R6.3** 保留运行时 `ensureInstalled()` 自愈机制（V2 后台安装包，postinstall 不保证执行）。
- **R6.4** `reasoning_effort` 到 V2 model variant 的映射须覆盖 `low`/`medium`/`high`/`max` 四档及自定义档位。
- **R6.5** 安装失败不得阻断插件加载，须告警并在下次启动重试。

### REQ-7 资产文件跨版本可用

145 个资产文件在两版本下均须正确加载。

- **R7.1** 13 个 agent 保持 legacy `permission:` 映射形态（V2 自动翻译），不得改为 V2 原生 `permissions` 数组，否则破坏 V1。
- **R7.2** 移除 V2 已不存在的工具授权项（`todowrite`）。
- **R7.3** command 的 `subtask` 迁移为 `subagent`，且 `agent`、`description`、`model` 保持不变。
- **R7.4** skill 的目录名与 frontmatter `name` 保持一致（ID 由路径叶子推导），不得引入嵌套目录以免 ID 塌陷冲突。
- **R7.5** 不得在 command 正文中使用 `@file` 引用（V2 不再自动展开文件内容）。

## Behavior

### 场景 1：V2 用户首次安装

1. 用户执行 `opencode plugin add opencode-impm-cn` 或在 `opencode.jsonc` 写 `plugins: ["opencode-impm-cn"]`。
2. 宿主加载包，读取 `default` 导出，识别出 `id: "impm"` 并调用 `setup(ctx)`。
3. `setup` 通过 `ctx.app.version` 判定 major=2，选择 V2 runtime。
4. 插件自检安装：探测到 `.opencode/impm-manifest.json` 版本不符，动态加载 `scripts/install-core.mjs` 重跑安装。
5. 安装器检测宿主为 V2，写入 `plugins` 与 `agents` 键，资产文件落到 `.opencode/`。
6. 15 个工具经 `ctx.tool.transform` 注册，prompt hook 与事件订阅建立。
7. 用户可直接使用 `/impm-init` 等命令与 `impm_*` 工具。

### 场景 2：V1 用户（≥1.18.29）安装

1. 用户在 `opencode.json` 写 `plugin: ["opencode-impm-cn"]`。
2. 宿主发现 default 导出为对象，调用其 `server()` 方法（即 V1 runtime），传入 V1 `PluginInput`。
3. V1 runtime 经 `(await client.app.get()).data.version` 判定 major=1。
4. 工具以 V1 `args` 形态注册，钩子以 `chat.message` / `event` 形态返回。
5. 行为与改造前完全一致。

### 场景 3：用户跨版本升级

1. 用户从 1.x 升级到 2.x，重新启动宿主。
2. `setup` 判定 major=2，运行时自检发现 manifest 版本变化或宿主版本变化，重跑安装。
3. 安装器补写 `plugins` / `agents` 键，旧的 `plugin` / `agent` 键保留但被 V2 忽略。
4. 用户配置零手工修改即可继续使用。

### 场景 4：heartbeat 检测卡死子会话

1. PM 派发的 subagent 子会话长时间无工具活动。
2. V2 下由 `ctx.tool.hook("execute.after")` 与事件流维护的活跃表判定超时；V1 下沿用 DB 查询判定。
3. 判定超时后经 `SessionPort.abort()` 中止子会话——V2 走 `ctx.session.interrupt`，V1 走 `client.session.abort`。
4. 告警追加到 `docs/prompts/heartbeat.md`，PM 收到信号后用原提示词重新派发同一 subagent。

### 场景 5：V2 下 DB 不可用

1. `OPENCODE_DB` 未设置或默认路径下无数据库文件。
2. 依赖数据库的能力（token 统计回填）降级为空统计并告警。
3. 其余 15 个工具、prompt 记录、心跳检测照常工作。

## Acceptance Criteria

| # | 验收项 | 判定方式 |
|---|---|---|
| AC1 | 同一包在 opencode 1.18.29+ 与 2.x 下均成功加载并出现在插件列表 | 两版本实机 `插件状态` 均出现 `impm` |
| AC2 | V1 环境下 `require.resolve('@opencode/plugin')` 不存在于运行时依赖树 | 检查 `package.json` + 安装后依赖树 |
| AC3 | 15 个 `impm_*` 工具在两版本下均可被模型调用且返回正确结果 | 逐工具实机调用 |
| AC4 | V2 下工具返回值不含裸字符串，schema 为完整 JSON Schema | 代码走查 + 实机调用日志 |
| AC5 | 两版本下 `docs/prompts/prompts.md` 均正确记录用户提问且无重复行 | 跑 `/impm-init` 全流程后检查文件 |
| AC6 | V2 下 prompt hook 并发触发不产生重复记录 | 构造并发提交验证 |
| AC7 | V2 下无任何对 `message`/`part` 表 V1 字段的 SQL 查询 | 代码走查 `src/**` 无 `time_created`/`json_extract(data` |
| AC8 | V2 下 heartbeat 能检测并中止卡死子会话，告警写入 heartbeat.md | 构造卡死子会话实机验证 |
| AC9 | 安装器在两版本下分别写入 `plugin`+`agent` 与 `plugins`+`agents` | 两版本各跑一次安装后检查 opencode.json |
| AC10 | 用户从 1.x 升级到 2.x 后配置零手工修改可用 | 跨版本升级实机验证 |
| AC11 | 两版本下 `/impm-init` → `/impm-finish` 全流程跑通 | 双机端到端回归 |
| AC12 | 资产中无 `todowrite` 授权项，无 `@file` 引用 | 资产走查 |

## 风险与待验证项

以下事项在实施中必须先行实测确认，方案不得建立在未证实的假设上：

| # | 待验证 | 影响 | 验证方式 |
|---|---|---|---|
| V1 | V2 是否正确翻译 `permission: { task: { ba: allow } }` 嵌套映射与 `{ "*": "deny" }` | 决定 REQ-7.1 是否需改为双资产树 | V2 实机检查 13 个 agent 的实际生效权限 |
| V2 | `Tool.Result` 是否接受 `{output}` 而非 `{content}` | 决定 R3.3 封装形态 | 官方 API schema + 实机 |
| V3 | `V2EventEncoded` 事件 payload 实际结构 | 决定 R4.2 事件解析 | `/v2/docs/api#schema-V2EventEncoded` + 实机 |
| V4 | `ctx.session.list()/get()` 是否暴露父子关系字段 | 决定 R5.1 | 实机 |
| V5 | `opencode-browser` 是否支持 V2 | 决定安装器 `DEFAULT_PLUGINS` | npm + 实机 |
| V6 | V1 ≥1.18.29 遇到「default 对象 + named export」是否重复注册 | 决定是否保留 named export 兜底 | 查 v1 loader 源码 + 实机 |