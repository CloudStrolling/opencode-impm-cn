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

# opencode-impm-cn 卸载脚本（Windows PowerShell 版）
# 用法：
#   .\scripts\uninstall.ps1                          # 卸载当前目录
#   .\scripts\uninstall.ps1 -Target D:\myproj        # 卸载指定项目
#   .\scripts\uninstall.ps1 -Global                  # 卸载全局安装（~/.config/opencode）
#   参数兼容多种写法：-Target/--target、-Global/--global
#
# 完整卸载本插件，仅清理本插件安装时写入的内容，保留用户自定义：
#   - 删除 .opencode/plugins/impm/ 目录与入口文件 plugins/impm.js
#   - 删除 assets 安装的 agents/commands/skills 下「本插件归属」的文件/目录
#   - 从 opencode.json 移除 opencode-impm-cn 插件注册（保留 opencode-browser 等）
#   - 清理 opencode.json 的 agent 键中 impm 管理的 agent 模型配置（保留用户自定义）

# 手动解析命令行参数，兼容 -Target/--target、-Global/--global 等写法。
# （不采用 param() 绑定：原生绑定不识别 -- 双横线参数名，会导致值解析错误）
$Target = ""
$Global = $false

$__i = 0
$__rawArgs = @($args)
while ($__i -lt $__rawArgs.Count) {
    $__token = $__rawArgs[$__i]
    if (-not $__token.StartsWith("-")) {
        Write-Error "错误：无法识别的参数 `"$__token`"，可用参数：-Target、-Global"
        exit 1
    }
    $__name = $__token.TrimStart("-") -replace "[_-]", ""
    $__name = $__name.ToLower()
    switch ($__name) {
        "global" { $Global = $true; $__i++ }
        "target" {
            if ($__i + 1 -ge $__rawArgs.Count) {
                Write-Error "错误：参数 `"$__token`" 缺少值"
                exit 1
            }
            $Target = $__rawArgs[$__i + 1]
            $__i += 2
        }
        default {
            Write-Error "错误：未知参数 `"$__token`"，可用参数：-Target、-Global"
            exit 1
        }
    }
}

$ErrorActionPreference = "Stop"

# 路径常量：插件根目录、可分发资源目录
$pluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $pluginRoot "assets"
$globalConfigDir = Join-Path $HOME ".config\opencode"
$packageName = "opencode-impm-cn"

# 解析目标：-Global 优先，其次 -Target，其次 INIT_CWD，最后回退到当前目录
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
Write-Host "  opencode-impm-cn 卸载脚本"
Write-Host "============================================"
Write-Host ""
Write-Host "目标项目: $targetRoot"
if ($Global) {
    Write-Host "模式: 全局卸载"
}
Write-Host ""

if ($Global) {
    $opencodeDir = $targetRoot
} else {
    $opencodeDir = Join-Path $targetRoot ".opencode"
}

# 1) 删除插件编译产物与入口文件
$removed = 0
$pluginDest = Join-Path $opencodeDir "plugins\impm"
$pluginEntry = Join-Path $opencodeDir "plugins\impm.js"
if (Test-Path $pluginDest) {
    Remove-Item -Path $pluginDest -Recurse -Force
    Write-Host "删除插件目录 -> $pluginDest"
    $removed++
}
if (Test-Path $pluginEntry) {
    Remove-Item -Path $pluginEntry -Force
    Write-Host "删除插件入口 -> $pluginEntry"
    $removed++
}
if ($removed -eq 0) {
    Write-Host "未发现插件编译产物（可能已卸载）"
}

# 2) 删除 agents/commands/skills 中 impm 归属的资源（保留用户其他文件）
Write-Host "清理 agents/commands/skills 中 impm 归属的资源..."
$agentRemoved = 0
$managedAgents = @()
foreach ($agentFile in Get-ChildItem -Path (Join-Path $assetsDir "agents\*.md") -ErrorAction SilentlyContinue) {
    $managedAgents += $agentFile.BaseName
}
$agentsDir = Join-Path $opencodeDir "agents"
foreach ($name in $managedAgents) {
    $file = Join-Path $agentsDir ($name + ".md")
    if (Test-Path $file) {
        Remove-Item -Path $file -Force
        $agentRemoved++
    }
}

$commandsRemoved = 0
$commandsDir = Join-Path $opencodeDir "commands"
if (Test-Path $commandsDir) {
    foreach ($item in Get-ChildItem -Path $commandsDir) {
        $base = [System.IO.Path]::GetFileNameWithoutExtension($item.Name)
        if ($base -eq "impm" -or $base.StartsWith("impm")) {
            Remove-Item -Path $item.FullName -Recurse -Force
            $commandsRemoved++
        }
    }
}

$skillsRemoved = 0
$skillsDir = Join-Path $opencodeDir "skills"
if (Test-Path $skillsDir) {
    foreach ($dir in Get-ChildItem -Path $skillsDir -Directory) {
        if ($dir.Name -eq "impm" -or $dir.Name.StartsWith("impm-") -or $dir.Name -eq "template") {
            Remove-Item -Path $dir.FullName -Recurse -Force
            $skillsRemoved++
        }
    }
}

Write-Host "已删除 impm 归属资源: agents $agentRemoved 个、commands $commandsRemoved 个、skills $skillsRemoved 个"

# 3) 清理 opencode.json 配置（plugin 注册 + agent 模型配置，保留用户自定义）
$configPath = Join-Path $targetRoot "opencode.json"
if (Test-Path $configPath) {
    $config = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json

    # 移除本插件注册名（保留其余插件，含 opencode-browser）
    if ($config.plugin) {
        $plugins = @($config.plugin | Where-Object { $_ -ne $packageName })
        if ($plugins.Count -eq 0) {
            $config.PSObject.Properties.Remove("plugin")
        } else {
            $config | Add-Member -NotePropertyName plugin -NotePropertyValue $plugins -Force
        }
        Write-Host "已从 plugin 列表移除 $packageName"
    }

    # 清理 impm 管理的 agent 模型配置（保留用户自定义 agent 及其他字段）
    $agentConfig = @{}
    if ($null -ne $config.agent) {
        $existing = $config.agent
        if ($existing -is [System.Collections.IDictionary]) {
            foreach ($k in $existing.Keys) { $agentConfig[$k] = $existing[$k] }
        } elseif ($existing -is [System.Management.Automation.PSCustomObject]) {
            foreach ($p in $existing.PSObject.Properties) { $agentConfig[$p.Name] = $p.Value }
        }
    }
    $cleaned = 0
    foreach ($name in $managedAgents) {
        if (-not $agentConfig.ContainsKey($name)) {
            continue
        }
        $entry = @{}
        $raw = $agentConfig[$name]
        if ($raw -is [System.Collections.IDictionary]) {
            foreach ($k in $raw.Keys) { $entry[$k] = $raw[$k] }
        } elseif ($raw -is [System.Management.Automation.PSCustomObject]) {
            foreach ($p in $raw.PSObject.Properties) { $entry[$p.Name] = $p.Value }
        }
        $changed = $false
        if ($entry.ContainsKey("model")) { $entry.Remove("model"); $changed = $true }
        if ($entry.ContainsKey("reasoning_effort")) { $entry.Remove("reasoning_effort"); $changed = $true }
        if ($changed) {
            $cleaned++
            if ($entry.Count -eq 0) {
                $agentConfig.Remove($name)
            } else {
                $agentConfig[$name] = $entry
            }
        }
    }
    if ($agentConfig.Count -eq 0) {
        $config.PSObject.Properties.Remove("agent")
    } else {
        $config | Add-Member -NotePropertyName agent -NotePropertyValue $agentConfig -Force
    }
    Write-Host "已清理 $cleaned 个 impm 管理的 agent 模型配置"

    [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))
} else {
    Write-Host "未找到配置文件，跳过配置清理: $configPath"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  卸载完成！"
Write-Host "  已移除插件及其注册/模型配置，用户自定义内容均被保留。"
Write-Host "============================================"