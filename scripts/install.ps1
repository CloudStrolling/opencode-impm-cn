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
#   .\scripts\install.ps1                          # 安装到当前目录
#   .\scripts\install.ps1 -Target D:\myproj        # 安装到指定项目
#   .\scripts\install.ps1 -Global                  # 全局安装到 ~/.config/opencode
#   .\scripts\install.ps1 -AgentType opencode-go-balance  # 按预设写各 agent 模型配置
#   参数兼容多种写法：-Target/--target、-Global/--global、-AgentType/--agent-type/--AgentType/--agent_type
#
# 模型配置预设（-AgentType）：
#   - 可选值：opencode-zen-free / opencode-go-lite / opencode-go-balance /
#             opencode-go-optimize / custom
#   - 每个预设对应一套 agent 的 model + reasoning_effort 设置，定义在 scripts/agent-models.json。
#   - custom 预设为手工维护：安装时目标 opencode.json 已有该 agent 模型配置则保留，
#     仅对缺失的 agent 按预设补齐（更新插件不影响 custom 手工设置）。
#   - 不传 -AgentType：清理 opencode.json 中 impm 管理的 agent 模型配置，不写入任何设置。

# 手动解析命令行参数，兼容 -Target/--target、-Global/--global、
# -AgentType/--agent-type/--AgentType/--agent_type 等写法。
# （不采用 param() 绑定：原生绑定不识别 -- 双横线参数名，会导致值解析错误）
$Target = ""
$Global = $false
$AgentType = ""

$__i = 0
$__rawArgs = @($args)
while ($__i -lt $__rawArgs.Count) {
    $__token = $__rawArgs[$__i]
    if (-not $__token.StartsWith("-")) {
        Write-Error "错误：无法识别的参数 `"$__token`"，可用参数：-Target、-Global、-AgentType"
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
        "agenttype" {
            if ($__i + 1 -ge $__rawArgs.Count) {
                Write-Error "错误：参数 `"$__token`" 缺少值"
                exit 1
            }
            $AgentType = $__rawArgs[$__i + 1]
            $__i += 2
        }
        default {
            Write-Error "错误：未知参数 `"$__token`"，可用参数：-Target、-Global、-AgentType"
            exit 1
        }
    }
}

$ErrorActionPreference = "Stop"

# 路径常量：插件根目录、可分发资源目录、TypeScript 编译产物目录
$pluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $pluginRoot "assets"
$distDir = Join-Path $pluginRoot "dist"
$presetFile = Join-Path $PSScriptRoot "agent-models.json"
$globalConfigDir = Join-Path $HOME ".config\opencode"

# 安装时默认注册的插件（impm 套件 + 浏览器插件，供 UI/网络相关技能使用）
$defaultPlugins = @("opencode-impm-cn", "opencode-browser")

# --agent-type 可选值
$agentTypes = @("opencode-zen-free", "opencode-go-lite", "opencode-go-balance", "opencode-go-optimize", "custom")

# 将 PSCustomObject/IDictionary 统一转换为 Hashtable，便于按字符串键读写
function ConvertTo-HashTable($obj) {
    $h = @{}
    if ($null -eq $obj) {
        return $h
    }
    if ($obj -is [System.Collections.IDictionary]) {
        foreach ($k in $obj.Keys) {
            $h[$k] = $obj[$k]
        }
    } elseif ($obj -is [System.Management.Automation.PSCustomObject]) {
        foreach ($p in $obj.PSObject.Properties) {
            $h[$p.Name] = $p.Value
        }
    }
    return $h
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
if ($AgentType) {
    Write-Host "agent-type: $AgentType"
} else {
    Write-Host "agent-type: （未指定，将清理 impm 管理的 agent 模型配置）"
}
Write-Host ""

# 校验 AgentType 取值
if ($AgentType -and $agentTypes -notcontains $AgentType) {
    Write-Error "错误：未知的 AgentType `"$AgentType`"，可选值：$($agentTypes -join ', ')"
    exit 1
}

