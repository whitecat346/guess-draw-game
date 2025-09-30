#!/bin/bash

# 一键快速部署脚本 - 使用 localtunnel (最简单)
echo "🚀 你画我猜 - 一键快速部署"
echo "========================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在尝试安装..."
    
    # 检测系统类型并安装 Node.js
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install -y nodejs npm
        elif command -v yum &> /dev/null; then
            sudo yum install -y nodejs npm
        else
            echo "请手动安装 Node.js: https://nodejs.org/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "请安装 Homebrew 或手动安装 Node.js: https://nodejs.org/"
            exit 1
        fi
    else
        echo "请手动安装 Node.js: https://nodejs.org/"
        exit 1
    fi
fi

# 检查项目文件
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 安装依赖
echo "📦 正在安装项目依赖..."
npm install

# 安装 localtunnel
echo "📡 正在安装 localtunnel..."
npm install -g localtunnel

# 启动服务器
echo "🚀 正在启动游戏服务器..."
node server.js &
SERVER_PID=$!

# 等待服务器启动
sleep 5

# 生成随机子域名
SUBDOMAIN="guess-draw-$(date +%s | tail -c 6)"

echo "🌐 正在创建公网隧道..."
echo "⏳ 请稍等..."

# 启动 localtunnel
lt --port 3000 --subdomain $SUBDOMAIN > /dev/null 2>&1 &
LT_PID=$!

sleep 8

# 构建公网地址
PUBLIC_URL="https://$SUBDOMAIN.loca.lt"

echo ""
echo "🎉 部署成功！"
echo "=================================="
echo "📍 公网游戏地址: $PUBLIC_URL"
echo "🎮 分享这个地址给朋友一起玩！"
echo ""
echo "⚠️  重要提示："
echo "   - 首次访问可能需要点击 'Click to Continue'"
echo "   - 如果无法访问，请稍等1-2分钟再试"
echo "   - 按 Ctrl+C 停止服务"
echo ""
echo "🔄 服务运行中..."

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    kill $SERVER_PID $LT_PID 2>/dev/null
    echo "✅ 服务已停止"
    exit 0
}

# 捕获 Ctrl+C
trap cleanup INT

# 保持运行并显示状态
while true; do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "❌ 游戏服务器已停止"
        break
    fi
    
    if ! kill -0 $LT_PID 2>/dev/null; then
        echo "❌ 隧道服务已断开，正在重新连接..."
        lt --port 3000 --subdomain $SUBDOMAIN > /dev/null 2>&1 &
        LT_PID=$!
    fi
    
    sleep 10
done

cleanup