@echo off
chcp 65001 > nul
title 你画我猜 - 一键部署到公网

echo 🚀 你画我猜 - 一键部署到公网
echo ==============================
echo.

REM 检查 Node.js
node --version > nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装
    echo 请访问 https://nodejs.org/ 下载安装 Node.js
    echo 安装完成后重新运行此脚本
    pause
    exit /b 1
)

REM 检查项目文件
if not exist "package.json" (
    echo ❌ 请在项目根目录运行此脚本
    pause
    exit /b 1
)

echo 📦 正在安装项目依赖...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

echo 📡 正在安装 localtunnel...
call npm install -g localtunnel
if errorlevel 1 (
    echo ❌ localtunnel 安装失败
    pause
    exit /b 1
)

echo 🚀 正在启动游戏服务器...
start /B node server.js

REM 等待服务器启动
timeout /t 5 > nul

REM 生成随机子域名
set /a rand=%random% %% 90000 + 10000
set SUBDOMAIN=guess-draw-%rand%

echo 🌐 正在创建公网隧道...
echo ⏳ 请稍等...

REM 启动 localtunnel
start /B lt --port 3000 --subdomain %SUBDOMAIN%

timeout /t 8 > nul

set PUBLIC_URL=https://%SUBDOMAIN%.loca.lt

echo.
echo 🎉 部署成功！
echo ==================================
echo 📍 公网游戏地址: %PUBLIC_URL%
echo 🎮 分享这个地址给朋友一起玩！
echo.
echo ⚠️  重要提示：
echo    - 首次访问可能需要点击 'Click to Continue'
echo    - 如果无法访问，请稍等1-2分钟再试
echo    - 关闭此窗口将停止服务
echo.
echo 🔄 服务运行中... 按任意键停止服务
echo.

pause > nul

echo.
echo 🛑 正在停止服务...
taskkill /f /im node.exe > nul 2>&1
taskkill /f /im lt.cmd > nul 2>&1
echo ✅ 服务已停止

pause