# 编译与部署流程（scripts/deploy.md）

> 本文档说明 opencode-impm-cn 套件自身的编译、安装与部署流程。
> 适用场景：在目标项目中使用本套件前，需要先编译插件并安装到 `.opencode/` 目录。

---

## 1. 环境要求

- Node.js >= 18（建议 20+）
- npm >= 9
- OpenCode（支持插件、技能、命令）

## 2. 编译流程

```bash
# 1) 安装依赖（首次）
npm install

# 2) 编译 TypeScript 源码到 dist/
npm run build

# 3) 校验产物
#    dist/ 目录应包含 index.js、tools/、utils/ 等编译结果
```

编译产物说明：

| 目录/文件 | 说明 |
| --- | --- |
| `dist/index.js` | 插件入口（OpenCode 加载入口） |
| `dist/tools/` | 11 个工具的编译产物 |
| `dist/utils/` | 路径/版本/git 等工具函数编译产物 |
| `assets/` | 套件资源（agents、commands、skills、模板） |

> 开发调试可用 `npm run dev`（tsc --watch 自动增量编译）。

## 3. 部署流程

### 3.1 本地部署（安装到当前项目）

```bash
# 方式一：npm install 触发 postinstall 自动安装
npm install

# 方式二：手动执行安装脚本
node scripts/install.mjs
```

安装脚本执行内容：

1. 复制 `assets/commands` → 目标目录 `commands/`（项目安装为 `.opencode/commands`，全局安装为全局配置目录 `commands`）
2. 复制 `assets/agents` → 目标目录 `agents/`（项目安装为 `.opencode/agents`，全局安装为全局配置目录 `agents`）
3. 复制 `assets/skills` → 目标目录 `skills/`（项目安装为 `.opencode/skills`，全局安装为全局配置目录 `skills`）
4. 复制 `dist/` + `package.json` → 目标目录 `plugins/impm/`（非自安装场景整体删除旧插件目录与入口后重装，避免历史产物残留；assets 亦按幂等覆盖写入）
5. 更新目标 `opencode.json`（非自安装场景追加 plugin 配置）
6. 依据 `--agent-type` 预设同步每个 impm 管理 agent 的模型与思考深度到 `opencode.json` 的 `agent` 键（详见 3.5）

### 3.2 部署到指定项目

```bash
node scripts/install.mjs --target /path/to/project
```

Windows PowerShell：

```powershell
.\scripts\install.ps1 -Target D:\path\to\project
```

### 3.3 全局安装

将 agents/commands/skills/插件安装到 opencode 全局配置目录（`~/.config/opencode`），所有项目均可使用 `/impm`，并把每个 agent 的模型配置写入全局 `opencode.json`：

```bash
node scripts/install.mjs --global
```

Windows PowerShell：

```powershell
.\scripts\install.ps1 -Global
```

> 说明：全局安装会把 agents/commands/skills 直接放入 `~/.config/opencode/` 对应目录，并把每个 agent 的模型配置写入 `~/.config/opencode/opencode.json` 的 `agent` 键。

### 3.4 作为 npm 依赖部署（消费方项目）

```bash
npm install opencode-impm-cn
```

安装到消费方项目后，postinstall 会自动把 assets 复制到消费方项目的 `.opencode/` 并注册插件、同步各 agent 模型配置。

### 3.5 Agent 模型配置参考

安装脚本通过 `--agent-type` 指定一套预设（全部预设定义在 `scripts/agent-models.json`，改模型只改该文件；默认不传 `--agent-type` 时只清理不写入，不会自动套用某预设）：

| 预设 | 说明 |
|:-----|:-----|
| `opencode-zen-free` | 全部 agent 使用 opencode-zen/deepseek-v4-flash-free，极限省 token |
| `opencode-go-lite` | 全部 agent 使用 opencode-go 低价模型，轻量低成本 |
| `opencode-go-balance` | 综合成本与职责权衡分配（原固定配置，推荐） |
| `opencode-go-optimize` | 重点 agent 分配更强模型，追求质量 |
| `custom` | 按既有配置为准：已存在 model 的 agent 保持不动，缺失的按 balance 档补齐 |

