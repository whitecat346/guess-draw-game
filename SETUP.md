# 🎨 你画我猜 - 设置指南

## 推送到 GitHub

### 1. 在 GitHub 上创建仓库
1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" -> "New repository"
3. 仓库名称填写: `guess-draw-game`
4. 描述填写: `🎨 实时多人你画我猜联网游戏`
5. 选择 "Public" 或 "Private"
6. **不要**勾选 "Initialize this repository with a README"
7. 点击 "Create repository"

### 2. 推送代码到 GitHub
复制以下命令在项目目录中执行（替换YOUR_USERNAME为你的GitHub用户名）:

```bash
git remote add origin https://github.com/YOUR_USERNAME/guess-draw-game.git
git branch -M main
git push -u origin main
```

## 本地运行游戏

### 快速启动
```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

### 使用启动脚本

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
双击 `start.bat` 文件

### 游戏地址
- 本机访问: http://localhost:3000
- 局域网访问: http://[你的IP地址]:3000

### 获取本机IP地址

**Windows:**
```cmd
ipconfig
```

**macOS/Linux:**
```bash
ifconfig
# 或者
hostname -I
```

## 游戏规则
1. 输入昵称和房间号（可选）
2. 等待其他玩家加入（至少2人）
3. 轮流画图和猜词
4. 每轮60秒，共3轮
5. 猜对得分，画家也会得分

## 自定义词汇
编辑 `words.json` 文件来添加或修改游戏词汇。

## 技术栈
- **前端**: HTML5 Canvas + CSS3 + JavaScript
- **后端**: Node.js + Express + Socket.IO
- **实时通信**: WebSocket

## 端口配置
默认端口3000，可通过环境变量修改:
```bash
PORT=8080 npm start
```