const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 解析 text/plain 用于词库上传
app.use(express.text({ type: 'text/plain', limit: '2mb' }));

// ─── 词库管理 ───────────────────────────────────────────────

const WORDBANKS_DIR = path.join(__dirname, 'wordbanks');

// 确保词库目录存在
if (!fs.existsSync(WORDBANKS_DIR)) {
    fs.mkdirSync(WORDBANKS_DIR, { recursive: true });
}

// 全局词库缓存: name -> string[]
const wordBanks = new Map();

// 默认词库
const defaultWords = [
    '苹果', '汽车', '房子', '猫咪', '太阳', '月亮', '树木', '花朵',
    '飞机', '船只', '鸟儿', '鱼儿', '蛋糕', '冰淇淋', '雨伞', '眼镜',
    '电脑', '手机', '书本', '铅笔', '足球', '篮球', '自行车', '钟表',
    '蝴蝶', '兔子', '大象', '狮子', '熊猫', '企鹅', '长颈鹿', '老虎',
    '草莓', '香蕉', '西瓜', '葡萄', '橘子', '菠萝', '樱桃', '桃子',
    '山峰', '海浪', '彩虹', '闪电', '雪花', '星星', '云朵', '火焰',
    '小狗', '小鸟', '青蛙', '蜗牛', '蚂蚁', '蜜蜂', '螃蟹', '章鱼',
    '城堡', '桥梁', '塔楼', '灯塔', '帐篷', '摩天轮', '滑梯', '秋千'
];

/** 加载单个 .json 词库文件，返回 {name, words} */
function loadWordBankFile(filePath) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const name = data.name || path.basename(filePath, '.json');
        const words = data.words || [];
        if (words.length > 0) {
            return { name, words };
        }
    } catch (e) {
        console.error(`加载词库失败: ${filePath}`, e.message);
    }
    return null;
}

/** 从 words.json 加载默认词库（兼容旧格式），然后扫描 wordbanks/ 目录 */
function loadAllWordBanks() {
    wordBanks.clear();

    // 1. 加载根目录的 words.json 作为"默认词库"
    const rootWordsPath = path.join(__dirname, 'words.json');
    if (fs.existsSync(rootWordsPath)) {
        const entry = loadWordBankFile(rootWordsPath);
        if (entry) {
            wordBanks.set('默认词库', entry.words);
            console.log(`已加载词库: 默认词库 (${entry.words.length}词)`);
        }
    } else {
        // words.json 不存在就用硬编码默认
        wordBanks.set('默认词库', [...defaultWords]);
        console.log(`使用内置默认词库 (${defaultWords.length}词)`);
    }

    // 2. 扫描 wordbanks/ 目录下的所有 .json 文件
    if (fs.existsSync(WORDBANKS_DIR)) {
        const files = fs.readdirSync(WORDBANKS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const filePath = path.join(WORDBANKS_DIR, file);
            const entry = loadWordBankFile(filePath);
            if (entry) {
                wordBanks.set(entry.name, entry.words);
                console.log(`已加载词库: ${entry.name} (${entry.words.length}词)`);
            }
        }
    }

    console.log(`词库加载完成，共 ${wordBanks.size} 个词库可用`);
}

/** 将词库保存到 wordbanks/ 目录 */
function saveWordBankFile(name, words) {
    const filePath = path.join(WORDBANKS_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ name, words }, null, 2), 'utf8');
}

/** 获取所有词库摘要（名称和词数，不包含词列表） */
function getWordBankSummaries() {
    const result = [];
    for (const [name, words] of wordBanks) {
        result.push({ name, count: words.length });
    }
    return result;
}

// 启动时加载所有词库
loadAllWordBanks();

// ─── REST: 词库上传 ─────────────────────────────────────────