if (-not (Test-Path $assetsDir)) {
    Write-Error "错误：资源目录不存在：$assetsDir"
    exit 1
}
if ($AgentType -and -not (Test-Path $presetFile)) {
    Write-Error "错误：预设模型配置文件不存在：$presetFile"
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

$pluginDest = Join-Path $opencodeDir "plugins\impm"
$pluginEntry = Join-Path $opencodeDir "plugins\impm.js"
if (Test-Path $distDir) {
    Write-Host "安装本地插件 -> .../plugins/impm/ ..."
    # 整体删除旧的插件目录与入口文件，彻底清除历史废弃/残留的编译产物与文件
    if (Test-Path $pluginDest) {
        Remove-Item -Path $pluginDest -Recurse -Force
    }
    if (Test-Path $pluginEntry) {
        Remove-Item -Path $pluginEntry -Force
    }
    New-Item -ItemType Directory -Path $pluginDest -Force | Out-Null
    Copy-Item -Path (Join-Path $pluginRoot "package.json") -Destination $pluginDest -Force
    New-Item -ItemType Directory -Path (Join-Path $pluginDest "dist") -Force | Out-Null
    Copy-Item -Path (Join-Path $distDir "*") -Destination (Join-Path $pluginDest "dist") -Recurse -Force

    # opencode 只自动发现 plugins/ 下直接 *.js/*.ts 文件（不递归子目录），
    # 因此必须在根目录生成入口文件指向 dist 编译产物
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

# 应用 agent 模型配置预设 / 清理 impm 管理的 agent 模型配置
$managedAgents = @()
foreach ($agentFile in Get-ChildItem -Path (Join-Path $assetsDir "agents\*.md") -ErrorAction SilentlyContinue) {
    $managedAgents += $agentFile.BaseName
}

# 归一化既有 agent 配置为 Hashtable
$agentConfig = @{}
if ($null -ne $config.agent) {
    $agentConfig = ConvertTo-HashTable $config.agent
}

if (-not $AgentType) {
    # 未指定 AgentType：仅清理 impm 管理的 agent 模型配置（model/reasoning_effort），不写入
    $cleaned = 0
    foreach ($name in $managedAgents) {
        if (-not $agentConfig.ContainsKey($name)) {
            continue
        }
        $entry = ConvertTo-HashTable $agentConfig[$name]
        $changed = $false
        if ($entry.ContainsKey("model")) {
            $entry.Remove("model")
            $changed = $true
        }
        if ($entry.ContainsKey("reasoning_effort")) {
            $entry.Remove("reasoning_effort")
            $changed = $true
        }
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
    Write-Host "未指定 AgentType：已清理 $cleaned 个 impm 管理的 agent 模型配置（保留其他自定义 agent）"
} else {
    # 读取预设并写入各 agent 模型配置
    $presets = Get-Content -Path $presetFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $preset = $presets."$AgentType"
    if ($null -eq $preset -or $null -eq $preset.agents) {
        Write-Error "错误：预设文件缺少 `"$AgentType`" 定义"
        exit 1
    }

    $synced = 0
    $preserved = 0
    foreach ($name in $preset.agents.PSObject.Properties.Name) {
        $setting = $preset.agents."$name"
        $existing = $null
        if ($agentConfig.ContainsKey($name)) {
            $existing = ConvertTo-HashTable $agentConfig[$name]
        }
        # custom 预设：已存在的模型配置不覆盖（更新插件不影响手工维护的设置）
        if ($AgentType -eq "custom" -and $null -ne $existing -and $existing.ContainsKey("model")) {
            $preserved++
            continue
        }
        if ($null -eq $existing) {
            $existing = @{}
        }
        $existing["model"] = $setting.model
        $existing["reasoning_effort"] = $setting.reasoning_effort
        $agentConfig[$name] = $existing
        $synced++
    }
    $config | Add-Member -NotePropertyName agent -NotePropertyValue $agentConfig -Force
    $msg = "已按预设 $AgentType 为 $synced 个 agent 写入模型配置"
    if ($preserved -gt 0) {
        $msg += "，保留 $preserved 个既有 custom 配置"
    }
    Write-Host $msg
}

[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))

Write-Host ""
Write-Host "============================================"
Write-Host "  安装完成！"
Write-Host "  使用 /impm 命令启动AI项目经理全流程开发。"
Write-Host "============================================"