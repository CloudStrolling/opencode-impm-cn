# Tasks: opencode-v2-dual-compat

> 任务编号规则：`P<阶段>.<序号>`。阶段与 proposal 中的 P0–P4 对应。
> 每项任务标注对应的 spec REQ 与验收标准 ID，完成后逐项勾选。

---

## P0 — 双入口骨架与宿主探测（地基，必须先落地）

- [x] **P0.1** 建立 `src/host/detect.ts`：实现 `detectHost(input)`，经 `ctx.app.version`（V2）与 `(await client.app.get()).data.version`（V1）取版本，`major` 取版本号首段数值比较并容忍 `v2.0.0-beta` 形式；探测失败降级为 `major=1` 且不抛异常。导出 `HostEnv` 接口。〔R2.1 R2.2〕

- [x] **P0.2** 建立 `src/host/session.ts`：定义 `SessionPort { abort(sessionId), prompt(sessionId, text) }`，分别实现 V1（`client.session.abort` / `client.session.chat`，含 `abort(id)`→`abort({path})` 双形态回退）与 V2（`ctx.session.interrupt({sessionID, continue:false})` / `ctx.session.prompt`）；两者均容忍宿主 API 缺失，失败仅告警。另提供 `NULL_SESSION_PORT`。〔R2.3〕

- [x] **P0.3** 建立 `src/tools/tool-defs.ts`：把 15 个工具定义抽取为**单一属性表** `STATIC_TOOL_DEFS`（11 静态 + 4 动态适配），导出 `toV1Args()` / `toV2Input()` / `toV1Result()` / `toV2Result()` / `adaptDynamicTool()`。〔R3.6〕

- [x] **P0.4** 建立 `src/runtime/v1.ts`：承接原 `src/index.ts` 全部逻辑，返回 `{ tool, "chat.message", event }` 形态不变。〔R1.1 R3.4〕

- [x] **P0.5** 建立 `src/runtime/v2.ts`：实现 `runV2(ctx)`——`ctx.tool.transform` 注册 15 个工具（返回 `{content}`）→ `ctx.session.hook("prompt")` → `ctx.event.subscribe({signal})` 循环；返回 cleanup（`AbortController.abort()`）；含 `resolveLocation()` 会话目录解析（`ctx.session.get().location.directory` + `subpath`，失败回落 `ctx.location.directory`）。〔R1.1 R3.2 R3.3 R3.5 R4.3〕

- [x] **P0.6** 重写 `src/index.ts` 为双形态 default 导出：`{ id: "impm", setup: runV2, server: runV1 }`。〔R1.1 R1.2〕

- [x] **P0.7** 更新 `package.json`：`peerDependencies` + `peerDependenciesMeta: { "@opencode/plugin": { optional: true } }`；`engines` 增加 `"opencode": ">=1.18.29"`。**实施偏差**：本机 npm 代理无法解析 `@opencode/plugin`（E500），编译期硬依赖它会使 `npm install` 失败，故改用本地结构类型 `src/host/plugin-types.ts` 描述 2.x 契约（与官方类型结构兼容），**编译期与运行期均零依赖**，比原方案的 `import type` 更彻底地满足 R1.3 意图。〔R1.3 R1.4〕〔AC2〕

- [x] **P0.8** `scripts/install-core.mjs` 增加 `detectHostMajor()`（优先用调用方传入值，否则 `opencode --version`，失败降级 1）与 `variantOf()`；`updateOpenCodeConfig` 改为**双键并写** `plugin`+`plugins`、`agent`+`agents`（后者 `model#variant`，`max→high` 并告警）。已实测验证。〔R6.1 R6.2 R6.4〕

- [x] **P0.9** `ensureInstalled()` 双条件自检（插件版本 + `hostMajor`），`impm-manifest.json` 新增 `hostMajor` 字段；宿主跨版本时自动重装。同时新建 `src/host/install.ts`：`resolvePluginRoot()` 按「name=opencode-impm-cn 的 package.json」向上查找包根，修复模块深度变化导致的路径错误（P0 冒烟测试中发现并修复）。〔R6.3〕

- [ ] **P0.10** P0 验收：
  - [x] 双运行时冒烟测试通过（21 项断言全绿：导出形态、V1 15 工具 + 2 钩子、V2 15 工具 + input schema + prompt 钩子 + cleanup、V1/V2 工具实际执行返回正确结果）
  - [x] `npm run build` 通过，`dist/index.js` 无 `@opencode/plugin` 运行时引用（仅注释提及）〔AC2〕
  - [ ] opencode 1.18.29+ 实机加载验证（插件列表出现 `impm`）— 待真实宿主
  - [ ] opencode 2.x 实机加载验证 — 待真实宿主