app.post('/api/wordbanks', (req, res) => {
    const bankName = (req.query.name || '').trim();
    if (!bankName) {
        return res.status(400).json({ error: '缺少词库名称 (query: ?name=xxx)' });
    }
    if (bankName === '默认词库') {
        return res.status(400).json({ error: '不能覆盖默认词库，请使用其他名称' });
    }

    const text = (req.body || '').trim();
    if (!text) {
        return res.status(400).json({ error: '上传内容为空' });
    }

    // 解析：每行一个词，过滤空行
    const words = text.split(/\r?\n/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

    if (words.length < 2) {
        return res.status(400).json({ error: '词库至少需要2个词' });
    }

    // 保存到磁盘和内存
    saveWordBankFile(bankName, words);
    wordBanks.set(bankName, words);

    // 通知所有连接的客户端词库列表已更新
    io.emit('word-banks-list', getWordBankSummaries());

    console.log(`词库已上传: ${bankName} (${words.length}词)`);
    res.json({ ok: true, name: bankName, count: words.length });
});

// ─── 游戏状态管理 ───────────────────────────────────────────

const rooms = new Map();

class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.currentDrawer = null;
        this.currentWord = '';
        this.roundStartTime = 0;
        this.roundDuration = 60000; // 60秒
        this.gameState = 'waiting'; // waiting | playing | ended
        this.drawingData = [];
        this.scores = new Map();
        this.roundNumber = 0;
        this.maxRounds = 3;
        this.roundActive = false;
        this.hostId = null;
        // 当前使用的词库名称
        this.wordBankName = '默认词库';
    }

    /** 获取当前生效的词表 */
    getWords() {
        return wordBanks.get(this.wordBankName) || wordBanks.get('默认词库') || defaultWords;
    }

    addPlayer(playerId, playerName) {
        const player = {
            id: playerId,
            name: playerName,
            score: 0,
            hasGuessed: false
        };
        this.players.set(playerId, player);
        this.scores.set(playerId, 0);

        if (!this.hostId) {
            this.hostId = playerId;
        }

        // 不再自动开始游戏 —— 由房主手动触发
        return player;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.scores.delete(playerId);

        if (this.hostId === playerId) {
            const nextHost = this.players.keys().next();
            this.hostId = (nextHost && !nextHost.done) ? nextHost.value : null;
        }

        if (this.currentDrawer === playerId) {
            this.startNextRound();
        }

        if (this.players.size < 2 && this.gameState === 'playing') {
            this.gameState = 'waiting';
            // 重置游戏进度
            this.roundNumber = 0;
            this.roundActive = false;
            this.drawingData = [];
        }
    }

    startNextRound() {
        if (this.players.size < 2) return;

        this.roundNumber++;
        if (this.roundNumber > this.maxRounds) {
            this.gameState = 'ended';
            return;
        }

        // 重置猜词状态
        this.players.forEach(player => {
            player.hasGuessed = false;
        });

        // 选择下一个画家
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentDrawer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        this.currentDrawer = playerIds[nextIndex];

        // 从当前词库选词
        const words = this.getWords();
        this.currentWord = words[Math.floor(Math.random() * words.length)];
        this.roundStartTime = Date.now();
        this.gameState = 'playing';
        this.drawingData = [];
        this.roundActive = true;
    }

    /** 房主手动开始游戏 */
    startGame() {
        if (this.gameState !== 'waiting') return false;
        if (this.players.size < 2) return false;
        this.roundNumber = 0;
        this.startNextRound();
        return true;
    }

    checkGuess(playerId, message) {
        const player = this.players.get(playerId);
        if (this.gameState !== 'playing' || !this.roundActive) {
            return false;
        }
        if (!player || player.hasGuessed || playerId === this.currentDrawer) {
            return false;
        }

        if (message.trim() === this.currentWord) {
            player.hasGuessed = true;
            const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - this.roundStartTime) / 6000));
            const points = 10 + timeBonus;
            player.score += points;
            this.scores.set(playerId, player.score);

            const drawer = this.players.get(this.currentDrawer);
            if (drawer) {
                drawer.score += 5;
                this.scores.set(this.currentDrawer, drawer.score);
            }

            this.roundActive = false;
            return true;
        }
        return false;
    }

    getGameState() {
        return {
            roomId: this.id,
            players: Array.from(this.players.values()),
            currentDrawer: this.currentDrawer,
            currentWord: this.currentWord,
            gameState: this.gameState,
            roundNumber: this.roundNumber,
            maxRounds: this.maxRounds,
            timeLeft: Math.max(0, this.roundDuration - (Date.now() - this.roundStartTime)),
            hostId: this.hostId,
            wordBankName: this.wordBankName
        };
    }
}

