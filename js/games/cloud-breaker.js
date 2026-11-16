/* Cloud Breaker — dependency-free Breakout inspired by AWS architectures. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:cloud-breaker:stats";
  const STYLE_ID = "cloud-breaker-styles";
  const WIDTH = 1000;
  const HEIGHT = 620;
  const BALL_RADIUS = 8;
  const FIXED_STEP = 1 / 120;
  const MAX_BALLS = 7;

  const MODES = {
    classic: {
      name: "Classic",
      tone: "orange",
      icon: "◇",
      description: "Rompe las ocho arquitecturas. Tres vidas y un ritmo equilibrado.",
      label: "8 despliegues · equilibrio",
      lives: 3,
      speed: 390,
      dropRate: 0.16,
      scoreScale: 1
    },
    architect: {
      name: "Architect",
      tone: "blue",
      icon: "⌂",
      description: "Desmonta cada stack en orden, desde la capa superior visible hasta sus datos.",
      label: "Dependencias · precisión",
      lives: 4,
      speed: 360,
      dropRate: 0.2,
      scoreScale: 1.25
    },
    chaos: {
      name: "Chaos",
      tone: "purple",
      icon: "⚡",
      description: "Pelotas rápidas, rebotes variables y una lluvia de servicios y power-ups.",
      label: "Rápido · impredecible",
      lives: 5,
      speed: 455,
      dropRate: 0.29,
      scoreScale: 1.5
    }
  };

  const POWER_UPS = {
    lambda: { name: "Lambda Multiball", short: "λ", color: "#f58536", description: "Replica las pelotas activas." },
    scaling: { name: "Auto Scaling", short: "AS", color: "#8b5cf6", description: "Amplía el paddle durante 12 s." },
    shield: { name: "Shield", short: "SH", color: "#39d98a", description: "Protege el piso durante dos caídas." },
    sqs: { name: "SQS Rescue", short: "Q", color: "#d85ad8", description: "Recupera automáticamente una pelota perdida." },
    cloudwatch: { name: "CloudWatch", short: "CW", color: "#19a7ce", description: "Proyecta la trayectoria durante 10 s." }
  };

  const LEVELS = [
    {
      name: "Static Edge",
      tier: "FOUNDATION",
      summary: "Route 53 dirige a CloudFront; S3 conserva el sitio.",
      services: ["Route 53", "CloudFront", "S3"],
      colors: ["#8b5cf6", "#19a7ce", "#2cae66"],
      pattern: ["..########..", ".##########.", "############", "###..##..###", "###..##..###"]
    },
    {
      name: "Serverless API",
      tier: "FOUNDATION",
      summary: "API Gateway invoca Lambda y persiste en DynamoDB.",
      services: ["API Gateway", "Lambda", "DynamoDB", "CloudWatch"],
      colors: ["#8b5cf6", "#f58536", "#4d7cff", "#18a3a8"],
      pattern: [".##########.", "##..####..##", "############", ".##########.", "...######..."]
    },
    {
      name: "Three-Tier VPC",
      tier: "INTERMEDIATE",
      summary: "ELB distribuye tráfico a EC2 con datos en RDS.",
      services: ["Route 53", "ELB", "EC2", "RDS", "VPC"],
      colors: ["#8b5cf6", "#19a7ce", "#f58536", "#4d7cff", "#39d98a"],
      pattern: ["############", "#..######..#", "############", "##.######.##", "############"]
    },
    {
      name: "Event Pipeline",
      tier: "INTERMEDIATE",
      summary: "EventBridge y SQS desacoplan consumidores Lambda.",
      services: ["EventBridge", "SQS", "Lambda", "SNS"],
      colors: ["#d85ad8", "#d85ad8", "#f58536", "#e5484d"],
      pattern: ["##..##..##..", ".##..##..##.", "..##..##..##", ".##..##..##.", "##..##..##..", "############"]
    },
    {
      name: "Container Platform",
      tier: "ADVANCED",
      summary: "ECS escala contenedores detrás de un ALB observable.",
      services: ["CloudFront", "ALB", "ECS", "Auto Scaling", "CloudWatch"],
      colors: ["#19a7ce", "#8b5cf6", "#f58536", "#8b5cf6", "#18a3a8"],
      pattern: ["############", "###..##..###", "############", ".####.##.####", "############", "..########.."]
    },
    {
      name: "Data Lake",
      tier: "ADVANCED",
      summary: "Kinesis ingresa datos; S3, Glue y Athena los convierten en señal.",
      services: ["Kinesis", "S3", "Glue", "Athena", "QuickSight"],
      colors: ["#19a7ce", "#2cae66", "#8b5cf6", "#19a7ce", "#f58536"],
      pattern: ["#.#.#.#.#.#.", ".#.#.#.#.#.#", "############", "#.########.#", "############", ".##########."]
    },
    {
      name: "Zero Trust",
      tier: "EXPERT",
      summary: "WAF, Cognito, IAM y KMS protegen cada límite.",
      services: ["WAF", "Cognito", "IAM", "KMS", "Shield"],
      colors: ["#e5484d", "#e5484d", "#f58536", "#8b5cf6", "#39d98a"],
      pattern: ["############", "#..######..#", "#.########.#", "#.##.##.##.#", "#.########.#", "#..######..#", "############"]
    },
    {
      name: "Global Resilience",
      tier: "WELL-ARCHITECTED",
      summary: "Una plataforma multi-región protegida, observable y autoscalable.",
      services: ["Route 53", "CloudFront", "WAF", "ALB", "ECS", "Aurora", "CloudWatch"],
      colors: ["#8b5cf6", "#19a7ce", "#e5484d", "#8b5cf6", "#f58536", "#4d7cff", "#18a3a8"],
      pattern: ["############", ".##########.", "##.######.##", "############", "###..##..###", "############", ".##########."]
    }
  ];

  let host = null;
  let exitCallback = null;
  let canvas = null;
  let context = null;
  let state = null;
  let rafId = 0;
  let lastFrame = 0;
  let accumulator = 0;
  let styleNode = null;
  let styleOwned = false;
  let resizeObserver = null;
  const keys = { left: false, right: false };

  function defaultStats() {
    return {
      played: 0,
      wins: 0,
      bestScore: 0,
      bestLevel: 0,
      bricksBroken: 0,
      powerUps: 0,
      modeWins: { classic: 0, architect: 0, chaos: 0 }
    };
  }

  function safeReadStats() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const base = defaultStats();
      if (!stored || typeof stored !== "object") return base;
      return {
        ...base,
        ...stored,
        played: Number(stored.played) || 0,
        wins: Number(stored.wins) || 0,
        bestScore: Number(stored.bestScore) || 0,
        bestLevel: Number(stored.bestLevel) || 0,
        bricksBroken: Number(stored.bricksBroken) || 0,
        powerUps: Number(stored.powerUps) || 0,
        modeWins: { ...base.modeWins, ...(stored.modeWins || {}) }
      };
    } catch (_) {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Storage is optional. */ }
  }

  function ensureStyles() {
    styleNode = document.getElementById(STYLE_ID);
    styleOwned = false;
    if (!styleNode) {
      styleNode = document.createElement("link");
      styleNode.id = STYLE_ID;
      styleNode.rel = "stylesheet";
      styleNode.href = "css/cloud-breaker.css";
      document.head.appendChild(styleNode);
      styleOwned = true;
    }
  }

  function markup() {
    return `
      <section class="cloud-breaker-shell" aria-label="Cloud Breaker">
        <header class="cb-header">
          <div class="cb-title">
            <span class="cb-title-icon" aria-hidden="true">▤</span>
            <div><span>ARCHITECTURE BREAKOUT</span><h1>Cloud Breaker <b id="cb-mode-badge">Classic</b></h1></div>
          </div>
          <div class="cb-toolbar" aria-label="Controles de partida">
            <span class="cb-key-hint"><kbd>←</kbd><kbd>→</kbd> o <kbd>A</kbd><kbd>D</kbd></span>
            <button type="button" data-cb-action="pause"><span aria-hidden="true">Ⅱ</span> <span id="cb-pause-label">Pausa</span></button>
            <button type="button" data-cb-action="modes"><span aria-hidden="true">▦</span> Modos</button>
          </div>
        </header>

        <div class="cb-dashboard">
          <div><span>VIDAS</span><strong id="cb-lives">● ● ●</strong></div>
          <div><span>SCORE</span><strong id="cb-score">0</strong></div>
          <div class="cb-mission">
            <span>ARQUITECTURA <b id="cb-level-number">01 / 08</b></span>
            <strong id="cb-level-name">Static Edge</strong>
            <small id="cb-level-summary">Route 53 dirige a CloudFront; S3 conserva el sitio.</small>
          </div>
          <div><span>COMBO</span><strong id="cb-combo">×1</strong></div>
          <div><span>BRICKS</span><strong id="cb-bricks">0 / 0</strong></div>
        </div>

        <div class="cb-arena">
          <div class="cb-stage" id="cb-stage">
            <canvas id="cb-canvas" aria-label="Área de juego de Cloud Breaker"></canvas>
            <div class="cb-stage-label" aria-hidden="true"><span><i></i> REGION: CLOUD-ARCADE-1</span><span id="cb-tier">FOUNDATION</span></div>
            <div id="cb-launch-hint" class="cb-launch-hint"><strong>SPACE / TOCA</strong><span>para desplegar la pelota</span></div>
            <div id="cb-overlay" class="cb-overlay"></div>
            <div id="cb-toast" class="cb-toast" role="status" aria-live="polite"></div>
          </div>
        </div>

        <div class="cb-mobile-controls" aria-label="Controles móviles">
          <button type="button" data-cb-move="left" aria-label="Mover paddle a la izquierda">←</button>
          <button type="button" data-cb-action="launch" class="cb-mobile-launch">LANZAR</button>
          <button type="button" data-cb-move="right" aria-label="Mover paddle a la derecha">→</button>
        </div>

        <footer class="cb-helpbar">
          <div class="cb-power-legend" aria-label="Power-ups">
            ${Object.entries(POWER_UPS).map(([id, power]) => `<span data-power="${id}"><i>${power.short}</i><b>${power.name}</b></span>`).join("")}
          </div>
          <p><span>i</span><strong>Control:</strong> mueve el paddle con teclado, mouse o touch. <kbd>P</kbd> pausa y <kbd>Space</kbd> lanza.</p>
        </footer>
      </section>`;
  }

  function modePickerMarkup() {
    return `
      <div class="cb-mode-picker">
        <div class="cb-mode-heading">
          <span>SELECCIONA UN RUNBOOK</span>
          <h2>Elige cómo desplegar</h2>
          <p>Completa ocho arquitecturas AWS. Cada modo altera las reglas del stack.</p>
        </div>
        <div class="cb-mode-grid">
          ${Object.entries(MODES).map(([id, mode]) => `
            <button class="cb-mode-card mode-${mode.tone}" type="button" data-cb-mode="${id}">
              <span class="cb-mode-icon">${mode.icon}</span>
              <span class="cb-mode-copy"><strong>${mode.name}</strong><small>${mode.description}</small></span>
              <b>${mode.label}</b><i>→</i>
            </button>`).join("")}
        </div>
        <button class="cb-exit-button" type="button" data-cb-action="exit">← Volver al centro</button>
      </div>`;
  }

  function finishMarkup(won) {
    const title = won ? "Arquitectura desplegada" : "Deploy interrumpido";
    const copy = won
      ? `Completaste las ocho arquitecturas en modo ${MODES[state.modeId].name}.`
      : `Llegaste a ${LEVELS[state.levelIndex].name}. El stack conserva tu mejor puntuación.`;
    return `
      <div class="cb-finish-card ${won ? "is-win" : ""}">
        <span class="cb-finish-icon">${won ? "✓" : "!"}</span>
        <small>${won ? "DEPLOY SUCCEEDED" : "ROLLBACK COMPLETE"}</small>
        <h2>${title}</h2>
        <p>${copy}</p>
        <strong>${formatNumber(state.score)} pts</strong>
        <div><button type="button" class="primary-button" data-cb-action="replay">Jugar otra vez</button><button type="button" class="secondary-button" data-cb-action="modes">Cambiar modo</button></div>
        <button class="cb-exit-button" type="button" data-cb-action="exit">Volver al centro</button>
      </div>`;
  }

  function pauseMarkup() {
    return `
      <div class="cb-pause-card">
        <span>Ⅱ</span><small>SIMULATION PAUSED</small><h2>Partida en pausa</h2>
        <p>La arquitectura y sus timers están detenidos.</p>
        <button type="button" class="primary-button" data-cb-action="resume">Continuar</button>
      </div>`;
  }

  function formatNumber(value) {
    return Math.round(value || 0).toLocaleString("es-ES");
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function createState(modeId) {
    const mode = MODES[modeId] || MODES.classic;
    return {
      modeId: MODES[modeId] ? modeId : "classic",
      phase: "ready",
      levelIndex: 0,
      score: 0,
      lives: mode.lives,
      combo: 1,
      comboExpires: 0,
      broken: 0,
      totalBricks: 0,
      paddle: { x: WIDTH / 2, targetX: WIDTH / 2, width: 142, height: 16, velocity: 0 },
      balls: [],
      bricks: [],
      powerUps: [],
      particles: [],
      effects: { wideUntil: 0, guideUntil: 0, shieldCharges: 0, rescueCharges: 0 },
      elapsed: 0,
      transitionUntil: 0,
      toastUntil: 0,
      toastText: "",
      pausedAt: 0,
      statsCommitted: false
    };
  }

  function createBricks(levelIndex) {
    const level = LEVELS[levelIndex];
    const rows = level.pattern.length;
    const columns = level.pattern[0].length;
    const gap = 6;
    const left = 54;
    const top = 76;
    const availableWidth = WIDTH - left * 2;
    const brickWidth = (availableWidth - gap * (columns - 1)) / columns;
    const brickHeight = rows >= 7 ? 31 : 36;
    const bricks = [];
    let id = 0;

    level.pattern.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        if (cell !== "#") return;
        const serviceIndex = Math.min(level.services.length - 1, Math.floor(rowIndex * level.services.length / rows));
        const tough = state.modeId === "chaos" && (rowIndex + columnIndex + levelIndex) % 7 === 0;
        bricks.push({
          id: id++,
          x: left + columnIndex * (brickWidth + gap),
          y: top + rowIndex * (brickHeight + gap),
          width: brickWidth,
          height: brickHeight,
          row: rowIndex,
          service: level.services[serviceIndex],
          color: level.colors[serviceIndex],
          hp: tough ? 2 : 1,
          maxHp: tough ? 2 : 1,
          alive: true,
          hitFlash: 0
        });
      });
    });
    return bricks;
  }

  function resetLevel() {
    state.bricks = createBricks(state.levelIndex);
    state.totalBricks = state.bricks.length;
    state.broken = 0;
    state.powerUps = [];
    state.particles = [];
    state.effects.wideUntil = 0;
    state.effects.guideUntil = 0;
    state.paddle.width = 142;
    state.paddle.x = WIDTH / 2;
    state.paddle.targetX = WIDTH / 2;
    state.phase = "ready";
    createDockedBall();
    updateDashboard();
    updateOverlay();
  }

  function createDockedBall() {
    const speed = MODES[state.modeId].speed + state.levelIndex * 13;
    state.balls = [{ x: state.paddle.x, y: HEIGHT - 66, vx: speed * 0.55, vy: -speed * 0.84, radius: BALL_RADIUS, docked: true, trail: [] }];
  }

  function startGame(modeId) {
    state = createState(modeId);
    const stats = safeReadStats();
    stats.played += 1;
    saveStats(stats);
    resetLevel();
    const badge = host.querySelector("#cb-mode-badge");
    badge.textContent = MODES[state.modeId].name;
    badge.className = `mode-${MODES[state.modeId].tone}`;
    showToast(`${MODES[state.modeId].name}: ${LEVELS[0].name}`, 2200);
    lastFrame = performance.now();
  }

  function launchBall() {
    if (!state) return;
    if (state.phase === "paused") { togglePause(false); return; }
    if (state.phase !== "ready") return;
    state.phase = "playing";
    state.balls.forEach((ball) => { ball.docked = false; });
    updateOverlay();
  }

  function showModes(confirmAbandon) {
    if (!state || !host) return;
    const active = ["playing", "ready", "paused", "transition"].includes(state.phase);
    if (confirmAbandon && active && !window.confirm("¿Quieres abandonar esta partida y elegir otro modo?")) return;
    state.phase = "menu";
    state.balls = [];
    state.powerUps = [];
    updateOverlay();
  }

  function updateOverlay() {
    if (!host || !state) return;
    const overlay = host.querySelector("#cb-overlay");
    const launchHint = host.querySelector("#cb-launch-hint");
    overlay.className = "cb-overlay";
    overlay.hidden = false;

    if (state.phase === "menu") {
      overlay.classList.add("is-menu");
      overlay.innerHTML = modePickerMarkup();
    } else if (state.phase === "paused") {
      overlay.innerHTML = pauseMarkup();
    } else if (state.phase === "won" || state.phase === "gameover") {
      overlay.innerHTML = finishMarkup(state.phase === "won");
    } else if (state.phase === "transition") {
      overlay.classList.add("is-transition");
      overlay.innerHTML = `<div class="cb-level-card"><span>STACK CLEARED</span><strong>${LEVELS[state.levelIndex - 1]?.name || "Arquitectura"}</strong><small>Siguiente: ${LEVELS[state.levelIndex]?.name || "Completado"}</small></div>`;
    } else {
      overlay.hidden = true;
      overlay.innerHTML = "";
    }
    launchHint.hidden = state.phase !== "ready";
    const pauseLabel = host.querySelector("#cb-pause-label");
    pauseLabel.textContent = state.phase === "paused" ? "Continuar" : "Pausa";
  }

  function togglePause(force) {
    if (!state) return;
    if (state.phase === "paused") {
      if (force === true) return;
      const pauseDuration = Math.max(0, performance.now() - state.pausedAt);
      state.effects.wideUntil += pauseDuration;
      state.effects.guideUntil += pauseDuration;
      state.comboExpires += pauseDuration;
      state.toastUntil += pauseDuration;
      state.pausedAt = 0;
      state.phase = state.balls.some((ball) => ball.docked) ? "ready" : "playing";
      lastFrame = performance.now();
    } else if (["playing", "ready"].includes(state.phase) && force !== false) {
      state.pausedAt = performance.now();
      state.phase = "paused";
    } else {
      return;
    }
    updateOverlay();
  }

  function showToast(text, duration) {
    if (!state) return;
    state.toastText = text;
    state.toastUntil = performance.now() + (duration || 1800);
    const toast = host?.querySelector("#cb-toast");
    if (toast) {
      toast.textContent = text;
      toast.classList.add("is-visible");
    }
  }

  function updateDashboard() {
    if (!host || !state) return;
    const safeLevelIndex = Math.min(state.levelIndex, LEVELS.length - 1);
    const level = LEVELS[safeLevelIndex];
    host.querySelector("#cb-lives").textContent = state.lives > 0 ? "● ".repeat(state.lives).trim() : "—";
    host.querySelector("#cb-score").textContent = formatNumber(state.score);
    host.querySelector("#cb-combo").textContent = `×${state.combo}`;
    host.querySelector("#cb-bricks").textContent = `${state.broken} / ${state.totalBricks}`;
    host.querySelector("#cb-level-number").textContent = `${String(safeLevelIndex + 1).padStart(2, "0")} / ${String(LEVELS.length).padStart(2, "0")}`;
    host.querySelector("#cb-level-name").textContent = level.name;
    host.querySelector("#cb-level-summary").textContent = level.summary;
    host.querySelector("#cb-tier").textContent = level.tier;
  }

  function isBrickVulnerable(brick) {
    if (state.modeId !== "architect") return true;
    const aliveRows = state.bricks.filter((item) => item.alive).map((item) => item.row);
    return brick.row === Math.min(...aliveRows);
  }

  function circleHitsRect(ball, rect) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.height);
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  function reflectFromRect(ball, rect, previousX, previousY) {
    const cameFromLeft = previousX + ball.radius <= rect.x;
    const cameFromRight = previousX - ball.radius >= rect.x + rect.width;
    const cameFromTop = previousY + ball.radius <= rect.y;
    const cameFromBottom = previousY - ball.radius >= rect.y + rect.height;
    if (cameFromLeft || cameFromRight) ball.vx *= -1;
    else if (cameFromTop || cameFromBottom) ball.vy *= -1;
    else {
      const overlaps = [
        { axis: "x-", value: Math.abs(ball.x + ball.radius - rect.x) },
        { axis: "x+", value: Math.abs(rect.x + rect.width - (ball.x - ball.radius)) },
        { axis: "y-", value: Math.abs(ball.y + ball.radius - rect.y) },
        { axis: "y+", value: Math.abs(rect.y + rect.height - (ball.y - ball.radius)) }
      ].sort((a, b) => a.value - b.value);
      if (overlaps[0].axis[0] === "x") ball.vx *= -1;
      else ball.vy *= -1;
    }
  }

  function normalizeBall(ball, targetSpeed) {
    const speed = Math.hypot(ball.vx, ball.vy) || targetSpeed;
    const scale = targetSpeed / speed;
    ball.vx *= scale;
    ball.vy *= scale;
    const minimumVertical = targetSpeed * 0.34;
    if (Math.abs(ball.vy) < minimumVertical) {
      ball.vy = Math.sign(ball.vy || -1) * minimumVertical;
      const horizontal = Math.sqrt(Math.max(0, targetSpeed * targetSpeed - ball.vy * ball.vy));
      ball.vx = Math.sign(ball.vx || 1) * horizontal;
    }
  }

  function spawnParticles(brick) {
    for (let index = 0; index < 7; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 100;
      state.particles.push({
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.25,
        color: brick.color
      });
    }
  }

  function choosePowerUp(brick) {
    const ids = Object.keys(POWER_UPS);
    const deterministic = (brick.id + state.levelIndex * 3) % 19 === 0;
    if (!deterministic && Math.random() > MODES[state.modeId].dropRate) return;
    const type = ids[(brick.id + state.levelIndex + Math.floor(Math.random() * ids.length)) % ids.length];
    state.powerUps.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, vy: state.modeId === "chaos" ? 150 : 120, radius: 15, type, spin: 0 });
  }

  function hitBrick(ball, brick, previousX, previousY) {
    reflectFromRect(ball, brick, previousX, previousY);
    if (!isBrickVulnerable(brick)) {
      brick.hitFlash = 0.18;
      state.combo = 1;
      showToast("Architect: rompe primero la capa superior", 1000);
      return;
    }
    brick.hp -= 1;
    brick.hitFlash = 0.18;
    if (brick.hp > 0) return;
    brick.alive = false;
    state.broken += 1;
    const now = performance.now();
    state.combo = now <= state.comboExpires ? Math.min(9, state.combo + 1) : 1;
    state.comboExpires = now + 2200;
    state.score += Math.round((100 + state.levelIndex * 20) * state.combo * MODES[state.modeId].scoreScale);
    spawnParticles(brick);
    choosePowerUp(brick);
    const stats = safeReadStats();
    stats.bricksBroken += 1;
    saveStats(stats);
    updateDashboard();
    if (!state.bricks.some((item) => item.alive)) completeLevel();
  }

  function completeLevel() {
    state.score += Math.round((750 + state.lives * 200) * MODES[state.modeId].scoreScale);
    const stats = safeReadStats();
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.bestLevel = Math.max(stats.bestLevel, state.levelIndex + 1);
    saveStats(stats);
    state.levelIndex += 1;
    if (state.levelIndex >= LEVELS.length) {
      finishGame(true);
      return;
    }
    state.phase = "transition";
    state.transitionUntil = performance.now() + 1650;
    state.balls = [];
    state.powerUps = [];
    updateDashboard();
    updateOverlay();
  }

  function finishGame(won) {
    state.phase = won ? "won" : "gameover";
    state.balls = [];
    state.powerUps = [];
    if (!state.statsCommitted) {
      const stats = safeReadStats();
      if (won) {
        stats.wins += 1;
        stats.modeWins[state.modeId] = (Number(stats.modeWins[state.modeId]) || 0) + 1;
      }
      stats.bestScore = Math.max(stats.bestScore, state.score);
      stats.bestLevel = Math.max(stats.bestLevel, Math.min(LEVELS.length, state.levelIndex + (won ? 0 : 1)));
      saveStats(stats);
      state.statsCommitted = true;
    }
    updateDashboard();
    updateOverlay();
  }

  function loseBalls() {
    if (state.effects.rescueCharges > 0) {
      state.effects.rescueCharges -= 1;
      createDockedBall();
      state.phase = "ready";
      showToast("SQS devolvió la pelota a la cola", 2200);
      updateOverlay();
      return;
    }
    state.lives -= 1;
    state.combo = 1;
    if (state.lives <= 0) {
      finishGame(false);
      return;
    }
    createDockedBall();
    state.phase = "ready";
    showToast("Retry de despliegue", 1300);
    updateDashboard();
    updateOverlay();
  }

  function applyPowerUp(type) {
    const now = performance.now();
    if (type === "lambda") {
      const sourceBalls = state.balls.slice(0, 3);
      sourceBalls.forEach((ball) => {
        if (state.balls.length >= MAX_BALLS) return;
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() > 0.5 ? 0.38 : -0.38);
        state.balls.push({ ...ball, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, trail: [] });
      });
    }
    if (type === "scaling") state.effects.wideUntil = Math.max(state.effects.wideUntil, now) + 12000;
    if (type === "shield") state.effects.shieldCharges = Math.min(4, state.effects.shieldCharges + 2);
    if (type === "sqs") state.effects.rescueCharges = Math.min(3, state.effects.rescueCharges + 1);
    if (type === "cloudwatch") state.effects.guideUntil = Math.max(state.effects.guideUntil, now) + 10000;
    state.score += 250;
    const stats = safeReadStats();
    stats.powerUps += 1;
    saveStats(stats);
    showToast(POWER_UPS[type].name, 1900);
    updateDashboard();
  }

  function updatePaddle(dt, now) {
    const paddle = state.paddle;
    const oldX = paddle.x;
    const input = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (input) paddle.targetX = paddle.x + input * 620 * dt;
    const desiredWidth = now < state.effects.wideUntil ? 218 : 142;
    paddle.width += (desiredWidth - paddle.width) * Math.min(1, dt * 8);
    paddle.targetX = clamp(paddle.targetX, paddle.width / 2 + 8, WIDTH - paddle.width / 2 - 8);
    paddle.x += (paddle.targetX - paddle.x) * Math.min(1, dt * (input ? 28 : 18));
    paddle.velocity = (paddle.x - oldX) / Math.max(dt, 0.001);
    state.balls.forEach((ball) => {
      if (ball.docked) {
        ball.x = paddle.x;
        ball.y = HEIGHT - 66;
      }
    });
  }

  function updateBall(ball, dt, now) {
    if (ball.docked) return true;
    const previousX = ball.x;
    const previousY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.radius > WIDTH) { ball.x = WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }

    const paddleRect = { x: state.paddle.x - state.paddle.width / 2, y: HEIGHT - 48, width: state.paddle.width, height: state.paddle.height };
    if (ball.vy > 0 && circleHitsRect(ball, paddleRect) && previousY + ball.radius <= paddleRect.y + 3) {
      ball.y = paddleRect.y - ball.radius;
      const ratio = clamp((ball.x - state.paddle.x) / (state.paddle.width / 2), -1, 1);
      const speed = Math.min(650, Math.hypot(ball.vx, ball.vy) * 1.012);
      const angle = ratio * 1.03;
      ball.vx = Math.sin(angle) * speed + state.paddle.velocity * 0.08;
      ball.vy = -Math.abs(Math.cos(angle) * speed);
      normalizeBall(ball, speed);
      state.combo = Math.max(1, state.combo);
    }

    for (const brick of state.bricks) {
      if (brick.alive && circleHitsRect(ball, brick)) {
        hitBrick(ball, brick, previousX, previousY);
        break;
      }
    }

    if (ball.y - ball.radius > HEIGHT) {
      if (state.effects.shieldCharges > 0) {
        state.effects.shieldCharges -= 1;
        ball.y = HEIGHT - ball.radius - 4;
        ball.vy = -Math.abs(ball.vy);
        showToast(`Shield absorbió la caída · ${state.effects.shieldCharges} cargas`, 1400);
        return true;
      }
      return false;
    }

    const targetSpeed = Math.min(650, MODES[state.modeId].speed + state.levelIndex * 13 + (state.modeId === "chaos" ? 25 * Math.sin(state.elapsed * 1.7) : 0));
    normalizeBall(ball, Math.max(280, targetSpeed));
    ball.trail.unshift({ x: ball.x, y: ball.y });
    ball.trail.length = Math.min(ball.trail.length, 10);
    return true;
  }

  function updatePowerUps(dt) {
    const paddleRect = { x: state.paddle.x - state.paddle.width / 2, y: HEIGHT - 53, width: state.paddle.width, height: 25 };
    state.powerUps = state.powerUps.filter((power) => {
      power.y += power.vy * dt;
      power.spin += dt * 3;
      if (power.x >= paddleRect.x && power.x <= paddleRect.x + paddleRect.width && power.y + power.radius >= paddleRect.y && power.y - power.radius <= paddleRect.y + paddleRect.height) {
        applyPowerUp(power.type);
        return false;
      }
      return power.y - power.radius < HEIGHT;
    });
  }

  function updateParticles(dt) {
    state.particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 150 * dt;
      particle.life -= dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function update(dt, now) {
    if (!state) return;
    state.elapsed += dt;
    state.bricks.forEach((brick) => { brick.hitFlash = Math.max(0, brick.hitFlash - dt); });
    updateParticles(dt);

    if (state.phase === "transition") {
      if (now >= state.transitionUntil) resetLevel();
      return;
    }
    if (!["playing", "ready"].includes(state.phase)) return;

    updatePaddle(dt, now);
    if (state.phase === "playing") {
      state.balls = state.balls.filter((ball) => updateBall(ball, dt, now));
      updatePowerUps(dt);
      if (!state.balls.length && state.phase === "playing") loseBalls();
    }
    if (state.combo > 1 && now > state.comboExpires) {
      state.combo = 1;
      updateDashboard();
    }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  function drawBackground(ctx) {
    const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.46, 30, WIDTH / 2, HEIGHT * 0.46, 570);
    gradient.addColorStop(0, "#102b43");
    gradient.addColorStop(0.5, "#071522");
    gradient.addColorStop(1, "#030a12");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "rgba(120, 157, 190, .08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.025)";
    ctx.font = "700 72px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(state.levelIndex + 1).padStart(2, "0"), WIDTH / 2, HEIGHT * 0.64);
  }

  function drawBricks(ctx) {
    const architectRow = state.modeId === "architect"
      ? Math.min(...state.bricks.filter((brick) => brick.alive).map((brick) => brick.row))
      : -1;
    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      const available = state.modeId !== "architect" || brick.row === architectRow;
      ctx.save();
      ctx.shadowColor = available ? hexToRgba(brick.color, 0.42) : "transparent";
      ctx.shadowBlur = available ? 12 : 0;
      roundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 6);
      const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
      gradient.addColorStop(0, hexToRgba(brick.color, brick.hitFlash ? 0.9 : available ? 0.66 : 0.24));
      gradient.addColorStop(1, hexToRgba(brick.color, available ? 0.26 : 0.1));
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(brick.color, available ? 0.72 : 0.22);
      ctx.lineWidth = brick.hitFlash ? 2.5 : 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (brick.width > 55) {
        ctx.fillStyle = available ? "rgba(247,251,255,.9)" : "rgba(166,184,201,.42)";
        ctx.font = `700 ${brick.width < 65 ? 7 : 8}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = brick.service.length > 12 ? brick.service.slice(0, 11) : brick.service;
        ctx.fillText(label.toUpperCase(), brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
      }
      if (brick.maxHp > 1 && brick.hp > 1) {
        ctx.fillStyle = "rgba(255,255,255,.65)";
        ctx.fillRect(brick.x + brick.width - 10, brick.y + 5, 4, 4);
      }
      ctx.restore();
    });
  }

  function drawGuide(ctx, ball) {
    if (performance.now() >= state.effects.guideUntil || ball.docked) return;
    let x = ball.x;
    let y = ball.y;
    let vx = ball.vx;
    let vy = ball.vy;
    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = "rgba(53, 204, 230, .48)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let index = 0; index < 55; index += 1) {
      x += vx * 0.012;
      y += vy * 0.012;
      if (x < BALL_RADIUS || x > WIDTH - BALL_RADIUS) vx *= -1;
      if (y < BALL_RADIUS) vy *= -1;
      ctx.lineTo(clamp(x, BALL_RADIUS, WIDTH - BALL_RADIUS), clamp(y, BALL_RADIUS, HEIGHT));
      if (y > HEIGHT || state.bricks.some((brick) => brick.alive && x >= brick.x && x <= brick.x + brick.width && y >= brick.y && y <= brick.y + brick.height)) break;
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls(ctx) {
    state.balls.forEach((ball) => {
      drawGuide(ctx, ball);
      ball.trail.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(1, ball.radius * (1 - index / 12)), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 169, 56, ${0.18 * (1 - index / 10)})`;
        ctx.fill();
      });
      ctx.save();
      ctx.shadowColor = "#ff9900";
      ctx.shadowBlur = 18;
      const gradient = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, ball.radius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.35, "#ffd28a");
      gradient.addColorStop(1, "#ff9900");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPaddle(ctx, now) {
    const paddle = state.paddle;
    const x = paddle.x - paddle.width / 2;
    const y = HEIGHT - 48;
    ctx.save();
    ctx.shadowColor = now < state.effects.wideUntil ? "#a78bfa" : "#ff9900";
    ctx.shadowBlur = 20;
    roundedRect(ctx, x, y, paddle.width, paddle.height, 8);
    const gradient = ctx.createLinearGradient(x, y, x, y + paddle.height);
    gradient.addColorStop(0, now < state.effects.wideUntil ? "#c4b5fd" : "#ffd18a");
    gradient.addColorStop(0.35, now < state.effects.wideUntil ? "#8b5cf6" : "#ff9900");
    gradient.addColorStop(1, now < state.effects.wideUntil ? "#5b21b6" : "#9b5200");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerUps(ctx) {
    state.powerUps.forEach((power) => {
      const definition = POWER_UPS[power.type];
      ctx.save();
      ctx.translate(power.x, power.y);
      ctx.rotate(Math.sin(power.spin) * 0.12);
      ctx.shadowColor = definition.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = hexToRgba(definition.color, 0.24);
      ctx.strokeStyle = definition.color;
      ctx.lineWidth = 2;
      roundedRect(ctx, -power.radius, -power.radius, power.radius * 2, power.radius * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f7fbff";
      ctx.font = "800 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(definition.short, 0, 1);
      ctx.restore();
    });
  }

  function drawParticles(ctx) {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = Math.min(1, particle.life * 2);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawEffects(ctx) {
    if (state.effects.shieldCharges > 0) {
      const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
      gradient.addColorStop(0, "rgba(57,217,138,0)");
      gradient.addColorStop(0.2, "rgba(57,217,138,.85)");
      gradient.addColorStop(0.8, "rgba(57,217,138,.85)");
      gradient.addColorStop(1, "rgba(57,217,138,0)");
      ctx.fillStyle = gradient;
      ctx.shadowColor = "#39d98a";
      ctx.shadowBlur = 14;
      ctx.fillRect(0, HEIGHT - 4, WIDTH, 3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(57,217,138,.8)";
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SHIELD ×${state.effects.shieldCharges}`, 18, HEIGHT - 12);
    }
    if (state.effects.rescueCharges > 0) {
      ctx.fillStyle = "rgba(216,90,216,.82)";
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`SQS RESCUE ×${state.effects.rescueCharges}`, WIDTH - 18, HEIGHT - 12);
    }
  }

  function render(now) {
    if (!context || !state) return;
    context.save();
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground(context);
    drawBricks(context);
    drawEffects(context);
    drawParticles(context);
    drawPowerUps(context);
    drawPaddle(context, now);
    drawBalls(context);
    context.restore();
  }

  function frame(now) {
    if (!host || !state) return;
    const delta = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000 || 0));
    lastFrame = now;
    if (!["paused", "menu", "won", "gameover"].includes(state.phase)) {
      accumulator = Math.min(accumulator + delta, FIXED_STEP * 8);
      while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP, now);
        accumulator -= FIXED_STEP;
      }
    }
    render(now);
    if (state.toastUntil && now > state.toastUntil) {
      state.toastUntil = 0;
      host.querySelector("#cb-toast")?.classList.remove("is-visible");
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      render(performance.now());
    }
  }

  function pointerToWorld(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
  }

  function handlePointerMove(event) {
    if (!state || !canvas || !["playing", "ready"].includes(state.phase)) return;
    if (event.pointerType === "touch") event.preventDefault();
    state.paddle.targetX = pointerToWorld(event).x;
  }

  function handleCanvasPointerDown(event) {
    if (!state || !["playing", "ready", "paused"].includes(state.phase)) return;
    if (event.pointerType === "touch") event.preventDefault();
    state.paddle.targetX = pointerToWorld(event).x;
    if (state.phase === "ready" || state.phase === "paused") launchBall();
  }

  function handleKeyDown(event) {
    if (!host || !state) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", " ", "p", "escape"].includes(key)) event.preventDefault();
    if (key === "arrowleft" || key === "a") keys.left = true;
    if (key === "arrowright" || key === "d") keys.right = true;
    if (key === " ") launchBall();
    if (key === "p" || key === "escape") togglePause();
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.left = false;
    if (key === "arrowright" || key === "d") keys.right = false;
  }

  function handleVisibility() {
    if (document.hidden && state?.phase === "playing") togglePause(true);
  }

  function handleClick(event) {
    const mode = event.target.closest("[data-cb-mode]")?.dataset.cbMode;
    if (mode) { startGame(mode); return; }
    const action = event.target.closest("[data-cb-action]")?.dataset.cbAction;
    if (!action) return;
    if (action === "pause") togglePause();
    if (action === "resume") togglePause(false);
    if (action === "launch") launchBall();
    if (action === "modes") showModes(true);
    if (action === "replay") startGame(state.modeId);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleMoveStart(event) {
    const move = event.target.closest("[data-cb-move]")?.dataset.cbMove;
    if (!move) return;
    event.preventDefault();
    keys[move] = true;
    event.target.setPointerCapture?.(event.pointerId);
  }

  function handleMoveEnd(event) {
    const move = event.target.closest("[data-cb-move]")?.dataset.cbMove;
    if (move) keys[move] = false;
    else { keys.left = false; keys.right = false; }
  }

  function mount(container, onExit) {
    destroy();
    if (!container) return;
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    host.innerHTML = markup();
    canvas = host.querySelector("#cb-canvas");
    context = canvas.getContext("2d");
    state = createState("classic");
    state.phase = "menu";

    host.addEventListener("click", handleClick);
    host.addEventListener("pointerdown", handleMoveStart);
    host.addEventListener("pointerup", handleMoveEnd);
    host.addEventListener("pointercancel", handleMoveEnd);
    canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    canvas.addEventListener("pointerdown", handleCanvasPointerDown, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", handleVisibility);

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);
    }
    resizeCanvas();
    updateDashboard();
    updateOverlay();
    lastFrame = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function destroy() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (canvas) {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
    }
    if (host) {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("pointerdown", handleMoveStart);
      host.removeEventListener("pointerup", handleMoveEnd);
      host.removeEventListener("pointercancel", handleMoveEnd);
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("resize", resizeCanvas);
    document.removeEventListener("visibilitychange", handleVisibility);
    keys.left = false;
    keys.right = false;
    if (styleOwned && styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
    styleNode = null;
    styleOwned = false;
    host = null;
    exitCallback = null;
    canvas = null;
    context = null;
    state = null;
    accumulator = 0;
    lastFrame = 0;
  }

  window.CloudBreaker = {
    mount,
    destroy,
    getStats: safeReadStats
  };
}());