- [x] **P0.11**（新增）建立 `src/host/log.ts` 统一日志出口：V1 绑定 `client.app.log` 结构化 sink，V2 走 console（2.x 已移除该端点）。〔设计 R9〕

---

## P1 — 自定义工具双形态完整实现

- [ ] **P1.1** 15 个工具全部改由 `tool-defs.ts` 属性表驱动，删除 `src/index.ts` 中重复的 `createStringSchema` / `createArraySchema` 内联定义。〔R3.6〕

- [ ] **P1.2** 实现 `toV2Input()`：`{ type: "object", properties, additionalProperties: false }`，确保数组参数（如 `sourceDirs`/`excludeDirs`）的 `items` 正确。〔R3.2〕

- [ ] **P1.3** 实现 V2 结果封装 `toV2Result()`：标量 → `{content: String}`，对象 → `{content: JSON.stringify(r, null, 2)}`；确认 V2 是否接受 `{output}` 后决定是否同时返回两字段。〔R3.3〕〔待验证 V2〕

- [ ] **P1.4** 实现 V2 工作目录解析：经 `ctx.session.get({sessionID}).location.directory` + `subpath`，失败回落 `ctx.location.directory`；`projectRoot` 参数缺省时使用该值。〔R3.5〕

- [ ] **P1.5** 接入 `context.signal` 到可取消的 IO 操作；确认实现不引用 V2 已移除的 `directory`/`abort`/`metadata`/`callID` 字段。〔R3.5〕

- [ ] **P1.6** `src/tools/*.ts` 全量走查：移除对宿主 `client` 与 V2 `ctx` 的直接引用，只接受端口参数。〔R2.4〕

- [ ] **P1.7** P1 验收：15 个 `impm_*` 工具在 V1 与 V2 下各调用一次，输出语义一致；V2 侧无裸字符串返回。〔AC3 AC4〕

---

## P2 — 钩子与事件订阅迁移

- [ ] **P2.1** `src/tools/prompt-recorder.ts`：把 `chat.message` 的记录逻辑抽为平台无关的 `onPrompt(sessionID, text)`；V1 runtime 负责从 `output.parts` 提取文本，V2 runtime 负责从 `event.prompt.text` 提取。〔R4.1〕

- [ ] **P2.2** 实现 prompt 幂等去重：按 `sessionID + text 前 120 字符` 建立 TTL 5s 的短窗去重集合，替代现有 `busy` 布尔量。〔R4.4〕

- [ ] **P2.3** 把 `event` 事件处理抽为平台无关的 `onEvent(event)`；V1 传 `{event}` 载荷，V2 传订阅流元素。复用现有 `extractSessionId()` 多形态防御。〔R4.2〕

- [ ] **P2.4** 实测校正 V2 的 `V2EventEncoded` 事件结构（`session.idle` / `session.error` / `message.updated` 的 props 形态），修正解析逻辑。〔待验证 V3〕

- [ ] **P2.5** `runV2` 返回 cleanup 函数：`AbortController.abort()` 终止事件订阅，并清理所有定时器。〔R4.3〕

- [ ] **P2.6** P2 验收：两版本下 `docs/prompts/prompts.md` 均正确记录提问且无重复行；并发提交不产生重复记录。〔AC5 AC6〕

---

## P3 — 解除 SQLite 私有 schema 耦合

- [ ] **P3.1** 建立 `src/host/activity.ts`：定义 `ActivityPort { lastActive, childSessions, lastAssistantError, tokenUsage }`。〔R5.1〕

- [ ] **P3.2** 实现 V1 ActivityPort：包装 `heartbeat.ts:242-380` 与 `progress.ts` 现有 SQL（`message.time_created` / `part.time_updated` / `json_extract(data,...)` / `session.parent_id`）。〔R5.3〕

- [ ] **P3.3** 实现 V2 ActivityPort：由 `ctx.tool.hook("execute.after")` + 事件流维护内存活跃表；子会话识别经 `ctx.session.list()`，若不暴露父子关系则降级为「排除主会话 + 事件流建表」。〔R5.1 R5.2〕〔待验证 V4〕

