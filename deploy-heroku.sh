#!/bin/bash

echo "🚀 你画我猜 - 部署到 Heroku"
echo "=========================="
echo ""

# 检查 Heroku CLI
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI 未安装"
    echo "请访问 https://devcenter.heroku.com/articles/heroku-cli 安装 Heroku CLI"
    echo "或运行以下命令（Ubuntu/Debian）："
    echo "curl https://cli-assets.heroku.com/install.sh | sh"
    exit 1
fi

# 检查是否登录 Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔑 请先登录 Heroku"
    heroku auth:login
fi

# 检查 Git
if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装，请先安装 Git"
    exit 1
fi

# 检查项目文件
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 生成应用名称
APP_NAME="guess-draw-$(date +%s | tail -c 6)"

echo "📝 准备 Heroku 配置文件..."

# 创建 Procfile
cat > Procfile << EOF
web: node server.js
EOF

# 更新 package.json 添加 engines
if ! grep -q "engines" package.json; then
    # 备份原文件
    cp package.json package.json.bak
    
    # 添加 engines 配置
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.engines = { node: '>=14.0.0', npm: '>=6.0.0' };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    
    echo "✅ 已更新 package.json"
fi

# 初始化 Git 仓库（如果不存在）
if [ ! -d ".git" ]; then
    echo "📁 初始化 Git 仓库..."
    git init
    git add .
    git commit -m "Initial commit for guess-draw game"
fi

echo "🏗️  创建 Heroku 应用: $APP_NAME"
heroku create $APP_NAME

if [ $? -ne 0 ]; then
    echo "❌ 创建 Heroku 应用失败"
    exit 1
fi

echo "📤 部署到 Heroku..."
git add .
git commit -m "Deploy to Heroku" --allow-empty
git push heroku main || git push heroku master

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 部署成功！"
    echo "=================================="
    echo "📍 公网游戏地址: https://$APP_NAME.herokuapp.com"
    echo "🎮 分享这个地址给朋友一起玩！"
    echo ""
    echo "📊 有用的命令："
    echo "   查看日志: heroku logs --tail -a $APP_NAME"
    echo "   重启应用: heroku restart -a $APP_NAME"
    echo "   删除应用: heroku apps:destroy $APP_NAME"
    echo ""
    
    # 自动打开应用
    read -p "是否现在打开游戏？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        heroku open -a $APP_NAME
    fi
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi