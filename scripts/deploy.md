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

1. 复制 `assets/commands` → 目标项目 `.opencode/commands`
2. 复制 `assets/agents` → 目标项目 `.opencode/agents`
3. 复制 `assets/skills` → 目标项目 `.opencode/skills`
4. 复制 `dist/` + `package.json` → 目标项目 `.opencode/plugins/impm/`（OpenCode 启动时自动加载本地插件）
5. 更新目标项目 `opencode.json`（非自安装场景追加 plugin 配置）

### 3.2 部署到指定项目

```bash
node scripts/install.mjs --target /path/to/project
```

Windows PowerShell：

```powershell
.\scripts\install.ps1 -Target D:\path\to\project
```

### 3.3 作为 npm 依赖部署（消费方项目）

```bash
npm install opencode-impm-cn
```

安装到消费方项目后，postinstall 会自动把 assets 复制到消费方项目的 `.opencode/` 并注册插件。

### 3.4 发布到 npm（可选）

```bash
# 1) 编译并检查产物
npm run build

# 2) 本地验证安装
npm pack
# 在临时项目中执行：npm install <生成的tgz文件>

# 3) 发布
npm publish --access public
```

发布前确认 `package.json` 的 `files` 字段包含：`dist/`、`assets/`、`scripts/install.mjs`。

## 4. 部署验证

安装完成后，按以下步骤验证：

```bash
# 1) 确认目录结构
#    .opencode/commands/  → 45 个命令
#    .opencode/agents/    → 13 个 agent
#    .opencode/skills/    → 45 个技能 + template/
#    .opencode/plugins/impm/ → 插件编译产物

# 2) 确认 opencode.json 配置正确（自安装时无需注册 plugin）

# 3) 重启 OpenCode，输入 /impm 应能启动项目经理全流程
```

## 5. 升级与回滚

### 升级

```bash
# 重新编译并重新安装，安装脚本会覆盖 .opencode/ 下旧文件
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
