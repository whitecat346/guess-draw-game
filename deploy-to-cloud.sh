#!/bin/bash

echo "🚀 你画我猜 - 一键部署到公网脚本"
echo "===================================="
echo ""

# 检查是否有必要的命令
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 命令未找到，请先安装 $1"
        return 1
    fi
    return 0
}

# 方案1: 使用 ngrok (推荐)
deploy_ngrok() {
    echo "📡 方案1: 使用 ngrok 部署"
    echo "------------------------"
    
    if ! check_command "ngrok"; then
        echo "请先安装 ngrok:"
        echo "1. 访问 https://ngrok.com/download"
        echo "2. 下载并安装 ngrok"
        echo "3. 注册账号获取 authtoken"
        echo "4. 运行: ngrok config add-authtoken YOUR_TOKEN"
        echo ""
        echo "安装完成后重新运行此脚本"
        return 1
    fi
    
    echo "正在启动游戏服务器..."
    node server.js &
    SERVER_PID=$!
    
    sleep 3
    
    echo "正在通过 ngrok 创建公网隧道..."
    ngrok http 3000 &
    NGROK_PID=$!
    
    sleep 5
    
    # 获取公网地址
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | grep https | cut -d'"' -f4)
    
    if [ ! -z "$PUBLIC_URL" ]; then
        echo "🎉 部署成功！"
        echo "📍 公网游戏地址: $PUBLIC_URL"
        echo "⚠️  按 Ctrl+C 停止服务"
        
        # 保持运行
        wait $SERVER_PID
    else
        echo "❌ 获取公网地址失败，请检查 ngrok 配置"
        kill $SERVER_PID $NGROK_PID 2>/dev/null
        return 1
    fi
}

# 方案2: 使用 localtunnel
deploy_localtunnel() {
    echo "📡 方案2: 使用 localtunnel 部署"
    echo "-----------------------------"
    
    if ! check_command "lt"; then
        echo "正在安装 localtunnel..."
        npm install -g localtunnel
        if [ $? -ne 0 ]; then
            echo "❌ localtunnel 安装失败"
            return 1
        fi
    fi
    
    echo "正在启动游戏服务器..."
    node server.js &
    SERVER_PID=$!
    
    sleep 3
    
    # 生成随机子域名
    SUBDOMAIN="guess-draw-$(date +%s)"
    
    echo "正在创建公网隧道..."
    lt --port 3000 --subdomain $SUBDOMAIN &
    LT_PID=$!
    
    sleep 3
    
    PUBLIC_URL="https://$SUBDOMAIN.loca.lt"
    
    echo "🎉 部署成功！"
    echo "📍 公网游戏地址: $PUBLIC_URL"
    echo "⚠️  首次访问可能需要点击 'Click to Continue'"
    echo "⚠️  按 Ctrl+C 停止服务"
    
    # 保持运行
    trap "kill $SERVER_PID $LT_PID 2>/dev/null; exit" INT
    wait $SERVER_PID
}

# 方案3: 使用 serveo.net
deploy_serveo() {
    echo "📡 方案3: 使用 serveo.net 部署"
    echo "-----------------------------"
    
    if ! check_command "ssh"; then
        echo "❌ SSH 命令未找到"
        return 1
    fi
    
    echo "正在启动游戏服务器..."
    node server.js &
    SERVER_PID=$!
    
    sleep 3
    
    # 生成随机子域名
    SUBDOMAIN="guess-draw-$(date +%s)"
    
    echo "正在创建公网隧道..."
    ssh -o StrictHostKeyChecking=no -R $SUBDOMAIN:80:localhost:3000 serveo.net &
    SSH_PID=$!
    
    sleep 5
    
    PUBLIC_URL="https://$SUBDOMAIN.serveo.net"
    
    echo "🎉 部署成功！"
    echo "📍 公网游戏地址: $PUBLIC_URL"
    echo "⚠️  按 Ctrl+C 停止服务"
    
    # 保持运行
    trap "kill $SERVER_PID $SSH_PID 2>/dev/null; exit" INT
    wait $SERVER_PID
}

# 显示选项菜单
show_menu() {
    echo "请选择部署方案："
    echo "1) ngrok (推荐 - 稳定，需注册)"
    echo "2) localtunnel (简单 - 无需注册)"
    echo "3) serveo.net (免费 - 无需注册)"
    echo "4) 退出"
    echo ""
    read -p "请输入选项 (1-4): " choice
    
    case $choice in
        1)
            deploy_ngrok
            ;;
        2)
            deploy_localtunnel
            ;;
        3)
            deploy_serveo
            ;;
        4)
            echo "退出部署"
            exit 0
            ;;
        *)
            echo "无效选项，请重新选择"
            show_menu
            ;;
    esac
}

# 检查 Node.js
if ! check_command "node"; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查是否在项目目录
if [ ! -f "server.js" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 显示菜单
show_menu