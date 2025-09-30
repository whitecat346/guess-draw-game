#!/bin/bash

echo "🎨 你画我猜 - 联机游戏启动器"
echo "================================"

# 获取本机IP地址
IP=$(hostname -I | cut -d' ' -f1 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)

if [ -z "$IP" ]; then
    IP="localhost"
fi

echo "正在启动服务器..."
echo ""
echo "📍 游戏地址："
echo "   本机访问: http://localhost:3000"
if [ "$IP" != "localhost" ]; then
    echo "   局域网访问: http://$IP:3000"
fi
echo ""
echo "🎮 游戏规则："
echo "   1. 输入昵称和房间号（可选）"
echo "   2. 等待其他玩家加入"
echo "   3. 轮流画图和猜词"
echo "   4. 每轮60秒，共3轮"
echo ""
echo "⚠️  按 Ctrl+C 停止服务器"
echo ""

# 启动Node.js服务器
node server.js