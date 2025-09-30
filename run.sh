#!/bin/bash

echo "🎨 你画我猜 - 本地运行"
echo "==================="

# 获取本机IP
IP=$(hostname -I | cut -d' ' -f1 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)

if [ -z "$IP" ]; then
    IP="localhost"
fi

echo "📍 游戏地址："
echo "   本机: http://localhost:3000"
if [ "$IP" != "localhost" ]; then
    echo "   局域网: http://$IP:3000"
fi
echo ""
echo "🎮 让朋友访问局域网地址一起玩！"
echo "⚠️  按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
node server.js