- [ ] **P3.4** `defaultDbPath()` 增加 `OPENCODE_DB` 优先链：`OPENCODE_DB` → `OPENCODE_DATA` → `~/.local/share/opencode/opencode.db`。〔R5.4〕

- [ ] **P3.5** `src/tools/heartbeat.ts` 改接 `SessionPort` + `ActivityPort`，移除对 `OpencodeClientLike` 的直连；`createHeartbeatMonitor` 签名改为接受端口。〔R2.3 R5.1〕

- [ ] **P3.6** `src/tools/progress.ts` 的 token 统计改走 `ActivityPort.tokenUsage()`；DB 不可用时降级为空统计并告警，不中断其余功能。〔R5.3〕〔场景 5〕

- [ ] **P3.7** 静态检查：`src/**` 中 V2 执行路径不得出现 `time_created` / `time_updated` / `json_extract(data`（允许仅存在于 V1 adapter 文件内）。〔AC7〕

- [ ] **P3.8** P3 验收：V2 下 heartbeat 能检测并中止卡死子会话，告警写入 `docs/prompts/heartbeat.md`，PM 能据此重启 subagent。〔AC8〕

---

## P4 — 资产、安装与文档收尾

- [ ] **P4.1** 实测验证 V2 是否正确翻译 `permission: { task: { ba: allow } }` 嵌套映射与 `{ "*": "deny" }`；若失败则启用双资产树 `assets/`(v1) + `assets-v2/`(v2)，由安装器按 `hostMajor` 选择。〔R7.1〕〔待验证 V1〕

- [ ] **P4.2** `.opencode/agents/*.md`（13 个）：删除 `todowrite: allow`；其余 `permission:` 映射保持 legacy 形态不变。〔R7.1 R7.2〕

- [ ] **P4.3** `.opencode/commands/*.md`（66 个）：`subtask:` → `subagent:`；核查无嵌套调度，如有则配置 `experimental.subagent_depth`。〔R7.3〕〔待验证 R6 风险〕

- [ ] **P4.4** 资产走查：确认 skill 目录名与 frontmatter `name` 一致、无嵌套目录；确认 command 正文无 `@file` 引用。〔R7.4 R7.5〕

- [ ] **P4.5** 验证 `opencode-browser` 是否支持 V2，从 `DEFAULT_PLUGINS` 中移除或改为可选安装项。〔待验证 V5〕

- [ ] **P4.6** 统一日志封装 `log()`：V1 走 `client.app.log()`，V2 走 `console`（V2 已无结构化日志端点）。〔设计 R9〕

- [ ] **P4.7** `readme.md` 与 `agent.md`：补充双版本安装说明（V1 `plugin` / V2 `plugins`、`opencode plugin add`）、最低宿主版本 1.18.29、能力差异表（`bash`→`shell`、`task`→`subagent`、`todowrite` 移除）。修正现有 `plugin`/`plugins` 混用。〔R8〕

- [ ] **P4.8** 端到端回归：V1 与 V2 下各跑一轮 `/impm-init` → `/impm-docs` → `/impm-coding` → `/impm-finish`。〔AC11〕

- [ ] **P4.9** 跨版本升级验证：V1 装好后升级到 V2，配置零手工修改可用。〔AC10〕

- [ ] **P4.10** 安装器验收：两版本下分别确认写入 `plugin`+`agent` 与 `plugins`+`agents`；并确认 V1 运行时对未知的 `plugins`/`agents` 键不报错（若报错则改为按 major 单写 + 插件自愈补写）。〔AC9〕〔设计 R2〕

---

## Verification

- [ ] **V.1** 双机矩阵就绪：opencode 1.18.29+ 与 2.x 两套可用环境（Windows 优先）。
- [ ] **V.2** 静态检查：`dist/index.js` 无 `@opencode/plugin` 运行时 import；`src/**` V2 路径无 V1 DB 字段引用。〔AC2 AC7〕
- [ ] **V.3** 逐工具清单：15 个 `impm_*` 工具在两版本下各调用一次并比对输出。〔AC3〕
- [ ] **V.4** 端到端：两版本各跑一轮全流程 `/impm-init` → `/impm-finish`。〔AC11〕
- [ ] **V.5** 跨版本升级：V1 → V2 零配置修改可用。〔AC10〕
- [ ] **V.6** 资产走查：无 `todowrite` 授权项、无 `@file` 引用、skill ID 无冲突。〔AC12〕
- [ ] **V.7** 风险项闭环：specs 中 V1–V6 六个待验证项全部有实测结论并回写文档。