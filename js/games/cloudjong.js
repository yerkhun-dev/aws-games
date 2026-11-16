/* Cloudjong: a dependency-free Mahjong Solitaire game. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:cloudjong:stats";
  const SERVICES = [
    { id: "ec2", name: "EC2", fullName: "Amazon EC2", category: "compute", icon: "server", description: "Capacidad de cómputo redimensionable para ejecutar aplicaciones." },
    { id: "lambda", name: "Lambda", fullName: "AWS Lambda", category: "compute", icon: "lambda", description: "Ejecuta código en respuesta a eventos sin administrar servidores." },
    { id: "ecs", name: "ECS", fullName: "Amazon ECS", category: "compute", icon: "containers", description: "Orquesta y ejecuta aplicaciones dentro de contenedores." },
    { id: "s3", name: "S3", fullName: "Amazon S3", category: "storage", icon: "bucket", description: "Almacenamiento de objetos duradero y escalable." },
    { id: "ebs", name: "EBS", fullName: "Amazon EBS", category: "storage", icon: "volume", description: "Volúmenes de bloques persistentes para instancias EC2." },
    { id: "efs", name: "EFS", fullName: "Amazon EFS", category: "storage", icon: "file", description: "Sistema de archivos elástico y administrado." },
    { id: "dynamodb", name: "DynamoDB", fullName: "Amazon DynamoDB", category: "database", icon: "database", description: "Base de datos NoSQL serverless de clave-valor y documentos." },
    { id: "rds", name: "RDS", fullName: "Amazon RDS", category: "database", icon: "relational", description: "Bases de datos relacionales administradas en la nube." },
    { id: "elasticache", name: "ElastiCache", fullName: "Amazon ElastiCache", category: "database", icon: "cache", description: "Caché en memoria administrada para aplicaciones de baja latencia." },
    { id: "redshift", name: "Redshift", fullName: "Amazon Redshift", category: "analytics", icon: "warehouse", description: "Data warehouse administrado para análisis a escala." },
    { id: "cloudfront", name: "CloudFront", fullName: "Amazon CloudFront", category: "network", icon: "globe", description: "Distribuye contenido con baja latencia mediante una red global." },
    { id: "route53", name: "Route 53", fullName: "Amazon Route 53", category: "network", icon: "route", description: "Servicio DNS escalable y altamente disponible." },
    { id: "apigateway", name: "API Gateway", fullName: "Amazon API Gateway", category: "network", icon: "gateway", description: "Crea, publica y protege APIs a cualquier escala." },
    { id: "elb", name: "ELB", fullName: "Elastic Load Balancing", category: "network", icon: "loadbalance", description: "Distribuye tráfico entre múltiples destinos saludables." },
    { id: "vpc", name: "VPC", fullName: "Amazon VPC", category: "network", icon: "network", description: "Aísla recursos dentro de una red virtual definida." },
    { id: "iam", name: "IAM", fullName: "AWS IAM", category: "security", icon: "identity", description: "Controla identidades y permisos de acceso a recursos AWS." },
    { id: "kms", name: "KMS", fullName: "AWS KMS", category: "security", icon: "key", description: "Crea y controla claves para proteger tus datos." },
    { id: "cognito", name: "Cognito", fullName: "Amazon Cognito", category: "security", icon: "userlock", description: "Agrega registro, autenticación y acceso de usuarios." },
    { id: "waf", name: "WAF", fullName: "AWS WAF", category: "security", icon: "firewall", description: "Filtra solicitudes web maliciosas antes de que lleguen a la aplicación." },
    { id: "secretsmanager", name: "Secrets", fullName: "AWS Secrets Manager", category: "security", icon: "secret", description: "Administra y rota credenciales y otros secretos." },
    { id: "cloudwatch", name: "CloudWatch", fullName: "Amazon CloudWatch", category: "operations", icon: "pulse", description: "Observa métricas, logs y eventos de aplicaciones y recursos." },
    { id: "sqs", name: "SQS", fullName: "Amazon SQS", category: "integration", icon: "queue", description: "Desacopla componentes mediante colas de mensajes administradas." },
    { id: "sns", name: "SNS", fullName: "Amazon SNS", category: "integration", icon: "broadcast", description: "Distribuye mensajes y notificaciones a múltiples suscriptores." },
    { id: "eventbridge", name: "EventBridge", fullName: "Amazon EventBridge", category: "integration", icon: "events", description: "Conecta aplicaciones mediante eventos y reglas." },
    { id: "stepfunctions", name: "Step Functions", fullName: "AWS Step Functions", category: "integration", icon: "workflow", description: "Coordina servicios y tareas en workflows visuales." },
    { id: "kinesis", name: "Kinesis", fullName: "Amazon Kinesis", category: "analytics", icon: "stream", description: "Captura y procesa flujos de datos en tiempo real." },
    { id: "glue", name: "Glue", fullName: "AWS Glue", category: "analytics", icon: "graph", description: "Descubre, prepara y combina datos para analítica." }
  ];

  const CATEGORY_NAMES = {
    compute: "Compute",
    storage: "Storage",
    database: "Database",
    network: "Networking",
    security: "Security",
    operations: "Operations",
    integration: "Integration",
    analytics: "Analytics"
  };

  const CORE_SERVICE_IDS = ["ec2", "lambda", "ecs", "s3", "ebs", "dynamodb", "rds", "cloudfront", "route53", "iam", "kms", "cloudwatch"];

  const ARCHITECTURES = [
    { id: "static-global", name: "Static Global Website", tier: "Foundation", summary: "Contenido estático distribuido globalmente con DNS administrado.", services: ["route53", "cloudfront", "s3"] },
    { id: "secure-static", name: "Secure Static Delivery", tier: "Intermediate", summary: "Sitio estático cifrado y protegido en el edge.", services: ["route53", "cloudfront", "s3", "waf", "kms"] },
    { id: "serverless-rest", name: "Serverless REST API", tier: "Foundation", summary: "API sin servidores con persistencia NoSQL y observabilidad.", services: ["apigateway", "lambda", "dynamodb", "iam", "cloudwatch"] },
    { id: "serverless-auth", name: "Authenticated Serverless App", tier: "Advanced", summary: "Aplicación global con identidad y backend serverless.", services: ["cloudfront", "cognito", "apigateway", "lambda", "dynamodb"] },
    { id: "three-tier", name: "Three-Tier Web App", tier: "Foundation", summary: "Frontend, cómputo y base relacional detrás de DNS y balanceo.", services: ["route53", "elb", "ec2", "rds", "cloudwatch"] },
    { id: "container-web", name: "Container Web Platform", tier: "Intermediate", summary: "Aplicación web contenerizada con datos relacionales.", services: ["route53", "elb", "ecs", "rds", "cloudwatch"] },
    { id: "event-orders", name: "Event-Driven Orders", tier: "Advanced", summary: "Órdenes desacopladas mediante eventos, colas y funciones.", services: ["apigateway", "lambda", "eventbridge", "sqs", "dynamodb"] },
    { id: "worker-queue", name: "Async Worker Queue", tier: "Foundation", summary: "Procesamiento asíncrono durable con workers serverless.", services: ["sqs", "lambda", "dynamodb", "cloudwatch"] },
    { id: "fanout", name: "Fanout Notifications", tier: "Intermediate", summary: "Un evento se distribuye a múltiples consumidores aislados.", services: ["sns", "sqs", "lambda", "cloudwatch"] },
    { id: "stream-analytics", name: "Streaming Analytics", tier: "Advanced", summary: "Flujos en tiempo real procesados y almacenados para análisis.", services: ["kinesis", "lambda", "s3", "redshift", "cloudwatch"] },
    { id: "data-lake", name: "Data Lake Foundation", tier: "Intermediate", summary: "Lago de datos transformado y consultado con cifrado.", services: ["s3", "glue", "redshift", "kms"] },
    { id: "cache-api", name: "Cache-Accelerated API", tier: "Intermediate", summary: "API de baja latencia respaldada por caché y datos relacionales.", services: ["apigateway", "lambda", "elasticache", "rds"] },
    { id: "secure-file", name: "Secure File Processing", tier: "Advanced", summary: "Archivos cifrados disparan procesamiento asíncrono observable.", services: ["s3", "lambda", "sqs", "kms", "cloudwatch"] },
    { id: "lift-shift", name: "EC2 Lift and Shift", tier: "Foundation", summary: "Aplicación tradicional migrada a cómputo y almacenamiento cloud.", services: ["route53", "elb", "ec2", "ebs", "rds"] },
    { id: "disaster-recovery", name: "Disaster Recovery Stack", tier: "Advanced", summary: "Copias protegidas y recuperación de infraestructura crítica.", services: ["route53", "s3", "ebs", "rds", "kms"] },
    { id: "microservices", name: "Container Microservices", tier: "Advanced", summary: "Servicios contenerizados desacoplados por eventos y colas.", services: ["elb", "ecs", "eventbridge", "sqs", "cloudwatch"] },
    { id: "workflow", name: "Orchestrated Workflow", tier: "Advanced", summary: "Una API coordina tareas, esperas y persistencia serverless.", services: ["apigateway", "stepfunctions", "lambda", "sqs", "dynamodb"] },
    { id: "private-app", name: "Private Web Application", tier: "Intermediate", summary: "Aplicación de tres capas aislada dentro de una red virtual.", services: ["vpc", "elb", "ec2", "rds", "iam"] },
    { id: "zero-trust", name: "Zero-Trust Backend", tier: "Advanced", summary: "Identidad, permisos, cifrado y secretos protegen cada solicitud.", services: ["apigateway", "cognito", "lambda", "kms", "secretsmanager"] },
    { id: "edge-personalization", name: "Edge Personalization", tier: "Intermediate", summary: "Contenido global personalizado con lógica y datos serverless.", services: ["route53", "cloudfront", "lambda", "dynamodb"] },
    { id: "media-delivery", name: "Protected Media Delivery", tier: "Foundation", summary: "Activos multimedia distribuidos por una capa edge protegida.", services: ["route53", "cloudfront", "s3", "waf"] },
    { id: "warehouse", name: "Analytics Warehouse", tier: "Advanced", summary: "Datos preparados, cifrados y cargados en un warehouse observable.", services: ["s3", "glue", "redshift", "cloudwatch", "kms"] },
    { id: "realtime-events", name: "Real-Time Event Pipeline", tier: "Advanced", summary: "Eventos en streaming activan procesamiento y persistencia inmediata.", services: ["kinesis", "eventbridge", "lambda", "dynamodb"] },
    { id: "secure-database", name: "Secure Database App", tier: "Intermediate", summary: "Aplicación con base relacional, cifrado y credenciales administradas.", services: ["ec2", "rds", "kms", "secretsmanager", "cloudwatch"] },
    { id: "elastic-containers", name: "Elastic Container Stack", tier: "Intermediate", summary: "Contenedores balanceados comparten archivos y métricas.", services: ["route53", "elb", "ecs", "efs", "cloudwatch"] },
    { id: "identity-portal", name: "Identity-Aware Portal", tier: "Advanced", summary: "Portal estático global con acceso autenticado y firewall web.", services: ["cloudfront", "s3", "cognito", "iam", "waf"] },
    { id: "audit-ready", name: "Audit-Ready Workload", tier: "Advanced", summary: "Datos, claves, secretos y actividad centralizados para auditoría.", services: ["iam", "kms", "cloudwatch", "s3", "secretsmanager"] },
    { id: "commerce", name: "Decoupled Commerce", tier: "Advanced", summary: "Compras asíncronas con API, cola, notificaciones y NoSQL.", services: ["apigateway", "sqs", "lambda", "dynamodb", "sns"] },
    { id: "file-sharing", name: "Shared File Platform", tier: "Intermediate", summary: "Instancias balanceadas comparten un sistema de archivos elástico.", services: ["route53", "elb", "ec2", "efs", "iam"] },
    { id: "scheduled-data", name: "Scheduled Data Jobs", tier: "Intermediate", summary: "Tareas programadas coordinan transformación y almacenamiento.", services: ["eventbridge", "stepfunctions", "lambda", "s3", "cloudwatch"] },
    { id: "notification-hub", name: "Notification Hub", tier: "Foundation", summary: "Mensajes publicados se encolan, procesan y registran.", services: ["sns", "sqs", "lambda", "dynamodb"] },
    { id: "migration", name: "Cloud Migration Landing", tier: "Intermediate", summary: "Aplicación y datos migran dentro de una red cloud aislada.", services: ["vpc", "ec2", "ebs", "rds", "s3"] }
  ];

  const MODES = {
    zen: {
      id: "zen", name: "Zen", icon: "∞", tone: "green",
      description: "Sin reloj ni penalizaciones. Ideal para aprender los servicios.",
      detail: "Pistas y barajados ilimitados", duration: null, showClock: false,
      hintLimit: null, shuffleLimit: null, hintPenalty: 0, shufflePenalty: 0,
      scoreMultiplier: 1, allowUndo: true
    },
    classic: {
      id: "classic", name: "Classic", icon: "◇", tone: "orange",
      description: "La experiencia original: limpia el stack y construye combos.",
      detail: "Reglas equilibradas", duration: null, showClock: true,
      hintLimit: null, shuffleLimit: null, hintPenalty: 100, shufflePenalty: 300,
      scoreMultiplier: 1, allowUndo: true
    },
    sprint: {
      id: "sprint", name: "Sprint", icon: "⚡", tone: "blue",
      description: "Despeja la arquitectura antes de que termine el despliegue.",
      detail: "04:00 · Puntuación ×2", duration: 240, showClock: true,
      hintLimit: 3, shuffleLimit: 1, hintPenalty: 200, shufflePenalty: 500,
      scoreMultiplier: 2, allowUndo: false
    },
    architect: {
      id: "architect", name: "Architect", icon: "⌘", tone: "purple",
      description: "Completa arquitecturas reales encontrando sus servicios clave.",
      detail: `${ARCHITECTURES.length} arquitecturas + bonificaciones`, duration: null, showClock: true,
      hintLimit: 3, shuffleLimit: 2, hintPenalty: 100, shufflePenalty: 300,
      scoreMultiplier: 1.25, allowUndo: true, architectures: true
    }
  };

  let host = null;
  let state = null;
  let timerId = null;
  let toastTimer = null;
  let exitCallback = null;

  function safeReadStats() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { played: 0, wins: 0, bestScore: 0, bestTime: null, totalPairs: 0, modeWins: {}, architectureWins: {}, ...stored };
    } catch (_) {
      return { played: 0, wins: 0, bestScore: 0, bestTime: null, totalPairs: 0, modeWins: {}, architectureWins: {} };
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Storage is optional. */ }
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function createLayout() {
    const positions = [];
    let id = 0;
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 8; x += 1) positions.push({ id: id++, x, y, z: 0 });
    }
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 2; x <= 5; x += 1) positions.push({ id: id++, x, y, z: 1 });
    }
    return positions;
  }

  function isPositionFree(position, occupied, positions) {
    const covered = positions.some((other) =>
      occupied.has(other.id) && other.z > position.z && other.x === position.x && other.y === position.y
    );
    if (covered) return false;

    const leftBlocked = positions.some((other) =>
      occupied.has(other.id) && other.z === position.z && other.y === position.y && other.x === position.x - 1
    );
    const rightBlocked = positions.some((other) =>
      occupied.has(other.id) && other.z === position.z && other.y === position.y && other.x === position.x + 1
    );
    return !leftBlocked || !rightBlocked;
  }

  function createRemovalPlan(positions) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const occupied = new Set(positions.map((position) => position.id));
      const pairs = [];

      while (occupied.size) {
        const free = positions.filter((position) => occupied.has(position.id) && isPositionFree(position, occupied, positions));
        if (free.length < 2) break;
        const choices = shuffle(free);
        const first = choices[0];
        const second = choices.find((position) => position.id !== first.id);
        pairs.push([first.id, second.id]);
        occupied.delete(first.id);
        occupied.delete(second.id);
      }

      if (!occupied.size) return pairs;
    }
    throw new Error("No fue posible generar un tablero solucionable.");
  }

  function assignServices(positions, pairServices) {
    const plan = createRemovalPlan(positions);
    const assignments = new Map();
    const shuffledServices = shuffle(pairServices);
    plan.forEach((pair, index) => {
      assignments.set(pair[0], shuffledServices[index]);
      assignments.set(pair[1], shuffledServices[index]);
    });
    return assignments;
  }

  function buildServicePool(architecture) {
    if (!architecture) return CORE_SERVICE_IDS;
    const required = [...architecture.services];
    const extras = shuffle(SERVICES.map((service) => service.id).filter((id) => !required.includes(id)));
    return [...required, ...extras.slice(0, 12 - required.length)];
  }

  function buildTiles(serviceIds = CORE_SERVICE_IDS) {
    const positions = createLayout();
    const pairServices = serviceIds.flatMap((serviceId) => [serviceId, serviceId]);
    const assignments = assignServices(positions, pairServices);
    return positions.map((position) => ({ ...position, serviceId: assignments.get(position.id), removed: false }));
  }

  function getOccupied() {
    return new Set(state.tiles.filter((tile) => !tile.removed).map((tile) => tile.id));
  }

  function getFreeTiles() {
    const occupied = getOccupied();
    return state.tiles.filter((tile) => !tile.removed && isPositionFree(tile, occupied, state.tiles));
  }

  function findAvailablePairs() {
    const byService = new Map();
    getFreeTiles().forEach((tile) => {
      if (!byService.has(tile.serviceId)) byService.set(tile.serviceId, []);
      byService.get(tile.serviceId).push(tile);
    });
    return [...byService.values()].filter((tiles) => tiles.length >= 2).map((tiles) => [tiles[0], tiles[1]]);
  }

  function getService(id) {
    return SERVICES.find((service) => service.id === id);
  }

  function iconSvg(type) {
    const icons = {
      server: '<rect x="6" y="5" width="20" height="8" rx="2"/><rect x="6" y="19" width="20" height="8" rx="2"/><circle cx="10" cy="9" r="1.3" class="cut"/><circle cx="10" cy="23" r="1.3" class="cut"/><path d="M14 9h8M14 23h8" class="line"/>',
      lambda: '<path d="M10 5h7l9 22h-7l-4-10-5 10H4l8-16-2-6Z"/>',
      containers: '<path d="m16 4 10 5.5v12L16 28 6 22V10L16 4Zm0 0v12m10-6.5-10 6.5L6 10m0 12 10-6 10 5.5" class="line fill-soft"/>',
      bucket: '<path d="M6 10h20l-2 17H8L6 10Z"/><path d="M10 10V8a6 6 0 0 1 12 0v2" class="line"/>',
      volume: '<path d="M5 9h22v15H5z"/><path d="M9 13h14v7H9z" class="cut"/><path d="M2 13v7M30 13v7" class="line"/>',
      database: '<ellipse cx="16" cy="8" rx="10" ry="4"/><path d="M6 8v16c0 2 4.5 4 10 4s10-2 10-4V8"/><path d="M6 16c0 2 4.5 4 10 4s10-2 10-4" class="line cut-line"/>',
      relational: '<ellipse cx="16" cy="8" rx="10" ry="4"/><path d="M6 8v16c0 2 4.5 4 10 4s10-2 10-4V8"/><text x="16" y="21" text-anchor="middle" class="icon-letter">R</text>',
      globe: '<circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c4 4 6 8 6 12s-2 8-6 12c-4-4-6-8-6-12s2-8 6-12Z" class="line cut-line"/>',
      route: '<circle cx="8" cy="8" r="4"/><circle cx="24" cy="24" r="4"/><path d="M11 10c9 2 1 9 10 12" class="line"/><text x="21" y="11" class="icon-letter small">53</text>',
      identity: '<circle cx="16" cy="10" r="6"/><path d="M5 28c1-8 5-11 11-11s10 3 11 11H5Z"/>',
      key: '<circle cx="11" cy="13" r="7" fill="none" class="line thick"/><path d="m16 18 11 10m-4-4 4-4m-8 0 3-3" class="line thick"/>',
      pulse: '<circle cx="16" cy="16" r="12" fill="none" class="line"/><path d="M6 17h5l2-6 4 12 3-7h6" class="line thick"/>',
      file: '<path d="M4 8h10l3 4h11v14H4V8Z"/><path d="M8 16h16M8 20h12" class="line cut-line"/>',
      cache: '<circle cx="16" cy="16" r="12"/><path d="m18 6-8 11h6l-2 9 8-12h-6l2-8Z" class="cut"/>',
      warehouse: '<path d="M4 27V10l12-6 12 6v17H4Z"/><path d="M9 14h4v4H9zm10 0h4v4h-4zM9 22h14" class="cut"/>',
      gateway: '<path d="M11 5H5v22h6M21 5h6v22h-6M9 16h14m-4-4 4 4-4 4" class="line thick"/>',
      loadbalance: '<circle cx="7" cy="16" r="4"/><circle cx="25" cy="8" r="4"/><circle cx="25" cy="24" r="4"/><path d="M11 16h5c4 0 3-8 5-8m-5 8c4 0 3 8 5 8" class="line"/>',
      network: '<path d="m16 3 13 7v12l-13 7-13-7V10l13-7Z" fill="none" class="line"/><circle cx="10" cy="16" r="3"/><circle cx="22" cy="11" r="3"/><circle cx="22" cy="22" r="3"/><path d="m13 15 6-3m-6 5 6 4" class="line"/>',
      userlock: '<circle cx="12" cy="10" r="5"/><path d="M3 25c1-7 4-10 9-10 3 0 5 1 6 3"/><rect x="17" y="18" width="12" height="10" rx="2"/><path d="M20 18v-2a3 3 0 0 1 6 0v2" class="line"/>',
      firewall: '<path d="M16 3 28 8v8c0 7-5 11-12 14C9 27 4 23 4 16V8l12-5Z"/><path d="M9 12h14M9 17h14M12 9v6m8-6v6m-5 0v6m8-6v6M9 21h14" class="line cut-line"/>',
      secret: '<rect x="5" y="8" width="22" height="19" rx="3"/><circle cx="16" cy="16" r="3" class="cut"/><path d="M16 19v4" class="line cut-line thick"/>',
      queue: '<rect x="4" y="6" width="24" height="5" rx="2"/><rect x="4" y="14" width="18" height="5" rx="2"/><rect x="4" y="22" width="12" height="5" rx="2"/>',
      broadcast: '<circle cx="16" cy="16" r="3"/><path d="M10 10a8 8 0 0 0 0 12m12-12a8 8 0 0 1 0 12M6 6a14 14 0 0 0 0 20m20-20a14 14 0 0 1 0 20" class="line"/>',
      events: '<circle cx="16" cy="16" r="4"/><circle cx="6" cy="7" r="3"/><circle cx="26" cy="7" r="3"/><circle cx="26" cy="25" r="3"/><circle cx="6" cy="25" r="3"/><path d="m9 9 4 4m6 0 4-4m0 14-4-4m-6 0-4 4" class="line"/>',
      workflow: '<rect x="3" y="5" width="9" height="7" rx="2"/><rect x="20" y="13" width="9" height="7" rx="2"/><rect x="3" y="21" width="9" height="7" rx="2"/><path d="M12 8h4c3 0 2 8 4 8m0 0c-2 0-1 8-4 8h-4" class="line"/>',
      stream: '<path d="M3 10c5-5 8 5 13 0s8 5 13 0M3 17c5-5 8 5 13 0s8 5 13 0M3 24c5-5 8 5 13 0s8 5 13 0" class="line thick"/>',
      graph: '<circle cx="7" cy="23" r="4"/><circle cx="16" cy="8" r="4"/><circle cx="26" cy="22" r="4"/><path d="m9 19 5-8m5 0 5 8M11 23h11" class="line"/>'
    };
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${icons[type] || icons.server}</svg>`;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function elapsedSeconds() {
    if (!state || !state.startedAt) return 0;
    const end = state.finishedAt || Date.now();
    return Math.floor((end - state.startedAt) / 1000);
  }

  function currentMode() {
    return MODES[state?.modeId] || MODES.classic;
  }

  function currentArchitecture() {
    return ARCHITECTURES.find((architecture) => architecture.id === state?.architectureId) || null;
  }

  function clockSeconds() {
    const mode = currentMode();
    return mode.duration === null ? elapsedSeconds() : Math.max(0, mode.duration - elapsedSeconds());
  }

  function initialMarkup() {
    return `
      <section class="cloudjong-shell" aria-label="Cloudjong">
        <div class="cj-topbar">
          <div class="cj-title-block"><span class="cj-game-icon">◇</span><div><span>MAHJONG SOLITAIRE</span><h1>Cloudjong <b id="cj-mode-badge" class="cj-mode-badge">Classic</b></h1></div></div>
          <div class="cj-toolbar" aria-label="Controles de partida">
            <button type="button" data-cj-action="undo" title="Deshacer último par"><span>↶</span> Deshacer</button>
            <button type="button" data-cj-action="hint" title="Mostrar una pareja disponible"><span>◎</span> <span id="cj-hint-label">Pista</span></button>
            <button type="button" data-cj-action="shuffle" title="Barajar fichas restantes"><span>⇄</span> <span id="cj-shuffle-label">Barajar</span></button>
            <button type="button" class="new-game-button" data-cj-action="new"><span>▦</span> Modos</button>
          </div>
        </div>

        <div class="cj-dashboard">
          <div class="cj-stat" id="cj-time-stat"><span>TIEMPO</span><strong id="cj-time">00:00</strong></div>
          <div class="cj-stat"><span>PUNTUACIÓN</span><strong id="cj-score">0</strong></div>
          <div class="cj-mission">
            <span class="mission-label">MISIÓN ACTUAL</span>
            <div id="cj-mission-content"><i></i><span><strong>Clear the Stack</strong><small>Despeja toda la arquitectura</small></span></div>
          </div>
          <div class="cj-stat"><span>COMBO</span><strong id="cj-combo">×1</strong></div>
          <div class="cj-stat"><span>PARES</span><strong id="cj-pairs">0 / 24</strong></div>
        </div>

        <div class="cj-board-frame">
          <div class="board-ambient ambient-one"></div><div class="board-ambient ambient-two"></div>
          <div class="cj-board-label"><span><i></i> REGION: CLOUD-ARCADE-1</span><span id="cj-moves">Calculando movimientos…</span></div>
          <div id="cj-board" class="cj-board" role="group" aria-label="Tablero de fichas"></div>
          <div id="cj-overlay" class="cj-overlay" hidden></div>
        </div>

        <div class="cj-bottom-panel">
          <div class="category-legend">
            ${Object.entries(CATEGORY_NAMES).map(([id, name]) => `<span class="legend-${id}"><i></i>${name}</span>`).join("")}
          </div>
          <div class="cj-tip"><span>ℹ</span><p><strong>¿Cómo jugar?</strong> Elige dos servicios iguales. Una ficha está libre si no tiene otra encima y uno de sus lados está abierto.</p></div>
        </div>
        <div id="cj-toast" class="cj-toast" role="status" aria-live="polite"></div>
      </section>`;
  }

  function renderBoard() {
    if (!host || !state) return;
    const board = host.querySelector("#cj-board");
    const freeIds = new Set(getFreeTiles().map((tile) => tile.id));

    board.innerHTML = state.tiles.filter((tile) => !tile.removed).map((tile) => {
      const service = getService(tile.serviceId);
      const selected = tile.id === state.selectedId;
      const hinted = state.hintIds.includes(tile.id);
      const isFree = freeIds.has(tile.id);
      return `
        <button class="cj-tile category-${service.category} ${selected ? "is-selected" : ""} ${hinted ? "is-hinted" : ""} ${isFree ? "is-free" : "is-locked"}"
          type="button" data-tile-id="${tile.id}" style="--x:${tile.x};--y:${tile.y};--z:${tile.z}"
          ${isFree ? "" : "disabled"} aria-label="${service.fullName}${isFree ? ", ficha libre" : ", ficha bloqueada"}">
          <span class="tile-depth"></span>
          <span class="tile-face">
            <span class="service-icon">${iconSvg(service.icon)}</span>
            <strong>${service.name}</strong>
            <small>${CATEGORY_NAMES[service.category]}</small>
            <i class="tile-status"></i>
          </span>
        </button>`;
    }).join("");

    updateDashboard();
  }

  function updateDashboard() {
    const mode = currentMode();
    const remaining = state.tiles.filter((tile) => !tile.removed).length;
    const matches = (state.tiles.length - remaining) / 2;
    const pairs = findAvailablePairs();
    const timeStat = host.querySelector("#cj-time-stat");
    const time = host.querySelector("#cj-time");
    const hintRemaining = mode.hintLimit === null ? null : Math.max(0, mode.hintLimit - state.hintsUsed);
    const shuffleRemainingCount = mode.shuffleLimit === null ? null : Math.max(0, mode.shuffleLimit - state.shufflesUsed);

    time.textContent = mode.showClock ? formatTime(clockSeconds()) : "∞";
    timeStat.classList.toggle("is-urgent", Boolean(mode.duration && clockSeconds() <= 30 && state.startedAt));
    host.querySelector("#cj-score").textContent = state.score.toLocaleString("es-ES");
    host.querySelector("#cj-combo").textContent = `×${state.combo}`;
    host.querySelector("#cj-pairs").textContent = `${matches} / ${state.tiles.length / 2}`;
    host.querySelector("#cj-moves").textContent = remaining ? `${pairs.length} ${pairs.length === 1 ? "pareja disponible" : "parejas disponibles"}` : "Stack completado";
    host.querySelector("#cj-mode-badge").textContent = mode.name;
    host.querySelector("#cj-mode-badge").className = `cj-mode-badge mode-${mode.tone}`;
    host.querySelector("#cj-hint-label").textContent = hintRemaining === null ? "Pista" : `Pista · ${hintRemaining}`;
    host.querySelector("#cj-shuffle-label").textContent = shuffleRemainingCount === null ? "Barajar" : `Barajar · ${shuffleRemainingCount}`;

    const undo = host.querySelector('[data-cj-action="undo"]');
    const hint = host.querySelector('[data-cj-action="hint"]');
    const shuffleButton = host.querySelector('[data-cj-action="shuffle"]');
    if (undo) undo.disabled = !mode.allowUndo || !state.history.length || state.busy;
    if (hint) hint.disabled = state.busy || hintRemaining === 0;
    if (shuffleButton) shuffleButton.disabled = state.busy || shuffleRemainingCount === 0;

    const mission = host.querySelector("#cj-mission-content");
    const architecture = currentArchitecture();
    if (architecture) {
      mission.innerHTML = `
        <i></i><span class="mission-summary"><strong>${architecture.name}</strong><small>${architecture.tier} · ${architecture.services.length} servicios clave</small></span>
        <span class="mission-services">${architecture.services.map((id) => {
          const service = getService(id);
          return `<b class="${state.missionCompleted.has(id) ? "is-complete" : ""}" title="${service.fullName}">${state.missionCompleted.has(id) ? "✓" : service.name}</b>`;
        }).join("")}</span>`;
    } else {
      mission.innerHTML = `<i></i><span class="mission-summary"><strong>${mode.name === "Sprint" ? "Beat the Clock" : "Clear the Stack"}</strong><small>${mode.name === "Sprint" ? "Despeja todo antes del timeout" : "Despeja toda la arquitectura"}</small></span>`;
    }
  }

  function startTimer() {
    if (state.startedAt || state.finishedAt) return;
    state.startedAt = Date.now();
    if (!currentMode().showClock) return;
    timerId = window.setInterval(() => {
      if (!host || !state) return;
      const time = host.querySelector("#cj-time");
      if (time) time.textContent = formatTime(clockSeconds());
      if (currentMode().duration && clockSeconds() <= 0) finishTimeout();
      else updateDashboard();
    }, 1000);
  }

  function showToast(service, message) {
    const toast = host.querySelector("#cj-toast");
    window.clearTimeout(toastTimer);
    toast.innerHTML = `<span class="toast-icon category-${service.category}">${iconSvg(service.icon)}</span><span><strong>${message || service.fullName}</strong><small>${service.description}</small></span>`;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function selectTile(tileId) {
    if (state.busy || state.finishedAt) return;
    const tile = state.tiles.find((entry) => entry.id === tileId);
    if (!tile || tile.removed || !getFreeTiles().some((free) => free.id === tileId)) return;
    startTimer();

    if (state.selectedId === tileId) {
      state.selectedId = null;
      renderBoard();
      return;
    }

    if (state.selectedId === null) {
      state.selectedId = tileId;
      renderBoard();
      return;
    }

    const selected = state.tiles.find((entry) => entry.id === state.selectedId);
    if (selected.serviceId !== tile.serviceId) {
      state.selectedId = tileId;
      renderBoard();
      return;
    }

    removePair(selected, tile);
  }

  function removePair(first, second) {
    state.busy = true;
    const mode = currentMode();
    const architecture = currentArchitecture();
    const previous = {
      ids: [first.id, second.id], score: state.score, combo: state.combo,
      lastMatchAt: state.lastMatchAt, missionCompleted: [...state.missionCompleted]
    };
    const now = Date.now();
    state.combo = state.lastMatchAt && now - state.lastMatchAt < 5000 ? Math.min(state.combo + 1, 3) : 1;
    state.lastMatchAt = now;
    state.score += Math.round(100 * state.combo * mode.scoreMultiplier);
    state.selectedId = null;
    state.history.push(previous);

    host.querySelectorAll(`[data-tile-id="${first.id}"], [data-tile-id="${second.id}"]`).forEach((element) => element.classList.add("is-removing"));

    window.setTimeout(() => {
      if (!state || state.finishedAt) return;
      first.removed = true;
      second.removed = true;
      state.busy = false;
      const stats = safeReadStats();
      stats.totalPairs += 1;
      saveStats(stats);
      const service = getService(first.serviceId);
      const completedMissionStep = architecture && architecture.services.includes(service.id) && !state.missionCompleted.has(service.id);
      if (completedMissionStep) {
        state.missionCompleted.add(service.id);
        state.score += 500;
        showToast(service, `${service.fullName} conectado · +500`);
      } else if (!state.discovered.has(service.id)) {
        state.discovered.add(service.id);
        showToast(service, `${service.fullName} desbloqueado`);
      }
      renderBoard();
      evaluateBoard();
    }, 240);
  }

  function evaluateBoard() {
    const remaining = state.tiles.filter((tile) => !tile.removed).length;
    if (!remaining) {
      state.finishedAt = Date.now();
      window.clearInterval(timerId);
      const stats = safeReadStats();
      const seconds = elapsedSeconds();
      stats.wins += 1;
      stats.modeWins = stats.modeWins || {};
      stats.modeWins[state.modeId] = (stats.modeWins[state.modeId] || 0) + 1;
      if (state.architectureId) {
        stats.architectureWins = stats.architectureWins || {};
        stats.architectureWins[state.architectureId] = (stats.architectureWins[state.architectureId] || 0) + 1;
      }
      stats.bestScore = Math.max(stats.bestScore || 0, state.score);
      if (currentMode().showClock) stats.bestTime = stats.bestTime === null ? seconds : Math.min(stats.bestTime, seconds);
      saveStats(stats);
      const missionBonus = currentArchitecture() ? " La arquitectura objetivo también quedó conectada." : "";
      const timeSummary = currentMode().showClock ? ` en ${formatTime(seconds)}` : "";
      showOverlay("win", "Arquitectura despejada", `Completaste ${currentMode().name}${timeSummary} con ${state.score.toLocaleString("es-ES")} puntos.${missionBonus}`);
    } else if (!findAvailablePairs().length) {
      const mode = currentMode();
      const canShuffle = mode.shuffleLimit === null || state.shufflesUsed < mode.shuffleLimit;
      showOverlay("stuck", "Sin movimientos", canShuffle ? "No quedan parejas accesibles. Baraja las fichas para continuar esta partida." : "No quedan parejas accesibles y ya utilizaste todos los barajados de este modo.");
    }
  }

  function finishTimeout() {
    if (!state || state.finishedAt) return;
    state.finishedAt = Date.now();
    state.busy = true;
    window.clearInterval(timerId);
    updateDashboard();
    const pairs = (state.tiles.length - state.tiles.filter((tile) => !tile.removed).length) / 2;
    showOverlay("timeout", "Deployment timeout", `El reloj llegó a cero. Despejaste ${pairs} de ${state.tiles.length / 2} pares y sumaste ${state.score.toLocaleString("es-ES")} puntos.`);
  }

  function showOverlay(type, title, copy) {
    const overlay = host.querySelector("#cj-overlay");
    const mode = currentMode();
    const canShuffle = mode.shuffleLimit === null || state.shufflesUsed < mode.shuffleLimit;
    const meta = {
      win: { symbol: "✓", label: "STACK COMPLETADO" },
      stuck: { symbol: "⇄", label: "ARQUITECTURA BLOQUEADA" },
      timeout: { symbol: "00", label: "TIEMPO AGOTADO" }
    }[type];
    overlay.className = "cj-overlay";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card ${type === "win" ? "is-win" : ""} ${type === "timeout" ? "is-timeout" : ""}">
        <span class="overlay-symbol">${meta.symbol}</span>
        <span class="eyebrow">${meta.label}</span>
        <h2>${title}</h2><p>${copy}</p>
        <div>
          ${type === "stuck" && canShuffle ? '<button type="button" class="primary-button" data-cj-action="shuffle">Barajar fichas <span>⇄</span></button>' : '<button type="button" class="primary-button" data-cj-action="replay">Repetir modo <span>→</span></button>'}
          <button type="button" class="secondary-button" data-cj-action="new">Elegir modo</button>
          <button type="button" class="overlay-text-button" data-cj-action="exit">Volver al centro</button>
        </div>
      </div>`;
  }

  function showModeSelection() {
    state.busy = true;
    updateDashboard();
    const overlay = host.querySelector("#cj-overlay");
    overlay.className = "cj-overlay is-mode-picker";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="mode-picker">
        <div class="mode-picker-heading">
          <span class="eyebrow">CONFIGURA TU PARTIDA</span>
          <h2>Selecciona un modo</h2>
          <p>El tablero es el mismo. Cambian la presión, las ayudas y los objetivos.</p>
        </div>
        <div class="mode-grid">
          ${Object.values(MODES).map((mode) => `
            <button type="button" class="mode-card mode-${mode.tone}" data-cj-mode="${mode.id}">
              <span class="mode-card-icon">${mode.icon}</span>
              <span class="mode-card-copy"><span>${mode.name}</span><small>${mode.description}</small></span>
              <strong>${mode.detail}</strong><i>→</i>
            </button>`).join("")}
        </div>
        <button type="button" class="mode-picker-exit" data-cj-action="exit">← Volver al centro de juegos</button>
      </div>`;
  }

  function showArchitectureSelection() {
    state.busy = true;
    const stats = safeReadStats();
    const architectureWins = stats.architectureWins || {};
    const completed = ARCHITECTURES.filter((architecture) => architectureWins[architecture.id]).length;
    const overlay = host.querySelector("#cj-overlay");
    overlay.className = "cj-overlay is-mode-picker is-architecture-picker";
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="architecture-picker">
        <div class="architecture-picker-header">
          <button type="button" data-cj-action="back-modes">← Modos</button>
          <div><span class="eyebrow">ARCHITECT CHALLENGES</span><h2>Elige una arquitectura</h2><p>Cada stack garantiza que sus servicios clave aparezcan en el tablero.</p></div>
          <span class="architecture-progress"><strong>${completed}</strong> / ${ARCHITECTURES.length}<small>completadas</small></span>
        </div>
        <div class="architecture-filters" role="group" aria-label="Filtrar por dificultad">
          <button type="button" class="is-active" data-architecture-filter="all">Todas</button>
          <button type="button" data-architecture-filter="Foundation">Foundation</button>
          <button type="button" data-architecture-filter="Intermediate">Intermediate</button>
          <button type="button" data-architecture-filter="Advanced">Advanced</button>
        </div>
        <div class="architecture-grid">
          ${ARCHITECTURES.map((architecture, index) => {
            const wins = architectureWins[architecture.id] || 0;
            return `
              <button type="button" class="architecture-card tier-${architecture.tier.toLowerCase()} ${wins ? "is-completed" : ""}" data-cj-architecture="${architecture.id}" data-architecture-tier="${architecture.tier}">
                <span class="architecture-card-number">${(index + 1).toString().padStart(2, "0")}</span>
                <span class="architecture-card-main"><span>${architecture.tier}</span><strong>${architecture.name}</strong><small>${architecture.summary}</small></span>
                <span class="architecture-services">${architecture.services.map((id) => `<i>${getService(id).name}</i>`).join("")}</span>
                <span class="architecture-launch">${wins ? `✓ ${wins} completada${wins > 1 ? "s" : ""}` : "Desplegar →"}</span>
              </button>`;
          }).join("")}
        </div>
      </div>`;
  }

  function filterArchitectures(tier, sourceButton) {
    host.querySelectorAll("[data-architecture-filter]").forEach((button) => button.classList.toggle("is-active", button === sourceButton));
    host.querySelectorAll("[data-architecture-tier]").forEach((card) => {
      card.hidden = tier !== "all" && card.dataset.architectureTier !== tier;
    });
  }

  function hideOverlay() {
    const overlay = host.querySelector("#cj-overlay");
    overlay.className = "cj-overlay";
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  function useHint() {
    if (state.busy || state.finishedAt) return;
    const mode = currentMode();
    if (mode.hintLimit !== null && state.hintsUsed >= mode.hintLimit) return;
    const pairs = findAvailablePairs();
    if (!pairs.length) { evaluateBoard(); return; }
    startTimer();
    state.hintsUsed += 1;
    state.score = Math.max(0, state.score - mode.hintPenalty);
    state.hintIds = pairs[Math.floor(Math.random() * pairs.length)].map((tile) => tile.id);
    renderBoard();
    window.setTimeout(() => {
      if (!state) return;
      state.hintIds = [];
      renderBoard();
    }, 1700);
  }

  function shuffleRemaining() {
    if (state.busy || state.finishedAt) return;
    const mode = currentMode();
    if (mode.shuffleLimit !== null && state.shufflesUsed >= mode.shuffleLimit) return;
    const remaining = state.tiles.filter((tile) => !tile.removed);
    if (remaining.length < 2) return;
    startTimer();

    const counts = remaining.reduce((map, tile) => map.set(tile.serviceId, (map.get(tile.serviceId) || 0) + 1), new Map());
    const pairServices = [];
    counts.forEach((count, serviceId) => {
      for (let index = 0; index < count / 2; index += 1) pairServices.push(serviceId);
    });

    const assignments = assignServices(remaining, pairServices);
    remaining.forEach((tile) => { tile.serviceId = assignments.get(tile.id); });
    state.shufflesUsed += 1;
    state.score = Math.max(0, state.score - mode.shufflePenalty);
    state.combo = 1;
    state.selectedId = null;
    state.hintIds = [];
    hideOverlay();
    renderBoard();
    const service = SERVICES.find((entry) => entry.id === remaining[0].serviceId);
    showToast(service, "Stack reorganizado");
  }

  function undoPair() {
    if (state.busy || state.finishedAt || !state.history.length || !currentMode().allowUndo) return;
    const previous = state.history.pop();
    previous.ids.forEach((id) => { state.tiles.find((tile) => tile.id === id).removed = false; });
    state.score = previous.score;
    state.combo = previous.combo;
    state.lastMatchAt = previous.lastMatchAt;
    state.missionCompleted = new Set(previous.missionCompleted);
    state.selectedId = null;
    hideOverlay();
    renderBoard();
  }

  function createGameState(modeId, architectureId = null) {
    const architecture = modeId === "architect"
      ? ARCHITECTURES.find((entry) => entry.id === architectureId) || ARCHITECTURES[0]
      : null;
    const servicePool = buildServicePool(architecture);
    return {
      modeId, architectureId: architecture?.id || null, servicePool,
      tiles: buildTiles(servicePool), selectedId: null, hintIds: [], history: [], discovered: new Set(), missionCompleted: new Set(),
      hintsUsed: 0, shufflesUsed: 0, score: 0, combo: 1, lastMatchAt: null,
      startedAt: null, finishedAt: null, busy: false
    };
  }

  function startGame(modeId, architectureId = null) {
    const selectedMode = MODES[modeId] ? modeId : "classic";
    window.clearInterval(timerId);
    state = createGameState(selectedMode, architectureId);
    const stats = safeReadStats();
    stats.played += 1;
    saveStats(stats);
    hideOverlay();
    renderBoard();
  }

  function chooseModes() {
    if (state?.busy && !state.finishedAt) return;
    if (state?.startedAt && !state.finishedAt && !window.confirm("¿Quieres abandonar esta partida y elegir otro modo?")) return;
    window.clearInterval(timerId);
    const previewMode = state?.modeId || "classic";
    state = createGameState(previewMode);
    renderBoard();
    showModeSelection();
  }

  function handleClick(event) {
    const architecture = event.target.closest("[data-cj-architecture]");
    if (architecture) { startGame("architect", architecture.dataset.cjArchitecture); return; }
    const filter = event.target.closest("[data-architecture-filter]");
    if (filter) { filterArchitectures(filter.dataset.architectureFilter, filter); return; }
    const modeChoice = event.target.closest("[data-cj-mode]");
    if (modeChoice) {
      if (modeChoice.dataset.cjMode === "architect") showArchitectureSelection();
      else startGame(modeChoice.dataset.cjMode);
      return;
    }
    const tile = event.target.closest("[data-tile-id]");
    if (tile) { selectTile(Number(tile.dataset.tileId)); return; }
    const action = event.target.closest("[data-cj-action]")?.dataset.cjAction;
    if (!action) return;
    if (action === "undo") undoPair();
    if (action === "hint") useHint();
    if (action === "shuffle") shuffleRemaining();
    if (action === "new") chooseModes();
    if (action === "back-modes") showModeSelection();
    if (action === "replay") startGame(state.modeId, state.architectureId);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function mount(container, onExit) {
    destroy();
    host = container;
    exitCallback = onExit;
    host.innerHTML = initialMarkup();
    host.addEventListener("click", handleClick);
    state = createGameState("classic");
    renderBoard();
    showModeSelection();
  }

  function destroy() {
    window.clearInterval(timerId);
    window.clearTimeout(toastTimer);
    if (host) host.removeEventListener("click", handleClick);
    host = null;
    state = null;
    exitCallback = null;
  }

  window.Cloudjong = {
    mount,
    destroy,
    getStats: safeReadStats,
    getModes: () => Object.values(MODES).map((mode) => ({ ...mode })),
    getArchitectures: () => ARCHITECTURES.map((architecture) => ({ ...architecture, services: [...architecture.services] }))
  };
}());