`custom` 预设语义：**安装/升级绝不覆盖用户手工改过的模型配置**，只补齐缺失 agent，避免升级覆盖个性化设置。

```bash
# 示例：按 balance 预设安装
node scripts/install.mjs --agent-type opencode-go-balance
node scripts/install.mjs --target /path/to/project --agent-type opencode-go-optimize
# Windows PowerShell（兼容 -AgentType/--agent-type/--AgentType/--agent_type 等多种写法）
.\scripts\install.ps1 -Target D:\path\to\project -AgentType opencode-go-lite
.\scripts\install.ps1 -Target D:\path\to\project --agent-type opencode-go-lite
```

- 不传 `--agent-type`：只清理 impm 管理 agent 的 `model`/`reasoning_effort`（幂等，供升级时重装），不写入任何模型配置，**不动用户自定义 agent 与其他字段**。
- 传未知值：报错退出（exit 1），不执行任何安装动作。
- 13 个 impm 管理 agent（pm/scm/ba/sa/tl/dba/te/cs/ws/sse/fee/bee/dw）的默认角色分配参考 balance 档：

| Agent | 模型 | 思考深度 | 角色 |
|:-----:|:-----|:--------:|:-----|
| pm  | opencode-go/deepseek-v4-flash | low | 编排调度、决策判断 |
| scm | opencode-go/deepseek-v4-flash | low | git/版本管理 |
| ba  | opencode-go/deepseek-v4-pro | high | 需求文档撰写 |
| sa  | opencode-go/deepseek-v4-pro | max | 系统架构设计 |
| tl  | opencode-go/deepseek-v4-pro | high | 详细设计/API/代码审核 |
| dba | opencode-go/deepseek-v4-flash | max | 数据库设计 |
| te  | opencode-go/deepseek-v4-flash | high | 测试用例/测试代码 |
| cs  | opencode-go/deepseek-v4-flash | low | 本地代码查询 |
| ws  | opencode-go/deepseek-v4-flash | low | 网络资料查询 |
| sse | opencode-go/deepseek-v4-pro | high | 复杂业务编码 |
| fee | opencode-go/deepseek-v4-flash | high | 前端编码 |
| bee | opencode-go/deepseek-v4-flash | max | 后端编码 |
| dw  | opencode-go/deepseek-v4-flash | high | 文档编写 |

> 上表为 `balance` 档具体值，其余预设及 custom 补齐值以 `scripts/agent-models.json` 为准。

### 3.6 Agent 模型配置清理（不传 agent-type）

不传 `--agent-type` 安装时，脚本对 impm 管理的 13 个 agent 只做模型配置清理（`model` 与 `reasoning_effort`），其余配置（自定义字段、用户自建 agent、opencode-browser 插件）一律保留，便于在改预设前先清除旧配置。

### 3.6.1 历史版本残留清理（安装清单 impm-manifest.json）

安装脚本维护累积安装清单 `.opencode/impm-manifest.json`（`everInstalled` 历史并集，**只增不减**），解决「历史版本已改名/移出但安装副本残留」的清理问题（尤其 agents 以角色名命名、不满足 impm 前缀规则）：

- **安装时**：有清单则按 `everInstalled` 精确删除「历史已装、当前已不存在」的残留（含更名/移除的 agent、命令、技能及历史插件注册、历史 agent 模型配置键），再复制当前资源；无清单（首次安装）按启发式清理（commands/skills 按 `impm*` 前缀 + 同名，agents 按同名）。
- **卸载时**（uninstall.mjs / uninstall.ps1）：按清单精确删除本次与历史上所有 impm 归属项，不依赖 `impm*` 前缀、也不依赖包内 assets 是否存在（先删包再卸载也能清干净）；同时回滚 `.opencode/package.json` 中由 install 写入的 `type:module`，最后删除清单文件本身。
- 用户自建 / 其他插件的非 impm 内容（`myuser.md`、`zzz-*.md` 等）在安装与卸载中均被保留。

