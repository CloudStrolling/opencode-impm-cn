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

$pluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $pluginRoot "assets"
$distDir = Join-Path $pluginRoot "dist"

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
    Copy-Item -Path $distDir -Destination (Join-Path $pluginDest "dist") -Recurse -Force
} else {
    Write-Warning "跳过：dist 目录不存在（请先执行 npm run build）: $distDir"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  安装完成！"
Write-Host "  使用 /impm 命令启动AI项目经理全流程开发。"
Write-Host "============================================"
