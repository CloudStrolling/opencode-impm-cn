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

param(
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"

# 路径常量：插件根目录、可分发资源目录、TypeScript 编译产物目录
$pluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $pluginRoot "assets"
$distDir = Join-Path $pluginRoot "dist"

# 解析安装目标项目：-Target 参数优先，其次 INIT_CWD（npm 依赖安装场景），最后回退到当前目录
if ($Target -ne "") {
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
Write-Host ""

if (-not (Test-Path $assetsDir)) {
    Write-Error "错误：资源目录不存在：$assetsDir"
    exit 1
}

$opencodeDir = Join-Path $targetRoot ".opencode"

# 复制 agents/commands/skills 资源到目标项目 .opencode/（逐个目录处理，缺失则跳过）
foreach ($dir in @("commands", "agents", "skills")) {
    $srcDir = Join-Path $assetsDir $dir
    $destDir = Join-Path $opencodeDir $dir
    if (-not (Test-Path $srcDir)) {
        Write-Warning "跳过：源目录不存在 $srcDir"
        continue
    }
    Write-Host "复制 $dir/ -> .opencode/$dir/ ..."
    # 先删除已存在的目标目录，避免 Copy-Item 把源目录嵌套复制进已有目录（重复安装）
    if (Test-Path $destDir) {
        Remove-Item -Path $destDir -Recurse -Force
    }
    Copy-Item -Path $srcDir -Destination $destDir -Recurse -Force
}

if (Test-Path $distDir) {
    $pluginDest = Join-Path $opencodeDir "plugins\impm"
    Write-Host "安装本地插件 -> .opencode/plugins/impm/ ..."
    New-Item -ItemType Directory -Path $pluginDest -Force | Out-Null
    Copy-Item -Path (Join-Path $pluginRoot "package.json") -Destination $pluginDest -Force
    # 先清空旧目标目录，再复制 dist 内容（而非目录本身），避免嵌套出 dist/dist（幂等安装）
    $pluginDistDest = Join-Path $pluginDest "dist"
    if (Test-Path $pluginDistDest) {
        Remove-Item -Path $pluginDistDest -Recurse -Force
    }
    New-Item -ItemType Directory -Path $pluginDistDest -Force | Out-Null
    Copy-Item -Path (Join-Path $distDir "*") -Destination $pluginDistDest -Recurse -Force

    # opencode 只自动发现 .opencode/plugins/ 下直接 *.js/*.ts 文件（不递归子目录），
    # 因此必须在根目录生成入口文件指向 dist 编译产物
    $pluginEntry = Join-Path $opencodeDir "plugins\impm.js"
    [System.IO.File]::WriteAllText($pluginEntry, 'export { default } from "./impm/dist/index.js";' + [Environment]::NewLine)
    Write-Host "生成插件入口文件 -> .opencode/plugins/impm.js"
} else {
    Write-Warning "跳过：dist 目录不存在（请先执行 npm run build）: $distDir"
}

# 确保 .opencode/package.json 声明 ESM（入口文件 impm.js 使用 export 语法）
$opencodePkgPath = Join-Path $opencodeDir "package.json"
if (Test-Path $opencodePkgPath) {
    $pkgJson = Get-Content -Path $opencodePkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pkgJson.type -ne "module") {
        $pkgJson | Add-Member -NotePropertyName type -NotePropertyValue "module" -Force
        [System.IO.File]::WriteAllText($opencodePkgPath, ($pkgJson | ConvertTo-Json -Depth 10))
        Write-Host "更新 .opencode/package.json（type: module）"
    }
} else {
    [System.IO.File]::WriteAllText($opencodePkgPath, '{"type": "module"}')
    Write-Host "生成 .opencode/package.json（type: module）"
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
    $plugins = @($config.plugin)
    if ($plugins -notcontains "opencode-impm-cn") {
        $plugins += "opencode-impm-cn"
    }
    $config | Add-Member -NotePropertyName plugin -NotePropertyValue $plugins -Force
    Write-Host "配置文件已更新: $configPath（plugin: opencode-impm-cn）"
} else {
    Write-Host "本地自安装：跳过 config.plugin 注册（插件入口文件由 .opencode/plugins/ 自动发现）"
}
[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10))

Write-Host ""
Write-Host "============================================"
Write-Host "  安装完成！"
Write-Host "  使用 /impm 命令启动AI项目经理全流程开发。"
Write-Host "============================================"
