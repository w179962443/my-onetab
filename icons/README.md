# 图标生成说明

由于项目需要 PNG 格式的图标，请使用以下方法生成：

## 方法 1：在线工具生成

1. 访问 https://www.favicon-generator.org/
2. 上传 `icon.svg` 或使用表情符号 📑
3. 下载生成的图标
4. 重命名为以下文件并放入此文件夹：
   - icon16.png (16x16)
   - icon48.png (48x48)
   - icon128.png (128x128)

## 方法 2：使用 PowerShell + ImageMagick

如果安装了 ImageMagick，可以运行：

```powershell
# 安装 ImageMagick
# winget install ImageMagick.ImageMagick

# 转换 SVG 为 PNG
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

## 方法 3：简单临时方案

在浏览器中直接使用表情符号作为图标：

1. 打开 https://emoji-favicon.com/
2. 输入 📑 表情符号
3. 下载生成的图标文件
