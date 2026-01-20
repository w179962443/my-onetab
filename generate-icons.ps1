# TabKeeper 图标生成脚本
# 此脚本使用 PowerShell 创建简单的 PNG 图标

Write-Host "TabKeeper 图标生成工具" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$iconsPath = "$PSScriptRoot\icons"

# 检查 icons 目录
if (-not (Test-Path $iconsPath)) {
    New-Item -ItemType Directory -Path $iconsPath | Out-Null
}

# 方法1: 使用在线 API 生成（推荐）
Write-Host "方法 1: 使用在线服务生成图标" -ForegroundColor Yellow
Write-Host "访问以下网址下载图标:" -ForegroundColor White
Write-Host "https://favicon.io/emoji-favicons/bookmark-tabs/" -ForegroundColor Green
Write-Host ""
Write-Host "或者:" -ForegroundColor White
Write-Host "https://www.favicon-generator.org/" -ForegroundColor Green
Write-Host ""

# 方法2: 检查是否安装了 ImageMagick
Write-Host "方法 2: 使用 ImageMagick (如果已安装)" -ForegroundColor Yellow

$magick = Get-Command magick -ErrorAction SilentlyContinue

if ($magick) {
    Write-Host "检测到 ImageMagick，正在生成图标..." -ForegroundColor Green
    
    $svgPath = Join-Path $iconsPath "icon.svg"
    
    if (Test-Path $svgPath) {
        try {
            & magick $svgPath -resize 16x16 (Join-Path $iconsPath "icon16.png")
            & magick $svgPath -resize 48x48 (Join-Path $iconsPath "icon48.png")
            & magick $svgPath -resize 128x128 (Join-Path $iconsPath "icon128.png")
            Write-Host "✓ 图标生成成功！" -ForegroundColor Green
        }
        catch {
            Write-Host "✗ 生成失败: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "✗ 找不到 icon.svg 文件" -ForegroundColor Red
    }
}
else {
    Write-Host "未安装 ImageMagick" -ForegroundColor Red
    Write-Host "安装命令: winget install ImageMagick.ImageMagick" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "方法 3: 手动下载" -ForegroundColor Yellow
Write-Host "1. 访问 https://emojipedia.org/bookmark-tabs/" -ForegroundColor White
Write-Host "2. 右键保存表情图片" -ForegroundColor White
Write-Host "3. 使用图片编辑工具调整大小为 16x16, 48x48, 128x128" -ForegroundColor White
Write-Host "4. 保存为 icon16.png, icon48.png, icon128.png" -ForegroundColor White
Write-Host ""

# 检查是否已存在图标
$icon16 = Join-Path $iconsPath "icon16.png"
$icon48 = Join-Path $iconsPath "icon48.png"
$icon128 = Join-Path $iconsPath "icon128.png"

Write-Host "当前图标状态:" -ForegroundColor Cyan
Write-Host "  icon16.png:  $(if (Test-Path $icon16) {'✓ 存在' } else {'✗ 缺失'})" -ForegroundColor $(if (Test-Path $icon16) { 'Green' } else { 'Red' })
Write-Host "  icon48.png:  $(if (Test-Path $icon48) {'✓ 存在' } else {'✗ 缺失'})" -ForegroundColor $(if (Test-Path $icon48) { 'Green' } else { 'Red' })
Write-Host "  icon128.png: $(if (Test-Path $icon128) {'✓ 存在' } else {'✗ 缺失'})" -ForegroundColor $(if (Test-Path $icon128) { 'Green' } else { 'Red' })

Write-Host ""
if ((Test-Path $icon16) -and (Test-Path $icon48) -and (Test-Path $icon128)) {
    Write-Host "✓ 所有图标已准备就绪！可以加载扩展了。" -ForegroundColor Green
}
else {
    Write-Host "⚠ 请按照上述方法生成图标后再加载扩展。" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "按 Enter 键退出"
