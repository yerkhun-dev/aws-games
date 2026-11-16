/* Cloud Stacker — dependency-free tetromino game for Cloud Arcade. */
(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const STORAGE_KEY = "cloud-arcade:cloud-stacker:stats";
  const executingScript = document.currentScript;
  const STYLE_URL = executingScript && executingScript.src
    ? new URL("../../css/cloud-stacker.css", executingScript.src).href
    : "css/cloud-stacker.css";

  const MODES = {
    classic: {
      id: "classic", name: "Classic", icon: "∞", tone: "orange",
      description: "Construye sin límite, encadena líneas y sube de nivel hasta que la región se quede sin capacidad.",
      detail: "Endless · velocidad creciente"
    },
    sprint: {
      id: "sprint", name: "Sprint 40", icon: "⚡", tone: "cyan",
      description: "Despeja 40 líneas lo antes posible. El cronómetro se detiene con la última línea.",
      detail: "40 líneas · contrarreloj"
    },
    architect: {
      id: "architect", name: "Architect", icon: "◇", tone: "purple",
      description: "Completa objetivos inspirados en arquitecturas AWS y entrega el stack antes del game over.",
      detail: "5 blueprints · 3 objetivos"
    }
  };

  const ARCHITECTURES = [
    {
      id: "serverless-api", name: "Serverless API", tier: "Compute",
      icon: "λ", route: "API Gateway → Lambda → DynamoDB",
      objectives: [
        { type: "pieces", target: 18, label: "Invoca 18 funciones", unit: "piezas" },
        { type: "hardDrops", target: 8, label: "Acelera 8 invocaciones", unit: "hard drops" },
        { type: "lines", target: 6, label: "Procesa 6 lotes", unit: "líneas" }
      ]
    },
    {
      id: "multi-az-web", name: "Multi-AZ Web", tier: "Reliability",
      icon: "AZ", route: "Route 53 → ALB → EC2 Auto Scaling",
      objectives: [
        { type: "pieces", target: 24, label: "Distribuye 24 instancias", unit: "piezas" },
        { type: "multiClears", target: 2, label: "Escala dos zonas", unit: "clears múltiples" },
        { type: "lines", target: 10, label: "Sirve 10 capas", unit: "líneas" }
      ]
    },
    {
      id: "data-lake", name: "Analytics Lake", tier: "Data",
      icon: "S3", route: "Kinesis → S3 → Glue → Athena",
      objectives: [
        { type: "pieces", target: 28, label: "Ingiere 28 eventos", unit: "piezas" },
        { type: "score", target: 5000, label: "Optimiza consultas", unit: "puntos" },
        { type: "lines", target: 12, label: "Compacta 12 particiones", unit: "líneas" }
      ]
    },
    {
      id: "event-pipeline", name: "Event Pipeline", tier: "Integration",
      icon: "⌁", route: "EventBridge → SQS → Lambda",
      objectives: [
        { type: "hardDrops", target: 12, label: "Publica 12 eventos", unit: "hard drops" },
        { type: "combo", target: 3, label: "Encadena consumidores", unit: "combo máximo" },
        { type: "lines", target: 8, label: "Vacía 8 particiones", unit: "líneas" }
      ]
    },
    {
      id: "resilient-storage", name: "Resilient Storage", tier: "Storage",
      icon: "▱", route: "CloudFront → S3 → Backup",
      objectives: [
        { type: "pieces", target: 22, label: "Replica 22 objetos", unit: "piezas" },
        { type: "tetrises", target: 1, label: "Crea un backup completo", unit: "tetris" },
        { type: "lines", target: 9, label: "Versiona 9 capas", unit: "líneas" }
      ]
    }
  ];

  const PIECES = {
    I: {
      name: "CloudFront", glyph: "CF", color: "#2ea7ff",
      rotations: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[2, 0], [2, 1], [2, 2], [2, 3]],
        [[0, 2], [1, 2], [2, 2], [3, 2]],
        [[1, 0], [1, 1], [1, 2], [1, 3]]
      ]
    },
    J: {
      name: "EC2", glyph: "EC2", color: "#ff9900",
      rotations: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [2, 2]],
        [[1, 0], [1, 1], [0, 2], [1, 2]]
      ]
    },
    L: {
      name: "Lambda", glyph: "λ", color: "#ffb13b",
      rotations: [
        [[2, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [2, 2]],
        [[0, 1], [1, 1], [2, 1], [0, 2]],
        [[0, 0], [1, 0], [1, 1], [1, 2]]
      ]
    },
    O: {
      name: "S3", glyph: "S3", color: "#45c486",
      rotations: Array.from({ length: 4 }, () => [[1, 0], [2, 0], [1, 1], [2, 1]])
    },
    S: {
      name: "Route 53", glyph: "53", color: "#a775ff",
      rotations: [
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[1, 0], [1, 1], [2, 1], [2, 2]],
        [[1, 1], [2, 1], [0, 2], [1, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2]]
      ]
    },
    T: {
      name: "DynamoDB", glyph: "DB", color: "#dc6cff",
      rotations: [
        [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [1, 2]],
        [[1, 0], [0, 1], [1, 1], [1, 2]]
      ]
    },
    Z: {
      name: "WAF", glyph: "◆", color: "#ef5b67",
      rotations: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[2, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [1, 2], [2, 2]],
        [[1, 0], [0, 1], [1, 1], [0, 2]]
      ]
    }
  };

  const PIECE_IDS = Object.keys(PIECES);
  const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]];

  let host = null;
  let canvas = null;
  let context = null;
  let state = null;
  let exitCallback = null;
  let animationId = null;
  let previousFrame = 0;
  let ownedStyle = null;
  let touchRepeatDelay = null;
  let touchRepeatInterval = null;
  const scheduledTimers = new Set();

  function defaultStats() {
    return {
      played: 0,
      wins: 0,
      bestScore: 0,
      bestLines: 0,
      bestSprintTime: null,
      totalLines: 0,
      modeWins: {},
      architecturesCompleted: []
    };
  }

  function readStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const stored = parsed && typeof parsed === "object" ? parsed : {};
      const defaults = defaultStats();
      return {
        played: Number.isFinite(stored.played) ? stored.played : defaults.played,
        wins: Number.isFinite(stored.wins) ? stored.wins : defaults.wins,
        bestScore: Number.isFinite(stored.bestScore) ? stored.bestScore : defaults.bestScore,
        bestLines: Number.isFinite(stored.bestLines) ? stored.bestLines : defaults.bestLines,
        bestSprintTime: Number.isFinite(stored.bestSprintTime) ? stored.bestSprintTime : defaults.bestSprintTime,
        totalLines: Number.isFinite(stored.totalLines) ? stored.totalLines : defaults.totalLines,
        modeWins: stored.modeWins && typeof stored.modeWins === "object" ? stored.modeWins : {},
        architecturesCompleted: Array.isArray(stored.architecturesCompleted) ? stored.architecturesCompleted.filter((id) => typeof id === "string") : []
      };
    } catch (_) {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Storage is optional. */ }
  }

  function ensureStyles() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) => link.href === STYLE_URL || link.dataset.cloudStackerStyle !== undefined);
    if (existing) return;
    ownedStyle = document.createElement("link");
    ownedStyle.rel = "stylesheet";
    ownedStyle.href = STYLE_URL;
    ownedStyle.dataset.cloudStackerStyle = "";
    document.head.appendChild(ownedStyle);
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      scheduledTimers.delete(timer);
      callback();
    }, delay);
    scheduledTimers.add(timer);
    return timer;
  }

  function clearTimers() {
    scheduledTimers.forEach((timer) => window.clearTimeout(timer));
    scheduledTimers.clear();
    stopTouchRepeat();
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function createIdleState() {
    return {
      modeId: "classic",
      architectureId: null,
      status: "menu",
      board: emptyBoard(),
      current: null,
      queue: [],
      bag: [],
      hold: null,
      canHold: true,
      score: 0,
      lines: 0,
      level: 1,
      combo: -1,
      bestCombo: 0,
      piecesPlaced: 0,
      hardDrops: 0,
      multiClears: 0,
      tetrises: 0,
      startedAt: null,
      finishedAt: null,
      pausedAt: null,
      pausedTotal: 0,
      fallAccumulator: 0,
      groundedAt: null,
      lockResets: 0,
      clearingRows: [],
      dirty: true,
      dashboardAt: 0
    };
  }

  function currentMode() {
    return MODES[state && state.modeId] || MODES.classic;
  }

  function currentArchitecture() {
    return ARCHITECTURES.find((architecture) => architecture.id === (state && state.architectureId)) || null;
  }

  function fillQueue() {
    while (state.queue.length < 6) {
      if (!state.bag.length) state.bag = shuffle(PIECE_IDS);
      state.queue.push(state.bag.shift());
    }
  }

  function makePiece(type) {
    return { type, rotation: 0, x: 3, y: -1 };
  }

  function cellsFor(piece, x = piece.x, y = piece.y, rotation = piece.rotation) {
    return PIECES[piece.type].rotations[rotation].map(([column, row]) => ({ x: x + column, y: y + row }));
  }

  function collides(piece, x = piece.x, y = piece.y, rotation = piece.rotation) {
    return cellsFor(piece, x, y, rotation).some((cell) => (
      cell.x < 0 || cell.x >= COLS || cell.y >= ROWS || (cell.y >= 0 && state.board[cell.y][cell.x])
    ));
  }

  function isGrounded() {
    return Boolean(state.current && collides(state.current, state.current.x, state.current.y + 1));
  }

  function spawnPiece(type) {
    fillQueue();
    state.current = makePiece(type || state.queue.shift());
    fillQueue();
    state.canHold = true;
    state.fallAccumulator = 0;
    state.groundedAt = null;
    state.lockResets = 0;
    state.dirty = true;
    if (collides(state.current)) finishGame("gameover");
    else renderSidePanels();
  }

  function gravityMs() {
    return Math.max(70, Math.round(850 * Math.pow(0.82, state.level - 1)));
  }

  function elapsedMs() {
    if (!state || !state.startedAt) return 0;
    const end = state.finishedAt || (state.status === "paused" ? state.pausedAt : Date.now());
    return Math.max(0, end - state.startedAt - state.pausedTotal);
  }

  function formatTime(milliseconds) {
    const totalCentiseconds = Math.floor(milliseconds / 10);
    const minutes = Math.floor(totalCentiseconds / 6000).toString().padStart(2, "0");
    const seconds = Math.floor((totalCentiseconds % 6000) / 100).toString().padStart(2, "0");
    const centiseconds = (totalCentiseconds % 100).toString().padStart(2, "0");
    return `${minutes}:${seconds}.${centiseconds}`;
  }

  function resetGroundAfterMove(wasGrounded) {
    if (!isGrounded()) {
      state.groundedAt = null;
      return;
    }
    if (wasGrounded && state.lockResets < 15) {
      state.groundedAt = performance.now();
      state.lockResets += 1;
    }
  }

  function moveHorizontal(direction) {
    if (state.status !== "playing" || !state.current) return false;
    const wasGrounded = isGrounded();
    if (collides(state.current, state.current.x + direction, state.current.y)) return false;
    state.current.x += direction;
    resetGroundAfterMove(wasGrounded);
    state.dirty = true;
    return true;
  }

  function softDrop() {
    if (state.status !== "playing" || !state.current) return false;
    if (!collides(state.current, state.current.x, state.current.y + 1)) {
      state.current.y += 1;
      state.score += 1;
      state.fallAccumulator = 0;
      state.groundedAt = null;
      state.dirty = true;
      updateDashboard();
      return true;
    }
    if (state.groundedAt === null) state.groundedAt = performance.now();
    return false;
  }

  function hardDrop() {
    if (state.status !== "playing" || !state.current) return;
    let distance = 0;
    while (!collides(state.current, state.current.x, state.current.y + 1)) {
      state.current.y += 1;
      distance += 1;
    }
    state.score += distance * 2;
    state.hardDrops += 1;
    state.dirty = true;
    lockPiece();
  }

  function rotatePiece(direction) {
    if (state.status !== "playing" || !state.current) return false;
    const piece = state.current;
    const wasGrounded = isGrounded();
    const nextRotation = (piece.rotation + direction + 4) % 4;
    const kicks = piece.type === "O" ? [[0, 0]] : KICKS;
    for (const [offsetX, offsetY] of kicks) {
      if (!collides(piece, piece.x + offsetX, piece.y + offsetY, nextRotation)) {
        piece.x += offsetX;
        piece.y += offsetY;
        piece.rotation = nextRotation;
        resetGroundAfterMove(wasGrounded);
        state.dirty = true;
        return true;
      }
    }
    return false;
  }

  function holdPiece() {
    if (state.status !== "playing" || !state.current || !state.canHold) return;
    const outgoing = state.current.type;
    if (state.hold) {
      const incoming = state.hold;
      state.hold = outgoing;
      state.current = makePiece(incoming);
      state.fallAccumulator = 0;
      state.groundedAt = null;
      state.lockResets = 0;
      state.canHold = false;
      if (collides(state.current)) finishGame("gameover");
    } else {
      state.hold = outgoing;
      spawnPiece();
      state.canHold = false;
    }
    state.dirty = true;
    renderSidePanels();
  }

  function lockPiece() {
    if (state.status !== "playing" || !state.current) return;
    const piece = state.current;
    const cells = cellsFor(piece);
    if (cells.some((cell) => cell.y < 0)) {
      finishGame("gameover");
      return;
    }
    cells.forEach((cell) => {
      state.board[cell.y][cell.x] = { type: piece.type, color: PIECES[piece.type].color, glyph: PIECES[piece.type].glyph };
    });
    state.piecesPlaced += 1;
    state.current = null;
    state.groundedAt = null;
    const fullRows = [];
    state.board.forEach((row, index) => { if (row.every(Boolean)) fullRows.push(index); });
    if (fullRows.length) beginLineClear(fullRows);
    else {
      state.combo = -1;
      updateLevel();
      if (!evaluateArchitect()) spawnPiece();
      updateDashboard();
    }
    state.dirty = true;
  }

  function beginLineClear(rows) {
    state.status = "clearing";
    state.clearingRows = rows;
    state.dirty = true;
    schedule(() => {
      if (!state || state.status !== "clearing") return;
      rows.slice().sort((a, b) => b - a).forEach((row) => {
        state.board.splice(row, 1);
        state.board.unshift(Array(COLS).fill(null));
      });
      const previousLevel = state.level;
      state.lines += rows.length;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo + 1);
      if (rows.length >= 2) state.multiClears += 1;
      if (rows.length === 4) state.tetrises += 1;
      const base = [0, 100, 300, 500, 800][rows.length] || rows.length * 250;
      const comboBonus = state.combo > 0 ? state.combo * 50 * previousLevel : 0;
      state.score += base * previousLevel + comboBonus;
      updateLevel();
      const stats = readStats();
      stats.totalLines += rows.length;
      saveStats(stats);
      state.clearingRows = [];
      state.status = "playing";
      showNotice(rows.length === 4 ? "CloudFormation completo" : `${rows.length} ${rows.length === 1 ? "línea desplegada" : "líneas desplegadas"}`, rows.length === 4 ? `Tetris · +${base * previousLevel + comboBonus}` : `Combo ×${Math.max(1, state.combo + 1)} · nivel ${state.level}`);
      updateDashboard();
      if (state.modeId === "sprint" && state.lines >= 40) {
        finishGame("completed");
        return;
      }
      if (!evaluateArchitect()) spawnPiece();
      state.dirty = true;
    }, 180);
  }

  function updateLevel() {
    state.level = Math.floor(state.lines / 10) + 1;
  }

  function objectiveValue(objective) {
    const values = {
      pieces: state.piecesPlaced,
      hardDrops: state.hardDrops,
      lines: state.lines,
      score: state.score,
      combo: state.bestCombo,
      multiClears: state.multiClears,
      tetrises: state.tetrises
    };
    return values[objective.type] || 0;
  }

  function evaluateArchitect() {
    if (state.modeId !== "architect") return false;
    const architecture = currentArchitecture();
    if (!architecture) return false;
    renderMissions();
    const completed = architecture.objectives.every((objective) => objectiveValue(objective) >= objective.target);
    if (completed) finishGame("completed");
    return completed;
  }

  function recordResult(completed) {
    const stats = readStats();
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.bestLines = Math.max(stats.bestLines, state.lines);
    if (completed) {
      stats.wins += 1;
      stats.modeWins[state.modeId] = (stats.modeWins[state.modeId] || 0) + 1;
      if (state.modeId === "sprint") {
        const time = Math.round(elapsedMs());
        stats.bestSprintTime = stats.bestSprintTime === null ? time : Math.min(stats.bestSprintTime, time);
      }
      if (state.modeId === "architect" && state.architectureId && !stats.architecturesCompleted.includes(state.architectureId)) {
        stats.architecturesCompleted.push(state.architectureId);
      }
    }
    saveStats(stats);
  }

  function finishGame(result) {
    if (!state || state.status === "finished") return;
    state.finishedAt = Date.now();
    state.status = "finished";
    state.current = null;
    state.dirty = true;
    const completed = result === "completed";
    recordResult(completed);
    updateDashboard();
    const architecture = currentArchitecture();
    let eyebrow = "CAPACITY EXCEEDED";
    let title = "Región sin capacidad";
    let copy = `El stack llegó a ${state.lines} líneas y ${state.score.toLocaleString("es-ES")} puntos.`;
    let symbol = "!";
    if (completed && state.modeId === "sprint") {
      eyebrow = "40 LINES DEPLOYED";
      title = "Sprint completado";
      copy = `Despejaste 40 líneas en ${formatTime(elapsedMs())} con ${state.score.toLocaleString("es-ES")} puntos.`;
      symbol = "✓";
    } else if (completed && architecture) {
      eyebrow = "WELL-ARCHITECTED";
      title = `${architecture.name} desplegada`;
      copy = `Completaste los tres objetivos del blueprint con ${state.score.toLocaleString("es-ES")} puntos.`;
      symbol = "◇";
    }
    showOverlay(`
      <div class="cs-result-card ${completed ? "is-success" : "is-failure"}">
        <span class="cs-result-symbol">${symbol}</span>
        <span class="cs-eyebrow">${eyebrow}</span>
        <h2>${title}</h2>
        <p>${copy}</p>
        <div class="cs-result-metrics"><span><small>LÍNEAS</small><strong>${state.lines}</strong></span><span><small>NIVEL</small><strong>${state.level}</strong></span><span><small>TIEMPO</small><strong>${formatTime(elapsedMs())}</strong></span></div>
        <div class="cs-result-actions"><button type="button" class="cs-primary" data-cs-action="restart">Reintentar <b>→</b></button><button type="button" data-cs-action="modes">Elegir modo</button><button type="button" class="cs-text-button" data-cs-action="exit">Volver al centro</button></div>
      </div>`);
  }

  function startGame(modeId, architectureId) {
    clearTimers();
    const mode = MODES[modeId] || MODES.classic;
    state = createIdleState();
    state.modeId = mode.id;
    state.architectureId = mode.id === "architect"
      ? (ARCHITECTURES.find((item) => item.id === architectureId) || ARCHITECTURES[0]).id
      : null;
    state.status = "playing";
    state.startedAt = Date.now();
    fillQueue();
    const stats = readStats();
    stats.played += 1;
    saveStats(stats);
    hideOverlay();
    spawnPiece();
    renderAll();
    previousFrame = performance.now();
  }

  function togglePause(forcePause) {
    if (!state || !["playing", "paused"].includes(state.status)) return;
    const shouldPause = forcePause === true || state.status === "playing";
    if (shouldPause && state.status === "playing") {
      state.status = "paused";
      state.pausedAt = Date.now();
      stopTouchRepeat();
      showOverlay(`
        <div class="cs-pause-card"><span class="cs-result-symbol">Ⅱ</span><span class="cs-eyebrow">DEPLOYMENT PAUSED</span><h2>Partida en pausa</h2><p>El reloj y la gravedad están detenidos.</p><button type="button" class="cs-primary" data-cs-action="resume">Continuar <b>→</b></button></div>`);
    } else if (!shouldPause && state.status === "paused") {
      state.pausedTotal += Date.now() - state.pausedAt;
      state.pausedAt = null;
      state.status = "playing";
      state.fallAccumulator = 0;
      state.groundedAt = null;
      previousFrame = performance.now();
      hideOverlay();
    } else if (state.status === "paused") {
      state.pausedTotal += Date.now() - state.pausedAt;
      state.pausedAt = null;
      state.status = "playing";
      state.fallAccumulator = 0;
      state.groundedAt = null;
      previousFrame = performance.now();
      hideOverlay();
    }
    updateDashboard();
  }

  function chooseModes() {
    if (state && ["playing", "paused", "clearing"].includes(state.status) && !window.confirm("¿Quieres abandonar este stack y elegir otro modo?")) return;
    clearTimers();
    state = createIdleState();
    renderAll();
    showModePicker();
  }

  function showModePicker() {
    showOverlay(`
      <div class="cs-picker">
        <div class="cs-picker-heading"><span class="cs-eyebrow">SELECT DEPLOYMENT MODE</span><h2>Elige tu stack</h2><p>Las mismas siete piezas, tres formas distintas de desplegar.</p></div>
        <div class="cs-mode-grid">
          ${Object.values(MODES).map((mode) => `
            <button type="button" class="cs-mode-card tone-${mode.tone}" data-cs-mode="${mode.id}">
              <span class="cs-mode-icon">${mode.icon}</span><span><strong>${mode.name}</strong><small>${mode.description}</small><b>${mode.detail}</b></span><i>→</i>
            </button>`).join("")}
        </div>
        <button type="button" class="cs-picker-exit" data-cs-action="exit">← Volver al centro de juegos</button>
      </div>`, true);
  }

  function showArchitecturePicker() {
    const stats = readStats();
    showOverlay(`
      <div class="cs-picker cs-architecture-picker">
        <div class="cs-picker-heading"><span class="cs-eyebrow">AWS ARCHITECT MISSIONS</span><h2>Selecciona un blueprint</h2><p>Completa sus tres objetivos antes de que la capacidad de la región se agote.</p></div>
        <div class="cs-architecture-grid">
          ${ARCHITECTURES.map((architecture) => {
            const completed = stats.architecturesCompleted.includes(architecture.id);
            return `<button type="button" class="cs-architecture-card ${completed ? "is-complete" : ""}" data-cs-architecture="${architecture.id}">
              <span class="cs-architecture-icon">${architecture.icon}</span><span><small>${architecture.tier.toUpperCase()} ${completed ? "· ✓ COMPLETADA" : ""}</small><strong>${architecture.name}</strong><em>${architecture.route}</em><b>${architecture.objectives.map((objective) => objective.label).join(" · ")}</b></span><i>→</i>
            </button>`;
          }).join("")}
        </div>
        <button type="button" class="cs-picker-exit" data-cs-action="back-modes">← Volver a modos</button>
      </div>`, true);
  }

  function showOverlay(markup, picker) {
    if (!host) return;
    const overlay = host.querySelector("#cs-overlay");
    overlay.hidden = false;
    overlay.className = `cs-overlay ${picker ? "is-picker" : ""}`;
    overlay.innerHTML = markup;
  }

  function hideOverlay() {
    if (!host) return;
    const overlay = host.querySelector("#cs-overlay");
    overlay.hidden = true;
    overlay.className = "cs-overlay";
    overlay.innerHTML = "";
  }

  function showNotice(title, copy) {
    if (!host) return;
    const notice = host.querySelector("#cs-notice");
    if (!notice) return;
    notice.innerHTML = `<span>◇</span><div><strong>${title}</strong><small>${copy}</small></div>`;
    notice.classList.add("is-visible");
    schedule(() => { if (notice.isConnected) notice.classList.remove("is-visible"); }, 2600);
  }

  function drawCell(x, y, data, alpha = 1, ghost = false) {
    if (y < 0) return;
    const px = x * CELL;
    const py = y * CELL;
    context.save();
    context.globalAlpha = alpha;
    if (ghost) {
      context.strokeStyle = data.color;
      context.lineWidth = 2;
      context.setLineDash([4, 3]);
      context.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8);
      context.restore();
      return;
    }
    const gradient = context.createLinearGradient(px, py, px + CELL, py + CELL);
    gradient.addColorStop(0, data.color);
    gradient.addColorStop(1, shadeColor(data.color, -30));
    context.fillStyle = gradient;
    context.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    context.fillStyle = "rgba(255,255,255,.25)";
    context.fillRect(px + 3, py + 3, CELL - 6, 2);
    context.fillStyle = "rgba(3,10,18,.26)";
    context.fillRect(px + 3, py + CELL - 5, CELL - 6, 2);
    context.strokeStyle = "rgba(255,255,255,.15)";
    context.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
    context.fillStyle = "rgba(4,12,22,.82)";
    context.font = `700 ${data.glyph.length > 2 ? 8 : 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(data.glyph, px + CELL / 2, py + CELL / 2 + .5);
    context.restore();
  }

  function shadeColor(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const red = Math.max(0, Math.min(255, (value >> 16) + amount));
    const green = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
    const blue = Math.max(0, Math.min(255, (value & 255) + amount));
    return `rgb(${red}, ${green}, ${blue})`;
  }

  function renderCanvas() {
    if (!context || !state) return;
    context.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    const gradient = context.createLinearGradient(0, 0, 0, ROWS * CELL);
    gradient.addColorStop(0, "#0a1b2d");
    gradient.addColorStop(1, "#030a12");
    context.fillStyle = gradient;
    context.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    context.strokeStyle = "rgba(97,145,181,.11)";
    context.lineWidth = 1;
    for (let column = 0; column <= COLS; column += 1) {
      context.beginPath(); context.moveTo(column * CELL + .5, 0); context.lineTo(column * CELL + .5, ROWS * CELL); context.stroke();
    }
    for (let row = 0; row <= ROWS; row += 1) {
      context.beginPath(); context.moveTo(0, row * CELL + .5); context.lineTo(COLS * CELL, row * CELL + .5); context.stroke();
    }

    state.board.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) drawCell(x, y, cell, state.clearingRows.includes(y) ? .28 : 1);
    }));

    if (state.current && ["playing", "paused"].includes(state.status)) {
      let ghostY = state.current.y;
      while (!collides(state.current, state.current.x, ghostY + 1)) ghostY += 1;
      const info = PIECES[state.current.type];
      if (ghostY !== state.current.y) cellsFor(state.current, state.current.x, ghostY).forEach((cell) => drawCell(cell.x, cell.y, info, .5, true));
      cellsFor(state.current).forEach((cell) => drawCell(cell.x, cell.y, info));
    }

    if (state.status === "paused") {
      context.fillStyle = "rgba(3,10,18,.44)";
      context.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    }
    state.dirty = false;
  }

  function miniPieceMarkup(type) {
    if (!type) return '<span class="cs-empty-mini">—</span>';
    const piece = PIECES[type];
    const cells = piece.rotations[0];
    return `<div class="cs-mini-piece" aria-label="${piece.name}">${cells.map(([x, y]) => `<i style="--mini-x:${x};--mini-y:${y};--mini-color:${piece.color}"><b>${piece.glyph}</b></i>`).join("")}</div>`;
  }

  function renderSidePanels() {
    if (!host || !state) return;
    const hold = host.querySelector("#cs-hold");
    const next = host.querySelector("#cs-next");
    if (hold) hold.innerHTML = miniPieceMarkup(state.hold);
    if (next) next.innerHTML = state.queue.slice(0, 4).map((type, index) => `<div class="cs-next-item ${index === 0 ? "is-first" : ""}">${miniPieceMarkup(type)}<span>${PIECES[type].name}</span></div>`).join("");
    renderMissions();
  }

  function renderMissions() {
    if (!host || !state) return;
    const panel = host.querySelector("#cs-mission-panel");
    if (!panel) return;
    const architecture = currentArchitecture();
    if (state.modeId !== "architect" || !architecture) {
      const copy = state.modeId === "sprint" ? "Despeja 40 líneas. Cada décima línea aumenta el nivel y acelera la gravedad." : "Mantén libre la zona de spawn y encadena líneas para multiplicar la puntuación.";
      panel.innerHTML = `<span class="cs-side-label">MISIÓN ACTIVA</span><div class="cs-default-mission"><i>${state.modeId === "sprint" ? "⚡" : "∞"}</i><span><strong>${currentMode().name}</strong><small>${copy}</small></span></div>`;
      return;
    }
    panel.innerHTML = `
      <span class="cs-side-label">ARCHITECT BLUEPRINT</span>
      <div class="cs-blueprint-heading"><i>${architecture.icon}</i><span><strong>${architecture.name}</strong><small>${architecture.route}</small></span></div>
      <div class="cs-objectives">${architecture.objectives.map((objective) => {
        const value = objectiveValue(objective);
        const complete = value >= objective.target;
        const percent = Math.min(100, (value / objective.target) * 100);
        return `<div class="cs-objective ${complete ? "is-complete" : ""}"><span><b>${complete ? "✓" : "○"}</b><small>${objective.label}</small><strong>${Math.min(value, objective.target)} / ${objective.target}</strong></span><i><em style="width:${percent}%"></em></i></div>`;
      }).join("")}</div>`;
  }

  function updateDashboard() {
    if (!host || !state) return;
    const setText = (selector, value) => { const element = host.querySelector(selector); if (element) element.textContent = value; };
    setText("#cs-score", state.score.toLocaleString("es-ES"));
    setText("#cs-lines", state.modeId === "sprint" ? `${Math.min(state.lines, 40)} / 40` : state.lines);
    setText("#cs-level", state.level);
    setText("#cs-combo", `×${Math.max(1, state.combo + 1)}`);
    setText("#cs-time", formatTime(elapsedMs()));
    setText("#cs-mode-name", currentMode().name);
    setText("#cs-speed", `${gravityMs()} ms`);
    const progress = host.querySelector("#cs-level-progress");
    if (progress) progress.style.width = `${(state.lines % 10) * 10}%`;
    const pause = host.querySelector('[data-cs-action="pause"]');
    if (pause) {
      pause.disabled = !["playing", "paused"].includes(state.status);
      pause.innerHTML = state.status === "paused" ? "<span>▶</span> Continuar" : "<span>Ⅱ</span> Pausa";
    }
    const hold = host.querySelector('[data-cs-control="hold"]');
    if (hold) hold.disabled = state.status !== "playing" || !state.canHold;
  }

  function renderAll() {
    renderCanvas();
    renderSidePanels();
    updateDashboard();
  }

  function runControl(action) {
    if (action === "left") moveHorizontal(-1);
    if (action === "right") moveHorizontal(1);
    if (action === "down") softDrop();
    if (action === "rotate-cw") rotatePiece(1);
    if (action === "rotate-ccw") rotatePiece(-1);
    if (action === "drop") hardDrop();
    if (action === "hold") holdPiece();
  }

  function startTouchRepeat(action) {
    stopTouchRepeat();
    runControl(action);
    touchRepeatDelay = window.setTimeout(() => {
      touchRepeatInterval = window.setInterval(() => runControl(action), action === "down" ? 45 : 80);
    }, 230);
  }

  function stopTouchRepeat() {
    window.clearTimeout(touchRepeatDelay);
    window.clearInterval(touchRepeatInterval);
    touchRepeatDelay = null;
    touchRepeatInterval = null;
  }

  function handlePointerDown(event) {
    const control = event.target.closest("[data-cs-control]");
    if (!control || !host || !host.contains(control)) return;
    const action = control.dataset.csControl;
    if (!["left", "right", "down"].includes(action)) return;
    event.preventDefault();
    startTouchRepeat(action);
  }

  function handleClick(event) {
    const mode = event.target.closest("[data-cs-mode]");
    if (mode) {
      if (mode.dataset.csMode === "architect") showArchitecturePicker();
      else startGame(mode.dataset.csMode);
      return;
    }
    const architecture = event.target.closest("[data-cs-architecture]");
    if (architecture) { startGame("architect", architecture.dataset.csArchitecture); return; }

    const control = event.target.closest("[data-cs-control]");
    if (control) {
      const action = control.dataset.csControl;
      if (["left", "right", "down"].includes(action) && event.detail !== 0) return;
      runControl(action);
      return;
    }

    const action = event.target.closest("[data-cs-action]")?.dataset.csAction;
    if (action === "pause") togglePause();
    if (action === "resume") togglePause(false);
    if (action === "restart") startGame(state.modeId, state.architectureId);
    if (action === "modes") chooseModes();
    if (action === "back-modes") showModePicker();
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleKeyDown(event) {
    if (!host || !state || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target?.isContentEditable) return;
    const key = event.key;
    const gameKeys = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "x", "X", "c", "C", "Shift", "p", "P", "Escape", "r", "R"];
    if (gameKeys.includes(key)) event.preventDefault();
    if (["p", "P", "Escape"].includes(key) && !event.repeat) { togglePause(); return; }
    if (state.status === "finished" && ["r", "R"].includes(key) && !event.repeat) { startGame(state.modeId, state.architectureId); return; }
    if (state.status !== "playing") return;
    if (key === "ArrowLeft") moveHorizontal(-1);
    if (key === "ArrowRight") moveHorizontal(1);
    if (key === "ArrowDown") softDrop();
    if (["ArrowUp", "x", "X"].includes(key) && !event.repeat) rotatePiece(1);
    if (["z", "Z"].includes(key) && !event.repeat) rotatePiece(-1);
    if (key === " " && !event.repeat) hardDrop();
    if (["c", "C", "Shift"].includes(key) && !event.repeat) holdPiece();
  }

  function handleVisibilityChange() {
    if (document.hidden && state && state.status === "playing") togglePause(true);
  }

  function updateFrame(timestamp) {
    if (!host || !state) return;
    const delta = Math.min(100, timestamp - (previousFrame || timestamp));
    previousFrame = timestamp;
    if (state.status === "playing" && state.current) {
      state.fallAccumulator += delta;
      const interval = gravityMs();
      if (state.fallAccumulator >= interval) {
        state.fallAccumulator %= interval;
        if (!collides(state.current, state.current.x, state.current.y + 1)) {
          state.current.y += 1;
          state.groundedAt = null;
          state.dirty = true;
        } else if (state.groundedAt === null) {
          state.groundedAt = timestamp;
        }
      }
      if (isGrounded()) {
        if (state.groundedAt === null) state.groundedAt = timestamp;
        if (timestamp - state.groundedAt >= 450) lockPiece();
      }
    }
    if (state.dirty) renderCanvas();
    if (timestamp - state.dashboardAt > 100) {
      state.dashboardAt = timestamp;
      updateDashboard();
    }
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function initialMarkup() {
    return `
      <section class="cloud-stacker-shell" aria-label="Cloud Stacker">
        <header class="cs-header">
          <div class="cs-title"><span class="cs-title-icon"><i></i><b>▦</b></span><div><span>TETROMINO DEPLOYMENT</span><h1>Cloud Stacker <b id="cs-mode-name">Classic</b></h1></div></div>
          <div class="cs-header-actions"><span class="cs-key-summary"><kbd>←↓→</kbd> mover <kbd>↑ / Z</kbd> rotar <kbd>Space</kbd> drop</span><button type="button" data-cs-action="pause"><span>Ⅱ</span> Pausa</button><button type="button" class="cs-modes-button" data-cs-action="modes"><span>▦</span> Modos</button></div>
        </header>
        <div class="cs-dashboard">
          <div><span>PUNTUACIÓN</span><strong id="cs-score">0</strong></div>
          <div><span>LÍNEAS</span><strong id="cs-lines">0</strong></div>
          <div class="cs-level-meter"><span>DEPLOYMENT LEVEL · <b id="cs-speed">850 ms</b></span><div><i id="cs-level-progress"></i></div></div>
          <div><span>NIVEL</span><strong id="cs-level">1</strong></div>
          <div><span>COMBO</span><strong id="cs-combo">×1</strong></div>
          <div><span>TIEMPO</span><strong id="cs-time">00:00.00</strong></div>
        </div>
        <div class="cs-play-area">
          <div class="cs-board-panel">
            <div class="cs-board-heading"><span><i></i> REGION: STACK-1 / CAPACITY GRID</span><span>10 × 20</span></div>
            <div class="cs-canvas-frame"><canvas id="cs-canvas" width="300" height="600" role="img" aria-label="Tablero de Cloud Stacker de 10 columnas y 20 filas"></canvas><span class="cs-spawn-label">SPAWN ZONE</span></div>
          </div>
          <aside class="cs-sidebar">
            <div class="cs-side-card cs-hold-card"><span class="cs-side-label">HOLD · <kbd>C</kbd></span><div id="cs-hold" class="cs-hold"></div></div>
            <div class="cs-side-card cs-next-card"><span class="cs-side-label">NEXT QUEUE</span><div id="cs-next" class="cs-next"></div></div>
            <div id="cs-mission-panel" class="cs-side-card cs-mission-card"></div>
          </aside>
          <div id="cs-overlay" class="cs-overlay" hidden></div>
        </div>
        <div class="cs-touch-controls" aria-label="Controles táctiles">
          <button type="button" data-cs-control="left" aria-label="Mover a la izquierda">←</button>
          <button type="button" data-cs-control="right" aria-label="Mover a la derecha">→</button>
          <button type="button" data-cs-control="down" aria-label="Descenso suave">↓</button>
          <button type="button" data-cs-control="rotate-ccw" aria-label="Rotar a la izquierda">↶</button>
          <button type="button" data-cs-control="rotate-cw" aria-label="Rotar a la derecha">↻</button>
          <button type="button" data-cs-control="hold" aria-label="Guardar pieza">HOLD</button>
          <button type="button" class="is-drop" data-cs-control="drop" aria-label="Descenso instantáneo">DROP</button>
        </div>
        <div class="cs-helpbar"><div><span><i class="cs-legend-current"></i>Pieza activa</span><span><i class="cs-legend-ghost"></i>Ghost</span><span><i class="cs-legend-stack"></i>Stack</span></div><p><strong>Controles:</strong> flechas para mover, ↑/X y Z para rotar, espacio para hard drop, C para hold y P para pausar.</p></div>
        <div id="cs-notice" class="cs-notice" role="status" aria-live="polite"></div>
      </section>`;
  }

  function mount(container, onExit) {
    destroy();
    if (!container) throw new Error("CloudStacker.mount requiere un contenedor válido.");
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    host.innerHTML = initialMarkup();
    canvas = host.querySelector("#cs-canvas");
    context = canvas.getContext("2d");
    host.addEventListener("click", handleClick);
    host.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", stopTouchRepeat);
    document.addEventListener("pointercancel", stopTouchRepeat);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    state = createIdleState();
    renderAll();
    showModePicker();
    previousFrame = performance.now();
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function destroy() {
    window.cancelAnimationFrame(animationId);
    animationId = null;
    clearTimers();
    if (host) {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("pointerdown", handlePointerDown);
    }
    document.removeEventListener("pointerup", stopTouchRepeat);
    document.removeEventListener("pointercancel", stopTouchRepeat);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (ownedStyle && ownedStyle.parentNode) ownedStyle.parentNode.removeChild(ownedStyle);
    ownedStyle = null;
    host = null;
    canvas = null;
    context = null;
    state = null;
    exitCallback = null;
    previousFrame = 0;
  }

  window.CloudStacker = {
    mount,
    destroy,
    getStats: readStats
  };
}());
