(function () {
  "use strict";

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const STYLE_ID = "cloud-defense-styles";
  const STORAGE_KEY = "cloud-arcade:cloud-defense:stats";
  const WIDTH = 1200;
  const HEIGHT = 650;
  const PATH = [
    { x: -30, y: 118 }, { x: 170, y: 118 }, { x: 170, y: 280 },
    { x: 430, y: 280 }, { x: 430, y: 96 }, { x: 690, y: 96 },
    { x: 690, y: 430 }, { x: 940, y: 430 }, { x: 940, y: 240 },
    { x: 1235, y: 240 }
  ];
  const SLOTS = [
    [92, 218], [265, 198], [332, 365], [510, 190], [575, 365],
    [780, 330], [805, 525], [1018, 350], [1065, 145], [355, 105],
    [610, 520], [860, 170]
  ].map((point, index) => ({ id: index, x: point[0], y: point[1] }));

  const SERVICES = {
    cloudfront: {
      name: "CloudFront", short: "CF", color: "#34d6ff", cost: 120, range: 132, rate: 0.62, damage: 15,
      pitch: "Acelera tráfico legítimo y frena bots en el edge.", icon: "edge"
    },
    waf: {
      name: "WAF", short: "WF", color: "#ff9f43", cost: 145, range: 118, rate: 0.48, damage: 24,
      pitch: "Reglas precisas contra SQLi y credential stuffing.", icon: "filter"
    },
    shield: {
      name: "Shield", short: "SH", color: "#67e8a5", cost: 180, range: 108, rate: 1.15, damage: 22,
      pitch: "Mitigación de área, especialmente fuerte contra DDoS.", icon: "shield"
    },
    lambda: {
      name: "Lambda", short: "λ", color: "#c49aff", cost: 170, range: 128, rate: 0.82, damage: 18,
      pitch: "Respuesta adaptable que encadena hasta tres amenazas.", icon: "bolt"
    },
    sqs: {
      name: "SQS", short: "Q", color: "#ef8ee8", cost: 135, range: 124, rate: 1.0, damage: 9,
      pitch: "Amortigua retry storms, ralentiza y devuelve paquetes.", icon: "queue"
    },
    cloudwatch: {
      name: "CloudWatch", short: "CW", color: "#f7d154", cost: 110, range: 155, rate: 1.7, damage: 0,
      pitch: "Revela tráfico sigiloso y amplifica el daño cercano.", icon: "pulse"
    },
    autoscaling: {
      name: "Auto Scaling", short: "AS", color: "#8aa8ff", cost: 210, range: 122, rate: 0.27, damage: 11,
      pitch: "Réplicas de alta cadencia para picos de cualquier tipo.", icon: "scale"
    }
  };

  const ENEMY_TYPES = {
    good: { name: "Request", color: "#44d9c5", hp: 1, speed: 76, reward: 18, malicious: false, radius: 10 },
    bot: { name: "Bot", color: "#ffb24a", hp: 54, speed: 58, reward: 14, damage: 8, malicious: true, radius: 11 },
    ddos: { name: "DDoS", color: "#ff596d", hp: 145, speed: 39, reward: 28, damage: 18, malicious: true, radius: 16, armor: 0.12 },
    sqli: { name: "SQLi", color: "#bd8cff", hp: 78, speed: 50, reward: 22, damage: 13, malicious: true, radius: 12, stealth: true },
    retry: { name: "Retry storm", color: "#ff80c8", hp: 96, speed: 68, reward: 24, damage: 11, malicious: true, radius: 13 },
    credential: { name: "Credential", color: "#ffc857", hp: 88, speed: 61, reward: 25, damage: 15, malicious: true, radius: 12, stealth: true }
  };

  const SCENARIOS = {
    static: {
      name: "01 · Static Launch", label: "Fundamentos", icon: "◇", waves: 6, budget: 620, health: 100, target: 92,
      threats: ["bot", "ddos"], description: "Protege un sitio global. Aprende a separar usuarios de bots y floods.",
      hint: "CloudFront reduce latencia. Shield controla grupos densos."
    },
    api: {
      name: "02 · API Rush", label: "Serverless", icon: "λ", waves: 8, budget: 690, health: 100, target: 94,
      threats: ["bot", "sqli", "retry"], description: "Una API pública recibe inyecciones y reintentos durante el lanzamiento.",
      hint: "WAF filtra SQLi. SQS desacelera retry storms."
    },
    identity: {
      name: "03 · Identity Siege", label: "Seguridad", icon: "⬡", waves: 9, budget: 720, health: 95, target: 95,
      threats: ["bot", "credential", "sqli"], description: "Defiende el login sin rechazar a clientes legítimos.",
      hint: "CloudWatch revela atacantes sigilosos; WAF termina el trabajo."
    },
    commerce: {
      name: "04 · Prime Traffic", label: "Escala", icon: "▥", waves: 10, budget: 780, health: 105, target: 96,
      threats: ["ddos", "retry", "credential", "bot"], description: "Mantén un checkout rápido bajo una oleada de tráfico mixto.",
      hint: "Combina edge, colas y capacidad de Auto Scaling."
    },
    resilience: {
      name: "05 · Resilience Exam", label: "Experto", icon: "✦", waves: 12, budget: 820, health: 110, target: 97,
      threats: ["bot", "ddos", "sqli", "retry", "credential"], description: "Todas las amenazas, menos margen y presión sostenida.",
      hint: "Las capas complementarias superan a una torre muy mejorada."
    },
    endless: {
      name: "Endless Operations", label: "Sin límite", icon: "∞", waves: Infinity, budget: 700, health: 100, target: 94,
      threats: ["bot", "ddos", "sqli", "retry", "credential"], description: "Oleadas progresivas sin final. Persigue tu récord operativo.",
      hint: "Cada quinta oleada introduce un pico de capacidad."
    },
    architect: {
      name: "Architect Sandbox", label: "Sandbox", icon: "⌘", waves: Infinity, budget: 99999, health: 999, target: 0,
      threats: ["bot", "ddos", "sqli", "retry", "credential"], description: "Construcción libre, servicios sin coste y sin condición de derrota.",
      hint: "Prueba combinaciones y vende sin penalización."
    }
  };

  let host = null;
  let canvas = null;
  let ctx = null;
  let state = null;
  let rafId = 0;
  let lastFrame = 0;
  let resizeObserver = null;
  let styleNode = null;
  let styleOwned = false;
  let exitCallback = null;
  let uid = 0;

  const pathData = buildPathData(PATH);

  function buildPathData(points) {
    const segments = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a, b, start: total, length });
      total += length;
    }
    return { segments, total };
  }

  function pointOnPath(distance) {
    const value = Math.max(0, Math.min(pathData.total, distance));
    const segment = pathData.segments.find((item) => value <= item.start + item.length) || pathData.segments[pathData.segments.length - 1];
    const ratio = segment.length ? (value - segment.start) / segment.length : 0;
    return {
      x: segment.a.x + (segment.b.x - segment.a.x) * ratio,
      y: segment.a.y + (segment.b.y - segment.a.y) * ratio,
      angle: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x)
    };
  }

  function defaultStats() {
    return { played: 0, wins: 0, bestScore: 0, highestWave: 0, threatsBlocked: 0, goodDelivered: 0, completed: {} };
  }

  function safeReadStats() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const base = defaultStats();
      if (!value || typeof value !== "object") return base;
      return {
        ...base, ...value,
        played: Number(value.played) || 0,
        wins: Number(value.wins) || 0,
        bestScore: Number(value.bestScore) || 0,
        highestWave: Number(value.highestWave) || 0,
        threatsBlocked: Number(value.threatsBlocked) || 0,
        goodDelivered: Number(value.goodDelivered) || 0,
        completed: value.completed && typeof value.completed === "object" ? value.completed : {}
      };
    } catch (_) { return defaultStats(); }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Persistence is optional. */ }
  }

  function ensureStyles() {
    styleNode = document.getElementById(STYLE_ID) || document.querySelector("link[data-cloud-defense-style]");
    styleOwned = false;
    if (!styleNode) {
      styleNode = document.createElement("link");
      styleNode.id = STYLE_ID;
      styleNode.rel = "stylesheet";
      styleNode.dataset.cloudDefenseStyle = "";
      styleNode.href = SCRIPT_URL ? new URL("../../css/cloud-defense.css", SCRIPT_URL).href : "css/cloud-defense.css";
      document.head.appendChild(styleNode);
      styleOwned = true;
    }
  }

  function iconSvg(type) {
    const paths = {
      edge: '<path d="M5 8h14M5 12h14M8 4 4 8l4 4M16 12l4 4-4 4"/>',
      filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/><path d="m15 5 3 3"/>',
      shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6Z"/><path d="m8 12 2.5 2.5L16 9"/>',
      bolt: '<path d="m13 2-7 11h5l-1 9 8-12h-5Z"/>',
      queue: '<rect x="4" y="5" width="16" height="4" rx="2"/><rect x="4" y="11" width="12" height="4" rx="2"/><rect x="4" y="17" width="8" height="4" rx="2"/>',
      pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/><circle cx="12" cy="12" r="9"/>',
      scale: '<path d="M12 4v16M4 12h16M12 4l-3 3M12 4l3 3M20 12l-3-3M20 12l-3 3M12 20l-3-3M12 20l3-3M4 12l3-3M4 12l3 3"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.edge}</svg>`;
  }

  function markup() {
    return `
      <section class="cloud-defense-shell" aria-label="Cloud Defense">
        <header class="cd-header">
          <div class="cd-brand"><span class="cd-brand-icon">${iconSvg("shield")}</span><div><small>RELIABILITY TOWER DEFENSE</small><h1>Cloud Defense <b id="cd-mode-badge">Campaign</b></h1></div></div>
          <div class="cd-toolbar">
            <button type="button" data-cd-action="pause" aria-label="Pausar"><span>Ⅱ</span><b id="cd-pause-label">Pausa</b></button>
            <button type="button" data-cd-action="help"><span>?</span><b>Guía</b></button>
            <button type="button" data-cd-action="scenarios"><span>▦</span><b>Escenarios</b></button>
          </div>
        </header>
        <div class="cd-metrics" aria-label="Estado del endpoint">
          <div><span>ENDPOINT</span><strong id="cd-health">100%</strong><i class="cd-meter"><b id="cd-health-bar"></b></i></div>
          <div><span>SLO</span><strong id="cd-slo">100.0%</strong><small id="cd-slo-target">objetivo 92%</small></div>
          <div><span>PRESUPUESTO</span><strong id="cd-budget">$0</strong><small id="cd-income">+$0 ingresos</small></div>
          <div><span>SCORE</span><strong id="cd-score">0</strong><small id="cd-blocked">0 bloqueadas</small></div>
          <div><span>LATENCIA P95</span><strong id="cd-latency">—</strong><small id="cd-load">carga estable</small></div>
          <div><span>OLEADA</span><strong id="cd-wave">0 / 0</strong><small id="cd-wave-state">preparando</small></div>
        </div>
        <div class="cd-layout">
          <aside class="cd-services" aria-label="Catálogo de servicios">
            <div class="cd-panel-heading"><span>BUILD PALETTE</span><strong>Servicios</strong><small>Elige y toca un slot</small></div>
            <div class="cd-service-list">
              ${Object.entries(SERVICES).map(([id, service], index) => `
                <button type="button" class="cd-service" data-cd-service="${id}" style="--service:${service.color}">
                  <span class="cd-service-icon">${iconSvg(service.icon)}</span>
                  <span><strong>${service.name}</strong><small>${service.pitch}</small></span>
                  <b><kbd>${index + 1}</kbd><em data-cd-cost="${id}">$${service.cost}</em></b>
                </button>`).join("")}
            </div>
          </aside>
          <main class="cd-stage-wrap">
            <div class="cd-stage" id="cd-stage">
              <canvas id="cd-canvas" aria-label="Mapa de defensa. Selecciona servicios y slots de construcción."></canvas>
              <div class="cd-stage-status"><span><i></i> EDGE → ENDPOINT</span><b id="cd-speed-label">LIVE</b></div>
              <div class="cd-toast" id="cd-toast" role="status" aria-live="polite"></div>
              <div class="cd-overlay" id="cd-overlay"></div>
            </div>
            <div class="cd-wavebar">
              <div><span id="cd-next-summary">Selecciona un escenario</span><small id="cd-next-detail">Las solicitudes legítimas deben llegar al endpoint.</small></div>
              <button type="button" data-cd-action="wave" id="cd-wave-button"><span>▶</span><b>Iniciar oleada</b><small>SPACE</small></button>
            </div>
          </main>
          <aside class="cd-inspector" aria-label="Inspector">
            <div class="cd-panel-heading"><span>INSPECTOR</span><strong id="cd-inspector-title">Arquitectura</strong><small id="cd-inspector-kicker">Selecciona una torre</small></div>
            <div id="cd-inspector-body" class="cd-inspector-body"></div>
          </aside>
        </div>
        <footer class="cd-helpbar">
          <p><span class="cd-good-dot"></span><strong>Legítimo:</strong> déjalo pasar para cobrar y cumplir el SLO.</p>
          <p><span class="cd-bad-dot"></span><strong>Amenaza:</strong> bloquéala antes del endpoint.</p>
          <p><kbd>1–7</kbd> servicio <kbd>U</kbd> mejora <kbd>X</kbd> vende <kbd>P</kbd> pausa</p>
        </footer>
      </section>`;
  }

  function menuMarkup() {
    const stats = safeReadStats();
    return `<div class="cd-menu">
      <div class="cd-menu-heading"><span>CHOOSE AN INCIDENT</span><h2>Defiende la experiencia, no solo el perímetro</h2><p>Las torres solo bloquean amenazas. El tráfico legítimo debe cruzar la ruta con baja latencia.</p></div>
      <div class="cd-scenario-grid">
        ${Object.entries(SCENARIOS).map(([id, scenario]) => {
          const done = stats.completed[id];
          return `<button type="button" class="cd-scenario-card ${id === "endless" || id === "architect" ? "is-special" : ""}" data-cd-scenario="${id}">
            <span class="cd-scenario-icon">${scenario.icon}</span><span class="cd-scenario-copy"><small>${scenario.label}</small><strong>${scenario.name}</strong><p>${scenario.description}</p></span>
            <span class="cd-scenario-meta"><b>${scenario.waves === Infinity ? "∞" : scenario.waves} waves</b><em>${done ? `✓ ${done}★` : "Deploy →"}</em></span>
          </button>`;
        }).join("")}
      </div>
      <div class="cd-menu-footer"><span>Récord: <b>${format(stats.bestScore)}</b></span><span>Mejor oleada: <b>${stats.highestWave}</b></span><button type="button" data-cd-action="exit">← Volver al centro</button></div>
    </div>`;
  }

  function helpMarkup() {
    return `<div class="cd-dialog">
      <span class="cd-dialog-icon">${iconSvg("pulse")}</span><small>RUNBOOK RÁPIDO</small><h2>Observa, filtra y escala</h2>
      <div class="cd-guide-grid">
        <p><b>1 · Construye</b> Elige un servicio y después un slot circular. El rango aparece antes de desplegar.</p>
        <p><b>2 · Protege</b> Las figuras cálidas son amenazas. Las solicitudes turquesa son clientes y nunca reciben disparos.</p>
        <p><b>3 · Opera</b> Bloquear genera recompensa; servir clientes genera ingresos. Mejora o vende la torre seleccionada.</p>
        <p><b>4 · Cumple</b> Las fugas dañan el endpoint, suben la latencia y pueden causar errores que bajan el SLO.</p>
      </div>
      <button class="cd-primary" type="button" data-cd-action="close">Entendido</button>
    </div>`;
  }

  function finishMarkup(won) {
    const endless = state.scenarioId === "endless";
    const title = won ? "SLO cumplido" : endless ? "Operación finalizada" : "Endpoint degradado";
    const text = won
      ? `Completaste ${state.wave} oleadas con ${getSlo().toFixed(1)}% de solicitudes exitosas.`
      : `La operación terminó en la oleada ${state.wave}. Revisa cobertura y especialización.`;
    return `<div class="cd-dialog cd-finish ${won ? "is-win" : "is-loss"}">
      <span class="cd-dialog-icon">${won ? "✓" : "!"}</span><small>${won ? "DEPLOY SUCCEEDED" : "INCIDENT DECLARED"}</small><h2>${title}</h2><p>${text}</p>
      <div class="cd-result"><span><small>SCORE</small><b>${format(state.score)}</b></span><span><small>SLO</small><b>${getSlo().toFixed(1)}%</b></span><span><small>BLOQUEADAS</small><b>${state.blocked}</b></span></div>
      <div class="cd-dialog-actions"><button class="cd-primary" type="button" data-cd-action="replay">Reintentar</button><button type="button" data-cd-action="scenarios">Escenarios</button></div>
      <button class="cd-text-button" type="button" data-cd-action="exit">Volver al centro</button>
    </div>`;
  }

  function createState(scenarioId) {
    const scenario = SCENARIOS[scenarioId];
    return {
      scenarioId, scenario, phase: "between", pausedFrom: null,
      health: scenario.health, maxHealth: scenario.health, budget: scenario.budget, income: 0, score: 0,
      wave: 0, enemies: [], towers: [], projectiles: [], effects: [], spawnQueue: [], spawnClock: 0,
      selectedService: null, selectedTower: null, hoverSlot: null, blocked: 0, leaked: 0,
      goodArrived: 0, goodSuccess: 0, latencySamples: [], endpointLoad: 0, lastWaveEnded: 0,
      message: "", toastUntil: 0, architect: scenarioId === "architect", finished: false
    };
  }

  function startScenario(id) {
    if (!SCENARIOS[id]) return;
    state = createState(id);
    const stats = safeReadStats();
    stats.played += 1;
    saveStats(stats);
    hideOverlay();
    updateServiceCosts();
    updateInspector();
    updateHud();
    toast(`${state.scenario.name}: ${state.scenario.hint}`);
  }

  function showMenu() {
    if (!state) state = createState("static");
    state.phase = "menu";
    const overlay = host.querySelector("#cd-overlay");
    overlay.hidden = false;
    overlay.className = "cd-overlay is-menu";
    overlay.innerHTML = menuMarkup();
    updateHud();
  }

  function showHelp() {
    if (!state || state.phase === "menu" || state.finished) return;
    state.pausedFrom = state.phase;
    state.phase = "help";
    const overlay = host.querySelector("#cd-overlay");
    overlay.hidden = false;
    overlay.className = "cd-overlay";
    overlay.innerHTML = helpMarkup();
    updateHud();
  }

  function closeHelp() {
    if (state?.phase !== "help") return;
    state.phase = state.pausedFrom || "between";
    state.pausedFrom = null;
    hideOverlay();
    updateHud();
  }

  function hideOverlay() {
    const overlay = host?.querySelector("#cd-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  function generateWave(number) {
    const threats = state.scenario.threats;
    const queue = [];
    const goodCount = 6 + Math.ceil(number * 1.25);
    const badCount = 4 + Math.ceil(number * 1.55) + (number % 5 === 0 ? 5 : 0);
    let t = 0;
    for (let i = 0; i < Math.max(goodCount, badCount); i += 1) {
      if (i < goodCount) {
        queue.push({ at: t + (i % 3) * 0.12, type: "good" });
        t += 0.22;
      }
      if (i < badCount) {
        const type = threats[(i + number + Math.floor(i / 3)) % threats.length];
        queue.push({ at: t + 0.08, type });
        t += 0.31;
      }
    }
    if (number % 4 === 0 && threats.includes("ddos")) {
      for (let i = 0; i < 4; i += 1) queue.push({ at: t + i * 0.13, type: "ddos" });
    }
    return queue.sort((a, b) => a.at - b.at);
  }

  function startWave() {
    if (!state || state.finished || !["between", "ready"].includes(state.phase)) return;
    if (state.wave >= state.scenario.waves) return;
    state.wave += 1;
    state.phase = "wave";
    state.spawnQueue = generateWave(state.wave);
    state.spawnClock = 0;
    state.lastWaveEnded = 0;
    toast(`Oleada ${state.wave}: tráfico mixto en camino`);
    updateHud();
  }

  function spawnEnemy(typeId) {
    const type = ENEMY_TYPES[typeId];
    const scale = 1 + Math.max(0, state.wave - 1) * (type.malicious ? 0.105 : 0.012);
    state.enemies.push({
      id: ++uid, typeId, ...type, hp: type.hp * scale, maxHp: type.hp * scale,
      distance: 0, age: 0, slowUntil: 0, markedUntil: 0, hitFlash: 0,
      speed: type.speed * (1 + Math.min(0.25, state.wave * 0.009)), dead: false
    });
  }

  function towerAtSlot(slotId) { return state.towers.find((tower) => tower.slotId === slotId); }

  function serviceCost(id) {
    if (state?.architect) return 0;
    return SERVICES[id].cost;
  }

  function selectService(id) {
    if (!state || state.phase === "menu" || state.finished || !SERVICES[id]) return;
    state.selectedService = state.selectedService === id ? null : id;
    state.selectedTower = null;
    updateServiceSelection();
    updateInspector();
  }

  function buildTower(slotId) {
    const slot = SLOTS[slotId];
    const service = SERVICES[state.selectedService];
    if (!slot || !service || towerAtSlot(slotId)) return;
    const cost = serviceCost(state.selectedService);
    if (state.budget < cost) { toast("Presupuesto insuficiente para ese servicio"); return; }
    state.budget -= cost;
    const tower = { id: ++uid, slotId, serviceId: state.selectedService, level: 1, cooldown: Math.random() * 0.3, spent: cost, angle: 0, pulse: 0 };
    state.towers.push(tower);
    state.selectedTower = tower.id;
    state.selectedService = null;
    toast(`${service.name} desplegado`);
    updateServiceSelection();
    updateInspector();
    updateHud();
  }

  function selectedTower() { return state?.towers.find((tower) => tower.id === state.selectedTower) || null; }

  function upgradeCost(tower) {
    if (state.architect) return 0;
    return Math.round(SERVICES[tower.serviceId].cost * (0.62 + tower.level * 0.48));
  }

  function upgradeTower() {
    const tower = selectedTower();
    if (!tower || tower.level >= 4 || state.finished) return;
    const cost = upgradeCost(tower);
    if (state.budget < cost) { toast("Presupuesto insuficiente para mejorar"); return; }
    state.budget -= cost;
    tower.spent += cost;
    tower.level += 1;
    tower.pulse = 1;
    toast(`${SERVICES[tower.serviceId].name} sube a nivel ${tower.level}`);
    updateInspector();
    updateHud();
  }

  function sellTower() {
    const tower = selectedTower();
    if (!tower || state.finished) return;
    const refund = state.architect ? 0 : Math.round(tower.spent * 0.7);
    state.budget += refund;
    state.towers = state.towers.filter((item) => item.id !== tower.id);
    state.selectedTower = null;
    toast(`Servicio retirado${refund ? ` · +$${refund}` : ""}`);
    updateInspector();
    updateHud();
  }

  function towerStats(tower) {
    const base = SERVICES[tower.serviceId];
    const multiplier = 1 + (tower.level - 1) * 0.34;
    return {
      range: base.range * (1 + (tower.level - 1) * 0.075),
      rate: Math.max(0.12, base.rate * (1 - (tower.level - 1) * 0.09)),
      damage: base.damage * multiplier
    };
  }

  function updateServiceCosts() {
    if (!host || !state) return;
    Object.keys(SERVICES).forEach((id) => {
      const node = host.querySelector(`[data-cd-cost="${id}"]`);
      if (node) node.textContent = state.architect ? "FREE" : `$${SERVICES[id].cost}`;
    });
  }

  function updateServiceSelection() {
    if (!host) return;
    host.querySelectorAll("[data-cd-service]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.cdService === state?.selectedService);
    });
  }

  function updateInspector() {
    if (!host || !state) return;
    const title = host.querySelector("#cd-inspector-title");
    const kicker = host.querySelector("#cd-inspector-kicker");
    const body = host.querySelector("#cd-inspector-body");
    const tower = selectedTower();
    if (tower) {
      const service = SERVICES[tower.serviceId];
      const stats = towerStats(tower);
      const next = tower.level < 4 ? upgradeCost(tower) : 0;
      title.textContent = service.name;
      kicker.textContent = `Nivel ${tower.level} · slot ${tower.slotId + 1}`;
      body.innerHTML = `<div class="cd-inspector-icon" style="--service:${service.color}">${iconSvg(service.icon)}</div>
        <p>${service.pitch}</p>
        <dl><div><dt>RANGO</dt><dd>${Math.round(stats.range)}m</dd></div><div><dt>DAÑO</dt><dd>${service.damage ? Math.round(stats.damage) : "Soporte"}</dd></div><div><dt>INTERVALO</dt><dd>${stats.rate.toFixed(2)}s</dd></div></dl>
        <div class="cd-level-pips">${[1, 2, 3, 4].map((level) => `<i class="${level <= tower.level ? "on" : ""}"></i>`).join("")}</div>
        <button type="button" class="cd-upgrade" data-cd-action="upgrade" ${tower.level >= 4 ? "disabled" : ""}>${tower.level >= 4 ? "Nivel máximo" : `Mejorar · ${state.architect ? "FREE" : `$${next}`}`} <kbd>U</kbd></button>
        <button type="button" class="cd-sell" data-cd-action="sell">Vender · ${state.architect ? "$0" : `$${Math.round(tower.spent * 0.7)}`} <kbd>X</kbd></button>`;
      return;
    }
    title.textContent = state.scenario.name;
    kicker.textContent = state.scenario.label;
    body.innerHTML = `<div class="cd-architecture-mark">${state.scenario.icon}</div><p>${state.scenario.description}</p><div class="cd-runbook"><span>RUNBOOK</span><strong>${state.scenario.hint}</strong></div>
      <ul><li><i class="good"></i> El tráfico turquesa genera $18.</li><li><i class="bad"></i> Las amenazas dañan el endpoint.</li><li><i class="slot"></i> Los círculos son slots de build.</li></ul>`;
  }

  function getSlo() {
    if (!state || state.goodArrived === 0) return 100;
    return state.goodSuccess / state.goodArrived * 100;
  }

  function p95() {
    if (!state || !state.latencySamples.length) return null;
    const values = [...state.latencySamples].sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
  }

  function format(value) { return Math.round(value || 0).toLocaleString("es-ES"); }

  function updateHud() {
    if (!host || !state) return;
    const health = Math.max(0, state.health / state.maxHealth * 100);
    const latency = p95();
    setText("cd-health", `${Math.ceil(health)}%`);
    const healthBar = host.querySelector("#cd-health-bar");
    if (healthBar) { healthBar.style.width = `${health}%`; healthBar.classList.toggle("is-critical", health < 35); }
    setText("cd-slo", `${getSlo().toFixed(1)}%`);
    setText("cd-slo-target", state.architect ? "sin objetivo" : `objetivo ${state.scenario.target}%`);
    setText("cd-budget", state.architect ? "∞" : `$${format(state.budget)}`);
    setText("cd-income", `+$${format(state.income)} ingresos`);
    setText("cd-score", format(state.score));
    setText("cd-blocked", `${state.blocked} bloqueadas`);
    setText("cd-latency", latency == null ? "—" : `${Math.round(latency)} ms`);
    setText("cd-load", state.endpointLoad > 45 ? "carga crítica" : state.endpointLoad > 15 ? "carga elevada" : "carga estable");
    const total = state.scenario.waves === Infinity ? "∞" : state.scenario.waves;
    setText("cd-wave", `${state.wave} / ${total}`);
    setText("cd-wave-state", state.phase === "wave" ? `${state.enemies.length + state.spawnQueue.length} en tránsito` : state.finished ? "finalizada" : "lista manual");
    setText("cd-speed-label", state.phase === "paused" ? "PAUSED" : state.phase === "wave" ? "LIVE" : "STANDBY");
    setText("cd-pause-label", state.phase === "paused" ? "Continuar" : "Pausa");
    const badge = host.querySelector("#cd-mode-badge");
    if (badge) badge.textContent = state.scenarioId === "architect" ? "Sandbox" : state.scenarioId === "endless" ? "Endless" : "Campaign";
    const button = host.querySelector("#cd-wave-button");
    if (button) {
      button.disabled = !["between", "ready"].includes(state.phase) || state.finished || state.wave >= state.scenario.waves;
      const label = button.querySelector("b");
      if (label) label.textContent = state.phase === "wave" ? "Oleada activa" : `Iniciar oleada ${state.wave + 1}`;
    }
    const nextThreats = state.scenario.threats.map((id) => ENEMY_TYPES[id].name).join(" · ");
    setText("cd-next-summary", state.phase === "wave" ? `Oleada ${state.wave} en curso` : `Siguiente: ${state.wave + 1} · ${nextThreats}`);
    setText("cd-next-detail", state.phase === "wave" ? "Los servicios adquieren solo objetivos maliciosos." : "Inicio manual. Construye o mejora antes de continuar.");
  }

  function setText(id, text) { const node = host?.querySelector(`#${id}`); if (node) node.textContent = text; }

  function toast(message) {
    if (!state || !host) return;
    state.message = message;
    state.toastUntil = performance.now() + 2800;
    const node = host.querySelector("#cd-toast");
    if (node) { node.textContent = message; node.classList.add("is-visible"); }
  }

  function togglePause(force) {
    if (!state || ["menu", "help"].includes(state.phase) || state.finished) return;
    if (force === true && state.phase === "paused") return;
    if (state.phase === "paused") {
      state.phase = state.pausedFrom || "between";
      state.pausedFrom = null;
      hideOverlay();
    } else {
      state.pausedFrom = state.phase;
      state.phase = "paused";
      const overlay = host.querySelector("#cd-overlay");
      overlay.hidden = false;
      overlay.className = "cd-overlay cd-pause-overlay";
      overlay.innerHTML = `<div class="cd-dialog"><span class="cd-dialog-icon">Ⅱ</span><small>SIMULATION PAUSED</small><h2>Operación en pausa</h2><p>Oleadas, cooldowns y latencia están detenidos.</p><button class="cd-primary" type="button" data-cd-action="pause">Continuar</button></div>`;
    }
    updateHud();
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function visibleToTower(enemy, tower) {
    if (!enemy.stealth) return true;
    if (enemy.markedUntil > stateTime()) return true;
    return tower.serviceId === "waf";
  }

  function stateTime() { return state ? state.elapsed || 0 : 0; }

  function acquireTargets(tower, stats) {
    const slot = SLOTS[tower.slotId];
    return state.enemies
      .filter((enemy) => enemy.malicious && !enemy.dead && visibleToTower(enemy, tower) && distance(slot, pointOnPath(enemy.distance)) <= stats.range)
      .sort((a, b) => b.distance - a.distance);
  }

  function addProjectile(tower, enemy, color) {
    const slot = SLOTS[tower.slotId];
    state.projectiles.push({ x: slot.x, y: slot.y, targetId: enemy.id, color, life: 0.34, maxLife: 0.34 });
  }

  function damageEnemy(enemy, amount, tower, kind) {
    if (!enemy || enemy.dead) return;
    let damage = amount * (1 - (enemy.armor || 0));
    if (tower.serviceId === "waf" && ["sqli", "credential"].includes(enemy.typeId)) damage *= 2.25;
    if (tower.serviceId === "shield" && enemy.typeId === "ddos") damage *= 2.15;
    if (tower.serviceId === "cloudfront" && enemy.typeId === "bot") damage *= 1.7;
    if (tower.serviceId === "sqs" && enemy.typeId === "retry") damage *= 2.8;
    const targetPoint = pointOnPath(enemy.distance);
    const observed = state.towers.some((item) => item.serviceId === "cloudwatch" && distance(SLOTS[item.slotId], targetPoint) <= towerStats(item).range);
    if (observed && tower.serviceId !== "cloudwatch") damage *= 1.22;
    enemy.hp -= damage;
    enemy.hitFlash = 0.12;
    state.effects.push({ type: kind || "hit", x: targetPoint.x, y: targetPoint.y, color: SERVICES[tower.serviceId].color, life: 0.35, maxLife: 0.35 });
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    state.blocked += 1;
    state.budget += enemy.reward;
    state.income += enemy.reward;
    state.score += Math.round(enemy.reward * 12 + state.wave * 9);
    const point = pointOnPath(enemy.distance);
    state.effects.push({ type: "burst", x: point.x, y: point.y, color: enemy.color, life: 0.55, maxLife: 0.55 });
  }

  function fireTower(tower) {
    const service = SERVICES[tower.serviceId];
    const stats = towerStats(tower);
    const targets = acquireTargets(tower, stats);
    const target = targets[0];
    if (tower.serviceId === "cloudwatch") {
      const slot = SLOTS[tower.slotId];
      state.enemies.forEach((enemy) => {
        const point = pointOnPath(enemy.distance);
        if (enemy.malicious && distance(slot, point) <= stats.range) enemy.markedUntil = stateTime() + 2.2 + tower.level * 0.3;
      });
      tower.pulse = 1;
      state.effects.push({ type: "scan", x: slot.x, y: slot.y, color: service.color, radius: stats.range, life: 0.7, maxLife: 0.7 });
      return true;
    }
    if (!target) return false;
    const targetPoint = pointOnPath(target.distance);
    const slot = SLOTS[tower.slotId];
    tower.angle = Math.atan2(targetPoint.y - slot.y, targetPoint.x - slot.x);
    addProjectile(tower, target, service.color);

    if (tower.serviceId === "shield") {
      const splash = 58 + tower.level * 8;
      state.enemies.forEach((enemy) => {
        if (enemy.malicious && distance(pointOnPath(enemy.distance), targetPoint) <= splash) damageEnemy(enemy, stats.damage, tower, "shock");
      });
    } else if (tower.serviceId === "lambda") {
      targets.slice(0, 3).forEach((enemy, index) => damageEnemy(enemy, stats.damage * (1 - index * 0.22), tower, "chain"));
    } else {
      damageEnemy(target, stats.damage, tower);
      if (tower.serviceId === "sqs" && !target.dead) {
        target.slowUntil = stateTime() + 1.8 + tower.level * 0.25;
        target.distance = Math.max(0, target.distance - (target.typeId === "retry" ? 24 : 8));
      }
    }
    tower.pulse = 1;
    return true;
  }

  function updateTowers(dt) {
    state.towers.forEach((tower) => {
      tower.cooldown -= dt;
      tower.pulse = Math.max(0, tower.pulse - dt * 2.8);
      if (tower.cooldown <= 0) {
        const didFire = fireTower(tower);
        tower.cooldown = didFire ? towerStats(tower).rate : Math.min(0.22, towerStats(tower).rate);
      }
    });
  }

  function processArrival(enemy) {
    enemy.dead = true;
    if (!enemy.malicious) {
      state.goodArrived += 1;
      const edgeCoverage = state.towers.reduce((total, tower) => tower.serviceId === "cloudfront" ? total + 1 : total, 0);
      const latency = 145 + enemy.age * 32 + state.endpointLoad * 4.2 - Math.min(72, edgeCoverage * 18);
      const failChance = Math.max(0, (state.endpointLoad - 28) / 105);
      const success = state.architect || Math.random() >= failChance;
      state.latencySamples.push(Math.max(38, latency));
      if (state.latencySamples.length > 100) state.latencySamples.shift();
      if (success) {
        state.goodSuccess += 1;
        state.budget += enemy.reward;
        state.income += enemy.reward;
        state.score += Math.round(45 + Math.max(0, 260 - latency) * 0.25);
        state.effects.push({ type: "success", x: 1160, y: 240, color: enemy.color, life: 0.45, maxLife: 0.45 });
      } else {
        state.effects.push({ type: "fail", x: 1160, y: 240, color: "#ff596d", life: 0.55, maxLife: 0.55 });
      }
      return;
    }
    state.leaked += 1;
    if (!state.architect) state.health -= enemy.damage;
    state.endpointLoad = Math.min(100, state.endpointLoad + enemy.damage * (enemy.typeId === "ddos" ? 1.55 : 0.9));
    state.score = Math.max(0, state.score - enemy.damage * 8);
    state.effects.push({ type: "fail", x: 1160, y: 240, color: enemy.color, life: 0.7, maxLife: 0.7 });
    toast(`${enemy.name} alcanzó el endpoint · -${enemy.damage} health`);
  }

  function updateEnemies(dt) {
    const now = stateTime();
    state.enemies.forEach((enemy) => {
      enemy.age += dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      const slow = enemy.slowUntil > now ? (enemy.typeId === "retry" ? 0.34 : 0.58) : 1;
      enemy.distance += enemy.speed * slow * dt;
      if (enemy.distance >= pathData.total) processArrival(enemy);
    });
    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  }

  function updateProjectiles(dt) {
    state.projectiles.forEach((projectile) => {
      projectile.life -= dt;
      const enemy = state.enemies.find((item) => item.id === projectile.targetId);
      if (enemy) {
        const point = pointOnPath(enemy.distance);
        projectile.x += (point.x - projectile.x) * Math.min(1, dt * 16);
        projectile.y += (point.y - projectile.y) * Math.min(1, dt * 16);
      }
    });
    state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0);
    state.effects.forEach((effect) => { effect.life -= dt; });
    state.effects = state.effects.filter((effect) => effect.life > 0);
  }

  function checkWaveComplete() {
    if (state.phase !== "wave" || state.spawnQueue.length || state.enemies.length) return;
    state.phase = "between";
    state.lastWaveEnded = stateTime();
    state.budget += state.architect ? 0 : 35 + state.wave * 4;
    state.score += state.wave * 75;
    const stats = safeReadStats();
    stats.highestWave = Math.max(stats.highestWave, state.wave);
    saveStats(stats);
    if (state.wave >= state.scenario.waves) finish(true);
    else toast(`Oleada ${state.wave} contenida · bono operativo recibido`);
    updateHud();
  }

  function checkDefeat() {
    if (state.architect || state.finished || state.phase === "menu") return;
    const sloCollapse = state.goodArrived >= 12 && getSlo() < Math.max(55, state.scenario.target - 28);
    if (state.health <= 0 || sloCollapse) finish(false);
  }

  function finish(won) {
    if (state.finished) return;
    state.finished = true;
    state.phase = "finished";
    const stats = safeReadStats();
    stats.wins += won ? 1 : 0;
    stats.bestScore = Math.max(stats.bestScore, Math.round(state.score));
    stats.highestWave = Math.max(stats.highestWave, state.wave);
    stats.threatsBlocked += state.blocked;
    stats.goodDelivered += state.goodSuccess;
    if (won && !["endless", "architect"].includes(state.scenarioId)) {
      const stars = getSlo() >= state.scenario.target && state.health / state.maxHealth > 0.7 ? 3 : state.health > 0 ? 2 : 1;
      stats.completed[state.scenarioId] = Math.max(stats.completed[state.scenarioId] || 0, stars);
    }
    saveStats(stats);
    const overlay = host.querySelector("#cd-overlay");
    overlay.hidden = false;
    overlay.className = "cd-overlay";
    overlay.innerHTML = finishMarkup(won);
    updateHud();
  }

  function update(dt) {
    if (!state || !["wave", "between", "ready"].includes(state.phase) || state.finished) return;
    state.elapsed = (state.elapsed || 0) + dt;
    state.endpointLoad = Math.max(0, state.endpointLoad - dt * (4.2 + state.towers.filter((tower) => tower.serviceId === "sqs").length * 0.5));
    if (state.phase === "wave") {
      state.spawnClock += dt;
      while (state.spawnQueue.length && state.spawnQueue[0].at <= state.spawnClock) spawnEnemy(state.spawnQueue.shift().type);
      updateEnemies(dt);
      updateTowers(dt);
      updateProjectiles(dt);
      checkWaveComplete();
      checkDefeat();
    } else {
      updateProjectiles(dt);
      state.towers.forEach((tower) => { tower.pulse = Math.max(0, tower.pulse - dt * 2); });
    }
  }

  function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawBackground(time) {
    ctx.fillStyle = "#050d18";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "rgba(72, 116, 151, .09)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(620, 320, 10, 620, 320, 520);
    glow.addColorStop(0, "rgba(25, 167, 206, .055)");
    glow.addColorStop(1, "rgba(5, 13, 24, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(29, 55, 76, .95)";
    ctx.lineWidth = 52;
    ctx.beginPath();
    PATH.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    ctx.strokeStyle = "rgba(87, 134, 166, .24)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = -(time * 0.025 % 24);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let distanceValue = 45; distanceValue < pathData.total; distanceValue += 86) {
      const point = pointOnPath(distanceValue);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(point.angle);
      ctx.fillStyle = "rgba(96, 145, 175, .23)";
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawEndpoint() {
    ctx.save();
    ctx.translate(1160, 240);
    const health = state ? Math.max(0, state.health / state.maxHealth) : 1;
    ctx.shadowBlur = 25;
    ctx.shadowColor = health < 0.35 ? "#ff596d" : "#44d9c5";
    ctx.fillStyle = "rgba(8, 24, 37, .96)";
    drawRoundedRect(-34, -43, 68, 86, 13); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = health < 0.35 ? "#ff596d" : "#44d9c5";
    ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "rgba(68, 217, 197, .15)";
    for (let y = -27; y <= 18; y += 15) { drawRoundedRect(-20, y, 40, 8, 3); ctx.fill(); }
    ctx.fillStyle = "#b9d4df"; ctx.font = "700 11px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText("API", 0, 62);
    ctx.restore();
  }

  function drawSlots(time) {
    SLOTS.forEach((slot) => {
      const tower = state && towerAtSlot(slot.id);
      if (tower) return;
      const hover = state && state.hoverSlot === slot.id;
      const active = state && state.selectedService;
      ctx.save(); ctx.translate(slot.x, slot.y);
      if (hover && active) {
        const range = SERVICES[state.selectedService].range;
        ctx.fillStyle = "rgba(52, 214, 255, .045)"; ctx.strokeStyle = "rgba(52, 214, 255, .25)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = active ? "rgba(255, 159, 67, .65)" : "rgba(109, 151, 181, .38)";
      ctx.fillStyle = hover ? "rgba(255, 159, 67, .16)" : "rgba(12, 30, 46, .78)";
      ctx.lineWidth = hover ? 3 : 2;
      ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(time * 0.002 + slot.id) * (active ? 1.5 : 0), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? "#ffb258" : "#648299"; ctx.font = "700 18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", 0, -1);
      ctx.fillStyle = "#4f687c"; ctx.font = "600 8px ui-monospace, monospace"; ctx.fillText(`S${slot.id + 1}`, 0, 36);
      ctx.restore();
    });
  }

  function drawTower(tower) {
    const slot = SLOTS[tower.slotId];
    const service = SERVICES[tower.serviceId];
    const selected = state.selectedTower === tower.id;
    const stats = towerStats(tower);
    ctx.save(); ctx.translate(slot.x, slot.y);
    if (selected) {
      ctx.fillStyle = `${service.color}0d`; ctx.strokeStyle = `${service.color}55`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.shadowBlur = 12 + tower.pulse * 14; ctx.shadowColor = service.color;
    ctx.fillStyle = "#102438"; ctx.strokeStyle = selected ? "#ffffff" : service.color; ctx.lineWidth = selected ? 3 : 2;
    drawRoundedRect(-27, -27, 54, 54, 13); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.rotate(tower.serviceId === "cloudwatch" ? (stateTime() * 0.5) : tower.angle);
    ctx.strokeStyle = service.color; ctx.fillStyle = `${service.color}33`; ctx.lineWidth = 3;
    if (tower.serviceId === "shield") { ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(14, -8); ctx.lineTo(11, 10); ctx.lineTo(0, 17); ctx.lineTo(-11, 10); ctx.lineTo(-14, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (tower.serviceId === "cloudwatch") { ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-7, 0); ctx.lineTo(-3, -9); ctx.lineTo(3, 9); ctx.lineTo(7, 0); ctx.lineTo(17, 0); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(13, 0); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.rotate(tower.serviceId === "cloudwatch" ? -(stateTime() * 0.5) : -tower.angle);
    ctx.fillStyle = service.color; ctx.font = "800 9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(service.short, 0, 40);
    for (let i = 0; i < tower.level; i += 1) { ctx.beginPath(); ctx.arc(-9 + i * 6, -36, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const point = pointOnPath(enemy.distance);
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(point.angle);
    const marked = enemy.markedUntil > stateTime();
    ctx.globalAlpha = enemy.stealth && !marked ? 0.48 : 1;
    ctx.shadowBlur = enemy.hitFlash ? 20 : 8; ctx.shadowColor = enemy.hitFlash ? "white" : enemy.color;
    ctx.fillStyle = enemy.hitFlash ? "#fff" : enemy.color;
    if (!enemy.malicious) {
      drawRoundedRect(-12, -8, 24, 16, 5); ctx.fill();
      ctx.fillStyle = "#082329"; ctx.fillRect(-5, -2, 10, 4);
    } else if (enemy.typeId === "ddos") {
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) { const angle = Math.PI * 2 * i / 8; const radius = i % 2 ? 12 : 18; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
    } else if (enemy.typeId === "sqli") {
      ctx.beginPath(); ctx.moveTo(-14, -11); ctx.lineTo(10, -11); ctx.lineTo(14, 0); ctx.lineTo(10, 11); ctx.lineTo(-14, 11); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#29143e"; ctx.font = "900 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("'--", 1, 0);
    } else if (enemy.typeId === "retry") {
      ctx.beginPath(); ctx.arc(0, 0, 13, 0.3, Math.PI * 1.7); ctx.lineWidth = 6; ctx.strokeStyle = enemy.color; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, -10); ctx.lineTo(16, -9); ctx.lineTo(12, -3); ctx.fill();
    } else if (enemy.typeId === "credential") {
      drawRoundedRect(-14, -10, 28, 20, 6); ctx.fill(); ctx.fillStyle = "#3a2c09"; ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-2, -1, 9, 3);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#422404"; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, Math.PI * 2); ctx.arc(4, -2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (enemy.malicious) {
      const width = 28;
      ctx.fillStyle = "rgba(3, 9, 15, .82)"; ctx.fillRect(-width / 2, -enemy.radius - 11, width, 4);
      ctx.fillStyle = enemy.hp / enemy.maxHp < 0.3 ? "#ff596d" : "#67e8a5"; ctx.fillRect(-width / 2, -enemy.radius - 11, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }
    if (marked) {
      ctx.strokeStyle = "#f7d154"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 7 + Math.sin(time * 0.006) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawEffects() {
    state.projectiles.forEach((projectile) => {
      ctx.save(); ctx.fillStyle = projectile.color; ctx.shadowBlur = 12; ctx.shadowColor = projectile.color;
      ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    state.effects.forEach((effect) => {
      const progress = 1 - effect.life / effect.maxLife;
      ctx.save(); ctx.globalAlpha = 1 - progress; ctx.strokeStyle = effect.color; ctx.fillStyle = effect.color; ctx.lineWidth = 3;
      if (effect.type === "scan") { ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * progress, 0, Math.PI * 2); ctx.stroke(); }
      else if (effect.type === "success") { ctx.beginPath(); ctx.arc(effect.x, effect.y, 12 + progress * 35, 0, Math.PI * 2); ctx.stroke(); }
      else if (effect.type === "fail") { ctx.beginPath(); ctx.arc(effect.x, effect.y, 8 + progress * 42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(effect.x - 10, effect.y - 10); ctx.lineTo(effect.x + 10, effect.y + 10); ctx.moveTo(effect.x + 10, effect.y - 10); ctx.lineTo(effect.x - 10, effect.y + 10); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(effect.x, effect.y, 5 + progress * 24, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
  }

  function render(time) {
    if (!ctx || !canvas || !state) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    drawBackground(time);
    drawEndpoint();
    drawSlots(time);
    state.towers.forEach(drawTower);
    state.enemies.forEach((enemy) => drawEnemy(enemy, time));
    drawEffects();
    if (state.selectedService) {
      ctx.save(); ctx.fillStyle = "rgba(255, 178, 88, .9)"; ctx.font = "700 11px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(`DESPLEGAR ${SERVICES[state.selectedService].name.toUpperCase()} · ELIGE UN SLOT`, WIDTH / 2, HEIGHT - 18); ctx.restore();
    }
    void dpr;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; render(performance.now()); }
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
  }

  function nearestSlot(point, maxDistance) {
    let result = null;
    let best = maxDistance;
    SLOTS.forEach((slot) => { const value = distance(point, slot); if (value < best) { best = value; result = slot; } });
    return result;
  }

  function handleCanvasMove(event) {
    if (!state || !canvas) return;
    if (event.pointerType === "touch") event.preventDefault();
    const slot = nearestSlot(canvasPoint(event), 42);
    state.hoverSlot = slot ? slot.id : null;
  }

  function handleCanvasLeave() { if (state) state.hoverSlot = null; }

  function handleCanvasDown(event) {
    if (!state || !canvas || state.phase === "menu" || state.finished) return;
    if (event.pointerType === "touch") event.preventDefault();
    const slot = nearestSlot(canvasPoint(event), 45);
    if (!slot) { state.selectedTower = null; updateInspector(); return; }
    const tower = towerAtSlot(slot.id);
    if (tower) {
      state.selectedTower = tower.id;
      state.selectedService = null;
      updateServiceSelection();
      updateInspector();
    } else if (state.selectedService) buildTower(slot.id);
    else toast("Selecciona un servicio y después este slot");
  }

  function handleClick(event) {
    const scenario = event.target.closest("[data-cd-scenario]")?.dataset.cdScenario;
    if (scenario) { startScenario(scenario); return; }
    const service = event.target.closest("[data-cd-service]")?.dataset.cdService;
    if (service) { selectService(service); return; }
    const action = event.target.closest("[data-cd-action]")?.dataset.cdAction;
    if (!action) return;
    if (action === "wave") startWave();
    if (action === "pause") togglePause();
    if (action === "help") showHelp();
    if (action === "close") closeHelp();
    if (action === "upgrade") upgradeTower();
    if (action === "sell") sellTower();
    if (action === "scenarios") showMenu();
    if (action === "replay") startScenario(state.scenarioId);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleKeyDown(event) {
    if (!host || !state || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || event.target?.isContentEditable) return;
    const key = event.key.toLowerCase();
    if ([" ", "p", "escape", "u", "x", "1", "2", "3", "4", "5", "6", "7"].includes(key)) event.preventDefault();
    if (/^[1-7]$/.test(key)) selectService(Object.keys(SERVICES)[Number(key) - 1]);
    if (key === " ") startWave();
    if (key === "p") togglePause();
    if (key === "u") upgradeTower();
    if (key === "x" || key === "delete" || key === "backspace") sellTower();
    if (key === "escape") {
      if (state.phase === "help") closeHelp();
      else if (state.phase === "paused") togglePause();
      else { state.selectedService = null; state.selectedTower = null; updateServiceSelection(); updateInspector(); }
    }
  }

  function handleVisibility() { if (document.hidden && state && state.phase === "wave") togglePause(true); }

  function frame(time) {
    if (!host) return;
    const dt = Math.min(0.05, Math.max(0, (time - lastFrame) / 1000 || 0));
    lastFrame = time;
    update(dt);
    render(time);
    if (state && state.toastUntil && time > state.toastUntil) {
      const node = host.querySelector("#cd-toast");
      if (node) node.classList.remove("is-visible");
      state.toastUntil = 0;
    }
    if (state && Math.floor(time / 250) !== Math.floor((time - dt * 1000) / 250)) updateHud();
    rafId = window.requestAnimationFrame(frame);
  }

  function mount(container, onExit) {
    destroy();
    if (!container) return;
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    host.innerHTML = markup();
    canvas = host.querySelector("#cd-canvas");
    ctx = canvas.getContext("2d");
    state = createState("static");
    state.phase = "menu";

    host.addEventListener("click", handleClick);
    canvas.addEventListener("pointermove", handleCanvasMove, { passive: false });
    canvas.addEventListener("pointerdown", handleCanvasDown, { passive: false });
    canvas.addEventListener("pointerleave", handleCanvasLeave);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);
    }
    resizeCanvas();
    updateServiceCosts();
    updateInspector();
    updateHud();
    showMenu();
    lastFrame = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function destroy() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (canvas) {
      canvas.removeEventListener("pointermove", handleCanvasMove);
      canvas.removeEventListener("pointerdown", handleCanvasDown);
      canvas.removeEventListener("pointerleave", handleCanvasLeave);
    }
    if (host) host.removeEventListener("click", handleClick);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", resizeCanvas);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (styleOwned && styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
    styleNode = null;
    styleOwned = false;
    host = null;
    canvas = null;
    ctx = null;
    state = null;
    exitCallback = null;
    lastFrame = 0;
  }

  function registerGame() {
    if (!Array.isArray(window.CLOUD_ARCADE_GAMES)) return;
    if (window.CLOUD_ARCADE_GAMES.some((game) => game.id === "cloud-defense")) return;
    window.CLOUD_ARCADE_GAMES.push({
      id: "cloud-defense", title: "Cloud Defense", kicker: "Reliability Tower Defense",
      description: "Filtra amenazas, sirve tráfico legítimo y protege el SLO con una arquitectura cloud por capas.",
      status: "available", module: "CloudDefense", accent: "#34d6ff",
      tags: ["Tower Defense", "SRE", "7 servicios", "7 modos"], players: "1 jugador"
    });
  }

  window.CloudDefense = { mount, destroy, getStats: safeReadStats };
  registerGame();
}());
