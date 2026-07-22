#!/bin/bash
# 本地启动 AI 图像工具箱
# ES Module 需要 HTTP 服务器，不能直接用 file:// 打开

PORT=${1:-8080}
echo "🚀 AI 图像工具箱已启动 → http://localhost:$PORT"
echo "按 Ctrl+C 停止"

if command -v python3 &>/dev/null; then
    python3 -m http.server "$PORT"
elif command -v python &>/dev/null; then
    python -m http.server "$PORT"
elif command -v npx &>/dev/null; then
    npx --yes serve -l "$PORT" .
else
    echo "❌ 未找到 Python 或 Node.js，请安装后再试"
    exit 1
fi
