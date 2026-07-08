class GuessDrawGame {
    constructor() {
        this.socket = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentColor = '#000000';
        this.currentBrushSize = 3;
        this.currentTool = 'brush';
        this.roomId = '';
        this.playerId = '';
        this.playerName = '';
        this.isCurrentDrawer = false;
        this.gameState = {};
        this.timerInterval = null;
        this.localTimeLeftMs = 0;
        this.currentScreen = 'login';

        // Shape drawing state
        this.shapeStartX = 0;
        this.shapeStartY = 0;
        this.shapePreview = null;
        this.pointerActive = false;

        // Zoom & Pan state
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartPanX = 0;
        this.panStartPanY = 0;
        // Pinch state
        this.pinchStartDist = 0;
        this.pinchStartZoom = 1;
        this.pinchStartPanX = 0;
        this.pinchStartPanY = 0;
        this.pinchCenterX = 0;
        this.pinchCenterY = 0;
        this.pinchCount = 0;

        this.initializeElements();
        this.bindEvents();
    }

    /* ═══════════════════════════════════════════
       DOM 元素初始化
       ═══════════════════════════════════════════ */
    initializeElements() {
        this.loginScreen   = document.getElementById('login-screen');
        this.waitingScreen = document.getElementById('waiting-screen');
        this.gameScreen    = document.getElementById('game-screen');
        this.endScreen     = document.getElementById('end-screen');

        this.playerNameInput = document.getElementById('player-name');
        this.roomIdInput     = document.getElementById('room-id');
        this.joinButton      = document.getElementById('join-button');

        this.waitingRoomId      = document.getElementById('waiting-room-id');
        this.copyRoomBtn        = document.getElementById('copy-room-btn');
        this.waitingPlayerCount  = document.getElementById('waiting-player-count');
        this.waitingHint        = document.getElementById('waiting-hint');
        this.waitingPlayersList  = document.getElementById('waiting-players-list');
        this.hostConfigCard     = document.getElementById('host-config-card');
        this.wordBankSelect     = document.getElementById('word-bank-select');
        this.btnApplyWordbank   = document.getElementById('btn-apply-wordbank');
        this.wordbankFileInput  = document.getElementById('wordbank-file-input');
        this.btnImportWordbank  = document.getElementById('btn-import-wordbank');
        this.importStatus       = document.getElementById('import-status');
        this.waitingMaxRounds   = document.getElementById('waiting-max-rounds');
        this.btnApplyRounds     = document.getElementById('btn-apply-rounds');
        this.waitingRoundTime   = document.getElementById('waiting-round-time');
        this.btnApplyRoundtime  = document.getElementById('btn-apply-roundtime');
        this.btnStartGame       = document.getElementById('btn-start-game');
        this.waitingChatMessages = document.getElementById('waiting-chat-messages');
        this.waitingChatInput   = document.getElementById('waiting-chat-input');
        this.waitingSendButton  = document.getElementById('waiting-send-button');

        this.currentRoomId    = document.getElementById('current-room-id');
        this.currentRound     = document.getElementById('current-round');
        this.maxRounds        = document.getElementById('max-rounds');
        this.timeLeft         = document.getElementById('time-left');
        this.currentWordDisplay = document.getElementById('current-word-display');

        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.viewport = document.getElementById('canvas-viewport');
        this.brushSizeSlider  = document.getElementById('brush-size');
        this.brushSizeDisplay = document.getElementById('brush-size-display');
        this.colorPicker      = document.getElementById('color-picker');
        this.colorDots        = document.querySelectorAll('.color-dot');
        this.clearCanvasButton = document.getElementById('clear-canvas');
        this.toolButtons      = document.querySelectorAll('.tool-btn');

        // Zoom controls
        this.zoomSlider  = document.getElementById('zoom-slider');
        this.zoomDisplay = document.getElementById('zoom-display');
        this.zoomInBtn   = document.getElementById('zoom-in');
        this.zoomOutBtn  = document.getElementById('zoom-out');
        this.zoomResetBtn = document.getElementById('zoom-reset');

        this.playerCount  = document.getElementById('player-count');
        this.playersList  = document.getElementById('players-list');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput    = document.getElementById('chat-input');
        this.sendButton   = document.getElementById('send-button');

        this.finalScores   = document.getElementById('final-scores');
        this.newGameButton = document.getElementById('new-game-button');

        this.updateToolUI();
        this.updateZoomUI();
    }

    /* ═══════════════════════════════════════════
       事件绑定
       ═══════════════════════════════════════════ */
    bindEvents() {
        this.joinButton.addEventListener('click', () => this.joinGame());
        this.playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinGame(); });
        this.roomIdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinGame(); });

        // ── Pointer Events (unified mouse/touch/pen) ──
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        this.canvas.style.touchAction = 'none';

        // ── Wheel zoom (Ctrl+wheel on viewport) ──
        this.viewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY * 0.005;
                this.zoomAtPoint(delta, e.clientX, e.clientY);
            }
        }, { passive: false });

        // ── Touch pinch zoom & two-finger pan on viewport ──
        this.viewport.addEventListener('touchstart', (e) => this.handleViewportTouchStart(e), { passive: false });
        this.viewport.addEventListener('touchmove', (e) => this.handleViewportTouchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', (e) => this.handleViewportTouchEnd(e));

        // ── Space+drag or middle-click pan ──
        this.viewport.addEventListener('pointerdown', (e) => {
            // Middle mouse button or space+left
            if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
                e.preventDefault();
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panStartPanX = this.panX;
                this.panStartPanY = this.panY;
                this.viewport.setPointerCapture(e.pointerId);
            }
        });
        this.viewport.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.panStartX;
                const dy = e.clientY - this.panStartY;
                this.panX = this.panStartPanX + dx;
                this.panY = this.panStartPanY + dy;
                this.applyViewportTransform();
            }
        });
        this.viewport.addEventListener('pointerup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.viewport.releasePointerCapture(e.pointerId);
            }
        });
        this.viewport.addEventListener('pointerleave', (e) => {
            if (this.isPanning) { this.isPanning = false; this.viewport.releasePointerCapture(e.pointerId); }
        });

        // Space key tracking
        this.spaceHeld = false;
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.spaceHeld = true;
                this.viewport.style.cursor = 'grab';
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spaceHeld = false;
                if (!this.isPanning) this.viewport.style.cursor = '';
            }
        });
        // Grab cursor while panning
        this.viewport.addEventListener('pointermove', (e) => {
            if (!this.isPanning && this.spaceHeld && e.buttons === 1) {
                this.viewport.style.cursor = 'grabbing';
            }
        });

        // Prevent middle-click auto-scroll
        this.viewport.addEventListener('auxclick', (e) => e.preventDefault());

        // ── Tool buttons ──
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentTool = btn.dataset.tool;
                this.updateToolUI();
            });
        });

        // ── Keyboard shortcuts ──
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (!this.isCurrentDrawer || this.gameState.gameState !== 'playing') {
                // Allow zoom shortcuts even when not drawing
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === '=' || e.key === '+') { e.preventDefault(); this.zoomIn(); }
                    if (e.key === '-') { e.preventDefault(); this.zoomOut(); }
                    if (e.key === '0') { e.preventDefault(); this.zoomReset(); }
                }
                return;
            }
            const key = e.key.toLowerCase();
            // Zoom
            if (e.ctrlKey || e.metaKey) {
                if (key === '=' || key === '+') { e.preventDefault(); this.zoomIn(); return; }
                if (key === '-') { e.preventDefault(); this.zoomOut(); return; }
                if (key === '0') { e.preventDefault(); this.zoomReset(); return; }
            }
            // Tools
            const map = { b:'brush', e:'eraser', g:'bucket', i:'picker', r:'rect', c:'circle', l:'line', h:'pan' };
            if (map[key]) { this.currentTool = map[key]; this.updateToolUI(); }
            if (key === '[') { this.adjustBrushSize(-1); }
            if (key === ']') { this.adjustBrushSize(1); }
        });

        // ── Zoom buttons ──
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.zoomResetBtn.addEventListener('click', () => this.zoomReset());
        this.zoomSlider.addEventListener('input', () => {
            this.setZoom(parseInt(this.zoomSlider.value) / 100);
        });

        // ── Brush size ──
        this.brushSizeSlider.addEventListener('input', (e) => {
            this.currentBrushSize = parseInt(e.target.value);
            this.brushSizeDisplay.textContent = e.target.value;
        });

        // ── Color ──
        this.colorDots.forEach(dot => {
            dot.addEventListener('click', () => { this.setColor(dot.dataset.color); });
        });
        this.colorPicker.addEventListener('input', (e) => { this.setColor(e.target.value); });

        // ── Clear ──
        this.clearCanvasButton.addEventListener('click', () => {
            if (this.isCurrentDrawer && this.socket) {
                this.clearLocalCanvas();
                this.socket.emit('clear-canvas');
            }
        });

        // ── Chat ──
        this.sendButton.addEventListener('click', () => this.sendGameChat());
        this.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendGameChat(); });
        this.waitingSendButton.addEventListener('click', () => this.sendWaitingChat());
        this.waitingChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendWaitingChat(); });

        // ── Waiting config ──
        this.copyRoomBtn.addEventListener('click', () => this.copyRoomCode());
        this.btnApplyWordbank.addEventListener('click', () => this.applyWordBank());
        this.btnApplyRounds.addEventListener('click', () => this.applyRounds());
        this.btnApplyRoundtime.addEventListener('click', () => this.applyRoundtime());
        this.btnStartGame.addEventListener('click', () => this.requestStartGame());
        this.btnImportWordbank.addEventListener('click', () => this.wordbankFileInput.click());
        this.wordbankFileInput.addEventListener('change', (e) => this.handleWordbankUpload(e));

        // ── End ──
        this.newGameButton.addEventListener('click', () => this.returnToRoom());
    }

    /* ═══════════════════════════════════════════
       缩放 & 平移
       ═══════════════════════════════════════════ */
    applyViewportTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
        this.canvas.style.transformOrigin = '0 0';
        this.updateZoomUI();
    }

    updateZoomUI() {
        const pct = Math.round(this.zoomLevel * 100);
        this.zoomDisplay.textContent = pct + '%';
        this.zoomSlider.value = pct;
    }

    setZoom(level) {
        this.zoomLevel = Math.max(0.10, Math.min(8.0, level));
        this.applyViewportTransform();
    }

    zoomIn() { this.zoomAtPoint(0.25, null, null); }
    zoomOut() { this.zoomAtPoint(-0.25, null, null); }
    zoomReset() {
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.applyViewportTransform();
    }

    /** Zoom centered on a screen point, or viewport center if point is null */
    zoomAtPoint(delta, clientX, clientY) {
        const oldZoom = this.zoomLevel;
        const newZoom = Math.max(0.10, Math.min(8.0, oldZoom + delta * oldZoom));
        if (newZoom === oldZoom) return;

        // Determine the focal point in viewport-local coordinates
        let vx, vy;
        if (clientX !== null && clientY !== null) {
            const vr = this.viewport.getBoundingClientRect();
            vx = clientX - vr.left;
            vy = clientY - vr.top;
        } else {
            // Zoom toward center of viewport
            const vr = this.viewport.getBoundingClientRect();
            vx = vr.width / 2;
            vy = vr.height / 2;
        }

        // Canvas point under focal point before zoom: (vx - panX) / oldZoom
        // We want this same canvas point to stay at (vx, vy) after zoom
        const cx = (vx - this.panX) / oldZoom;
        const cy = (vy - this.panY) / oldZoom;
        this.panX = vx - cx * newZoom;
        this.panY = vy - cy * newZoom;
        this.zoomLevel = newZoom;
        this.applyViewportTransform();
    }

    /* ── Touch pinch zoom & two-finger pan ── */
    handleViewportTouchStart(e) {
        if (e.touches.length === 2) {
            // Two-finger gesture starting
            e.preventDefault();
            this.pinchCount = 2;
            const t0 = e.touches[0], t1 = e.touches[1];
            this.pinchStartDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            this.pinchStartZoom = this.zoomLevel;
            this.pinchStartPanX = this.panX;
            this.pinchStartPanY = this.panY;
            this.pinchCenterX = (t0.clientX + t1.clientX) / 2;
            this.pinchCenterY = (t0.clientY + t1.clientY) / 2;
            // Cancel any in-progress drawing
            if (this.isDrawing) {
                this.isDrawing = false;
                this.ctx.beginPath();
                if (this.socket) this.socket.emit('end-drawing');
            }
        }
    }

    handleViewportTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const t0 = e.touches[0], t1 = e.touches[1];
            const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            const newCenterX = (t0.clientX + t1.clientX) / 2;
            const newCenterY = (t0.clientY + t1.clientY) / 2;

            // Zoom: scale proportional to distance change
            if (this.pinchStartDist > 0) {
                const scale = newDist / this.pinchStartDist;
                const newZoom = Math.max(0.10, Math.min(8.0, this.pinchStartZoom * scale));

                // Pan: follow the center movement + zoom adjustment
                const vr = this.viewport.getBoundingClientRect();
                const vcx = this.pinchCenterX - vr.left;
                const vcy = this.pinchCenterY - vr.top;
                const cx = (vcx - this.pinchStartPanX) / this.pinchStartZoom;
                const cy = (vcy - this.pinchStartPanY) / this.pinchStartZoom;
                const panDx = newCenterX - this.pinchCenterX;
                const panDy = newCenterY - this.pinchCenterY;

                this.zoomLevel = newZoom;
                this.panX = (newCenterX - vr.left) - cx * newZoom;
                this.panY = (newCenterY - vr.top) - cy * newZoom;
                this.applyViewportTransform();
            }

            this.pinchCenterX = newCenterX;
            this.pinchCenterY = newCenterY;
        }
    }

    handleViewportTouchEnd(e) {
        if (e.touches.length < 2) {
            this.pinchCount = e.touches.length;
            this.pinchStartDist = 0;
        }
    }

    /* ═══════════════════════════════════════════
       工具管理
       ═══════════════════════════════════════════ */
    updateToolUI() {
        this.toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        this.canvas.classList.remove('tool-eraser', 'tool-bucket', 'tool-picker', 'tool-shape', 'tool-pan');
        if (this.currentTool === 'eraser') this.canvas.classList.add('tool-eraser');
        if (this.currentTool === 'bucket') this.canvas.classList.add('tool-bucket');
        if (this.currentTool === 'picker') this.canvas.classList.add('tool-picker');
        if (this.currentTool === 'pan') this.canvas.classList.add('tool-pan');
        if (['rect','circle','line'].includes(this.currentTool)) this.canvas.classList.add('tool-shape');
    }

    setColor(color) {
        this.currentColor = color;
        this.colorPicker.value = color;
        this.colorDots.forEach(d => d.classList.remove('active'));
        const match = document.querySelector(`.color-dot[data-color="${color}"]`);
        if (match) match.classList.add('active');
    }

    adjustBrushSize(delta) {
        let size = this.currentBrushSize + delta;
        size = Math.max(1, Math.min(30, size));
        this.currentBrushSize = size;
        this.brushSizeSlider.value = size;
        this.brushSizeDisplay.textContent = size;
    }

    /* ═══════════════════════════════════════════
       画布指针事件
       ═══════════════════════════════════════════ */
    handlePointerDown(e) {
        if (!this.isCurrentDrawer || this.gameState.gameState !== 'playing') return;
        if (this.isPanning || this.spaceHeld || this.pinchCount >= 2) return;
        e.preventDefault();

        const pos = this.getCanvasPos(e);
        const pressure = e.pressure || 0.5;
        this.canvas.setPointerCapture(e.pointerId);
        this.pointerActive = true;

        switch (this.currentTool) {
            case 'pan':
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panStartPanX = this.panX;
                this.panStartPanY = this.panY;
                this.canvas.setPointerCapture(e.pointerId);
                return;
            case 'brush':
            case 'eraser':
                this.isDrawing = true;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
                const bs = this.currentTool === 'eraser' ? this.currentBrushSize : Math.max(1, this.currentBrushSize * (0.3 + pressure * 0.7));
                const col = this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor;
                this.socket.emit('start-drawing', { x: pos.x, y: pos.y, color: col, size: Math.round(bs) });
                break;
            case 'bucket':
                this.floodFill(Math.round(pos.x), Math.round(pos.y), this.currentColor);
                break;
            case 'picker':
                this.pickColor(Math.round(pos.x), Math.round(pos.y));
                break;
            case 'rect': case 'circle': case 'line':
                this.shapeStartX = pos.x;
                this.shapeStartY = pos.y;
                this.shapePreview = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                this.isDrawing = true;
                break;
        }
    }

    handlePointerMove(e) {
        if (!this.isCurrentDrawer || this.gameState.gameState !== 'playing') return;
        if (this.isPanning || this.spaceHeld || this.pinchCount >= 2) return;
        if (!this.pointerActive) return;
        e.preventDefault();

        const pos = this.getCanvasPos(e);
        const pressure = e.pressure || 0.5;

        switch (this.currentTool) {
            case 'pan':
                if (this.isPanning) {
                    const dx = e.clientX - this.panStartX;
                    const dy = e.clientY - this.panStartY;
                    this.panX = this.panStartPanX + dx;
                    this.panY = this.panStartPanY + dy;
                    this.applyViewportTransform();
                }
                return;
            case 'brush':
            case 'eraser':
                if (!this.isDrawing) return;
                const bs = this.currentTool === 'eraser' ? this.currentBrushSize : Math.max(1, this.currentBrushSize * (0.3 + pressure * 0.7));
                const col = this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor;
                this.drawLine(pos.x, pos.y, col, Math.round(bs));
                this.socket.emit('drawing', { x: pos.x, y: pos.y });
                break;
            case 'rect': case 'circle': case 'line':
                if (!this.isDrawing || !this.shapePreview) return;
                this.ctx.putImageData(this.shapePreview, 0, 0);
                this.drawShapePreview(this.shapeStartX, this.shapeStartY, pos.x, pos.y);
                break;
        }
    }

    handlePointerUp(e) {
        if (!this.isCurrentDrawer || this.gameState.gameState !== 'playing') return;
        if (!this.pointerActive) return;
        this.pointerActive = false;

        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}

        const pos = this.getCanvasPos(e);
        switch (this.currentTool) {
            case 'pan':
                if (this.isPanning) {
                    this.isPanning = false;
                    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
                }
                return;
            case 'brush': case 'eraser':
                if (this.isDrawing) {
                    this.isDrawing = false;
                    this.ctx.beginPath();
                    this.socket.emit('end-drawing');
                }
                break;
            case 'rect': case 'circle': case 'line':
                if (this.isDrawing && this.shapePreview) {
                    this.isDrawing = false;
                    this.ctx.putImageData(this.shapePreview, 0, 0);
                    this.drawShapeFinal(this.shapeStartX, this.shapeStartY, pos.x, pos.y);
                    this.shapePreview = null;
                }
                break;
        }
    }

    /* ═══════════════════════════════════════════
       画线
       ═══════════════════════════════════════════ */
    drawLine(x, y, color, size) {
        this.ctx.lineWidth = size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = color;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    /* ═══════════════════════════════════════════
       油漆桶
       ═══════════════════════════════════════════ */
    floodFill(startX, startY, fillColor) {
        const w = this.canvas.width, h = this.canvas.height;
        if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
        const imageData = this.ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const idx = (startY * w + startX) * 4;
        const tR = data[idx], tG = data[idx+1], tB = data[idx+2], tA = data[idx+3];
        const tc = document.createElement('canvas').getContext('2d');
        tc.fillStyle = fillColor; tc.fillRect(0,0,1,1);
        const fd = tc.getImageData(0,0,1,1).data;
        const fR=fd[0],fG=fd[1],fB=fd[2],fA=fd[3];
        if (tR===fR && tG===fG && tB===fB && tA===fA) return;
        const st=[startX,startY], vis=new Uint8Array(w*h), tol=8;
        const mc=(i)=>Math.abs(data[i]-tR)<=tol&&Math.abs(data[i+1]-tG)<=tol&&Math.abs(data[i+2]-tB)<=tol&&Math.abs(data[i+3]-tA)<=tol;
        let pi=0;
        while(pi<st.length){const sx=st[pi++],sy=st[pi++];const si=(sy*w+sx)*4;
            if(sx<0||sx>=w||sy<0||sy>=h||vis[sy*w+sx]||!mc(si))continue;
            vis[sy*w+sx]=1;data[si]=fR;data[si+1]=fG;data[si+2]=fB;data[si+3]=fA;
            st.push(sx+1,sy,sx-1,sy,sx,sy+1,sx,sy-1);}
        this.ctx.putImageData(imageData,0,0);
        this.socket.emit('draw-shape', { type:'bucket', x:startX, y:startY, color:fillColor });
    }

    /* ═══════════════════════════════════════════
       吸色
       ═══════════════════════════════════════════ */
    pickColor(x, y) {
        if (x<0||x>=this.canvas.width||y<0||y>=this.canvas.height) return;
        const p=this.ctx.getImageData(x,y,1,1).data;
        this.setColor('#'+[p[0],p[1],p[2]].map(c=>c.toString(16).padStart(2,'0')).join(''));
    }

    /* ═══════════════════════════════════════════
       形状
       ═══════════════════════════════════════════ */
    drawShapePreview(x1,y1,x2,y2){this.ctx.save();this.ctx.strokeStyle=this.currentColor;this.ctx.lineWidth=this.currentBrushSize;this.ctx.lineCap='round';this.ctx.lineJoin='round';this.ctx.setLineDash([6,4]);this.ctx.globalAlpha=0.7;
        switch(this.currentTool){case'rect':this.ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));break;
            case'circle':{const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;this.ctx.beginPath();this.ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);this.ctx.stroke();}break;
            case'line':this.ctx.setLineDash([]);this.ctx.beginPath();this.ctx.moveTo(x1,y1);this.ctx.lineTo(x2,y2);this.ctx.stroke();break;}this.ctx.restore();}
    drawShapeFinal(x1,y1,x2,y2){this.ctx.save();this.ctx.strokeStyle=this.currentColor;this.ctx.lineWidth=this.currentBrushSize;this.ctx.lineCap='round';this.ctx.lineJoin='round';this.ctx.globalAlpha=1;
        let d={x1:Math.round(x1),y1:Math.round(y1),x2:Math.round(x2),y2:Math.round(y2),color:this.currentColor,size:this.currentBrushSize};
        switch(this.currentTool){case'rect':this.ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));d.type='rect';break;
            case'circle':{const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;this.ctx.beginPath();this.ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);this.ctx.stroke();d.type='circle';}break;
            case'line':this.ctx.beginPath();this.ctx.moveTo(x1,y1);this.ctx.lineTo(x2,y2);this.ctx.stroke();d.type='line';break;}this.ctx.restore();
        this.socket.emit('draw-shape', d);}

    /* ═══════════════════════════════════════════
       坐标 & 远程回放
       ═══════════════════════════════════════════ */
    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // With zoom/pan transforms on the canvas, getBoundingClientRect already accounts
        // for the visual position. Map screen coords to canvas pixel coords.
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    handleRemoteDrawing(data) {
        if (data.type === 'start') {
            this.ctx.beginPath(); this.ctx.moveTo(data.x, data.y);
            this.ctx.lineWidth=data.size; this.ctx.lineCap='round'; this.ctx.lineJoin='round'; this.ctx.strokeStyle=data.color;
        } else if (data.type === 'draw') {
            this.ctx.lineTo(data.x, data.y); this.ctx.stroke(); this.ctx.beginPath(); this.ctx.moveTo(data.x, data.y);
        } else if (data.type === 'end') { this.ctx.beginPath(); }
        else if (data.type === 'rect') {
            this.ctx.save(); this.ctx.strokeStyle=data.color; this.ctx.lineWidth=data.size; this.ctx.lineCap='round'; this.ctx.lineJoin='round';
            this.ctx.strokeRect(Math.min(data.x1,data.x2),Math.min(data.y1,data.y2),Math.abs(data.x2-data.x1),Math.abs(data.y2-data.y1)); this.ctx.restore();
        } else if (data.type === 'circle') {
            this.ctx.save(); this.ctx.strokeStyle=data.color; this.ctx.lineWidth=data.size;
            const cx=(data.x1+data.x2)/2,cy=(data.y1+data.y2)/2,rx=Math.abs(data.x2-data.x1)/2,ry=Math.abs(data.y2-data.y1)/2;
            this.ctx.beginPath(); this.ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); this.ctx.stroke(); this.ctx.restore();
        } else if (data.type === 'line') {
            this.ctx.save(); this.ctx.strokeStyle=data.color; this.ctx.lineWidth=data.size; this.ctx.lineCap='round';
            this.ctx.beginPath(); this.ctx.moveTo(data.x1,data.y1); this.ctx.lineTo(data.x2,data.y2); this.ctx.stroke(); this.ctx.restore();
        } else if (data.type === 'bucket') {
            const w=this.canvas.width,h=this.canvas.height;
            if(data.x<0||data.x>=w||data.y<0||data.y>=h)return;
            const im=this.ctx.getImageData(0,0,w,h),d=im.data;
            const idx=(Math.round(data.y)*w+Math.round(data.x))*4;
            const tR=d[idx],tG=d[idx+1],tB=d[idx+2],tA=d[idx+3];
            const tc=document.createElement('canvas').getContext('2d');tc.fillStyle=data.color;tc.fillRect(0,0,1,1);
            const fd=tc.getImageData(0,0,1,1).data,fR=fd[0],fG=fd[1],fB=fd[2],fA=fd[3];
            if(tR===fR&&tG===fG&&tB===fB&&tA===fA)return;
            const st=[Math.round(data.x),Math.round(data.y)],vis=new Uint8Array(w*h),tol=8;
            const mc=(i)=>Math.abs(d[i]-tR)<=tol&&Math.abs(d[i+1]-tG)<=tol&&Math.abs(d[i+2]-tB)<=tol&&Math.abs(d[i+3]-tA)<=tol;
            let pi=0;while(pi<st.length){const sx=st[pi++],sy=st[pi++];const si=(sy*w+sx)*4;
                if(sx<0||sx>=w||sy<0||sy>=h||vis[sy*w+sx]||!mc(si))continue;
                vis[sy*w+sx]=1;d[si]=fR;d[si+1]=fG;d[si+2]=fB;d[si+3]=fA;st.push(sx+1,sy,sx-1,sy,sx,sy+1,sx,sy-1);}
            this.ctx.putImageData(im,0,0);
        }
    }

    replayDrawing(drawingData) { this.clearLocalCanvas(); drawingData.forEach(d => this.handleRemoteDrawing(d)); }

    clearLocalCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /* ═══════════════════════════════════════════
       聊天 & 计时器
       ═══════════════════════════════════════════ */
    sendGameChat() { const m=this.chatInput.value.trim(); if(!m||!this.socket)return; this.socket.emit('chat-message',m); this.chatInput.value=''; }
    sendWaitingChat() { const m=this.waitingChatInput.value.trim(); if(!m||!this.socket)return; this.socket.emit('chat-message',m); this.waitingChatInput.value=''; }
    addWaitingChat(c,t){this._addChatTo(this.waitingChatMessages,c,t);}
    addGameChat(c,t){this._addChatTo(this.chatMessages,c,t);}
    _addChatTo(ct,c,t){const d=document.createElement('div');d.className=`chat-msg ${t}`;d.innerHTML=c;ct.appendChild(d);ct.scrollTop=ct.scrollHeight;}

    setupLocalTimer(gs){this.clearLocalTimer();if(gs.gameState==='playing'){this.localTimeLeftMs=Math.max(0,gs.timeLeft|0);this.updateTimeDisplay(this.localTimeLeftMs);this.timerInterval=setInterval(()=>{this.localTimeLeftMs=Math.max(0,this.localTimeLeftMs-1000);this.updateTimeDisplay(this.localTimeLeftMs);if(this.localTimeLeftMs<=0)this.clearLocalTimer();},1000);}else this.updateTimeDisplay(0);}
    clearLocalTimer(){if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null;}}
    updateTimeDisplay(tl){const s=Math.ceil(tl/1000);this.timeLeft.textContent=Math.max(0,s);this.timeLeft.classList.toggle('urgent',s<=10&&s>0);}

    /* ═══════════════════════════════════════════
       屏幕 & 游戏状态
       ═══════════════════════════════════════════ */
    switchScreen(sc){this.currentScreen=sc;[this.loginScreen,this.waitingScreen,this.gameScreen,this.endScreen].forEach(s=>s.classList.add('hidden'));if(sc==='login')this.loginScreen.classList.remove('hidden');else if(sc==='waiting')this.waitingScreen.classList.remove('hidden');else if(sc==='game')this.gameScreen.classList.remove('hidden');else if(sc==='end')this.endScreen.classList.remove('hidden');}
    joinGame(){const n=this.playerNameInput.value.trim();if(!n){alert('请输入昵称');return;}this.playerName=n;this.roomId=this.roomIdInput.value.trim()||this.generateRoomId();this.connectToServer(this.roomId,n);}
    generateRoomId(){return Math.random().toString(36).substring(2,8).toUpperCase();}

    connectToServer(rid,pn){
        this.socket=io();
        this.socket.on('connect',()=>{this.playerId=this.socket.id;this.socket.emit('join-room',{roomId:rid,playerName:pn});this.socket.emit('get-word-banks');this.switchScreen('waiting');this.waitingRoomId.textContent=rid;this.addWaitingChat('你已加入房间，等待房主开始游戏...','system');});
        this.socket.on('game-state',gs=>this.updateGameState(gs));
        this.socket.on('player-joined',p=>{const m=`${p.name} 加入了房间`;this.addWaitingChat(m,'system');if(this.currentScreen==='game')this.addGameChat(m,'system');});
        this.socket.on('player-left',d=>{const m=`${d.playerName} 离开了房间`;this.addWaitingChat(m,'system');if(this.currentScreen==='game')this.addGameChat(m,'system');});
        this.socket.on('drawing',d=>this.handleRemoteDrawing(d));
        this.socket.on('drawing-data',d=>this.replayDrawing(d));
        this.socket.on('clear-canvas',()=>this.clearLocalCanvas());
        this.socket.on('chat-message',d=>{if(this.currentScreen==='waiting')this.addWaitingChat(`${d.playerName}: ${d.message}`,'user');else this.addGameChat(`${d.playerName}: ${d.message}`,'user');});
        this.socket.on('correct-guess',d=>{const m=`🎉 ${d.playerName} 猜对了！答案是："${d.word}"`;this.addGameChat(m,'correct');if(this.currentScreen==='waiting')this.addWaitingChat(m,'correct');});
        this.socket.on('round-timeout',()=>this.addGameChat('⏰ 时间到！开始下一轮','system'));
        this.socket.on('word-banks-list',b=>this.updateWordBankSelect(b));
        this.socket.on('disconnect',()=>{const m='⚠️ 连接断开';if(this.currentScreen==='waiting')this.addWaitingChat(m,'system');else this.addGameChat(m,'system');});
    }

    updateGameState(gs){this.gameState=gs;this.isCurrentDrawer=(gs.currentDrawer===this.playerId);
        if(gs.gameState==='waiting'){if(this.currentScreen!=='waiting')this.switchScreen('waiting');this.updateWaitingUI(gs);}
        else if(gs.gameState==='playing'){if(this.currentScreen!=='game')this.switchScreen('game');this.updateGameUI(gs);this.setupLocalTimer(gs);this.updateCanvasState();}
        else if(gs.gameState==='ended'){if(this.currentScreen!=='game')this.switchScreen('game');this.updateGameUI(gs);setTimeout(()=>this.showEndScreen(),2000);}}

    updateWaitingUI(gs){const pl=gs.players||[];this.waitingPlayerCount.textContent=pl.length;this.waitingRoomId.textContent=gs.roomId;const isH=gs.hostId===this.playerId;if(isH){this.hostConfigCard.classList.remove('hidden');this.waitingHint.textContent='你是房主，配置好后点击「开始游戏」';this.btnStartGame.disabled=pl.length<2;this.btnStartGame.textContent=pl.length>=2?`🚀 开始游戏（${pl.length} 名玩家）`:'🚀 开始游戏（至少需要2名玩家）';this.waitingMaxRounds.value=gs.maxRounds;this.waitingRoundTime.value=Math.round((gs.roundDuration||60000)/1000);}else{this.hostConfigCard.classList.add('hidden');this.waitingHint.textContent='等待房主开始游戏...';}if(gs.wordBankName)this.wordBankSelect.value=gs.wordBankName;this.renderWaitingPlayers(pl,gs);}
    renderWaitingPlayers(pl,gs){this.waitingPlayersList.innerHTML='';pl.forEach(p=>{const d=document.createElement('div');d.className='player-badge';d.innerHTML=`<span class="badge-name">${p.name}${p.id===gs.hostId?'<span class="badge-host">👑</span>':''}${p.id===this.playerId?'<span class="badge-you">我</span>':''}</span><span style="color:var(--text-tertiary);font-size:0.8rem">${p.score} 分</span>`;this.waitingPlayersList.appendChild(d);});}
    updateGameUI(gs){this.currentRoomId.textContent=gs.roomId;this.currentRound.textContent=gs.roundNumber;this.maxRounds.textContent=gs.maxRounds;this.updatePlayersList(gs.players);this.updateWordDisplay(gs);}
    updatePlayersList(pl){this.playerCount.textContent=pl.length;this.playersList.innerHTML='';pl.forEach(p=>{const d=document.createElement('div');d.className='player-item';if(p.id===this.gameState.currentDrawer)d.classList.add('current-drawer');if(p.id===this.playerId)d.classList.add('self');d.innerHTML=`<span class="player-name">${p.name}</span><span class="player-score">${p.score} 分</span>`;this.playersList.appendChild(d);});}
    updateWordDisplay(gs){if(gs.gameState==='playing'){if(this.isCurrentDrawer){this.currentWordDisplay.textContent=`🎯 请画：${gs.currentWord}`;this.currentWordDisplay.style.color='var(--danger)';}else{this.currentWordDisplay.textContent=`🔍 猜词：${'？'.repeat(gs.currentWord.length)}`;this.currentWordDisplay.style.color='var(--accent)';}}else this.currentWordDisplay.textContent='';}
    updateCanvasState(){if(this.isCurrentDrawer&&this.gameState.gameState==='playing'){this.canvas.classList.remove('disabled');this.clearCanvasButton.disabled=false;}else{this.canvas.classList.add('disabled');this.clearCanvasButton.disabled=true;}}

    /* ═══════════════════════════════════════════
       词库 & 配置
       ═══════════════════════════════════════════ */
    updateWordBankSelect(bks){const cv=this.wordBankSelect.value;this.wordBankSelect.innerHTML='';bks.forEach(b=>{const o=document.createElement('option');o.value=b.name;o.textContent=`${b.name} (${b.count}词)`;this.wordBankSelect.appendChild(o);});if([...this.wordBankSelect.options].some(o=>o.value===cv))this.wordBankSelect.value=cv;}
    applyWordBank(){if(!this.socket)return;const n=this.wordBankSelect.value;this.socket.emit('set-word-bank',{bankName:n});this.addWaitingChat(`词库已切换为：${n}`,'system');}
    handleWordbankUpload(e){const f=e.target.files[0];if(!f)return;const bn=f.name.replace(/\.txt$/i,'').trim();if(!bn||bn==='默认词库'){this.setImportStatus('词库名称无效或与默认词库冲突','error');this.wordbankFileInput.value='';return;}const r=new FileReader();r.onload=ev=>this.uploadWordBank(bn,ev.target.result);r.onerror=()=>{this.setImportStatus('读取文件失败','error');this.wordbankFileInput.value='';};r.readAsText(f);this.wordbankFileInput.value='';}
    async uploadWordBank(bn,text){try{const r=await fetch(`/api/wordbanks?name=${encodeURIComponent(bn)}`,{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8'},body:text});const j=await r.json();if(r.ok&&j.ok){this.setImportStatus(`✅ 词库「${bn}」导入成功 (${j.count}词)`,'success');this.addWaitingChat(`📚 自定义词库「${bn}」已导入 (${j.count}词)`,'system');}else this.setImportStatus(`❌ ${j.error||'导入失败'}`,'error');}catch{this.setImportStatus('❌ 网络错误，导入失败','error');}}
    setImportStatus(msg,type){this.importStatus.textContent=msg;this.importStatus.className='config-hint';if(type)this.importStatus.classList.add(type);setTimeout(()=>{this.importStatus.textContent='';this.importStatus.className='config-hint';},4000);}
    applyRounds(){if(!this.socket)return;const v=parseInt(this.waitingMaxRounds.value,10);if(isNaN(v)||v<1)return;this.socket.emit('set-max-rounds',{maxRounds:v});this.addWaitingChat(`总轮数已设置为：${v} 轮`,'system');}
    applyRoundtime(){if(!this.socket)return;const v=parseInt(this.waitingRoundTime.value,10);if(isNaN(v)||v<10)return;this.socket.emit('set-round-duration',{duration:v});this.addWaitingChat(`每轮时间已设置为：${v} 秒`,'system');}
    requestStartGame(){if(this.socket)this.socket.emit('start-game');}
    copyRoomCode(){const c=this.waitingRoomId.textContent;if(!c||c==='------')return;navigator.clipboard.writeText(c).then(()=>{this.copyRoomBtn.style.color='var(--success)';setTimeout(()=>{this.copyRoomBtn.style.color='';},1500);}).catch(()=>{const inp=document.createElement('input');inp.value=c;document.body.appendChild(inp);inp.select();document.execCommand('copy');document.body.removeChild(inp);});}

    /* ═══════════════════════════════════════════
       结束
       ═══════════════════════════════════════════ */
    showEndScreen(){this.switchScreen('end');const pl=[...(this.gameState.players||[])].sort((a,b)=>b.score-a.score);this.finalScores.innerHTML='';pl.forEach((p,i)=>{const d=document.createElement('div');d.className='final-score-item';if(i===0)d.classList.add('winner');const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';d.innerHTML=`<span class="final-score-name">${medal} ${i+1}. ${p.name}</span><span class="final-score-points">${p.score} 分</span>`;this.finalScores.appendChild(d);});const isH=this.gameState.hostId===this.playerId;this.newGameButton.textContent=isH?'🔄 返回房间（重新开始）':'⏳ 等待房主返回房间...';this.newGameButton.disabled=!isH;}
    returnToRoom(){if(!this.socket)return;this.clearLocalTimer();this.clearLocalCanvas();this.chatMessages.innerHTML='';this.waitingChatMessages.innerHTML='';this.socket.emit('reset-room');}
}

document.addEventListener('DOMContentLoaded', () => { new GuessDrawGame(); });
