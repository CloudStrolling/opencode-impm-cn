# Copyright 2026 jenemy8023 <jenemy8023@163.com>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# opencode-impm-cn 安装脚本（Windows PowerShell 版）
# 用法：
#   .\scripts\install.ps1                    # 安装到当前目录
#   .\scripts\install.ps1 -Target D:\myproj  # 安装到指定项目
#   .\scripts\install.ps1 -Global            # 全局安装到 ~/.config/opencode
#
# 模型配置同步：安装时会为 assets/agents 下定义的每个 agent，在对应的
# opencode.json（全局安装写全局配置，非全局安装写项目配置）写入按角色分配的
# opencode-go 模型与思考深度（见 $agentModelMap）。

param(
    [string]$Target = "",
    [switch]$Global
)

$ErrorActionPreference = "Stop"

# 路径常量：插件根目录、可分发资源目录、TypeScript 编译产物目录
$pluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $pluginRoot "assets"
$distDir = Join-Path $pluginRoot "dist"
$globalConfigDir = Join-Path $HOME ".config\opencode"

# 安装时默认注册的插件（impm 套件 + 浏览器插件，供 UI/网络相关技能使用）
$defaultPlugins = @("opencode-impm-cn", "opencode-browser")

# 各 agent 的默认模型与思考深度（模型均来自 opencode-go provider，按角色职责与成本配置）
$agentModelMap = @{
    "pm"  = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "low" }  # 编排调度、决策判断
    "scm" = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "low" }   # git/版本管理
    "ba"  = @{ model = "opencode-go/glm-5.2";           reasoning_effort = "high" } # 需求文档撰写
    "sa"  = @{ model = "opencode-go/glm-5.2";           reasoning_effort = "max" }  # 系统架构设计
    "tl"  = @{ model = "opencode-go/deepseek-v4-pro";   reasoning_effort = "high" }  # 详细设计/API/代码审核
    "dba" = @{ model = "opencode-go/glm-5.2"; reasoning_effort = "high" } # 数据库设计
    "te"  = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "high" } # 测试用例/测试代码
    "cs"  = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "low" } # 本地代码查询
    "ws"  = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "low" } # 网络资料查询
    "sse" = @{ model = "opencode-go/deepseek-v4-pro"; reasoning_effort = "max" }  # 复杂业务编码
    "fee" = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "high" }  # 前端编码
    "bee" = @{ model = "opencode-go/deepseek-v4-pro"; reasoning_effort = "high" }  # 后端编码
    "dw"  = @{ model = "opencode-go/deepseek-v4-flash"; reasoning_effort = "high" } # 文档编写
}

# 解析安装目标：-Global 优先，其次 -Target，其次 INIT_CWD（npm 依赖安装场景），最后回退到当前目录
if ($Global) {
    $targetRoot = $globalConfigDir
} elseif ($Target -ne "") {
    $targetRoot = $Target
} elseif ($env:INIT_CWD -and ((Resolve-Path $env:INIT_CWD) -ne $pluginRoot)) {
    $targetRoot = $env:INIT_CWD
} else {
    $targetRoot = Get-Location
}

Write-Host "============================================"
Write-Host "  opencode-impm-cn 安装脚本"
Write-Host "============================================"
Write-Host ""
Write-Host "插件目录: $pluginRoot"
Write-Host "目标项目: $targetRoot"
if ($Global) {
    Write-Host "安装模式: 全局安装"
}
Write-Host ""

if (-not (Test-Path $assetsDir)) {
    Write-Error "错误：资源目录不存在：$assetsDir"
    exit 1
}

# 全局安装时资源直接放入全局配置目录（agents/commands/skills），非全局安装放入项目 .opencode/
if ($Global) {
    $opencodeDir = $targetRoot
} else {
    $opencodeDir = Join-Path $targetRoot ".opencode"
}

# 复制 agents/commands/skills 资源到目标目录（逐个目录处理，缺失则跳过）
foreach ($dir in @("commands", "agents", "skills")) {
    $srcDir = Join-Path $assetsDir $dir
    $destDir = Join-Path $opencodeDir $dir
    if (-not (Test-Path $srcDir)) {
        Write-Warning "跳过：源目录不存在 $srcDir"
        continue
    }
    Write-Host "复制 $dir/ -> $destDir/ ..."
    # 先删除已存在的目标目录，避免 Copy-Item 把源目录嵌套复制进已有目录（重复安装）
    if (Test-Path $destDir) {
        Remove-Item -Path $destDir -Recurse -Force
    }
    Copy-Item -Path $srcDir -Destination $destDir -Recurse -Force
}

