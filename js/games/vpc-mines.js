/* VPC Mines: a VPC-themed Minesweeper game. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:vpc-mines:stats";
  const MODES = {
    sandbox: { id: "sandbox", name: "Sandbox", rows: 9, cols: 9, threats: 10, scans: 3, tone: "green", icon: "◎", detail: "9 × 9 · 10 amenazas", description: "Una subred compacta para aprender las señales sin demasiada presión." },
    standard: { id: "standard", name: "Production", rows: 12, cols: 12, threats: 24, scans: 2, tone: "blue", icon: "⬡", detail: "12 × 12 · 24 amenazas", description: "Una VPC equilibrada con varias zonas y una densidad real de amenazas." },
    blackout: { id: "blackout", name: "Blackout", rows: 16, cols: 16, threats: 45, scans: 1, tone: "red", icon: "!", detail: "16 × 16 · 45 amenazas", description: "La red más extensa. Pocos escaneos y una superficie de ataque mayor." }
  };

  let host = null;
  let state = null;
  let timerId = null;
  let noticeTimer = null;
  let exitCallback = null;

  function readStats() {
    try {
      return { played: 0, wins: 0, bestScore: 0, bestTime: null, modeWins: {}, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch (_) {
      return { played: 0, wins: 0, bestScore: 0, bestTime: null, modeWins: {} };
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Storage is optional. */ }
  }

  function currentMode() {
    return MODES[state?.modeId] || MODES.standard;
  }

  function formatTime(seconds) {
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  }

  function elapsedSeconds() {
    if (!state?.startedAt) return 0;
    return Math.floor(((state.finishedAt || Date.now()) - state.startedAt) / 1000);
  }

  function startTimer() {
    if (state.startedAt || state.finishedAt) return;
    state.startedAt = Date.now();
    state.status = "playing";
    timerId = window.setInterval(() => {
      const element = host?.querySelector("#vpc-time");
      if (element) element.textContent = formatTime(elapsedSeconds());
    }, 1000);
  }

  function createState(modeId) {
    const mode = MODES[modeId] || MODES.standard;
    const cells = Array.from({ length: mode.rows * mode.cols }, (_, index) => ({
      index,
      row: Math.floor(index / mode.cols),
      col: index % mode.cols,
      isThreat: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
      detonated: false
    }));
    return {
      modeId: mode.id,
      cells,
      generated: false,
      status: "ready",
      tool: "reveal",
      score: 0,
      streak: 0,
      safeRevealed: 0,
      scansUsed: 0,
      startedAt: null,
      finishedAt: null
    };
  }

  function neighborIndices(index) {
    const mode = currentMode();
    const cell = state.cells[index];
    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (!rowOffset && !colOffset) continue;
        const row = cell.row + rowOffset;
        const col = cell.col + colOffset;
        if (row >= 0 && row < mode.rows && col >= 0 && col < mode.cols) result.push(row * mode.cols + col);
      }
    }
    return result;
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function generateThreats(firstIndex) {
    const excluded = new Set([firstIndex, ...neighborIndices(firstIndex)]);
    const candidates = state.cells.map((cell) => cell.index).filter((index) => !excluded.has(index));
    shuffle(candidates).slice(0, currentMode().threats).forEach((index) => { state.cells[index].isThreat = true; });
    state.cells.forEach((cell) => {
      cell.adjacent = neighborIndices(cell.index).filter((index) => state.cells[index].isThreat).length;
    });
    state.generated = true;
  }

  function revealSafeArea(startIndex) {
    const queue = [startIndex];
    const queued = new Set(queue);
    let revealed = 0;

    while (queue.length) {
      const index = queue.shift();
      const cell = state.cells[index];
      if (cell.revealed || cell.flagged || cell.isThreat) continue;
      cell.revealed = true;
      revealed += 1;
      if (cell.adjacent === 0) {
        neighborIndices(index).forEach((neighbor) => {
          const nearby = state.cells[neighbor];
          if (!nearby.revealed && !nearby.flagged && !nearby.isThreat && !queued.has(neighbor)) {
            queued.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
    state.safeRevealed += revealed;
    return revealed;
  }

  function revealCell(index, forceReveal) {
    if (["won", "lost", "choosing"].includes(state.status)) return;
    const cell = state.cells[index];
    if (!cell) return;
    if (state.tool === "flag" && !forceReveal) {
      toggleFlag(index);
      return;
    }
    if (cell.flagged) return;

    if (!state.generated) {
      generateThreats(index);
      startTimer();
    }

    if (cell.revealed) {
      chordCell(index);
      return;
    }

    if (cell.isThreat) {
      triggerBreach(index);
      return;
    }

    state.streak += 1;
    const revealed = revealSafeArea(index);
    state.score += revealed * 10 + Math.min(state.streak * 5, 100);
    render();
    evaluateWin();
  }

  function chordCell(index) {
    const cell = state.cells[index];
    if (!cell.revealed || !cell.adjacent) return;
    const neighbors = neighborIndices(index);
    const flags = neighbors.filter((neighbor) => state.cells[neighbor].flagged).length;
    if (flags !== cell.adjacent) return;

    let revealed = 0;
    for (const neighbor of neighbors) {
      const nearby = state.cells[neighbor];
      if (nearby.flagged || nearby.revealed) continue;
      if (nearby.isThreat) {
        triggerBreach(neighbor);
        return;
      }
      revealed += revealSafeArea(neighbor);
    }
    if (revealed) {
      state.streak += 1;
      state.score += revealed * 10 + Math.min(state.streak * 5, 100);
      render();
      evaluateWin();
    }
  }

  function toggleFlag(index) {
    if (["won", "lost", "choosing"].includes(state.status)) return;
    const cell = state.cells[index];
    if (!cell || cell.revealed) return;
    const placedFlags = state.cells.filter((entry) => entry.flagged).length;
    if (!cell.flagged && placedFlags >= currentMode().threats) {
      showNotice("Sin security groups", "Ya utilizaste todas las marcas disponibles para esta VPC.");
      return;
    }
    cell.flagged = !cell.flagged;
    state.streak = 0;
    render();
  }

  function securityScan() {
    if (["won", "lost", "choosing"].includes(state.status)) return;
    const mode = currentMode();
    if (state.scansUsed >= mode.scans) return;

    if (!state.generated) {
      const center = Math.floor(mode.rows / 2) * mode.cols + Math.floor(mode.cols / 2);
      generateThreats(center);
      startTimer();
    }

    const safeCells = state.cells.filter((cell) => !cell.isThreat && !cell.revealed && !cell.flagged);
    if (!safeCells.length) return;
    const target = safeCells[Math.floor(Math.random() * safeCells.length)];
    state.scansUsed += 1;
    const revealed = revealSafeArea(target.index);
    state.score = Math.max(0, state.score + revealed * 10 - 100);
    state.streak = 0;
    state.scanHighlight = target.index;
    render();
    showNotice("Security scan completado", `El nodo ${target.row + 1}.${target.col + 1} no contiene amenazas.`);
    window.setTimeout(() => {
      if (!state) return;
      state.scanHighlight = null;
      render();
    }, 1500);
    evaluateWin();
  }

  function triggerBreach(index) {
    state.cells[index].detonated = true;
    state.cells.filter((cell) => cell.isThreat).forEach((cell) => { cell.revealed = true; });
    state.status = "lost";
    state.finishedAt = Date.now();
    state.streak = 0;
    window.clearInterval(timerId);
    render();
    showEndOverlay("lost");
  }

  function evaluateWin() {
    const totalSafe = state.cells.length - currentMode().threats;
    if (state.safeRevealed !== totalSafe) return;
    state.status = "won";
    state.finishedAt = Date.now();
    state.cells.filter((cell) => cell.isThreat).forEach((cell) => { cell.flagged = true; });
    const timeBonus = Math.max(0, 1500 - elapsedSeconds() * 4);
    state.score += timeBonus;
    window.clearInterval(timerId);

    const stats = readStats();
    stats.wins += 1;
    stats.modeWins = stats.modeWins || {};
    stats.modeWins[state.modeId] = (stats.modeWins[state.modeId] || 0) + 1;
    stats.bestScore = Math.max(stats.bestScore || 0, state.score);
    stats.bestTime = stats.bestTime === null ? elapsedSeconds() : Math.min(stats.bestTime, elapsedSeconds());
    saveStats(stats);
    render();
    showEndOverlay("won");
  }

  function showEndOverlay(result) {
    const won = result === "won";
    const overlay = host.querySelector("#vpc-overlay");
    overlay.className = "vpc-overlay";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="vpc-result-card ${won ? "is-win" : "is-breach"}">
        <span class="vpc-result-icon">${won ? "✓" : "!"}</span>
        <span class="eyebrow">${won ? "VPC SECURED" : "SECURITY BREACH"}</span>
        <h2>${won ? "Red asegurada" : "Amenaza detectada"}</h2>
        <p>${won ? `Limpiaste ${currentMode().name} en ${formatTime(elapsedSeconds())} sin dejar nodos expuestos.` : "Un paquete malicioso atravesó la subred. Revisa las señales e inténtalo otra vez."}</p>
        <strong>${state.score.toLocaleString("es-ES")} puntos</strong>
        <div><button type="button" class="primary-button" data-vpc-action="restart">Reintentar <span>→</span></button><button type="button" class="secondary-button" data-vpc-action="modes">Elegir modo</button><button type="button" class="vpc-text-button" data-vpc-action="exit">Volver al centro</button></div>
      </div>`;
  }

  function showModeSelection() {
    state.status = "choosing";
    updateDashboard();
    const overlay = host.querySelector("#vpc-overlay");
    overlay.className = "vpc-overlay is-mode-picker";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="mode-picker vpc-mode-picker">
        <div class="mode-picker-heading"><span class="eyebrow">NETWORK CONFIGURATION</span><h2>Selecciona una VPC</h2><p>Cada entorno cambia el tamaño de red, la densidad de amenazas y los security scans.</p></div>
        <div class="mode-grid vpc-mode-grid">
          ${Object.values(MODES).map((mode) => `
            <button type="button" class="mode-card mode-${mode.tone}" data-vpc-mode="${mode.id}">
              <span class="mode-card-icon">${mode.icon}</span>
              <span class="mode-card-copy"><span>${mode.name}</span><small>${mode.description}</small></span>
              <strong>${mode.detail} · ${mode.scans} scans</strong><i>→</i>
            </button>`).join("")}
        </div>
        <button type="button" class="mode-picker-exit" data-vpc-action="exit">← Volver al centro de juegos</button>
      </div>`;
  }

  function hideOverlay() {
    const overlay = host.querySelector("#vpc-overlay");
    overlay.className = "vpc-overlay";
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  function showNotice(title, copy) {
    const notice = host.querySelector("#vpc-notice");
    window.clearTimeout(noticeTimer);
    notice.innerHTML = `<span>⌁</span><div><strong>${title}</strong><small>${copy}</small></div>`;
    notice.classList.add("is-visible");
    noticeTimer = window.setTimeout(() => notice.classList.remove("is-visible"), 3200);
  }

  function cellContent(cell) {
    if (cell.flagged && !(state.status === "lost" && !cell.isThreat)) return '<span class="vpc-flag">⚑</span>';
    if (state.status === "lost" && cell.flagged && !cell.isThreat) return '<span class="vpc-wrong">×</span>';
    if (cell.revealed && cell.isThreat) return '<span class="vpc-threat">!</span>';
    if (cell.revealed && cell.adjacent) return `<span class="vpc-number">${cell.adjacent}</span>`;
    if (cell.revealed) return '<span class="vpc-safe-node"></span>';
    return '<span class="vpc-hidden-node"></span>';
  }

  function render() {
    if (!host || !state) return;
    const mode = currentMode();
    const grid = host.querySelector("#vpc-grid");
    grid.style.setProperty("--vpc-cols", mode.cols);
    grid.style.setProperty("--vpc-rows", mode.rows);
    grid.className = `vpc-grid size-${mode.id}`;
    grid.innerHTML = state.cells.map((cell) => {
      const classes = [
        "vpc-cell",
        cell.revealed ? "is-revealed" : "is-hidden",
        cell.flagged ? "is-flagged" : "",
        cell.isThreat && cell.revealed ? "is-threat" : "",
        cell.detonated ? "is-detonated" : "",
        state.scanHighlight === cell.index ? "is-scanned" : "",
        cell.revealed && cell.adjacent ? `number-${cell.adjacent}` : ""
      ].filter(Boolean).join(" ");
      const label = cell.flagged ? "Nodo marcado" : cell.revealed ? (cell.isThreat ? "Amenaza" : `${cell.adjacent} amenazas cercanas`) : "Nodo sin analizar";
      return `<button type="button" class="${classes}" data-vpc-cell="${cell.index}" aria-label="Fila ${cell.row + 1}, columna ${cell.col + 1}: ${label}">${cellContent(cell)}</button>`;
    }).join("");
    updateDashboard();
  }

  function updateDashboard() {
    if (!host || !state) return;
    const mode = currentMode();
    const flags = state.cells.filter((cell) => cell.flagged).length;
    const totalSafe = state.cells.length - mode.threats;
    const coverage = Math.round((state.safeRevealed / totalSafe) * 100);
    host.querySelector("#vpc-time").textContent = formatTime(elapsedSeconds());
    host.querySelector("#vpc-score").textContent = state.score.toLocaleString("es-ES");
    host.querySelector("#vpc-threats-left").textContent = Math.max(0, mode.threats - flags).toString().padStart(2, "0");
    host.querySelector("#vpc-coverage").textContent = `${coverage}%`;
    host.querySelector("#vpc-coverage-bar").style.width = `${coverage}%`;
    host.querySelector("#vpc-mode-name").textContent = mode.name;
    host.querySelector("#vpc-grid-size").textContent = `${mode.rows} × ${mode.cols}`;
    host.querySelector("#vpc-scan-label").textContent = `Scan · ${Math.max(0, mode.scans - state.scansUsed)}`;
    host.querySelectorAll("[data-vpc-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.vpcTool === state.tool));
    const scanButton = host.querySelector('[data-vpc-action="scan"]');
    if (scanButton) scanButton.disabled = state.scansUsed >= mode.scans || ["won", "lost", "choosing"].includes(state.status);
  }

  function startGame(modeId) {
    window.clearInterval(timerId);
    state = createState(modeId);
    const stats = readStats();
    stats.played += 1;
    saveStats(stats);
    hideOverlay();
    render();
  }

  function chooseModes() {
    if (state?.status === "playing" && !window.confirm("¿Quieres abandonar esta VPC y elegir otro entorno?")) return;
    window.clearInterval(timerId);
    showModeSelection();
  }

  function initialMarkup() {
    return `
      <section class="vpc-shell" aria-label="VPC Mines">
        <header class="vpc-header">
          <div class="vpc-title"><span class="vpc-title-icon">⬡</span><div><span>NETWORK DEFENSE / MINESWEEPER</span><h1>VPC Mines <b id="vpc-mode-name">Production</b></h1></div></div>
          <div class="vpc-controls">
            <div class="vpc-tool-switch" aria-label="Herramienta activa"><button type="button" data-vpc-tool="reveal" class="is-active">◎ Revelar</button><button type="button" data-vpc-tool="flag">⚑ Marcar</button></div>
            <button type="button" data-vpc-action="scan"><span>⌁</span> <span id="vpc-scan-label">Scan · 2</span></button>
            <button type="button" data-vpc-action="modes" class="vpc-modes-button"><span>▦</span> Entornos</button>
          </div>
        </header>
        <div class="vpc-dashboard">
          <div><span>TIEMPO</span><strong id="vpc-time">00:00</strong></div>
          <div><span>AMENAZAS</span><strong id="vpc-threats-left">24</strong></div>
          <div class="vpc-coverage-stat"><span>NETWORK COVERAGE · <b id="vpc-grid-size">12 × 12</b></span><div><i id="vpc-coverage-bar"></i></div></div>
          <div><span>COBERTURA</span><strong id="vpc-coverage">0%</strong></div>
          <div><span>PUNTUACIÓN</span><strong id="vpc-score">0</strong></div>
        </div>
        <div class="vpc-board">
          <div class="vpc-grid-lines"></div>
          <div class="vpc-board-heading"><span><i></i> VPC-0CA / PRIVATE NETWORK</span><span>SECURITY GROUP MONITORING: ACTIVE</span></div>
          <div class="vpc-grid-wrap"><div id="vpc-grid" class="vpc-grid" role="grid" aria-label="Red de nodos VPC"></div></div>
          <div id="vpc-overlay" class="vpc-overlay" hidden></div>
        </div>
        <div class="vpc-helpbar">
          <div><span class="vpc-legend-safe"><i></i>Nodo seguro</span><span class="vpc-legend-flag"><i>⚑</i>Amenaza marcada</span><span class="vpc-legend-risk"><i>3</i>Amenazas adyacentes</span></div>
          <p><strong>Objetivo:</strong> revela todos los nodos seguros. Usa clic derecho para marcar o cambia la herramienta en pantallas táctiles.</p>
        </div>
        <div id="vpc-notice" class="vpc-notice" role="status" aria-live="polite"></div>
      </section>`;
  }

  function handleClick(event) {
    const mode = event.target.closest("[data-vpc-mode]");
    if (mode) { startGame(mode.dataset.vpcMode); return; }
    const cell = event.target.closest("[data-vpc-cell]");
    if (cell) { revealCell(Number(cell.dataset.vpcCell), false); return; }
    const tool = event.target.closest("[data-vpc-tool]");
    if (tool) { state.tool = tool.dataset.vpcTool; updateDashboard(); return; }
    const action = event.target.closest("[data-vpc-action]")?.dataset.vpcAction;
    if (action === "scan") securityScan();
    if (action === "modes") chooseModes();
    if (action === "restart") startGame(state.modeId);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleContextMenu(event) {
    const cell = event.target.closest("[data-vpc-cell]");
    if (!cell) return;
    event.preventDefault();
    toggleFlag(Number(cell.dataset.vpcCell));
  }

  function mount(container, onExit) {
    destroy();
    host = container;
    exitCallback = onExit;
    host.innerHTML = initialMarkup();
    host.addEventListener("click", handleClick);
    host.addEventListener("contextmenu", handleContextMenu);
    state = createState("standard");
    render();
    showModeSelection();
  }

  function destroy() {
    window.clearInterval(timerId);
    window.clearTimeout(noticeTimer);
    if (host) {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("contextmenu", handleContextMenu);
    }
    host = null;
    state = null;
    exitCallback = null;
  }

  window.VpcMines = {
    mount,
    destroy,
    getStats: readStats,
    getModes: () => Object.values(MODES).map((mode) => ({ ...mode }))
  };
}());
