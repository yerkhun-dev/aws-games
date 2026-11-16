(function () {
  "use strict";

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const STYLE_ID = "pipeline-factory-styles";
  const STORAGE_KEY = "cloud-arcade:pipeline-factory:stats";
  const DESIGN_KEY = "cloud-arcade:pipeline-factory:design";
  const SLOT_POSITIONS = [
    [24, 24], [43, 18], [62, 24], [24, 52], [43, 48],
    [62, 52], [24, 79], [43, 76], [62, 79]
  ];

  const SERVICES = {
    kinesis: { name: "Kinesis", short: "KIN", color: "#d879f2", cost: 150, op: 2.3, capacity: 95, latency: 0.12, queue: 240, icon: "stream", pitch: "Ingesta streams y suaviza picos por particiones.", effect: "streamed" },
    sqs: { name: "SQS", short: "SQS", color: "#e879bb", cost: 105, op: 1.1, capacity: 55, latency: 0.24, queue: 900, icon: "queue", pitch: "Cola durable: gran buffer y menos pérdida.", effect: "durable" },
    eventbridge: { name: "EventBridge", short: "EB", color: "#e879bb", cost: 120, op: 1.6, capacity: 72, latency: 0.16, queue: 220, icon: "route", pitch: "Enruta lotes entre todas sus salidas.", effect: "routed" },
    lambda: { name: "Lambda", short: "λ", color: "#ff9f43", cost: 135, op: 2.8, capacity: 48, latency: 0.20, queue: 130, loss: 0.012, icon: "bolt", pitch: "Transforma eventos con cómputo serverless.", effect: "transformed" },
    stepfunctions: { name: "Step Functions", short: "SFN", color: "#f06cae", cost: 175, op: 3.4, capacity: 34, latency: 0.42, queue: 180, icon: "steps", pitch: "Orquesta, valida y reintenta flujos complejos.", effect: "validated" },
    s3: { name: "S3", short: "S3", color: "#62cf72", cost: 95, op: 0.7, capacity: 130, latency: 0.28, queue: 420, icon: "bucket", pitch: "Compacta y marca lotes para el data lake.", effect: "stored" },
    glue: { name: "Glue", short: "GLU", color: "#8b7cf6", cost: 185, op: 3.1, capacity: 64, latency: 0.55, queue: 280, icon: "spark", pitch: "ETL de alta calidad, lento pero escalable.", effect: "transformed" },
    dynamodb: { name: "DynamoDB", short: "DDB", color: "#4f8ff7", cost: 145, op: 2.4, capacity: 90, latency: 0.09, queue: 170, icon: "table", pitch: "Indexa eventos con latencia mínima.", effect: "indexed" },
    redshift: { name: "Redshift", short: "RS", color: "#4f8ff7", cost: 190, op: 3.8, capacity: 78, latency: 0.38, queue: 320, icon: "warehouse", pitch: "Prepara lotes columnares para analítica.", effect: "warehoused" },
    cloudwatch: { name: "CloudWatch", short: "CW", color: "#ef5c70", cost: 90, op: 1.5, capacity: 120, latency: 0.08, queue: 120, icon: "pulse", pitch: "Instrumenta el recorrido y revela fallos.", effect: "observed" },
    kms: { name: "KMS", short: "KMS", color: "#f2c94c", cost: 115, op: 1.9, capacity: 68, latency: 0.14, queue: 150, icon: "key", pitch: "Cifra datos sensibles antes del destino.", effect: "encrypted" }
  };

  const SCENARIOS = {
    clickstream: { mode: "Campaign 01", name: "Clickstream global", icon: "◎", description: "Convierte clics sensibles en analítica observable.", rate: 42, duration: 30, budget: 720, throughput: 34, latency: 2.3, maxLoss: 8, destination: "redshift", transform: true, encrypt: true, observe: true, sensitive: true },
    iot: { mode: "Campaign 02", name: "Flota IoT", icon: "⌁", description: "Absorbe telemetría irregular y archívala sin pérdida.", rate: 58, duration: 32, budget: 680, throughput: 45, latency: 2.8, maxLoss: 6, destination: "s3", transform: false, encrypt: true, observe: false, sensitive: true, burst: 1.55 },
    orders: { mode: "Campaign 03", name: "Pedidos online", icon: "▣", description: "Procesa pedidos con validación, cifrado e índice rápido.", rate: 32, duration: 32, budget: 760, throughput: 27, latency: 1.9, maxLoss: 4, destination: "dynamodb", transform: true, encrypt: true, observe: true, sensitive: true, requireValidated: true },
    fraud: { mode: "Campaign 04", name: "Fraude en tiempo real", icon: "◇", description: "Transforma señales críticas con latencia extrema.", rate: 28, duration: 30, budget: 620, throughput: 23, latency: 1.25, maxLoss: 5, destination: "dynamodb", transform: true, encrypt: false, observe: true, sensitive: false },
    datalake: { mode: "Campaign 05", name: "Data lake nocturno", icon: "▽", description: "ETL masivo, cifrado y almacenamiento económico.", rate: 65, duration: 34, budget: 700, throughput: 50, latency: 3.6, maxLoss: 7, destination: "s3", transform: true, encrypt: true, observe: false, sensitive: true },
    logs: { mode: "Campaign 06", name: "Central de logs", icon: "≋", description: "Entrega logs observados al warehouse bajo presupuesto.", rate: 47, duration: 32, budget: 650, throughput: 37, latency: 2.5, maxLoss: 7, destination: "redshift", transform: false, encrypt: false, observe: true, sensitive: false },
    sandbox: { mode: "Sandbox", name: "Laboratorio libre", icon: "∞", description: "Construye sin reloj y valida cuando quieras.", rate: 38, duration: Infinity, budget: 1200, throughput: 25, latency: 3.2, maxLoss: 15, destination: "s3", transform: false, encrypt: false, observe: false, sensitive: false, sandbox: true },
    incident: { mode: "Incident mode", name: "Guardia SEV-1", icon: "!", description: "Una anomalía desconocida altera la carga o un servicio.", rate: 48, duration: 38, budget: 760, throughput: 34, latency: 2.8, maxLoss: 10, destination: "redshift", transform: true, encrypt: true, observe: true, sensitive: true, incident: true }
  };

  const INCIDENTS = [
    { id: "spike", name: "Traffic spike", text: "La fuente triplica la carga entre los segundos 9 y 18." },
    { id: "lambda", name: "Lambda throttling", text: "Lambda pierde 55% de capacidad durante la simulación." },
    { id: "network", name: "Packet loss", text: "Cada transferencia tiene 4% de pérdida adicional." },
    { id: "poison", name: "Poison messages", text: "Sin SQS, los fallos de proceso son seis veces más frecuentes." }
  ];

  let host = null;
  let exitCallback = null;
  let state = null;
  let styleNode = null;
  let styleOwned = false;
  let rafId = 0;
  let lastFrame = 0;
  let resizeObserver = null;
  let refs = {};
  let batchSequence = 0;

  function defaultStats() {
    return { played: 0, wins: 0, bestScore: 0, delivered: 0, completed: {}, tutorialSeen: false };
  }

  function finiteNonNegative(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function safeReadStats() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!value || typeof value !== "object") return defaultStats();
      const completed = {};
      if (value.completed && typeof value.completed === "object") {
        Object.keys(SCENARIOS).forEach((id) => { completed[id] = finiteNonNegative(value.completed[id]); });
      }
      return {
        played: finiteNonNegative(value.played), wins: finiteNonNegative(value.wins),
        bestScore: finiteNonNegative(value.bestScore), delivered: finiteNonNegative(value.delivered),
        completed, tutorialSeen: value.tutorialSeen === true
      };
    } catch (_) { return defaultStats(); }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Persistence is optional. */ }
  }

  function ensureStyles() {
    const url = SCRIPT_URL ? new URL("../../css/pipeline-factory.css", SCRIPT_URL).href : "css/pipeline-factory.css";
    styleNode = document.getElementById(STYLE_ID) || document.querySelector("link[data-pipeline-factory-style]") || Array.from(document.styleSheets || []).map((sheet) => sheet.ownerNode).find((node) => node && node.href === url);
    styleOwned = false;
    if (!styleNode) {
      styleNode = document.createElement("link");
      styleNode.id = STYLE_ID;
      styleNode.rel = "stylesheet";
      styleNode.dataset.pipelineFactoryStyle = "";
      styleNode.href = url;
      document.head.appendChild(styleNode);
      styleOwned = true;
    }
  }

  function format(value, digits) {
    return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: digits === undefined ? 0 : digits, minimumFractionDigits: digits === undefined ? 0 : digits });
  }

  function iconSvg(type) {
    const paths = {
      stream: '<path d="M4 7c3-3 5 3 8 0s5 3 8 0M4 12c3-3 5 3 8 0s5 3 8 0M4 17c3-3 5 3 8 0s5 3 8 0"/>',
      queue: '<rect x="4" y="5" width="16" height="4" rx="2"/><rect x="4" y="11" width="13" height="4" rx="2"/><rect x="4" y="17" width="9" height="4" rx="2"/>',
      route: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4c3 0 3-6 6-6M11 12c3 0 3 6 6 6"/>',
      bolt: '<path d="m13 2-7 11h5l-1 9 8-12h-5Z"/>',
      steps: '<path d="M4 18h5v-4h5v-4h6M5 6h3m4 0h3m4 0h1"/>',
      bucket: '<path d="M5 7h14l-1 13H6Z"/><path d="M8 7V5c0-2 8-2 8 0v2"/>',
      spark: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/>',
      table: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v14c0 1.7 14 1.7 14 0V5M5 12c0 1.7 14 1.7 14 0"/>',
      warehouse: '<path d="M4 20V8l8-5 8 5v12ZM8 20v-7h8v7M8 9h.01M12 9h.01M16 9h.01"/>',
      pulse: '<circle cx="12" cy="12" r="9"/><path d="M3 12h4l2-5 4 10 2-5h6"/>',
      key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.stream}</svg>`;
  }

  function shellMarkup() {
    return `<section class="pipeline-factory-shell" aria-label="Data Pipeline Factory">
      <header class="pf-header">
        <div class="pf-brand"><span class="pf-brand-mark">${iconSvg("route")}</span><div><small>EVENT-DRIVEN ARCHITECTURE LAB</small><h1>Data Pipeline <b>Factory</b></h1></div></div>
        <div class="pf-header-actions">
          <button type="button" data-pf-action="menu" aria-label="Escenarios"><span>▦</span><b>Escenarios</b></button>
          <button type="button" data-pf-action="help" aria-label="Abrir tutorial"><span>?</span><b>Tutorial</b></button>
          <button type="button" data-pf-action="exit" aria-label="Salir"><span>×</span><b>Salir</b></button>
        </div>
      </header>
      <div class="pf-metrics" aria-label="Métricas de la tubería">
        <div><span>THROUGHPUT</span><strong id="pf-throughput">0 evt/s</strong><small id="pf-throughput-target">objetivo —</small></div>
        <div><span>LATENCIA AVG</span><strong id="pf-latency">—</strong><small id="pf-latency-target">objetivo —</small></div>
        <div><span>EN COLA</span><strong id="pf-queue">0</strong><small id="pf-loss">0% pérdida</small></div>
        <div><span>COSTO</span><strong id="pf-cost">$0</strong><small id="pf-budget">de $0</small></div>
        <div><span>OBSERVADOS</span><strong id="pf-observed">0%</strong><small id="pf-encrypted">0% cifrados</small></div>
        <div><span>TIEMPO</span><strong id="pf-time">0:00</strong><small id="pf-phase">BUILD</small></div>
      </div>
      <div class="pf-workspace">
        <aside class="pf-palette" aria-label="Catálogo de servicios">
          <div class="pf-panel-heading"><span>BUILD PALETTE</span><strong>Servicios AWS</strong><small>Selecciona y coloca en un slot</small></div>
          <div class="pf-service-list">${Object.entries(SERVICES).map(([id, service], index) => `<button type="button" class="pf-service" data-pf-service="${id}" style="--service:${service.color}" aria-pressed="false"><span class="pf-service-icon">${iconSvg(service.icon)}</span><span><strong>${service.name}</strong><small>${service.pitch}</small></span><b><kbd>${index < 9 ? index + 1 : ""}</kbd><em>$${service.cost}</em></b></button>`).join("")}</div>
        </aside>
        <main class="pf-stage-wrap">
          <div class="pf-stage-scroll">
            <div class="pf-stage" id="pf-stage" aria-label="Editor visual de topología">
              <div class="pf-grid" aria-hidden="true"></div>
              <svg class="pf-edges" id="pf-edges" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-label="Conexiones dirigidas"></svg>
              <div id="pf-tokens" class="pf-tokens" aria-hidden="true"></div>
              <div id="pf-nodes" class="pf-nodes"></div>
              <div id="pf-slots" class="pf-slots"></div>
              <div class="pf-stage-label"><span><i></i> <b id="pf-scenario-label">Selecciona un escenario</b></span><em id="pf-incident-label"></em></div>
              <div id="pf-toast" class="pf-toast" role="status" aria-live="polite"></div>
            </div>
          </div>
          <div class="pf-controls" aria-label="Controles de simulación">
            <div class="pf-control-group">
              <button type="button" data-pf-action="build"><span>⌘</span><b>Build</b></button>
              <button class="is-primary" type="button" data-pf-action="run"><span>▶</span><b>Run</b></button>
              <button type="button" data-pf-action="pause"><span>Ⅱ</span><b>Pause</b></button>
              <button type="button" data-pf-action="reset"><span>↺</span><b>Reset</b></button>
            </div>
            <div class="pf-control-group pf-speed" role="group" aria-label="Velocidad"><button type="button" data-pf-speed="1">1×</button><button type="button" data-pf-speed="2">2×</button><button type="button" data-pf-speed="3">3×</button></div>
            <button type="button" class="pf-validate" data-pf-action="validate">Validar arquitectura</button>
          </div>
        </main>
        <aside class="pf-inspector" aria-label="Inspector de topología">
          <div class="pf-panel-heading"><span>INSPECTOR</span><strong id="pf-inspector-title">Arquitectura</strong><small id="pf-inspector-kicker">Sin selección</small></div>
          <div class="pf-inspector-body" id="pf-inspector-body"></div>
        </aside>
      </div>
      <footer class="pf-helpbar"><span><kbd>1–9</kbd> servicio</span><span><kbd>C</kbd> conectar</span><span><kbd>U</kbd> mejorar</span><span><kbd>Del</kbd> vender / borrar</span><span><kbd>Space</kbd> run / pausa</span><span>Click en una línea para eliminarla</span></footer>
      <div id="pf-overlay" class="pf-overlay"></div>
      <div class="pf-announcer" aria-live="polite" id="pf-announcer"></div>
    </section>`;
  }

  function scenarioMenuMarkup() {
    const stats = safeReadStats();
    return `<div class="pf-menu">
      <div class="pf-menu-heading"><span>PIPELINE CONTROL PLANE</span><h2>Diseña el camino de cada evento</h2><p>Construye un grafo dirigido. Las colas, transformaciones, cifrado y destinos cambian el resultado real de cada batch.</p></div>
      <div class="pf-scenario-grid">${Object.entries(SCENARIOS).map(([id, scenario]) => {
        const best = stats.completed[id];
        return `<button type="button" class="pf-scenario-card ${scenario.sandbox || scenario.incident ? "is-special" : ""}" data-pf-scenario="${id}"><span class="pf-scenario-icon">${scenario.icon}</span><span class="pf-scenario-copy"><small>${scenario.mode}</small><strong>${scenario.name}</strong><p>${scenario.description}</p></span><span class="pf-scenario-meta"><b>${scenario.rate} EVT/S · $${scenario.budget}</b><em>${best ? `✓ ${format(best)} pts` : "Diseñar →"}</em></span></button>`;
      }).join("")}</div>
      <div class="pf-menu-footer"><span>Partidas: <b>${format(stats.played)}</b></span><span>Victorias: <b>${format(stats.wins)}</b></span><span>Récord: <b>${format(stats.bestScore)}</b></span><button type="button" data-pf-action="exit">← Volver al centro</button></div>
    </div>`;
  }

  function tutorialMarkup() {
    return `<div class="pf-dialog pf-tutorial"><span class="pf-dialog-icon">${iconSvg("route")}</span><small>QUICK START · 60 SEGUNDOS</small><h2>Del evento al resultado</h2><div class="pf-guide-grid"><p><b>1 · Coloca</b> Elige servicios y toca slots. La fuente y el destino ya están fijados.</p><p><b>2 · Conecta</b> Selecciona un nodo, pulsa Conectar y elige el siguiente. Las flechas marcan el flujo.</p><p><b>3 · Ejecuta</b> Los batches recorren el grafo. Observa colas, pérdida, latencia y costo operativo.</p><p><b>4 · Cumple</b> El destino exige capacidades. Cifra datos sensibles y añade CloudWatch cuando corresponda.</p></div><p class="pf-tip">No existe una única respuesta. Paraleliza rutas, usa buffers o mejora cuellos de botella.</p><button class="pf-primary" type="button" data-pf-action="close-help">Empezar a construir</button></div>`;
  }

  function createState(scenarioId) {
    const scenario = SCENARIOS[scenarioId];
    const incident = scenario.incident ? INCIDENTS[Math.floor(Math.random() * INCIDENTS.length)] : null;
    return {
      scenarioId, scenario, incident, phase: "building", resumePhase: "building", nodes: [], edges: [], selectedNode: null,
      selectedEdge: null, selectedService: null, connectingFrom: null, cash: scenario.budget, opCost: 0, speed: 1,
      elapsed: 0, sourceElapsed: 0, emitClock: 0, generated: 0, delivered: 0, lost: 0, correctDestination: 0,
      transformed: 0, encrypted: 0, observed: 0, validated: 0, latencyTotal: 0, batchesDelivered: 0,
      transfers: [], rr: {}, started: false, finished: false, statsCommitted: false, toastUntil: 0, lastHud: 0,
      sourceStopped: false, savedPhase: null
    };
  }

  function restoreSavedDesign(target) {
    try {
      const saved = JSON.parse(localStorage.getItem(DESIGN_KEY));
      if (!saved || saved.scenarioId !== target.scenarioId || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) return false;
      const slots = new Set();
      const ids = new Set(["source", "target"]);
      let spent = 0;
      saved.nodes.slice(0, SLOT_POSITIONS.length).forEach((item) => {
        if (!item || !SERVICES[item.serviceId] || !Number.isInteger(item.slot) || item.slot < 0 || item.slot >= SLOT_POSITIONS.length || slots.has(item.slot) || typeof item.id !== "string" || !/^n[a-z0-9]+$/i.test(item.id) || ids.has(item.id)) return;
        const level = Math.min(3, Math.max(1, Math.floor(Number(item.level) || 1)));
        const service = SERVICES[item.serviceId];
        const nodeCost = service.cost + Array.from({ length: level - 1 }).reduce((sum, _, index) => sum + Math.round(service.cost * (.75 + index * .2)), 0);
        if (spent + nodeCost > target.scenario.budget) return;
        spent += nodeCost;
        slots.add(item.slot);
        ids.add(item.id);
        target.nodes.push({ id: item.id, serviceId: item.serviceId, slot: item.slot, level, queue: [], credit: 0, processed: 0 });
      });
      const pairs = new Set();
      saved.edges.forEach((edge) => {
        if (!edge || typeof edge.id !== "string" || !/^e[a-z0-9]+$/i.test(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || edge.from === "target" || edge.to === "source") return;
        const pair = `${edge.from}>${edge.to}`;
        if (pairs.has(pair)) return;
        pairs.add(pair);
        target.edges.push({ id: edge.id, from: edge.from, to: edge.to });
      });
      target.cash -= spent;
      return target.nodes.length > 0;
    } catch (_) { return false; }
  }

  function startScenario(id, restore) {
    if (!SCENARIOS[id]) return;
    state = createState(id);
    if (restore !== false && restoreSavedDesign(state)) toast("Diseño guardado restaurado.");
    batchSequence = 0;
    refs.overlay.hidden = true;
    refs.overlay.className = "pf-overlay";
    renderBoard();
    updateServiceSelection();
    updateInspector();
    updateHud();
    saveDesignSoon();
    const stats = safeReadStats();
    if (!stats.tutorialSeen) showHelp();
    else toast("Construye la topología. Conecta SOURCE con TARGET.");
  }

  function showMenu() {
    if (!refs.overlay) return;
    if (state && ["running", "draining"].includes(state.phase)) pause(true);
    refs.overlay.hidden = false;
    refs.overlay.className = "pf-overlay is-menu";
    refs.overlay.innerHTML = scenarioMenuMarkup();
  }

  function showHelp() {
    if (!state) {
      refs.overlay.hidden = false;
      refs.overlay.className = "pf-overlay";
      refs.overlay.innerHTML = tutorialMarkup();
      return;
    }
    state.resumePhase = state.phase === "running" || state.phase === "draining" ? "paused" : state.phase;
    if (state.phase === "running" || state.phase === "draining") state.phase = "paused";
    refs.overlay.hidden = false;
    refs.overlay.className = "pf-overlay";
    refs.overlay.innerHTML = tutorialMarkup();
    updateHud();
  }

  function closeHelp() {
    const stats = safeReadStats();
    stats.tutorialSeen = true;
    saveStats(stats);
    refs.overlay.hidden = true;
    refs.overlay.innerHTML = "";
    if (state && state.phase === "paused" && state.resumePhase === "building") state.phase = "building";
    updateHud();
  }

  function serviceEffectLabel(effect) {
    return { streamed: "stream", durable: "durable", routed: "routing", transformed: "transformado", validated: "validado", stored: "S3-ready", indexed: "indexado", warehoused: "warehouse-ready", observed: "observado", encrypted: "cifrado" }[effect] || effect;
  }

  function destinationLabel() {
    if (!state) return "TARGET";
    return { s3: "S3 DATA LAKE", redshift: "REDSHIFT DWH", dynamodb: "DYNAMODB APP" }[state.scenario.destination] || state.scenario.destination.toUpperCase();
  }

  function nodeById(id) {
    return state && state.nodes.find((node) => node.id === id);
  }

  function serviceForNode(id) {
    const node = nodeById(id);
    return node ? SERVICES[node.serviceId] : null;
  }

  function endpointPosition(id) {
    if (id === "source") return { x: 7, y: 50 };
    if (id === "target") return { x: 93, y: 50 };
    const node = nodeById(id);
    if (!node) return { x: 50, y: 50 };
    return { x: SLOT_POSITIONS[node.slot][0], y: SLOT_POSITIONS[node.slot][1] };
  }

  function nodeMarkup(id, x, y, fixed) {
    if (fixed === "source") return `<button type="button" class="pf-node pf-fixed pf-source ${state.selectedNode === "source" ? "is-selected" : ""}" data-pf-node="source" style="--x:${x}%;--y:${y}%" aria-pressed="${state.selectedNode === "source"}"><span class="pf-node-icon">⇥</span><strong>SOURCE</strong><small>${state.scenario.rate} evt/s</small><i></i></button>`;
    if (fixed === "target") return `<button type="button" class="pf-node pf-fixed pf-target ${state.selectedNode === "target" ? "is-selected" : ""}" data-pf-node="target" style="--x:${x}%;--y:${y}%" aria-pressed="${state.selectedNode === "target"}"><span class="pf-node-icon">✓</span><strong>${destinationLabel()}</strong><small>destination</small><i></i></button>`;
    const node = nodeById(id);
    const service = SERVICES[node.serviceId];
    const queue = queueSize(node);
    return `<button type="button" class="pf-node ${state.selectedNode === id ? "is-selected" : ""} ${queue > effectiveQueue(node) * .7 ? "is-hot" : ""}" data-pf-node="${id}" style="--x:${x}%;--y:${y}%;--service:${service.color}" aria-pressed="${state.selectedNode === id}"><span class="pf-node-icon">${iconSvg(service.icon)}</span><strong>${service.short}</strong><small>LV ${node.level} · Q <b data-pf-node-queue="${id}">${format(queue)}</b></small><i></i></button>`;
  }

  function renderBoard() {
    if (!state || !refs.nodes) return;
    refs.nodes.innerHTML = nodeMarkup("source", 7, 50, "source") + state.nodes.map((node) => {
      const position = endpointPosition(node.id);
      return nodeMarkup(node.id, position.x, position.y);
    }).join("") + nodeMarkup("target", 93, 50, "target");
    const occupied = new Set(state.nodes.map((node) => node.slot));
    refs.slots.innerHTML = SLOT_POSITIONS.map((position, slot) => occupied.has(slot) ? "" : `<button type="button" class="pf-slot ${state.selectedService ? "is-ready" : ""}" data-pf-slot="${slot}" style="--x:${position[0]}%;--y:${position[1]}%" aria-label="Slot vacío ${slot + 1}"><span>＋</span><small>${state.selectedService ? SERVICES[state.selectedService].short : "SLOT"}</small></button>`).join("");
    renderEdges();
    refs.scenarioLabel.textContent = `${state.scenario.mode} · ${state.scenario.name}`;
    refs.incidentLabel.textContent = state.incident ? `SEV-1: ${state.incident.name}` : "";
  }

  function renderEdges() {
    if (!state || !refs.edges) return;
    refs.edges.innerHTML = state.edges.map((edge) => {
      const from = endpointPosition(edge.from);
      const to = endpointPosition(edge.to);
      const x1 = from.x * 10;
      const y1 = from.y * 6;
      const x2 = to.x * 10;
      const y2 = to.y * 6;
      const curve = Math.max(36, Math.abs(x2 - x1) * .38);
      const d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
      const selected = state.selectedEdge === edge.id ? "is-selected" : "";
      return `<path class="pf-edge-hit" data-pf-edge="${edge.id}" d="${d}"/><path class="pf-edge ${selected}" data-edge-line="${edge.id}" d="${d}" marker-end="url(#pf-arrow)"/>`;
    }).join("") + '<defs><marker id="pf-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z"/></marker></defs>';
  }

  function canEdit() {
    return state && ["building", "paused"].includes(state.phase) && !state.finished;
  }

  function selectService(id) {
    if (!state || !SERVICES[id]) return;
    if (!canEdit()) { toast("Pausa la simulación para editar la arquitectura."); return; }
    state.selectedService = state.selectedService === id ? null : id;
    state.selectedNode = null;
    state.selectedEdge = null;
    state.connectingFrom = null;
    updateServiceSelection();
    renderBoard();
    updateInspector();
  }

  function placeService(slot) {
    if (!state || !state.selectedService || !canEdit()) { toast("Selecciona un servicio de la paleta."); return; }
    if (state.nodes.some((node) => node.slot === slot)) return;
    const service = SERVICES[state.selectedService];
    if (state.cash < service.cost) { toast(`Presupuesto insuficiente: ${service.name} cuesta $${service.cost}.`, true); return; }
    const node = { id: `n${Date.now().toString(36)}${slot}`, serviceId: state.selectedService, slot, level: 1, queue: [], credit: 0, processed: 0 };
    state.nodes.push(node);
    state.cash -= service.cost;
    state.selectedNode = node.id;
    state.selectedService = null;
    toast(`${service.name} desplegado. Ahora conecta el flujo.`);
    architectureChanged();
  }

  function selectNode(id) {
    if (!state || (id !== "source" && id !== "target" && !nodeById(id))) return;
    if (state.connectingFrom) {
      addEdge(state.connectingFrom, id);
      return;
    }
    state.selectedNode = id;
    state.selectedEdge = null;
    state.selectedService = null;
    updateServiceSelection();
    renderBoard();
    updateInspector();
  }

  function beginConnect() {
    if (!state || !state.selectedNode || !canEdit()) { toast("Selecciona un nodo y pausa antes de conectar."); return; }
    if (state.selectedNode === "target") { toast("TARGET no puede iniciar una conexión.", true); return; }
    state.connectingFrom = state.selectedNode;
    toast("Selecciona el nodo de destino. ESC cancela.");
    updateInspector();
    renderBoard();
  }

  function addEdge(from, to) {
    state.connectingFrom = null;
    if (!canEdit()) return;
    if (from === to || to === "source" || from === "target") { toast("Esa dirección no es válida.", true); updateInspector(); return; }
    if (state.edges.some((edge) => edge.from === from && edge.to === to)) { toast("La conexión ya existe.", true); updateInspector(); return; }
    const edge = { id: `e${Date.now().toString(36)}${state.edges.length}`, from, to };
    state.edges.push(edge);
    state.selectedEdge = edge.id;
    state.selectedNode = null;
    toast("Conexión dirigida creada.");
    architectureChanged();
  }

  function selectEdge(id) {
    if (!state || !state.edges.some((edge) => edge.id === id)) return;
    state.selectedEdge = id;
    state.selectedNode = null;
    state.selectedService = null;
    state.connectingFrom = null;
    updateServiceSelection();
    renderBoard();
    updateInspector();
  }

  function deleteSelectedEdge() {
    if (!state || !state.selectedEdge || !canEdit()) return;
    state.edges = state.edges.filter((edge) => edge.id !== state.selectedEdge);
    state.selectedEdge = null;
    toast("Conexión eliminada.");
    architectureChanged();
  }

  function upgradeNode() {
    const node = state && nodeById(state.selectedNode);
    if (!node || !canEdit()) return;
    if (node.level >= 3) { toast("El nodo ya está al máximo."); return; }
    const service = SERVICES[node.serviceId];
    const price = Math.round(service.cost * (.55 + node.level * .2));
    if (state.cash < price) { toast(`Necesitas $${price} para mejorar.`, true); return; }
    node.level += 1;
    state.cash -= price;
    toast(`${service.name} mejorado a nivel ${node.level}.`);
    architectureChanged();
  }

  function sellNode() {
    const node = state && nodeById(state.selectedNode);
    if (!node || !canEdit()) return;
    const service = SERVICES[node.serviceId];
    const invested = service.cost + Array.from({ length: node.level - 1 }).reduce((sum, _, index) => sum + Math.round(service.cost * (.75 + index * .2)), 0);
    const refund = Math.round(invested * .6);
    state.cash += refund;
    state.nodes = state.nodes.filter((item) => item.id !== node.id);
    state.edges = state.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    state.selectedNode = null;
    toast(`${service.name} vendido por $${refund}.`);
    architectureChanged();
  }

  function architectureChanged() {
    saveDesignSoon();
    renderBoard();
    updateServiceSelection();
    updateInspector();
    updateHud();
  }

  function effectiveCapacity(node) {
    const service = SERVICES[node.serviceId];
    let capacity = service.capacity * (1 + (node.level - 1) * .55);
    if (state.incident && state.incident.id === "lambda" && node.serviceId === "lambda") capacity *= .45;
    if (node.serviceId === "kinesis" && queueSize(node) > service.queue * .35) capacity *= 1.18;
    return capacity;
  }

  function effectiveQueue(node) {
    const service = SERVICES[node.serviceId];
    return service.queue * (1 + (node.level - 1) * .45);
  }

  function effectiveLatency(node) {
    const service = SERVICES[node.serviceId];
    return service.latency / (1 + (node.level - 1) * .18);
  }

  function queueSize(node) {
    return node.queue.reduce((sum, batch) => sum + batch.count, 0);
  }

  function totalQueued() {
    if (!state) return 0;
    return state.nodes.reduce((sum, node) => sum + queueSize(node), 0) + state.transfers.reduce((sum, transfer) => sum + transfer.batch.count, 0);
  }

  function outgoing(id) {
    return state.edges.filter((edge) => edge.from === id);
  }

  function pathExists() {
    if (!state) return false;
    const seen = new Set();
    const pending = ["source"];
    while (pending.length) {
      const current = pending.shift();
      if (current === "target") return true;
      if (seen.has(current)) continue;
      seen.add(current);
      outgoing(current).forEach((edge) => pending.push(edge.to));
    }
    return false;
  }

  function saveDesignSoon() {
    if (!state) return;
    try {
      localStorage.setItem(DESIGN_KEY, JSON.stringify({ scenarioId: state.scenarioId, nodes: state.nodes.map(({ id, serviceId, slot, level }) => ({ id, serviceId, slot, level })), edges: state.edges.map(({ id, from, to }) => ({ id, from, to })) }));
    } catch (_) { /* Persistence is optional. */ }
  }

  function startRun() {
    if (!state || state.finished) return;
    if (state.phase === "running" || state.phase === "draining") return;
    if (!pathExists()) { toast("No existe una ruta completa SOURCE → TARGET.", true); updateInspector(); return; }
    if (!state.started) {
      state.started = true;
      const stats = safeReadStats();
      stats.played += 1;
      saveStats(stats);
    }
    state.phase = state.sourceStopped ? "draining" : "running";
    state.resumePhase = state.phase;
    toast("Pipeline activo: los batches ya están fluyendo.");
    updateHud();
  }

  function pause(force) {
    if (!state || state.finished) return;
    if (["running", "draining"].includes(state.phase)) {
      state.savedPhase = state.phase;
      state.phase = "paused";
      if (!force) toast("Simulación pausada. Puedes editar la topología.");
    } else if (state.phase === "paused" && !force) {
      state.phase = state.savedPhase || (state.sourceStopped ? "draining" : "running");
    }
    updateHud();
  }

  function buildMode() {
    if (!state || state.finished) return;
    if (["running", "draining"].includes(state.phase)) {
      state.savedPhase = state.phase;
      state.phase = "paused";
    } else if (!state.started) state.phase = "building";
    toast("Modo de edición activo.");
    updateHud();
  }

  function resetScenario() {
    if (!state) return;
    const id = state.scenarioId;
    try { localStorage.removeItem(DESIGN_KEY); } catch (_) { /* Persistence is optional. */ }
    startScenario(id, false);
    toast("Escenario reiniciado con una arquitectura vacía.");
  }

  function setSpeed(speed) {
    if (!state || ![1, 2, 3].includes(speed)) return;
    state.speed = speed;
    updateHud();
  }

  function cloneBatch(batch, count) {
    return { id: ++batchSequence, lineage: batch.lineage, count, born: batch.born, hops: batch.hops, props: { ...batch.props } };
  }

  function emitBatch() {
    let rate = state.scenario.rate;
    if (state.scenario.burst && Math.sin(state.sourceElapsed * .8) > .35) rate *= state.scenario.burst;
    if (state.incident && state.incident.id === "spike" && state.sourceElapsed >= 9 && state.sourceElapsed <= 18) rate *= 3;
    const interval = .25;
    const count = Math.max(1, Math.round(rate * interval));
    const id = ++batchSequence;
    const batch = { id, lineage: id, count, born: state.elapsed, hops: 0, props: { sensitive: state.scenario.sensitive, transformed: false, encrypted: false, observed: false, validated: false, stored: false, indexed: false, warehoused: false, durable: false, streamed: false, routed: false } };
    state.generated += count;
    routeBatch("source", batch);
  }

  function recordLoss(count) {
    state.lost += Math.max(0, count);
  }

  function routeBatch(fromId, batch) {
    if (batch.hops > 18) { recordLoss(batch.count); return; }
    const edges = outgoing(fromId);
    if (!edges.length) { recordLoss(batch.count); return; }
    const service = serviceForNode(fromId);
    if (service && service.effect === "routed" && edges.length > 1) {
      let remaining = batch.count;
      edges.forEach((edge, index) => {
        const count = index === edges.length - 1 ? remaining : Math.max(1, Math.floor(batch.count / edges.length));
        remaining -= count;
        if (count > 0) launchTransfer(edge, cloneBatch(batch, count));
      });
      return;
    }
    const key = fromId;
    const index = state.rr[key] || 0;
    const sorted = edges.slice().sort((a, b) => targetLoad(a.to) - targetLoad(b.to));
    const edge = sorted[index % sorted.length];
    state.rr[key] = index + 1;
    launchTransfer(edge, batch);
  }

  function targetLoad(id) {
    if (id === "target") return 0;
    const node = nodeById(id);
    return node ? queueSize(node) / effectiveQueue(node) : 999;
  }

  function launchTransfer(edge, batch) {
    const from = endpointPosition(edge.from);
    const to = endpointPosition(edge.to);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    state.transfers.push({ edgeId: edge.id, from: edge.from, to: edge.to, batch, progress: 0, duration: .1 + distance * .006 });
  }

  function receiveBatch(targetId, batch) {
    if (state.incident && state.incident.id === "network" && Math.random() < .04) { recordLoss(batch.count); return; }
    if (targetId === "target") { deliverBatch(batch); return; }
    const node = nodeById(targetId);
    if (!node) { recordLoss(batch.count); return; }
    const available = Math.max(0, Math.floor(effectiveQueue(node) - queueSize(node)));
    if (available <= 0) { recordLoss(batch.count); return; }
    if (available < batch.count) {
      recordLoss(batch.count - available);
      batch.count = available;
    }
    batch.readyAt = state.elapsed + effectiveLatency(node);
    node.queue.push(batch);
  }

  function applyService(node, batch) {
    const service = SERVICES[node.serviceId];
    const poisonMultiplier = state.incident && state.incident.id === "poison" && !state.nodes.some((item) => item.serviceId === "sqs") ? 6 : 1;
    const failChance = (service.loss || 0) * poisonMultiplier;
    if (failChance && Math.random() < failChance) { recordLoss(batch.count); return false; }
    batch.props[service.effect] = true;
    if (node.serviceId === "stepfunctions") batch.props.transformed = true;
    if (node.serviceId === "glue") { batch.props.transformed = true; batch.props.validated = true; }
    if (node.serviceId === "sqs") batch.props.durable = true;
    batch.hops += 1;
    return true;
  }

  function processNodes(dt) {
    state.nodes.forEach((node) => {
      const service = SERVICES[node.serviceId];
      state.opCost += service.op * node.level * dt / 10;
      node.credit = Math.min(effectiveCapacity(node) * 2, node.credit + effectiveCapacity(node) * dt);
      let guard = 0;
      while (node.queue.length && guard < 12) {
        const batch = node.queue[0];
        if (batch.readyAt > state.elapsed || node.credit < batch.count) break;
        node.queue.shift();
        node.credit -= batch.count;
        node.processed += batch.count;
        if (applyService(node, batch)) routeBatch(node.id, batch);
        guard += 1;
      }
    });
  }

  function processTransfers(dt) {
    const completed = [];
    state.transfers.forEach((transfer) => {
      transfer.progress += dt / transfer.duration;
      if (transfer.progress >= 1) completed.push(transfer);
    });
    if (completed.length) {
      const ids = new Set(completed);
      state.transfers = state.transfers.filter((transfer) => !ids.has(transfer));
      completed.forEach((transfer) => receiveBatch(transfer.to, transfer.batch));
    }
  }

  function deliverBatch(batch) {
    const count = batch.count;
    state.delivered += count;
    state.batchesDelivered += 1;
    state.latencyTotal += Math.max(0, state.elapsed - batch.born) * count;
    if (batch.props.transformed) state.transformed += count;
    if (batch.props.encrypted) state.encrypted += count;
    if (batch.props.observed) state.observed += count;
    if (batch.props.validated) state.validated += count;
    const property = { s3: "stored", redshift: "warehoused", dynamodb: "indexed" }[state.scenario.destination];
    if (batch.props[property]) state.correctDestination += count;
  }

  function updateSimulation(dt) {
    if (!state || !["running", "draining"].includes(state.phase) || state.finished) return;
    state.elapsed += dt;
    if (!state.sourceStopped) {
      state.sourceElapsed += dt;
      state.emitClock += dt;
      while (state.emitClock >= .25) { state.emitClock -= .25; emitBatch(); }
      if (Number.isFinite(state.scenario.duration) && state.sourceElapsed >= state.scenario.duration) {
        state.sourceStopped = true;
        state.phase = "draining";
        toast("Fuente detenida. Drenando queues pendientes.");
      }
    }
    processTransfers(dt);
    processNodes(dt);
    if (state.phase === "draining" && (totalQueued() === 0 || state.sourceElapsed + 9 < state.elapsed)) finishGame();
  }

  function ratio(value) {
    return state && state.delivered ? value / state.delivered * 100 : 0;
  }

  function averageLatency() {
    return state && state.delivered ? state.latencyTotal / state.delivered : Infinity;
  }

  function throughput() {
    return state && state.sourceElapsed > 0 ? state.delivered / state.sourceElapsed : 0;
  }

  function lossPercent() {
    return state && state.generated ? state.lost / state.generated * 100 : 0;
  }

  function totalCost() {
    return state ? state.scenario.budget - state.cash + state.opCost : 0;
  }

  function evaluate() {
    if (!state) return [];
    const scenario = state.scenario;
    const enoughData = state.generated >= Math.max(40, scenario.rate * 3);
    const checks = [
      { id: "data", label: "Muestra suficiente", pass: enoughData, value: `${format(state.generated)} eventos`, target: `≥ ${format(scenario.rate * 3)}` },
      { id: "throughput", label: "Throughput", pass: throughput() >= scenario.throughput, value: `${format(throughput(), 1)} evt/s`, target: `≥ ${scenario.throughput}` },
      { id: "latency", label: "Latencia promedio", pass: averageLatency() <= scenario.latency, value: Number.isFinite(averageLatency()) ? `${format(averageLatency(), 2)} s` : "sin entregas", target: `≤ ${scenario.latency} s` },
      { id: "loss", label: "Pérdida", pass: lossPercent() <= scenario.maxLoss, value: `${format(lossPercent(), 1)}%`, target: `≤ ${scenario.maxLoss}%` },
      { id: "destination", label: `Destino ${scenario.destination.toUpperCase()}`, pass: ratio(state.correctDestination) >= 95, value: `${format(ratio(state.correctDestination), 0)}%`, target: "≥ 95%" },
      { id: "budget", label: "Presupuesto", pass: totalCost() <= scenario.budget, value: `$${format(totalCost())}`, target: `≤ $${scenario.budget}` }
    ];
    if (scenario.transform) checks.push({ id: "transform", label: "Transformación", pass: ratio(state.transformed) >= 90, value: `${format(ratio(state.transformed), 0)}%`, target: "≥ 90%" });
    if (scenario.encrypt) checks.push({ id: "encrypt", label: "Cifrado sensible", pass: ratio(state.encrypted) >= 95, value: `${format(ratio(state.encrypted), 0)}%`, target: "≥ 95%" });
    if (scenario.observe) checks.push({ id: "observe", label: "Observabilidad", pass: ratio(state.observed) >= 85, value: `${format(ratio(state.observed), 0)}%`, target: "≥ 85%" });
    if (scenario.requireValidated) checks.push({ id: "validated", label: "Validación", pass: ratio(state.validated) >= 90, value: `${format(ratio(state.validated), 0)}%`, target: "≥ 90%" });
    return checks;
  }

  function diagnostics(checks) {
    if (!state) return [];
    const issues = [];
    if (!pathExists()) issues.push("No hay una ruta completa desde SOURCE hasta TARGET.");
    if (!state.edges.some((edge) => edge.to === "target")) issues.push("TARGET no tiene ninguna conexión entrante.");
    if (state.edges.some((edge) => edge.from !== "target" && !outgoing(edge.to).length && edge.to !== "target")) issues.push("Hay una rama muerta que descarta batches.");
    const hot = state.nodes.filter((node) => queueSize(node) > effectiveQueue(node) * .55).sort((a, b) => queueSize(b) - queueSize(a))[0];
    if (hot) issues.push(`${SERVICES[hot.serviceId].name} es un cuello de botella: mejora el nodo o paraleliza la ruta.`);
    if (checks.some((check) => check.id === "destination" && !check.pass)) issues.push(`Los batches deben pasar por ${SERVICES[state.scenario.destination].name} antes de TARGET.`);
    if (checks.some((check) => check.id === "encrypt" && !check.pass)) issues.push("Añade KMS a todas las rutas que transportan datos sensibles.");
    if (checks.some((check) => check.id === "transform" && !check.pass)) issues.push("Añade Lambda, Glue o Step Functions a cada ruta de entrega.");
    if (checks.some((check) => check.id === "observe" && !check.pass)) issues.push("CloudWatch debe estar en el camino de al menos 85% de las entregas.");
    if (checks.some((check) => check.id === "validated" && !check.pass)) issues.push("Los pedidos necesitan Step Functions o Glue para quedar validados.");
    if (checks.some((check) => check.id === "throughput" && !check.pass)) issues.push("La capacidad efectiva es baja. Mejora servicios o divide carga con EventBridge.");
    if (checks.some((check) => check.id === "latency" && !check.pass)) issues.push("Reduce saltos, evita servicios lentos o mejora los nodos críticos.");
    if (checks.some((check) => check.id === "loss" && !check.pass)) issues.push("SQS aporta buffer durable; Kinesis absorbe picos y las rutas paralelas elevan capacidad.");
    if (checks.some((check) => check.id === "budget" && !check.pass)) issues.push("El costo operativo superó el presupuesto. Vende capacidad o acorta la ruta.");
    if (!issues.length) issues.push("La arquitectura cumple los objetivos medidos.");
    return Array.from(new Set(issues)).slice(0, 5);
  }

  function scoreFor(checks) {
    const passed = checks.filter((check) => check.pass).length;
    const quality = checks.length ? passed / checks.length : 0;
    const efficiency = Math.max(0, state.scenario.budget - totalCost());
    return Math.max(0, Math.round(state.delivered * 1.6 + quality * 3200 + efficiency * 4 - state.lost * .8 - (Number.isFinite(averageLatency()) ? averageLatency() * 80 : 500)));
  }

  function resultMarkup(won, checks, score, live) {
    const issues = diagnostics(checks);
    return `<div class="pf-dialog pf-result ${won ? "is-win" : "is-loss"}"><span class="pf-dialog-icon">${won ? "✓" : "!"}</span><small>${live ? "ARCHITECTURE REVIEW" : won ? "DEPLOY SUCCEEDED" : "SLO NOT MET"}</small><h2>${won ? "Pipeline aprobado" : live ? "Validación incompleta" : "Arquitectura rechazada"}</h2><p>${won ? "Los datos llegaron con las garantías y el rendimiento exigidos." : "Revisa cada objetivo y ajusta el grafo antes del siguiente despliegue."}</p><div class="pf-result-score"><span><small>SCORE</small><b>${format(score)}</b></span><span><small>ENTREGADOS</small><b>${format(state.delivered)}</b></span><span><small>COSTO</small><b>$${format(totalCost())}</b></span></div><div class="pf-checks">${checks.map((check) => `<div class="${check.pass ? "pass" : "fail"}"><i>${check.pass ? "✓" : "×"}</i><span><b>${check.label}</b><small>${check.value} · meta ${check.target}</small></span></div>`).join("")}</div><div class="pf-diagnostics"><strong>POR QUÉ ${won ? "FUNCIONA" : "FALLA"}</strong>${issues.map((issue) => `<p>${issue}</p>`).join("")}</div><div class="pf-dialog-actions">${live ? '<button class="pf-primary" type="button" data-pf-action="continue">Seguir ajustando</button><button type="button" data-pf-action="reset">Reiniciar</button>' : '<button class="pf-primary" type="button" data-pf-action="reset">Reintentar</button><button type="button" data-pf-action="menu">Escenarios</button>'}</div></div>`;
  }

  function validateArchitecture() {
    if (!state || state.finished) return;
    if (["running", "draining"].includes(state.phase)) pause(true);
    const checks = evaluate();
    const won = checks.length > 0 && checks.every((check) => check.pass);
    const score = scoreFor(checks);
    refs.overlay.hidden = false;
    refs.overlay.className = "pf-overlay";
    refs.overlay.innerHTML = resultMarkup(won, checks, score, true);
  }

  function finishGame() {
    if (!state || state.finished) return;
    state.finished = true;
    state.phase = "finished";
    const checks = evaluate();
    const won = checks.every((check) => check.pass);
    const score = scoreFor(checks);
    if (!state.statsCommitted) {
      state.statsCommitted = true;
      const stats = safeReadStats();
      if (won) stats.wins += 1;
      stats.bestScore = Math.max(stats.bestScore, score);
      stats.delivered += state.delivered;
      if (won && !state.scenario.sandbox) stats.completed[state.scenarioId] = Math.max(stats.completed[state.scenarioId] || 0, score);
      saveStats(stats);
    }
    refs.overlay.hidden = false;
    refs.overlay.className = "pf-overlay";
    refs.overlay.innerHTML = resultMarkup(won, checks, score, false);
    refs.announcer.textContent = won ? `Pipeline aprobado. Puntuación ${score}.` : `Arquitectura rechazada. ${diagnostics(checks)[0]}`;
    updateHud();
  }

  function continueEditing() {
    if (!state) return;
    refs.overlay.hidden = true;
    refs.overlay.innerHTML = "";
    state.phase = "paused";
    updateHud();
  }

  function updateServiceSelection() {
    if (!host || !state) return;
    host.querySelectorAll("[data-pf-service]").forEach((button) => {
      const selected = button.dataset.pfService === state.selectedService;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function architectureSummaryMarkup() {
    const checks = evaluate();
    const issues = diagnostics(checks);
    return `<div class="pf-architecture-summary"><span class="pf-architecture-mark">${iconSvg("route")}</span><p>Construye una ruta desde <b>SOURCE</b> hasta <b>${destinationLabel()}</b>. Cada servicio modifica o limita los batches.</p><dl><div><dt>DESTINO</dt><dd>${SERVICES[state.scenario.destination].name}</dd></div><div><dt>LOAD</dt><dd>${state.scenario.rate} evt/s</dd></div><div><dt>BUDGET</dt><dd>$${format(state.cash)} libre</dd></div><div><dt>GRAFO</dt><dd>${state.nodes.length} nodos · ${state.edges.length} links</dd></div></dl>${state.incident ? `<div class="pf-incident"><span>SEV-1 ACTIVE</span><strong>${state.incident.name}</strong><p>${state.incident.text}</p></div>` : ""}<div class="pf-objectives"><strong>OBJETIVOS</strong>${checks.filter((check) => check.id !== "data").map((check) => `<span class="${state.started ? (check.pass ? "pass" : "fail") : ""}"><i></i>${check.label} <b>${check.target}</b></span>`).join("")}</div><div class="pf-hint"><span>ARCHITECT ADVISOR</span><p>${issues[0]}</p></div></div>`;
  }

  function updateInspector() {
    if (!state || !refs.inspectorBody) return;
    if (state.selectedEdge) {
      const edge = state.edges.find((item) => item.id === state.selectedEdge);
      if (!edge) { state.selectedEdge = null; updateInspector(); return; }
      refs.inspectorTitle.textContent = "Conexión dirigida";
      refs.inspectorKicker.textContent = `${nodeLabel(edge.from)} → ${nodeLabel(edge.to)}`;
      refs.inspectorBody.innerHTML = `<span class="pf-architecture-mark">→</span><p>Los batches viajan en esta dirección. Selecciona la línea o usa el botón para retirarla.</p><dl><div><dt>ORIGEN</dt><dd>${nodeLabel(edge.from)}</dd></div><div><dt>DESTINO</dt><dd>${nodeLabel(edge.to)}</dd></div><div><dt>ESTADO</dt><dd>${canEdit() ? "editable" : "bloqueada"}</dd></div></dl><button class="pf-danger" type="button" data-pf-action="delete-edge" ${canEdit() ? "" : "disabled"}>Eliminar conexión <kbd>DEL</kbd></button>`;
      return;
    }
    if (state.selectedNode) {
      if (state.selectedNode === "source" || state.selectedNode === "target") {
        refs.inspectorTitle.textContent = state.selectedNode === "source" ? "Fuente fija" : "Destino fijo";
        refs.inspectorKicker.textContent = nodeLabel(state.selectedNode);
        refs.inspectorBody.innerHTML = `<span class="pf-architecture-mark">${state.selectedNode === "source" ? "⇥" : "✓"}</span><p>${state.selectedNode === "source" ? `Emite batches a una media de ${state.scenario.rate} eventos por segundo.` : `Recibe el resultado. Los batches deben estar preparados para ${SERVICES[state.scenario.destination].name}.`}</p>${state.selectedNode === "source" ? `<button class="pf-connect" type="button" data-pf-action="connect" ${canEdit() ? "" : "disabled"}>Crear conexión <kbd>C</kbd></button>` : ""}`;
        return;
      }
      const node = nodeById(state.selectedNode);
      const service = node && SERVICES[node.serviceId];
      if (!node || !service) return;
      const upgrade = Math.round(service.cost * (.55 + node.level * .2));
      refs.inspectorTitle.textContent = service.name;
      refs.inspectorKicker.textContent = `NODE ${node.id.slice(-4).toUpperCase()} · LEVEL ${node.level}`;
      refs.inspectorBody.innerHTML = `<span class="pf-inspector-icon" style="--service:${service.color}">${iconSvg(service.icon)}</span><p>${service.pitch}</p><dl><div><dt>CAPACIDAD</dt><dd>${format(effectiveCapacity(node))} evt/s</dd></div><div><dt>LATENCIA</dt><dd>${format(effectiveLatency(node), 2)} s</dd></div><div><dt>QUEUE</dt><dd>${format(queueSize(node))} / ${format(effectiveQueue(node))}</dd></div><div><dt>EFECTO</dt><dd>${serviceEffectLabel(service.effect)}</dd></div></dl><div class="pf-levels">${[1, 2, 3].map((level) => `<i class="${level <= node.level ? "on" : ""}"></i>`).join("")}</div><button class="pf-connect" type="button" data-pf-action="connect" ${canEdit() ? "" : "disabled"}>${state.connectingFrom === node.id ? "Elige destino…" : "Crear conexión"} <kbd>C</kbd></button><button class="pf-upgrade" type="button" data-pf-action="upgrade" ${node.level >= 3 || !canEdit() ? "disabled" : ""}>Mejorar ${node.level < 3 ? `$${upgrade}` : "MAX"} <kbd>U</kbd></button><button class="pf-danger" type="button" data-pf-action="sell" ${canEdit() ? "" : "disabled"}>Vender nodo <kbd>DEL</kbd></button>`;
      return;
    }
    refs.inspectorTitle.textContent = "Arquitectura";
    refs.inspectorKicker.textContent = state.connectingFrom ? "Elige un destino" : "Sin selección";
    refs.inspectorBody.innerHTML = architectureSummaryMarkup();
  }

  function nodeLabel(id) {
    if (id === "source") return "SOURCE";
    if (id === "target") return destinationLabel();
    const node = nodeById(id);
    return node ? SERVICES[node.serviceId].name : "Nodo eliminado";
  }

  function updateHud() {
    if (!state || !refs.throughput) return;
    refs.throughput.textContent = `${format(throughput(), 1)} evt/s`;
    refs.throughputTarget.textContent = `objetivo ≥ ${state.scenario.throughput}`;
    refs.latency.textContent = Number.isFinite(averageLatency()) ? `${format(averageLatency(), 2)} s` : "—";
    refs.latencyTarget.textContent = `objetivo ≤ ${state.scenario.latency} s`;
    refs.queue.textContent = format(totalQueued());
    refs.loss.textContent = `${format(lossPercent(), 1)}% pérdida`;
    refs.cost.textContent = `$${format(totalCost())}`;
    refs.budget.textContent = `de $${state.scenario.budget} · $${format(state.cash)} libre`;
    refs.observed.textContent = `${format(ratio(state.observed), 0)}%`;
    refs.encrypted.textContent = `${format(ratio(state.encrypted), 0)}% cifrados`;
    const shownTime = Number.isFinite(state.scenario.duration) ? Math.max(0, state.scenario.duration - state.sourceElapsed) : state.sourceElapsed;
    refs.time.textContent = `${Math.floor(shownTime / 60)}:${String(Math.floor(shownTime % 60)).padStart(2, "0")}`;
    refs.phase.textContent = state.phase.toUpperCase();
    host.querySelectorAll("[data-pf-speed]").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.pfSpeed) === state.speed));
    const run = host.querySelector('[data-pf-action="run"]');
    const pauseButton = host.querySelector('[data-pf-action="pause"]');
    if (run) run.disabled = state.finished || ["running", "draining"].includes(state.phase);
    if (pauseButton) pauseButton.disabled = state.finished || !state.started;
    state.nodes.forEach((node) => {
      const element = host.querySelector(`[data-pf-node-queue="${node.id}"]`);
      if (element) element.textContent = format(queueSize(node));
      const button = host.querySelector(`[data-pf-node="${node.id}"]`);
      if (button) button.classList.toggle("is-hot", queueSize(node) > effectiveQueue(node) * .7);
    });
  }

  function toast(message, danger) {
    if (!state || !refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.toggle("is-danger", Boolean(danger));
    refs.toast.classList.add("is-visible");
    state.toastUntil = performance.now() + 2800;
  }

  function updateTokens() {
    if (!state || !refs.tokens) return;
    const visible = state.transfers.slice(0, 55);
    refs.tokens.innerHTML = visible.map((transfer) => {
      const from = endpointPosition(transfer.from);
      const to = endpointPosition(transfer.to);
      const t = Math.min(1, transfer.progress);
      const smooth = t * t * (3 - 2 * t);
      const x = from.x + (to.x - from.x) * smooth;
      const y = from.y + (to.y - from.y) * smooth;
      const props = transfer.batch.props;
      const className = props.encrypted ? "is-encrypted" : props.transformed ? "is-transformed" : "";
      return `<i class="pf-token ${className}" style="--x:${x}%;--y:${y}%"><b>${Math.round(transfer.batch.count)}</b></i>`;
    }).join("");
  }

  function handleClick(event) {
    if (!host) return;
    const scenarioButton = event.target.closest("[data-pf-scenario]");
    if (scenarioButton && host.contains(scenarioButton)) { startScenario(scenarioButton.dataset.pfScenario); return; }
    const serviceButton = event.target.closest("[data-pf-service]");
    if (serviceButton && host.contains(serviceButton)) { selectService(serviceButton.dataset.pfService); return; }
    const slotButton = event.target.closest("[data-pf-slot]");
    if (slotButton && host.contains(slotButton)) { placeService(Number(slotButton.dataset.pfSlot)); return; }
    const edge = event.target.closest("[data-pf-edge]");
    if (edge && host.contains(edge)) { selectEdge(edge.dataset.pfEdge); return; }
    const node = event.target.closest("[data-pf-node]");
    if (node && host.contains(node)) { selectNode(node.dataset.pfNode); return; }
    const speedButton = event.target.closest("[data-pf-speed]");
    if (speedButton && host.contains(speedButton)) { setSpeed(Number(speedButton.dataset.pfSpeed)); return; }
    const actionButton = event.target.closest("[data-pf-action]");
    if (!actionButton || !host.contains(actionButton)) return;
    const action = actionButton.dataset.pfAction;
    if (action === "menu") showMenu();
    if (action === "help") showHelp();
    if (action === "close-help") closeHelp();
    if (action === "exit" && exitCallback) exitCallback();
    if (action === "connect") beginConnect();
    if (action === "delete-edge") deleteSelectedEdge();
    if (action === "upgrade") upgradeNode();
    if (action === "sell") sellNode();
    if (action === "run") startRun();
    if (action === "pause") pause(false);
    if (action === "build") buildMode();
    if (action === "reset") resetScenario();
    if (action === "validate") validateArchitecture();
    if (action === "continue") continueEditing();
  }

  function handleKeyDown(event) {
    if (!host || !state || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName && event.target.tagName.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || event.target.isContentEditable) return;
    const key = event.key.toLowerCase();
    const consumed = [" ", "c", "u", "delete", "backspace", "escape", "p", "r", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(key);
    if (consumed) event.preventDefault();
    if (/^[1-9]$/.test(key)) selectService(Object.keys(SERVICES)[Number(key) - 1]);
    if (key === "c") beginConnect();
    if (key === "u") upgradeNode();
    if (key === "delete" || key === "backspace") { if (state.selectedEdge) deleteSelectedEdge(); else sellNode(); }
    if (key === "p") pause(false);
    if (key === "r") resetScenario();
    if (key === " ") { if (["running", "draining"].includes(state.phase)) pause(false); else if (state.phase === "paused" && state.started) pause(false); else startRun(); }
    if (key === "escape") {
      state.connectingFrom = null;
      state.selectedNode = null;
      state.selectedEdge = null;
      state.selectedService = null;
      updateServiceSelection();
      renderBoard();
      updateInspector();
    }
  }

  function handleVisibility() {
    if (document.hidden && state && ["running", "draining"].includes(state.phase)) pause(true);
  }

  function handleResize() {
    if (!state) return;
    renderEdges();
  }

  function frame(time) {
    if (!host) return;
    const rawDt = Math.min(.05, Math.max(0, (time - lastFrame) / 1000 || 0));
    lastFrame = time;
    if (state) {
      updateSimulation(rawDt * state.speed);
      updateTokens();
      if (state.toastUntil && time >= state.toastUntil) {
        refs.toast.classList.remove("is-visible");
        state.toastUntil = 0;
      }
      if (time - state.lastHud > 220) {
        state.lastHud = time;
        updateHud();
      }
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function collectRefs() {
    refs = {
      overlay: host.querySelector("#pf-overlay"), edges: host.querySelector("#pf-edges"), tokens: host.querySelector("#pf-tokens"),
      nodes: host.querySelector("#pf-nodes"), slots: host.querySelector("#pf-slots"), toast: host.querySelector("#pf-toast"),
      scenarioLabel: host.querySelector("#pf-scenario-label"), incidentLabel: host.querySelector("#pf-incident-label"),
      inspectorTitle: host.querySelector("#pf-inspector-title"), inspectorKicker: host.querySelector("#pf-inspector-kicker"), inspectorBody: host.querySelector("#pf-inspector-body"),
      throughput: host.querySelector("#pf-throughput"), throughputTarget: host.querySelector("#pf-throughput-target"),
      latency: host.querySelector("#pf-latency"), latencyTarget: host.querySelector("#pf-latency-target"), queue: host.querySelector("#pf-queue"),
      loss: host.querySelector("#pf-loss"), cost: host.querySelector("#pf-cost"), budget: host.querySelector("#pf-budget"),
      observed: host.querySelector("#pf-observed"), encrypted: host.querySelector("#pf-encrypted"), time: host.querySelector("#pf-time"),
      phase: host.querySelector("#pf-phase"), announcer: host.querySelector("#pf-announcer")
    };
  }

  function mount(container, onExit) {
    destroy();
    if (!container) throw new Error("PipelineFactory.mount requires a container.");
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    host.innerHTML = shellMarkup();
    collectRefs();
    host.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(host.querySelector("#pf-stage"));
    }
    refs.overlay.hidden = false;
    refs.overlay.className = "pf-overlay is-menu";
    refs.overlay.innerHTML = scenarioMenuMarkup();
    lastFrame = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function destroy() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (host) {
      host.removeEventListener("click", handleClick);
      host.innerHTML = "";
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (styleOwned && styleNode && styleNode.parentNode) styleNode.parentNode.removeChild(styleNode);
    styleNode = null;
    styleOwned = false;
    host = null;
    exitCallback = null;
    state = null;
    refs = {};
    lastFrame = 0;
    batchSequence = 0;
  }

  function registerGame() {
    if (!Array.isArray(window.CLOUD_ARCADE_GAMES)) return;
    if (window.CLOUD_ARCADE_GAMES.some((game) => game.id === "pipeline-factory")) return;
    window.CLOUD_ARCADE_GAMES.push({
      id: "pipeline-factory", title: "Data Pipeline Factory", kicker: "Event-Driven Architecture Lab",
      description: "Diseña grafos de datos, mueve batches reales y cumple SLOs de rendimiento, seguridad y costo.",
      status: "available", module: "PipelineFactory", accent: "#a78bfa",
      tags: ["Simulación", "Data", "11 servicios", "8 modos"], players: "1 jugador"
    });
  }

  window.PipelineFactory = { mount, destroy, getStats: safeReadStats };
  registerGame();
}());