if (Test-Path $distDir) {
    $pluginDest = Join-Path $opencodeDir "plugins\impm"
    Write-Host "安装本地插件 -> .../plugins/impm/ ..."
    New-Item -ItemType Directory -Path $pluginDest -Force | Out-Null
    Copy-Item -Path (Join-Path $pluginRoot "package.json") -Destination $pluginDest -Force
    # 先清空旧目标目录，再复制 dist 内容（而非目录本身），避免嵌套出 dist/dist（幂等安装）
    $pluginDistDest = Join-Path $pluginDest "dist"
    if (Test-Path $pluginDistDest) {
        Remove-Item -Path $pluginDistDest -Recurse -Force
    }
    New-Item -ItemType Directory -Path $pluginDistDest -Force | Out-Null
    Copy-Item -Path (Join-Path $distDir "*") -Destination $pluginDistDest -Recurse -Force

    # opencode 只自动发现 plugins/ 下直接 *.js/*.ts 文件（不递归子目录），
    # 因此必须在根目录生成入口文件指向 dist 编译产物
    $pluginEntry = Join-Path $opencodeDir "plugins\impm.js"
    [System.IO.File]::WriteAllText($pluginEntry, 'export { default } from "./impm/dist/index.js";' + [Environment]::NewLine)
    Write-Host "生成插件入口文件 -> .../plugins/impm.js"
} else {
    Write-Warning "跳过：dist 目录不存在（请先执行 npm run build）: $distDir"
}

# 确保 opencodeDir/package.json 声明 ESM（入口文件 impm.js 使用 export 语法）
$opencodePkgPath = Join-Path $opencodeDir "package.json"
if (Test-Path $opencodePkgPath) {
    $pkgJson = Get-Content -Path $opencodePkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pkgJson.type -ne "module") {
        $pkgJson | Add-Member -NotePropertyName type -NotePropertyValue "module" -Force
        [System.IO.File]::WriteAllText($opencodePkgPath, ($pkgJson | ConvertTo-Json -Depth 10))
        Write-Host "更新 $opencodeDir/package.json（type: module）"
    }
} else {
    [System.IO.File]::WriteAllText($opencodePkgPath, '{"type": "module"}')
    Write-Host "生成 $opencodeDir/package.json（type: module）"
}

# 更新 opencode.json 配置（npm 安装模式注册插件名；本地自安装模式由入口文件自动发现）
$configPath = Join-Path $targetRoot "opencode.json"
if (Test-Path $configPath) {
    $config = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $config = @{}
}
if (-not $config.'$schema') {
    $config | Add-Member -NotePropertyName '$schema' -NotePropertyValue "https://opencode.ai/config.json" -Force
}
$resolvedTarget = (Resolve-Path $targetRoot).Path
$isSelfInstall = ($resolvedTarget -eq $pluginRoot.Path)
if (-not $isSelfInstall) {
    $plugins = @()
    if ($config.plugin) {
        $plugins = @($config.plugin)
    }
    foreach ($p in $defaultPlugins) {
        if ($plugins -notcontains $p) {
            $plugins += $p
        }
    }
    $config | Add-Member -NotePropertyName plugin -NotePropertyValue $plugins -Force
    Write-Host "配置文件已更新: $configPath（plugin: $($defaultPlugins -join ', ')）"
} else {
    Write-Host "本地自安装：跳过 config.plugin 注册（插件入口文件由 plugins/ 自动发现）"
}

# 同步每个 agent 的模型与思考深度到 opencode.json 的 agent 键（按角色分配 opencode-go 模型）
$agentConfig = @{}
if ($null -ne $config.agent) {
    $existing = $config.agent
    if ($existing -is [System.Collections.IDictionary]) {
        foreach ($k in $existing.Keys) { $agentConfig[$k] = $existing[$k] }
    } elseif ($existing -is [System.Management.Automation.PSCustomObject]) {
        foreach ($p in $existing.PSObject.Properties) { $agentConfig[$p.Name] = $p.Value }
    }
}
$syncedCount = 0
foreach ($agentFile in Get-ChildItem -Path (Join-Path $assetsDir "agents\*.md") -ErrorAction SilentlyContinue) {
    $name = $agentFile.BaseName
    $setting = $agentModelMap[$name]
    if (-not $setting) {
        continue
    }
    # 将既有条目（可能是 PSCustomObject 或 Hashtable）归一为 Hashtable，便于按字符串键写入
    $entry = @{}
    if ($agentConfig.ContainsKey($name) -and $null -ne $agentConfig[$name]) {
        $existingEntry = $agentConfig[$name]
        if ($existingEntry -is [System.Collections.IDictionary]) {
            foreach ($k in $existingEntry.Keys) { $entry[$k] = $existingEntry[$k] }
        } elseif ($existingEntry -is [System.Management.Automation.PSCustomObject]) {
            foreach ($p in $existingEntry.PSObject.Properties) { $entry[$p.Name] = $p.Value }
        }
    }
    $entry["model"] = $setting["model"]
    $entry["reasoning_effort"] = $setting["reasoning_effort"]
    $agentConfig[$name] = $entry
    $syncedCount++
}
$config | Add-Member -NotePropertyName agent -NotePropertyValue $agentConfig -Force
if ($syncedCount -gt 0) {
    Write-Host "已为 $syncedCount 个 agent 写入模型配置（按角色分配 opencode-go 模型）"
}

[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))

Write-Host ""
Write-Host "============================================"
Write-Host "  安装完成！"
Write-Host "  使用 /impm 命令启动AI项目经理全流程开发。"
Write-Host "============================================"
