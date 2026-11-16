/* Packet Ascent: a platform game built around AWS Security Group rules. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:packet-ascent:stats";
  const WIDTH = 1000;
  const HEIGHT = 620;
  const LANES = [175, 500, 825];
  const PORTS = [22, 53, 80, 443, 587, 2049, 3306, 5432, 6379, 8080, 8443, 9100];

  const MODES = {
    training: { id: "training", name: "Training", icon: "◎", tone: "green", lives: null, decisionSeconds: null, description: "Aprende puertos, protocolos, CIDR y referencias entre SG sin perder vidas.", detail: "8 rondas guiadas" },
    runner: { id: "runner", name: "Packet Run", icon: "↟", tone: "orange", lives: 3, decisionSeconds: 12, description: "Decide rápido, construye combos y asciende hasta que el paquete sea rechazado.", detail: "Endless · 3 vidas" },
    architecture: { id: "architecture", name: "Architecture Route", icon: "⌘", tone: "purple", lives: 3, decisionSeconds: 15, description: "Completa una ruta real de varias capas desde el origen hasta los datos.", detail: "5 rutas disponibles" }
  };

  const SCENARIOS = [
    { id: "office-ssh", title: "Office SSH", sourceLabel: "Corporate Office", peerIp: "10.20.4.18", protocol: "tcp", port: 22, direction: "inbound", target: "Bastion Host", sg: "sg-bastion", allowCidr: "10.20.0.0/16" },
    { id: "public-https", title: "Public HTTPS", sourceLabel: "Internet Client", peerIp: "198.51.100.24", protocol: "tcp", port: 443, direction: "inbound", target: "Public ALB", sg: "sg-public-alb", allowCidr: "0.0.0.0/0" },
    { id: "alb-app", title: "ALB to Application", sourceLabel: "Application Load Balancer", peerSg: "sg-alb", protocol: "tcp", port: 8080, direction: "inbound", target: "ECS Application", sg: "sg-application", allowSg: "sg-alb" },
    { id: "app-postgres", title: "Application to PostgreSQL", sourceLabel: "Application Tier", peerSg: "sg-app", protocol: "tcp", port: 5432, direction: "inbound", target: "Orders Database", sg: "sg-postgres", allowSg: "sg-app" },
    { id: "backend-mysql", title: "Backend to MySQL", sourceLabel: "Backend Service", peerSg: "sg-backend", protocol: "tcp", port: 3306, direction: "inbound", target: "Customer Database", sg: "sg-mysql", allowSg: "sg-backend" },
    { id: "api-redis", title: "API to Redis", sourceLabel: "API Service", peerSg: "sg-api", protocol: "tcp", port: 6379, direction: "inbound", target: "Session Cache", sg: "sg-cache", allowSg: "sg-api" },
    { id: "ecs-nfs", title: "Containers to EFS", sourceLabel: "ECS Tasks", peerSg: "sg-ecs", protocol: "tcp", port: 2049, direction: "inbound", target: "Shared File System", sg: "sg-efs", allowSg: "sg-ecs" },
    { id: "internal-dns", title: "Internal DNS", sourceLabel: "Private Subnet", peerIp: "10.4.18.21", protocol: "udp", port: 53, direction: "inbound", target: "DNS Resolver", sg: "sg-dns", allowCidr: "10.0.0.0/8" },
    { id: "monitoring", title: "Metrics Collection", sourceLabel: "Monitoring Fleet", peerSg: "sg-monitoring", protocol: "tcp", port: 9100, direction: "inbound", target: "Metrics Endpoint", sg: "sg-metrics", allowSg: "sg-monitoring" },
    { id: "outbound-https", title: "Outbound HTTPS", sourceLabel: "Private Application", peerIp: "203.0.113.15", protocol: "tcp", port: 443, direction: "outbound", target: "Application Egress", sg: "sg-egress-web", allowCidr: "0.0.0.0/0" },
    { id: "outbound-dns", title: "Outbound DNS", sourceLabel: "Private EC2", peerIp: "10.0.0.2", protocol: "udp", port: 53, direction: "outbound", target: "DNS Egress", sg: "sg-egress-dns", allowCidr: "10.0.0.0/8" },
    { id: "outbound-mail", title: "Outbound Mail Relay", sourceLabel: "Notification Service", peerIp: "198.51.100.25", protocol: "tcp", port: 587, direction: "outbound", target: "Mail Egress", sg: "sg-egress-mail", allowCidr: "198.51.100.0/24" },
    { id: "outbound-replica", title: "Database Replication", sourceLabel: "Primary Database", peerSg: "sg-replica", protocol: "tcp", port: 5432, direction: "outbound", target: "Replication Egress", sg: "sg-egress-replication", allowSg: "sg-replica" },
    { id: "service-8443", title: "Service Mesh API", sourceLabel: "Internal Service", peerSg: "sg-services", protocol: "tcp", port: 8443, direction: "inbound", target: "Private API", sg: "sg-private-api", allowSg: "sg-services" },
    { id: "smtp-relay", title: "Mail Submission", sourceLabel: "Notification Worker", peerSg: "sg-workers", protocol: "tcp", port: 587, direction: "inbound", target: "SMTP Relay", sg: "sg-mail", allowSg: "sg-workers" },
    { id: "public-http", title: "HTTP Redirect", sourceLabel: "Internet Client", peerIp: "192.0.2.44", protocol: "tcp", port: 80, direction: "inbound", target: "Redirect Load Balancer", sg: "sg-http-redirect", allowCidr: "0.0.0.0/0" },
    { id: "bastion-ssh", title: "Bastion to Private Host", sourceLabel: "Bastion Host", peerSg: "sg-bastion", protocol: "tcp", port: 22, direction: "inbound", target: "Private EC2", sg: "sg-private-ec2", allowSg: "sg-bastion" },
    { id: "worker-postgres", title: "Worker to Reporting DB", sourceLabel: "Async Workers", peerSg: "sg-workers", protocol: "tcp", port: 5432, direction: "inbound", target: "Reporting Database", sg: "sg-reporting-db", allowSg: "sg-workers" },
    { id: "health-check", title: "Load Balancer Health Check", sourceLabel: "Load Balancer", peerSg: "sg-alb", protocol: "tcp", port: 8080, direction: "inbound", target: "Healthy Target", sg: "sg-targets", allowSg: "sg-alb" }
  ];

  const ROUTES = [
    { id: "web-database", name: "Public Web to Database", description: "Internet → ALB → ECS → PostgreSQL", steps: ["public-https", "alb-app", "app-postgres"] },
    { id: "admin", name: "Administrative Access", description: "Office → Bastion → Private EC2 → MySQL", steps: ["office-ssh", "bastion-ssh", "backend-mysql"] },
    { id: "microservice", name: "Microservice Data Path", description: "Service Mesh → API → Cache → Reporting DB", steps: ["service-8443", "api-redis", "worker-postgres"] },
    { id: "container-files", name: "Container File Platform", description: "Internet → ALB → ECS → EFS", steps: ["public-https", "alb-app", "ecs-nfs"] },
    { id: "operations", name: "Operations Route", description: "Monitoring → Metrics → DNS → Internet Egress", steps: ["monitoring", "internal-dns", "outbound-https"] }
  ];

  let host = null;
  let canvas = null;
  let context = null;
  let state = null;
  let animationId = null;
  let resultTimer = null;
  let exitCallback = null;
  let previousFrame = 0;
  const keys = { left: false, right: false };

  function readStats() {
    try {
      return { played: 0, wins: 0, bestScore: 0, bestRun: 0, modeWins: {}, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch (_) {
      return { played: 0, wins: 0, bestScore: 0, bestRun: 0, modeWins: {} };
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Local storage is optional. */ }
  }

  function currentMode() {
    return MODES[state?.modeId] || MODES.training;
  }

  function ipv4ToInt(address) {
    const parts = String(address).split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
  }

  function ipMatchesCidr(address, cidr) {
    const [networkAddress, prefixText] = String(cidr).split("/");
    const addressValue = ipv4ToInt(address);
    const networkValue = ipv4ToInt(networkAddress);
    const prefix = Number(prefixText);
    if (addressValue === null || networkValue === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    if (prefix === 0) return true;
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (addressValue & mask) === (networkValue & mask);
  }

  function ruleMatches(packet, rule) {
    if (rule.direction !== packet.direction) return false;
    if (rule.protocol !== "all" && rule.protocol !== packet.protocol) return false;
    if (!["icmp", "all"].includes(rule.protocol)) {
      if (packet.port === null || packet.port < rule.fromPort || packet.port > rule.toPort) return false;
    }
    if (rule.peerSg) return Boolean(packet.peerSg && packet.peerSg === rule.peerSg);
    if (rule.peerCidr) return Boolean(packet.peerIp && ipMatchesCidr(packet.peerIp, rule.peerCidr));
    return false;
  }

  function evaluateTraffic(packet, destination) {
    for (const securityGroup of destination.securityGroups) {
      const matchedRule = securityGroup.rules.find((rule) => ruleMatches(packet, rule));
      if (matchedRule) return { allowed: true, securityGroup: securityGroup.name, rule: matchedRule };
    }
    return { allowed: false, securityGroup: null, rule: null };
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function alternatePort(port) {
    return PORTS.find((candidate) => candidate !== port && Math.abs(candidate - port) > 1) || 443;
  }

  function scenarioPacket(scenario) {
    return {
      direction: scenario.direction,
      protocol: scenario.protocol,
      port: scenario.port,
      peerIp: scenario.peerIp || null,
      peerSg: scenario.peerSg || null,
      sourceLabel: scenario.sourceLabel
    };
  }

  function correctRuleFor(scenario, complexity) {
    const rule = {
      direction: scenario.direction,
      protocol: scenario.protocol,
      fromPort: scenario.port,
      toPort: scenario.port,
      peerCidr: scenario.allowCidr || null,
      peerSg: scenario.allowSg || null
    };
    if (complexity >= 3 && ["tcp", "udp"].includes(rule.protocol) && Math.random() < .55) {
      const spread = scenario.port < 100 ? 5 : scenario.port < 1000 ? 20 : 100;
      rule.fromPort = Math.max(0, scenario.port - spread);
      rule.toPort = scenario.port + spread;
    }
    return rule;
  }

  function wrongPeerFor(scenario) {
    if (scenario.allowSg) return { peerSg: "sg-quarantine", peerCidr: null };
    return {
      peerSg: null,
      peerCidr: scenario.allowCidr === "0.0.0.0/0" ? "10.0.0.0/8" : "192.0.2.0/24"
    };
  }

  function mutateRule(rule, kind, scenario) {
    if (kind === "direction") return { ...rule, direction: rule.direction === "inbound" ? "outbound" : "inbound" };
    if (kind === "protocol") return { ...rule, protocol: rule.protocol === "tcp" ? "udp" : "tcp" };
    if (kind === "port") {
      const port = alternatePort(scenario.port);
      return { ...rule, fromPort: port, toPort: port };
    }
    return { ...rule, ...wrongPeerFor(scenario) };
  }

  function nonMatchingRules(baseRule, scenario, packet, count, preferredKind) {
    const kinds = [preferredKind, ...shuffle(["direction", "protocol", "port", "peer"])].filter(Boolean);
    const rules = [];
    let index = 0;
    while (rules.length < count) {
      const firstKind = kinds[index % kinds.length];
      let candidate = mutateRule(baseRule, firstKind, scenario);
      if (index >= kinds.length && index % 2) candidate = mutateRule(candidate, kinds[(index + 1) % kinds.length], scenario);
      if (!ruleMatches(packet, candidate)) rules.push(candidate);
      index += 1;
    }
    return rules;
  }

  function distributeRules(name, rules, groupCount) {
    const groups = Array.from({ length: groupCount }, (_, index) => ({
      name: groupCount === 1 ? name : `${name}-${index === 0 ? "core" : "extra"}`,
      rules: []
    }));
    shuffle(rules).forEach((rule, index) => groups[index % groupCount].rules.push(rule));
    return groups;
  }

  function createChallenge(scenario, complexity = 3) {
    const packet = scenarioPacket(scenario);
    const correctRule = correctRuleFor(scenario, complexity);
    const ruleCount = Math.max(2, Math.min(4, complexity));
    const groupCount = complexity >= 4 ? 2 : 1;
    const labels = shuffle(["a", "b", "c"]);
    const optionSpecs = [
      {
        id: "correct",
        resource: `${scenario.target} · Node ${labels[0].toUpperCase()}`,
        sg: `${scenario.sg}-${labels[0]}`,
        rules: [correctRule, ...nonMatchingRules(correctRule, scenario, packet, ruleCount - 1, "protocol")]
      },
      {
        id: "wrong-port",
        resource: `${scenario.target} · Node ${labels[1].toUpperCase()}`,
        sg: `${scenario.sg}-${labels[1]}`,
        rules: nonMatchingRules(correctRule, scenario, packet, ruleCount, "port")
      },
      {
        id: "wrong-peer",
        resource: `${scenario.target} · Node ${labels[2].toUpperCase()}`,
        sg: `${scenario.sg}-${labels[2]}`,
        rules: nonMatchingRules(correctRule, scenario, packet, ruleCount, "peer")
      }
    ];

    const options = shuffle(optionSpecs.map((option) => ({
      id: option.id,
      resource: option.resource,
      icon: resourceIcon(scenario.target),
      securityGroups: distributeRules(option.sg, option.rules, groupCount)
    })));

    return { id: scenario.id, title: scenario.title, complexity, packet, options };
  }

  function challengeComplexity() {
    if (state.modeId === "architecture") return 4;
    if (state.modeId === "runner") return Math.min(4, 3 + Math.floor(state.round / 6));
    return Math.min(4, 2 + Math.floor(state.round / 3));
  }

  function ruleMismatches(packet, rule) {
    const mismatches = [];
    if (rule.direction !== packet.direction) mismatches.push("dirección");
    if (rule.protocol !== "all" && rule.protocol !== packet.protocol) mismatches.push("protocolo");
    if (!["icmp", "all"].includes(rule.protocol) && (packet.port < rule.fromPort || packet.port > rule.toPort)) mismatches.push("puerto");
    const peerMatches = rule.peerSg
      ? packet.peerSg === rule.peerSg
      : Boolean(rule.peerCidr && packet.peerIp && ipMatchesCidr(packet.peerIp, rule.peerCidr));
    if (!peerMatches) mismatches.push(packet.direction === "inbound" ? "origen" : "destino");
    return mismatches;
  }

  function explainRejection(packet, destination) {
    const inspected = destination.securityGroups.flatMap((group) => group.rules.map((rule) => ({ group: group.name, rule, mismatches: ruleMismatches(packet, rule) })));
    inspected.sort((first, second) => first.mismatches.length - second.mismatches.length);
    const closest = inspected[0];
    if (!closest) return "El recurso no tiene reglas de permiso.";
    const fields = closest.mismatches.join(", ");
    return `La regla más cercana en ${closest.group} falla por ${fields}.`;
  }

  function resourceIcon(name) {
    if (/database|postgres|mysql|cache/i.test(name)) return "DB";
    if (/load balancer|alb/i.test(name)) return "LB";
    if (/file|efs/i.test(name)) return "FS";
    if (/dns/i.test(name)) return "53";
    if (/repository/i.test(name)) return "S3";
    return "EC2";
  }

  function formatRule(rule) {
    const direction = rule.direction === "inbound" ? "IN" : "OUT";
    const protocol = rule.protocol.toUpperCase();
    const port = rule.protocol === "icmp" ? "ALL" : rule.fromPort === rule.toPort ? rule.fromPort : `${rule.fromPort}–${rule.toPort}`;
    const peerLabel = rule.direction === "inbound" ? "FROM" : "TO";
    return `${direction} · ${protocol} ${port} · ${peerLabel} ${rule.peerSg || rule.peerCidr}`;
  }

  function formatPacketPeer(packet) {
    return packet.peerSg || packet.peerIp || "unknown";
  }

  function createState(modeId) {
    const mode = MODES[modeId] || MODES.training;
    const route = mode.id === "architecture" ? ROUTES[Math.floor(Math.random() * ROUTES.length)] : null;
    return {
      modeId: mode.id,
      phase: "menu",
      score: 0,
      lives: mode.lives,
      streak: 0,
      round: 0,
      route,
      routeStep: 0,
      challenge: null,
      previousScenarioId: null,
      playerX: 500,
      playerY: 550,
      selectedLane: 1,
      jumpStart: 0,
      jumpFromX: 500,
      jumpLane: null,
      deadline: null,
      roundSeconds: null,
      timeRemainingAtJump: 0,
      result: null,
      startedAt: null,
      finishedAt: null
    };
  }

  function pickScenario() {
    if (state.modeId === "training") return SCENARIOS[state.round % 8];
    if (state.modeId === "architecture") {
      const id = state.route.steps[state.routeStep];
      return SCENARIOS.find((scenario) => scenario.id === id);
    }
    const pool = SCENARIOS.filter((scenario) => scenario.id !== state.previousScenarioId);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function beginRound() {
    const scenario = pickScenario();
    state.previousScenarioId = scenario.id;
    state.challenge = createChallenge(scenario, challengeComplexity());
    state.phase = "choosing";
    state.playerX = 500;
    state.playerY = 550;
    state.selectedLane = 1;
    state.jumpLane = null;
    state.timeRemainingAtJump = 0;
    state.result = null;
    const baseSeconds = currentMode().decisionSeconds;
    state.roundSeconds = baseSeconds === null ? null : Math.max(6, baseSeconds - (state.modeId === "runner" ? Math.floor(state.round / 4) : 0));
    state.deadline = state.roundSeconds === null ? null : Date.now() + state.roundSeconds * 1000;
    const decisionBar = host.querySelector("#packet-decision-bar");
    const decisionTime = host.querySelector("#packet-decision-time");
    if (decisionBar) decisionBar.style.width = "100%";
    if (decisionTime) decisionTime.textContent = state.roundSeconds === null ? "∞" : `${state.roundSeconds}s`;
    renderChallenge();
    updateDashboard();
  }

  function renderChallenge() {
    if (!host || !state.challenge) return;
    const gates = host.querySelector("#packet-gates");
    gates.innerHTML = state.challenge.options.map((option, index) => `
      <button type="button" class="packet-gate ${state.selectedLane === index ? "is-nearest" : ""}" data-packet-lane="${index}" style="--lane:${index}">
        <span class="gate-resource-icon">${option.icon}</span>
        <span class="gate-copy"><small>RESOURCE ${index + 1}</small><strong>${option.resource}</strong></span>
        <span class="gate-sg">${option.securityGroups.map((group) => group.name).join(" + ")}</span>
        <span class="gate-rules">${option.securityGroups.flatMap((group) => group.rules).map((rule) => `<i>${formatRule(rule)}</i>`).join("")}</span>
        <span class="gate-action">JUMP <b>↑</b></span>
      </button>`).join("");

    const packet = state.challenge.packet;
    host.querySelector("#packet-title").textContent = state.challenge.title;
    host.querySelector("#packet-direction").textContent = packet.direction === "inbound" ? "INBOUND" : "OUTBOUND";
    host.querySelector("#packet-protocol").textContent = packet.protocol.toUpperCase();
    host.querySelector("#packet-port").textContent = packet.port ?? "ALL";
    host.querySelector("#packet-peer-label").textContent = packet.direction === "inbound" ? "SOURCE" : "DESTINATION";
    host.querySelector("#packet-peer").textContent = formatPacketPeer(packet);
    renderRouteProgress();
  }

  function renderRouteProgress() {
    const routeBar = host.querySelector("#packet-route");
    if (state.modeId !== "architecture") {
      routeBar.hidden = true;
      routeBar.innerHTML = "";
      return;
    }
    routeBar.hidden = false;
    routeBar.innerHTML = `<span><small>ACTIVE ROUTE</small><strong>${state.route.name}</strong></span><p>${state.route.description}</p><div>${state.route.steps.map((_, index) => `<i class="${index < state.routeStep ? "is-complete" : index === state.routeStep ? "is-current" : ""}">${index < state.routeStep ? "✓" : index + 1}</i>`).join("<b>→</b>")}</div>`;
  }

  function updateDashboard() {
    if (!host || !state) return;
    const mode = currentMode();
    host.querySelector("#packet-score").textContent = state.score.toLocaleString("es-ES");
    host.querySelector("#packet-lives").textContent = mode.lives === null ? "∞" : "●".repeat(Math.max(0, state.lives)) + "○".repeat(Math.max(0, mode.lives - state.lives));
    host.querySelector("#packet-combo").textContent = `×${Math.max(1, state.streak)}`;
    host.querySelector("#packet-round").textContent = state.modeId === "architecture" ? `${state.routeStep + 1} / ${state.route.steps.length}` : (state.round + 1).toString().padStart(2, "0");
    host.querySelector("#packet-mode-name").textContent = mode.name;
  }

  function movePlayer(direction) {
    if (state.phase !== "choosing") return;
    const lane = Math.max(0, Math.min(2, state.selectedLane + direction));
    state.selectedLane = lane;
    state.playerX = LANES[lane];
    updateNearestGate();
  }

  function updateNearestGate() {
    if (!host) return;
    let nearest = 0;
    let distance = Infinity;
    LANES.forEach((x, index) => {
      const candidate = Math.abs(state.playerX - x);
      if (candidate < distance) { distance = candidate; nearest = index; }
    });
    state.selectedLane = nearest;
    host.querySelectorAll("[data-packet-lane]").forEach((gate) => gate.classList.toggle("is-nearest", Number(gate.dataset.packetLane) === nearest));
  }

  function jumpToLane(lane) {
    if (state.phase !== "choosing" || lane < 0 || lane > 2) return;
    state.phase = "jumping";
    state.jumpStart = performance.now();
    state.jumpFromX = state.playerX;
    state.jumpLane = lane;
    state.timeRemainingAtJump = state.deadline ? Math.max(0, (state.deadline - Date.now()) / 1000) : 0;
    state.deadline = null;
    state.selectedLane = lane;
    host.querySelectorAll("[data-packet-lane]").forEach((gate) => gate.classList.toggle("is-committed", Number(gate.dataset.packetLane) === lane));
  }

  function resolveJump() {
    if (state.phase !== "jumping") return;
    const option = state.challenge.options[state.jumpLane];
    const evaluation = evaluateTraffic(state.challenge.packet, option);
    resolveChoice(state.jumpLane, evaluation);
  }

  function resolveChoice(lane, evaluation) {
    state.phase = "result";
    const correctLane = state.challenge.options.findIndex((option) => evaluateTraffic(state.challenge.packet, option).allowed);
    const correctOption = state.challenge.options[correctLane];
    const gateElements = host.querySelectorAll("[data-packet-lane]");
    gateElements.forEach((gate, index) => {
      gate.classList.remove("is-nearest", "is-committed");
      if (index === correctLane) gate.classList.add("is-correct");
      if (index === lane && !evaluation.allowed) gate.classList.add("is-rejected");
    });

    if (evaluation.allowed) {
      state.streak += 1;
      const speedBonus = state.roundSeconds ? Math.round(state.timeRemainingAtJump * 10) : 0;
      const points = 100 + Math.min(state.streak * 25, 250) + speedBonus;
      state.score += points;
      state.result = { accepted: true, title: "ACCEPT", copy: `${evaluation.securityGroup} permite ${formatRule(evaluation.rule)}.`, points };
    } else {
      state.streak = 0;
      if (state.lives !== null) state.lives -= 1;
      const packet = state.challenge.packet;
      const rejectionReason = lane >= 0
        ? explainRejection(packet, state.challenge.options[lane])
        : "La ventana de decisión terminó antes de seleccionar un recurso.";
      state.result = {
        accepted: false,
        title: "REJECT",
        copy: `${rejectionReason} La ruta válida era ${correctOption.resource}.`,
        points: 0
      };
    }
    renderResultBanner();
    updateDashboard();
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(advanceAfterResult, 1900);
  }

  function timeoutRound() {
    if (state.phase !== "choosing") return;
    state.deadline = null;
    resolveChoice(-1, { allowed: false, securityGroup: null, rule: null });
    const banner = host.querySelector("#packet-result");
    banner.querySelector("strong").textContent = "TIMEOUT";
  }

  function renderResultBanner() {
    const banner = host.querySelector("#packet-result");
    banner.hidden = false;
    banner.className = `packet-result ${state.result.accepted ? "is-accept" : "is-reject"}`;
    banner.innerHTML = `<span>${state.result.accepted ? "✓" : "×"}</span><div><strong>${state.result.title}</strong><small>${state.result.copy}</small></div>${state.result.points ? `<b>+${state.result.points}</b>` : ""}`;
  }

  function hideResultBanner() {
    const banner = host.querySelector("#packet-result");
    banner.hidden = true;
    banner.innerHTML = "";
  }

  function advanceAfterResult() {
    if (!state || state.phase !== "result") return;
    const accepted = state.result.accepted;
    if (state.lives !== null && state.lives <= 0) {
      finishGame(false);
      return;
    }

    if (state.modeId === "architecture") {
      if (accepted) state.routeStep += 1;
      if (state.routeStep >= state.route.steps.length) {
        finishGame(true);
        return;
      }
    } else {
      state.round += 1;
      if (state.modeId === "training" && state.round >= 8) {
        finishGame(true);
        return;
      }
    }
    hideResultBanner();
    beginRound();
  }

  function finishGame(won) {
    state.phase = "finished";
    state.finishedAt = Date.now();
    state.deadline = null;
    const stats = readStats();
    stats.bestScore = Math.max(stats.bestScore || 0, state.score);
    stats.bestRun = Math.max(stats.bestRun || 0, state.round);
    if (won) {
      stats.wins += 1;
      stats.modeWins = stats.modeWins || {};
      stats.modeWins[state.modeId] = (stats.modeWins[state.modeId] || 0) + 1;
    }
    saveStats(stats);

    const overlay = host.querySelector("#packet-overlay");
    overlay.className = "packet-overlay";
    overlay.hidden = false;
    const title = won ? (state.modeId === "architecture" ? "Ruta completada" : "Training completado") : "Packet dropped";
    const copy = won
      ? (state.modeId === "architecture" ? `El paquete atravesó correctamente ${state.route.name}.` : "Completaste las ocho rondas y verificaste cada decisión.")
      : `El paquete llegó hasta la ronda ${state.round + 1}. Revisa las reglas antes de volver a desplegarlo.`;
    overlay.innerHTML = `
      <div class="packet-finish-card ${won ? "is-win" : ""}">
        <span class="packet-finish-icon">${won ? "✓" : "×"}</span><span class="eyebrow">${won ? "ROUTE ACCEPTED" : "CONNECTION TERMINATED"}</span>
        <h2>${title}</h2><p>${copy}</p><strong>${state.score.toLocaleString("es-ES")} puntos</strong>
        <div><button type="button" class="primary-button" data-packet-action="restart">Reintentar <span>→</span></button><button type="button" class="secondary-button" data-packet-action="modes">Elegir modo</button><button type="button" class="packet-text-button" data-packet-action="exit">Volver al centro</button></div>
      </div>`;
  }

  function showModeSelection() {
    state.phase = "menu";
    state.deadline = null;
    const overlay = host.querySelector("#packet-overlay");
    overlay.className = "packet-overlay is-mode-picker";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="mode-picker packet-mode-picker">
        <div class="mode-picker-heading"><span class="eyebrow">SELECT A ROUTE</span><h2>Elige cómo ascender</h2><p>Lee el paquete, analiza las reglas y salta únicamente hacia un destino permitido.</p></div>
        <div class="mode-grid packet-mode-grid">
          ${Object.values(MODES).map((mode) => `
            <button type="button" class="mode-card mode-${mode.tone}" data-packet-mode="${mode.id}">
              <span class="mode-card-icon">${mode.icon}</span><span class="mode-card-copy"><span>${mode.name}</span><small>${mode.description}</small></span><strong>${mode.detail}</strong><i>→</i>
            </button>`).join("")}
        </div>
        <div class="packet-rule-note"><span>i</span><p>Los Security Groups se evalúan como reglas acumulativas de permiso. El juego representa tres recursos de destino, cada uno protegido por sus propios SG.</p></div>
        <button type="button" class="mode-picker-exit" data-packet-action="exit">← Volver al centro de juegos</button>
      </div>`;
  }

  function hideOverlay() {
    const overlay = host.querySelector("#packet-overlay");
    overlay.className = "packet-overlay";
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  function startGame(modeId) {
    window.clearTimeout(resultTimer);
    state = createState(modeId);
    state.phase = "choosing";
    state.startedAt = Date.now();
    const stats = readStats();
    stats.played += 1;
    saveStats(stats);
    hideOverlay();
    hideResultBanner();
    beginRound();
  }

  function chooseModes() {
    if (["choosing", "jumping", "result"].includes(state.phase) && !window.confirm("¿Quieres abandonar esta ruta y elegir otro modo?")) return;
    window.clearTimeout(resultTimer);
    showModeSelection();
  }

  function drawBackground(time) {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#071a2b");
    gradient.addColorStop(1, "#030a12");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = "rgba(69, 112, 145, .13)";
    context.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 50) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 50) { context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke(); }

    for (let index = 0; index < 20; index += 1) {
      const x = (index * 137 + 45) % WIDTH;
      const y = (index * 79 + time * .015) % HEIGHT;
      context.fillStyle = index % 3 ? "rgba(57, 217, 138, .18)" : "rgba(255, 153, 0, .2)";
      context.fillRect(x, y, 2, 8);
    }

    LANES.forEach((x, lane) => {
      const active = lane === state?.selectedLane;
      context.strokeStyle = active ? "rgba(255, 153, 0, .24)" : "rgba(99, 135, 168, .1)";
      context.setLineDash([5, 9]);
      context.beginPath(); context.moveTo(x, 215); context.lineTo(x, 545); context.stroke();
      context.setLineDash([]);
      context.fillStyle = active ? "rgba(255, 153, 0, .18)" : "rgba(62, 92, 118, .22)";
      context.fillRect(x - 92, 224, 184, 9);
      context.fillStyle = active ? "#ff9900" : "#415b72";
      context.fillRect(x - 92, 224, 184, 2);
    });
  }

  function drawPacket() {
    if (!state) return;
    const x = state.playerX;
    const y = state.playerY;
    context.save();
    context.shadowColor = state.phase === "result" && state.result?.accepted === false ? "#ef5b60" : "#ff9900";
    context.shadowBlur = 20;
    context.fillStyle = state.phase === "result" && state.result?.accepted === false ? "#ef5b60" : "#ffad32";
    context.beginPath();
    context.roundRect(x - 28, y - 21, 56, 42, 10);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(7, 17, 31, .72)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#111a22";
    context.font = "700 11px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(state.challenge?.packet.port ?? "IP", x, y + 4);
    context.fillStyle = "rgba(255,255,255,.7)";
    context.beginPath(); context.arc(x - 17, y - 10, 3, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  function updateFrame(timestamp) {
    if (!state || !host) return;
    const delta = Math.min(32, timestamp - (previousFrame || timestamp));
    previousFrame = timestamp;

    if (state.phase === "choosing") {
      const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (direction) {
        state.playerX = Math.max(80, Math.min(920, state.playerX + direction * delta * .42));
        updateNearestGate();
      }
      if (state.deadline) {
        const remaining = Math.max(0, state.deadline - Date.now());
        const ratio = remaining / (state.roundSeconds * 1000);
        const bar = host.querySelector("#packet-decision-bar");
        if (bar) bar.style.width = `${Math.max(0, ratio * 100)}%`;
        const clock = host.querySelector("#packet-decision-time");
        if (clock) clock.textContent = `${Math.ceil(remaining / 1000)}s`;
        if (remaining <= 0) timeoutRound();
      }
    } else if (state.phase === "jumping") {
      const progress = Math.min(1, (timestamp - state.jumpStart) / 720);
      const eased = 1 - Math.pow(1 - progress, 3);
      state.playerX = state.jumpFromX + (LANES[state.jumpLane] - state.jumpFromX) * eased;
      state.playerY = 550 + (202 - 550) * eased - Math.sin(Math.PI * progress) * 105;
      if (progress >= 1) resolveJump();
    } else if (state.phase === "result") {
      state.playerY += state.result?.accepted ? -.12 * delta : .2 * delta;
    }

    drawBackground(timestamp);
    drawPacket();
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function handleKeyDown(event) {
    if (!host || !state) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "A", "d", "D", "w", "W"].includes(event.key)) event.preventDefault();
    if (["ArrowLeft", "a", "A"].includes(event.key)) keys.left = true;
    if (["ArrowRight", "d", "D"].includes(event.key)) keys.right = true;
    if (["ArrowUp", "w", "W", " "].includes(event.key) && !event.repeat) jumpToLane(state.selectedLane);
  }

  function handleKeyUp(event) {
    if (["ArrowLeft", "a", "A"].includes(event.key)) keys.left = false;
    if (["ArrowRight", "d", "D"].includes(event.key)) keys.right = false;
  }

  function handleClick(event) {
    const mode = event.target.closest("[data-packet-mode]");
    if (mode) { startGame(mode.dataset.packetMode); return; }
    const gate = event.target.closest("[data-packet-lane]");
    if (gate) { jumpToLane(Number(gate.dataset.packetLane)); return; }
    const movement = event.target.closest("[data-packet-move]")?.dataset.packetMove;
    if (movement === "left") movePlayer(-1);
    if (movement === "right") movePlayer(1);
    if (movement === "jump") jumpToLane(state.selectedLane);
    const action = event.target.closest("[data-packet-action]")?.dataset.packetAction;
    if (action === "modes") chooseModes();
    if (action === "restart") startGame(state.modeId);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function initialMarkup() {
    return `
      <section class="packet-shell" aria-label="Packet Ascent">
        <header class="packet-header">
          <div class="packet-title-block"><span class="packet-game-icon">↟</span><div><span>SECURITY GROUP PLATFORMER</span><h1>Packet Ascent <b id="packet-mode-name">Training</b></h1></div></div>
          <div class="packet-controls"><span class="packet-key-hint"><kbd>←</kbd><kbd>→</kbd> Mover <kbd>Space</kbd> Saltar</span><button type="button" data-packet-action="restart"><span>↻</span> Reiniciar</button><button type="button" data-packet-action="modes" class="packet-modes-button"><span>▦</span> Modos</button></div>
        </header>
        <div class="packet-dashboard">
          <div><span>INTEGRIDAD</span><strong id="packet-lives">∞</strong></div>
          <div><span>PUNTUACIÓN</span><strong id="packet-score">0</strong></div>
          <div class="packet-inspector"><span id="packet-title">PACKET INSPECTOR</span><p><b id="packet-direction">INBOUND</b><i id="packet-protocol">TCP</i><strong>PORT <em id="packet-port">22</em></strong><small><span id="packet-peer-label">SOURCE</span> <code id="packet-peer">10.0.0.1</code></small></p></div>
          <div><span>COMBO</span><strong id="packet-combo">×1</strong></div>
          <div><span>RONDA</span><strong id="packet-round">01</strong></div>
        </div>
        <div class="packet-arena">
          <div class="packet-stage">
            <div class="packet-grid-overlay"></div>
            <div id="packet-route" class="packet-route" hidden></div>
            <div id="packet-gates" class="packet-gates"></div>
            <canvas id="packet-canvas" width="1000" height="620" aria-label="Área de juego de Packet Ascent"></canvas>
            <div class="packet-decision"><span>DECISION WINDOW</span><div><i id="packet-decision-bar"></i></div><b id="packet-decision-time">∞</b></div>
            <div id="packet-result" class="packet-result" hidden></div>
          </div>
          <div id="packet-overlay" class="packet-overlay" hidden></div>
          <div class="packet-mobile-controls"><button type="button" data-packet-move="left" aria-label="Mover a la izquierda">←</button><button type="button" data-packet-move="jump" class="is-jump">↑ JUMP</button><button type="button" data-packet-move="right" aria-label="Mover a la derecha">→</button></div>
        </div>
        <div class="packet-helpbar"><div><span><i class="accept-dot"></i>Regla compatible</span><span><i class="reject-dot"></i>Default deny</span><span><i class="stateful-dot"></i>SG stateful</span></div><p><strong>Evalúa:</strong> dirección, protocolo, puerto y origen o destino. Las reglas de varios SG se combinan.</p></div>
      </section>`;
  }

  function mount(container, onExit) {
    destroy();
    host = container;
    exitCallback = onExit;
    host.innerHTML = initialMarkup();
    canvas = host.querySelector("#packet-canvas");
    context = canvas.getContext("2d");
    host.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    state = createState("training");
    updateDashboard();
    showModeSelection();
    previousFrame = 0;
    animationId = window.requestAnimationFrame(updateFrame);
  }

  function destroy() {
    window.cancelAnimationFrame(animationId);
    window.clearTimeout(resultTimer);
    keys.left = false;
    keys.right = false;
    if (host) host.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    host = null;
    canvas = null;
    context = null;
    state = null;
    exitCallback = null;
  }

  window.PacketAscent = {
    mount,
    destroy,
    getStats: readStats,
    getModes: () => Object.values(MODES).map((mode) => ({ ...mode }))
  };
}());