// ─── Socket.IO 事件 ─────────────────────────────────────────

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 加入房间
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Room(roomId));
        }

        const room = rooms.get(roomId);
        const player = room.addPlayer(socket.id, playerName);

        socket.join(roomId);
        socket.roomId = roomId;

        io.to(roomId).emit('game-state', room.getGameState());
        io.to(roomId).emit('player-joined', player);

        if (room.drawingData.length > 0) {
            socket.emit('drawing-data', room.drawingData);
        }

        console.log(`玩家 ${playerName} 加入房间 ${roomId}`);
    });

    // 获取词库列表
    socket.on('get-word-banks', () => {
        socket.emit('word-banks-list', getWordBankSummaries());
    });

    // 房主设置词库
    socket.on('set-word-bank', (data) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;
        if (socket.id !== room.hostId) return;

        const { bankName } = data || {};
        if (!bankName || !wordBanks.has(bankName)) return;

        room.wordBankName = bankName;
        io.to(socket.roomId).emit('game-state', room.getGameState());
        console.log(`房间 ${room.id} 切换词库: ${bankName}`);
    });

    // 房主开始游戏
    socket.on('start-game', () => {
        const room = rooms.get(socket.roomId);
        if (!room) return;
        if (socket.id !== room.hostId) return;

        if (room.startGame()) {
            io.to(socket.roomId).emit('clear-canvas');
            io.to(socket.roomId).emit('game-state', room.getGameState());
            console.log(`房间 ${room.id} 游戏开始`);
        }
    });

    // 开始绘画
    socket.on('start-drawing', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'start', ...data });
            socket.to(socket.roomId).emit('drawing', { type: 'start', ...data });
        }
    });

    // 绘画中
    socket.on('drawing', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'draw', ...data });
            socket.to(socket.roomId).emit('drawing', { type: 'draw', ...data });
        }
    });

    // 结束绘画
    socket.on('end-drawing', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'end' });
            socket.to(socket.roomId).emit('drawing', { type: 'end' });
        }
    });

    // 清空画布
    socket.on('clear-canvas', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData = [];
            io.to(socket.roomId).emit('clear-canvas');
        }
    });

    // 形状 / 油漆桶绘制
    socket.on('draw-shape', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: data.type || 'rect', ...data });
            socket.to(socket.roomId).emit('drawing', { type: data.type || 'rect', ...data });
        }
    });

    // 聊天消息 / 猜词（等待和游戏中均可使用）
    socket.on('chat-message', (message) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        // 游戏中画家的消息不作为猜词处理，直接忽略（防止误触发送答案）
        if (room.gameState === 'playing' && socket.id === room.currentDrawer) {
            return;
        }

        const isCorrect = room.checkGuess(socket.id, message);

        if (isCorrect) {
            io.to(socket.roomId).emit('correct-guess', {
                playerId: socket.id,
                playerName: player.name,
                word: room.currentWord
            });

            room.startNextRound();
            io.to(socket.roomId).emit('clear-canvas');
            io.to(socket.roomId).emit('game-state', room.getGameState());
        } else {
            // 等待状态下的消息全都广播（没有画家限制）
            if (room.gameState === 'waiting') {
                io.to(socket.roomId).emit('chat-message', {
                    playerId: socket.id,
                    playerName: player.name,
                    message: message,
                    timestamp: Date.now()
                });
            } else if (socket.id !== room.currentDrawer) {
                // 游戏中：画家的消息不广播（隐藏答案）
                io.to(socket.roomId).emit('chat-message', {
                    playerId: socket.id,
                    playerName: player.name,
                    message: message,
                    timestamp: Date.now()
                });
            }
        }
    });

    // 房主设置轮数
    socket.on('set-max-rounds', (data) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;
        if (socket.id !== room.hostId) return;

        const { maxRounds } = data || {};
        let value = parseInt(maxRounds, 10);
        if (isNaN(value)) return;
        value = Math.max(1, Math.min(20, value));
        room.maxRounds = value;

        if (room.roundNumber > room.maxRounds) {
            room.gameState = 'ended';
            room.roundActive = false;
        }

        io.to(socket.roomId).emit('game-state', room.getGameState());
    });

    // 房主重置房间（游戏结束 → 返回等待大厅）
    socket.on('reset-room', () => {
        const room = rooms.get(socket.roomId);
        if (!room) return;
        if (socket.id !== room.hostId) return;

        room.gameState = 'waiting';
        room.roundNumber = 0;
        room.roundActive = false;
        room.drawingData = [];
        room.currentDrawer = null;
        room.currentWord = '';

        // 重置所有玩家分数
        room.players.forEach(p => { p.score = 0; p.hasGuessed = false; });
        room.scores.forEach((_, key) => room.scores.set(key, 0));

        io.to(socket.roomId).emit('clear-canvas');
        io.to(socket.roomId).emit('game-state', room.getGameState());
        console.log(`房间 ${room.id} 已重置，返回等待大厅`);
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);

        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                const player = room.players.get(socket.id);
                room.removePlayer(socket.id);

                if (room.players.size === 0) {
                    rooms.delete(socket.roomId);
                } else {
                    io.to(socket.roomId).emit('player-left', {
                        playerId: socket.id,
                        playerName: player ? player.name : 'Unknown'
                    });
                    io.to(socket.roomId).emit('game-state', room.getGameState());
                }
            }
        }
    });
});

// 定时检查房间超时
setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (room.gameState === 'playing' && room.roundActive) {
            const timeLeft = room.roundDuration - (Date.now() - room.roundStartTime);
            if (timeLeft <= 0) {
                room.startNextRound();
                io.to(roomId).emit('round-timeout');
                io.to(roomId).emit('game-state', room.getGameState());
            }
        }
    });
}, 1000);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`服务器运行在 ${HOST}:${PORT}`);
    console.log(`本机访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://[你的IP地址]:${PORT}`);
});