### 3.7 卸载

卸载只删除本插件相关内容，**保留用户自定义内容**（自建 agent、命令、技能、`opencode-browser` 插件、其他字段）：

```bash
# 直接卸载（node 版）
node scripts/uninstall.mjs
# 指定目标项目
node scripts/uninstall.mjs --target /path/to/project
# PowerShell 版
.\scripts\uninstall.ps1 -Target D:\path\to\project
# 通过 npm scripts 在当前项目卸载
npm run uninstall:plugin
```

卸载内容：

1. 删除 `plugins/impm/` 与插件入口 `plugins/impm.js`
2. 按安装清单精确删除 impm 归属的 `agents/`（13 个）、`commands/`（51 个）、`skills/`（51 个 + template）；无清单时回退启发式（`impm*` 前缀 / 当前 assets 集合）
3. 从 `opencode.json` 移除 impm 历史插件注册（保留其他插件）
4. 清理 impm 管理的 agent（当前 assets ∪ 清单历史）的 `model`/`reasoning_effort` 字段（用户自定义 agent 完全不动）
5. 若清单记录 install 曾写入 `type:module`，回滚 `.opencode/package.json`
6. 删除安装清单文件 `impm-manifest.json`

### 3.8 发布到 npm（可选）

```bash
# 1) 编译并检查产物
npm run build

# 2) 本地验证安装
npm pack
# 在临时项目中执行：npm install <生成的tgz文件>

# 3) 发布
npm publish --access public
```

发布前确认 `package.json` 的 `files` 字段包含：`dist/`、`assets/`、`scripts/install.mjs`、`scripts/uninstall.mjs`、`scripts/install.ps1`、`scripts/uninstall.ps1`、`scripts/agent-models.json`。

## 4. 部署验证

安装完成后，按以下步骤验证：

```bash
# 1) 确认目录结构
#    .opencode/commands/  → 51 个命令
#    .opencode/agents/    → 13 个 agent
#    .opencode/skills/    → 51 个技能 + template/ 17 个模板
#    .opencode/impm-manifest.json → 累积安装清单（历史残留清理依据）
#    .opencode/plugins/impm/ → 插件编译产物

# 2) 确认 opencode.json 配置正确（自安装时无需注册 plugin）

# 3) 重启 OpenCode，输入 /impm 应能启动项目经理全流程
```

## 5. 升级与回滚

### 升级

```bash
# 重新编译并重新安装，安装脚本会按累积清单清理历史残留、整体重建插件目录与入口，并按 `--agent-type` 同步模型配置（默认不传：只清理不写入；custom 预设会保留用户已手工调整过的模型设置）
npm run build
node scripts/install.mjs
```

### 回滚

- 本地部署：备份并恢复旧版 `assets/` 与 `dist/` 后重新执行 `node scripts/install.mjs`。
- 版本备份：建议使用 git 对套件源码打 tag（如 `v0.1.0`），需要回滚时 `git checkout` 对应 tag 后重新编译安装。

## 6. 常见问题

| 问题 | 处理 |
| --- | --- |
| `dist` 目录不存在 | 先执行 `npm run build` 再运行安装脚本 |
| `.opencode` 下文件未更新 | 安装脚本会覆盖复制；确认目标项目路径正确（`--target`） |
| `/impm` 命令不可用 | 重启 OpenCode；确认 `.opencode/skills/impm/SKILL.md` 与 `.opencode/commands/impm.md` 存在 |
| 插件工具不生效 | 确认 `.opencode/plugins/impm/dist/index.js` 存在且可加载（查看 OpenCode 启动日志） |

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
