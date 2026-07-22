@echo off
REM 本地启动 AI 图像工具箱
REM ES Module 需要 HTTP 服务器，不能直接用 file:// 打开

set PORT=8080
echo 🚀 AI 图像工具箱已启动 → http://localhost:%PORT%
echo 按 Ctrl+C 停止

python -m http.server %PORT%
pause
