/* Incident Commander — dependency-free AWS operations simulation for Cloud Arcade. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:incident-commander:stats";
  const executingScript = document.currentScript;
  const STYLE_URL = executingScript && executingScript.src
    ? new URL("../../css/incident-commander.css", executingScript.src).href
    : "css/incident-commander.css";

  const MODES = {
    campaign: {
      id: "campaign", name: "Campaign", icon: "⌁", tone: "orange",
      description: "Dirige una guardia completa. Cada incidente desbloquea el siguiente y la campaña conserva tu progreso.",
      detail: "9 incidentes · progresión persistente"
    },
    drill: {
      id: "drill", name: "Drill", icon: "◎", tone: "cyan",
      description: "Practica cualquier escenario con métricas comparables y sin afectar el progreso de campaña.",
      detail: "Selección libre · respuesta focalizada"
    },
    endless: {
      id: "endless", name: "Endless", icon: "∞", tone: "purple",
      description: "Resuelve incidentes aleatorios consecutivos. El coste y la puntuación se acumulan hasta una derrota.",
      detail: "Guardia infinita · dificultad creciente"
    }
  };

  const INCIDENTS = [
    {
      id: "bad-deploy", code: "INC-1042", title: "Errores tras un despliegue", severity: "SEV-1", domain: "Compute",
      summary: "La API de checkout comenzó a devolver 5xx segundos después de publicar la versión 4.18.0.",
      rootCause: "La versión 4.18.0 cambió el nombre de una variable de entorno y los nuevos tasks no pueden firmar pagos.",
      symptoms: ["Pico de HTTP 500 en /checkout", "Solo los tasks nuevos fallan", "El error empezó tras CodeDeploy"],
      nodes: [["R53", "Route 53", "healthy"], ["ALB", "Load Balancer", "degraded"], ["ECS", "ECS v4.18", "critical"], ["RDS", "Aurora", "healthy"]],
      initial: { availability: 91, latency: 780, error: 9.2, impact: 7 },
      rates: { availability: 1.05, latency: 68, error: 1.1, impact: 2.4, cost: 0.35 }, limit: 42,
      diagnostics: [
        ["cw-compare", "Comparar métricas por task set", 2, 1, "CloudWatch confirma 0,2% de errores en la versión anterior y 28% en v4.18.0."],
        ["deploy-events", "Revisar eventos de CodeDeploy", 3, 1, "El despliegue alcanzó 100% justo antes del primer aumento de errores."],
        ["ecs-logs", "Consultar logs de los tasks", 3, 2, "Los tasks nuevos registran PAYMENT_SIGNING_KEY undefined." ]
      ],
      mitigations: [
        ["rollback", "Revertir a v4.17.3", 4, 4, "optimal", "CodeDeploy restaura el task set estable y drena conexiones sin interrumpir sesiones."],
        ["scale-out", "Duplicar tasks de ECS", 3, 12, "helpful", "Hay más capacidad, pero las nuevas réplicas conservan la configuración defectuosa."],
        ["restart-db", "Reiniciar Aurora", 6, 18, "wrong", "El reinicio corta conexiones sanas y no cambia el código defectuoso."]
      ],
      optimal: { minutes: 9, budget: 7, path: ["Comparar métricas", "Logs de ECS", "Rollback a v4.17.3"] }
    },
    {
      id: "rds-connections", code: "INC-1178", title: "Aurora sin conexiones", severity: "SEV-1", domain: "Database",
      summary: "La base de datos de pedidos llegó al máximo de conexiones; las solicitudes esperan hasta agotar timeout.",
      rootCause: "Una actualización del worker dejó conexiones inactivas abiertas y agotó max_connections.",
      symptoms: ["DatabaseConnections al 100%", "Latencia de checkout creciente", "CPU de Aurora solo al 42%"],
      nodes: [["API", "API Gateway", "degraded"], ["ECS", "Order API", "critical"], ["RDS", "Aurora", "critical"], ["RR", "Read replica", "healthy"]],
      initial: { availability: 88, latency: 1350, error: 13.5, impact: 10 },
      rates: { availability: 1.25, latency: 95, error: 1.4, impact: 2.7, cost: 0.5 }, limit: 38,
      diagnostics: [
        ["rds-metrics", "Inspeccionar métricas de Aurora", 2, 1, "Las conexiones están al límite mientras CPU e IOPS mantienen margen."],
        ["sessions", "Analizar sesiones activas", 4, 2, "El 71% de las sesiones están idle y pertenecen al worker release-92."],
        ["deploy-trace", "Correlacionar despliegues del worker", 3, 1, "release-92 cambió el pool y eliminó el tiempo máximo de inactividad."]
      ],
      mitigations: [
        ["proxy-pool", "Restaurar pool y activar RDS Proxy", 5, 8, "optimal", "El pool libera sesiones ociosas y RDS Proxy amortigua los picos."],
        ["scale-db", "Escalar la instancia de Aurora", 5, 24, "helpful", "El límite aumenta temporalmente, pero la fuga continúa y eleva el coste."],
        ["reboot-writer", "Reiniciar el writer", 7, 15, "wrong", "Las conexiones se cortan y los workers vuelven a llenar el pool defectuoso."]
      ],
      optimal: { minutes: 11, budget: 11, path: ["Métricas de Aurora", "Sesiones activas", "Corregir pool + RDS Proxy"] }
    },
    {
      id: "sqs-backlog", code: "INC-1236", title: "Backlog crítico en SQS", severity: "SEV-2", domain: "Integration",
      summary: "La cola de fulfilment crece más rápido de lo que Lambda procesa los mensajes.",
      rootCause: "Un límite de concurrencia reservado quedó en 5 durante una prueba y estrangula a los consumidores.",
      symptoms: ["ApproximateAgeOfOldestMessage sube", "120.000 mensajes visibles", "Productores y DLQ permanecen normales"],
      nodes: [["EVB", "EventBridge", "healthy"], ["SQS", "Fulfilment queue", "critical"], ["λ", "Consumer Lambda", "degraded"], ["DDB", "DynamoDB", "healthy"]],
      initial: { availability: 95, latency: 3400, error: 3.4, impact: 6 },
      rates: { availability: 0.55, latency: 130, error: 0.45, impact: 2.2, cost: 0.45 }, limit: 48,
      diagnostics: [
        ["queue-age", "Revisar edad y ritmo de la cola", 2, 1, "Llegan 520 mensajes/min y solo se eliminan 85 mensajes/min."],
        ["lambda-concurrency", "Comparar concurrencia de Lambda", 3, 1, "ConcurrentExecutions se mantiene exactamente en 5 sin throttles aguas abajo."],
        ["config-history", "Consultar historial de configuración", 3, 1, "CloudTrail muestra PutFunctionConcurrency=5 durante la prueba de carga."]
      ],
      mitigations: [
        ["raise-concurrency", "Elevar concurrencia con rampa controlada", 4, 7, "optimal", "La concurrencia sube por etapas y vacía la cola sin saturar DynamoDB."],
        ["extend-retention", "Aumentar retención de mensajes", 2, 3, "helpful", "Evita perder mensajes, aunque el backlog continúa creciendo más despacio."],
        ["purge-queue", "Purgar la cola", 2, 30, "wrong", "Se pierden pedidos pendientes y el impacto al cliente aumenta de inmediato."]
      ],
      optimal: { minutes: 9, budget: 9, path: ["Ritmo de la cola", "Concurrencia de Lambda", "Rampa de concurrencia"] }
    },
    {
      id: "lambda-throttling", code: "INC-1309", title: "Throttling en Lambda", severity: "SEV-2", domain: "Serverless",
      summary: "Las funciones de generación de documentos reciben throttling durante el cierre mensual.",
      rootCause: "Otra función sin límite consume la concurrencia regional compartida y deja sin capacidad al generador.",
      symptoms: ["Throttles en document-renderer", "Duración normal al ejecutar", "Concurrencia regional cerca del límite"],
      nodes: [["API", "API Gateway", "degraded"], ["λ1", "Document renderer", "critical"], ["S3", "Document bucket", "healthy"], ["λ2", "Batch importer", "degraded"]],
      initial: { availability: 90, latency: 2100, error: 11.2, impact: 8 },
      rates: { availability: 0.9, latency: 105, error: 1.15, impact: 2.1, cost: 0.4 }, limit: 44,
      diagnostics: [
        ["lambda-metrics", "Desglosar concurrencia por función", 3, 1, "batch-importer usa el 82% de la concurrencia regional."],
        ["quota", "Verificar cuotas y reservas", 2, 1, "document-renderer no tiene concurrencia reservada; el límite regional está lleno."],
        ["batch-logs", "Inspeccionar batch-importer", 3, 2, "Una reimportación histórica lanzó miles de invocaciones no urgentes."]
      ],
      mitigations: [
        ["reserve-capacity", "Limitar batch y reservar concurrencia", 4, 6, "optimal", "El batch se regula y el renderer recibe capacidad garantizada."],
        ["provisioned", "Añadir concurrencia provisionada", 4, 22, "helpful", "Reduce arranques en frío, pero no elimina la competencia por la cuota compartida."],
        ["aggressive-retry", "Reducir backoff de reintentos", 2, 9, "wrong", "La tormenta de reintentos consume todavía más concurrencia regional."]
      ],
      optimal: { minutes: 9, budget: 8, path: ["Concurrencia por función", "Cuotas y reservas", "Limitar batch + reservar"] }
    },
    {
      id: "cloudfront-stale", code: "INC-1411", title: "Contenido obsoleto en CloudFront", severity: "SEV-2", domain: "Edge",
      summary: "Los clientes reciben bundles incompatibles después de una publicación del frontend.",
      rootCause: "index.html se publicó con Cache-Control max-age=86400 y CloudFront conserva referencias a bundles eliminados.",
      symptoms: ["Errores JS solo en algunos edge locations", "El origen S3 tiene la versión correcta", "Forzar recarga no siempre funciona"],
      nodes: [["R53", "Route 53", "healthy"], ["CF", "CloudFront", "critical"], ["S3", "Origin bucket", "healthy"], ["API", "Backend API", "healthy"]],
      initial: { availability: 93, latency: 620, error: 7.8, impact: 9 },
      rates: { availability: 0.7, latency: 42, error: 0.75, impact: 2.5, cost: 0.25 }, limit: 46,
      diagnostics: [
        ["edge-headers", "Comparar headers entre edges", 3, 1, "Los edges afectados responden Age alto y HIT para un index.html anterior."],
        ["origin-check", "Validar objetos del origen S3", 2, 1, "S3 contiene index.html correcto, pero los bundles antiguos ya no existen."],
        ["deploy-manifest", "Revisar manifiesto de publicación", 3, 1, "La regla no-cache de index.html fue omitida por el nuevo pipeline."]
      ],
      mitigations: [
        ["invalidate-fix", "Invalidar index y corregir Cache-Control", 4, 5, "optimal", "La invalidación retira el documento obsoleto y la política evita recurrencias."],
        ["restore-assets", "Restaurar bundles antiguos en S3", 4, 11, "helpful", "Los clientes vuelven a cargar, aunque continúan usando la versión anterior."],
        ["scale-origin", "Escalar el origen", 3, 17, "wrong", "Los cache hits nunca alcanzan el origen y el cambio no afecta el fallo."]
      ],
      optimal: { minutes: 9, budget: 7, path: ["Headers por edge", "Manifiesto de publicación", "Invalidar + corregir caché"] }
    },
    {
      id: "az-failure", code: "INC-1520", title: "Fallo de una Availability Zone", severity: "SEV-1", domain: "Reliability",
      summary: "Una zona perdió conectividad y el balanceador aún envía tráfico a targets que no responden.",
      rootCause: "El health check tolera demasiados fallos y el Auto Scaling Group mantiene 70% de capacidad en la AZ degradada.",
      symptoms: ["Timeouts en aproximadamente un tercio de requests", "Targets de eu-west-1b flapean", "Las otras zonas tienen capacidad disponible"],
      nodes: [["R53", "Route 53", "healthy"], ["ALB", "Multi-AZ ALB", "degraded"], ["1A", "AZ eu-west-1a", "healthy"], ["1B", "AZ eu-west-1b", "critical"], ["RDS", "Aurora Multi-AZ", "degraded"]],
      initial: { availability: 74, latency: 2700, error: 25.5, impact: 18 },
      rates: { availability: 1.35, latency: 115, error: 1.25, impact: 3.3, cost: 0.8 }, limit: 32,
      diagnostics: [
        ["target-health", "Agrupar target health por AZ", 2, 1, "Todos los targets inestables pertenecen a eu-west-1b."],
        ["az-events", "Consultar AWS Health y reachability", 3, 1, "AWS Health confirma degradación de red en eu-west-1b."],
        ["capacity", "Validar capacidad en zonas sanas", 2, 2, "eu-west-1a y 1c pueden absorber el tráfico con un pequeño scale-out."]
      ],
      mitigations: [
        ["evacuate-az", "Evacuar la AZ y escalar zonas sanas", 4, 14, "optimal", "El ALB deja de enrutar a 1b y Auto Scaling repone capacidad en zonas sanas."],
        ["replace-instances", "Reemplazar instancias dentro de 1b", 5, 19, "wrong", "Las instancias nuevas nacen en la misma red degradada y también fallan."],
        ["relax-checks", "Relajar health checks del ALB", 2, 5, "wrong", "Los targets rotos permanecen más tiempo en rotación y aumentan los timeouts."]
      ],
      optimal: { minutes: 8, budget: 17, path: ["Target health por AZ", "Capacidad en zonas sanas", "Evacuar AZ"] }
    },
    {
      id: "iam-secret", code: "INC-1604", title: "Credenciales rotadas no válidas", severity: "SEV-1", domain: "Security",
      summary: "El servicio de facturación perdió acceso a la API de pagos tras una rotación de secreto.",
      rootCause: "Secrets Manager rotó correctamente, pero los pods conservan el secreto anterior en memoria por tiempo indefinido.",
      symptoms: ["AccessDenied desde billing-api", "La rotación terminó sin errores", "Solo fallan pods con más de 6 horas"],
      nodes: [["ALB", "Internal ALB", "healthy"], ["EKS", "Billing pods", "critical"], ["SM", "Secrets Manager", "degraded"], ["KMS", "KMS", "healthy"], ["PAY", "Payment API", "healthy"]],
      initial: { availability: 84, latency: 980, error: 16.8, impact: 13 },
      rates: { availability: 1.15, latency: 76, error: 1.3, impact: 2.8, cost: 0.45 }, limit: 37,
      diagnostics: [
        ["cloudtrail", "Revisar CloudTrail y AccessDenied", 3, 1, "Las denegaciones usan la versión AWSPREVIOUS del secreto."],
        ["secret-versions", "Comparar versiones del secreto", 2, 1, "AWSCURRENT es válida; pods antiguos aún presentan el valor anterior."],
        ["pod-age", "Cruzar edad de pods y errores", 3, 1, "El 100% de los errores viene de pods anteriores a la rotación."]
      ],
      mitigations: [
        ["refresh-secret", "Refrescar secreto y reciclar pods gradualmente", 4, 5, "optimal", "Los pods cargan AWSCURRENT sin cortar todo el servicio y se añade refresco periódico."],
        ["grant-admin", "Adjuntar AdministratorAccess", 2, 28, "wrong", "Amplía privilegios de forma peligrosa y no cambia el secreto que usa la aplicación."],
        ["rollback-secret", "Promover el secreto anterior", 3, 9, "helpful", "Restaura acceso temporal, pero revierte la rotación y mantiene el defecto de refresco." ]
      ],
      optimal: { minutes: 9, budget: 7, path: ["Versiones del secreto", "Edad de pods", "Refresco + reciclado gradual"] }
    },
    {
      id: "nat-saturation", code: "INC-1719", title: "NAT Gateway saturado", severity: "SEV-2", domain: "Networking",
      summary: "Los workloads privados agotan puertos de origen al llamar a un proveedor externo.",
      rootCause: "Todos los subnets de tres AZ comparten un único NAT Gateway y un nuevo worker abre conexiones sin reutilizarlas.",
      symptoms: ["ErrorPortAllocation crece", "Conexiones externas expiran", "Tráfico interno y CPU permanecen normales"],
      nodes: [["ECS", "Private workloads", "degraded"], ["NAT", "Shared NAT", "critical"], ["IGW", "Internet Gateway", "healthy"], ["EXT", "Partner API", "healthy"]],
      initial: { availability: 87, latency: 1850, error: 14.2, impact: 11 },
      rates: { availability: 1.0, latency: 98, error: 1.15, impact: 2.5, cost: 0.7 }, limit: 40,
      diagnostics: [
        ["nat-metrics", "Inspeccionar métricas de NAT Gateway", 2, 1, "ErrorPortAllocation coincide con cada pico de requests externas."],
        ["flow-logs", "Analizar VPC Flow Logs", 4, 2, "Miles de conexiones cortas salen desde el worker hacia la misma IP y puerto."],
        ["routes", "Revisar rutas por AZ", 2, 1, "Los tres subnets enrutan por un único NAT en eu-central-1a."]
      ],
      mitigations: [
        ["nat-per-az", "Desplegar NAT por AZ y reutilizar conexiones", 5, 16, "optimal", "Las rutas distribuyen puertos por zona y el pool HTTP elimina conexiones innecesarias."],
        ["throttle-egress", "Limitar temporalmente los workers", 2, 4, "helpful", "La presión baja y se estabiliza el servicio, pero aumenta el tiempo de procesamiento."],
        ["scale-workers", "Duplicar workers privados", 3, 18, "wrong", "Más workers abren más conexiones y agotan los puertos con mayor rapidez."]
      ],
      optimal: { minutes: 11, budget: 19, path: ["Métricas NAT", "VPC Flow Logs", "NAT por AZ + connection pooling"] }
    },
    {
      id: "dynamodb-hot-key", code: "INC-1843", title: "Partición caliente en DynamoDB", severity: "SEV-2", domain: "Data",
      summary: "Una campaña concentra escrituras en una sola clave y dispara throttling en la tabla de sesiones.",
      rootCause: "El partition key usa campaignId sin dispersión; todo el tráfico promocional cae en una partición lógica.",
      symptoms: ["WriteThrottleEvents elevados", "Capacidad total sin consumir", "Una campaignId domina Contributor Insights"],
      nodes: [["API", "Campaign API", "degraded"], ["λ", "Session writer", "degraded"], ["DDB", "Sessions table", "critical"], ["KDS", "Analytics stream", "healthy"]],
      initial: { availability: 89, latency: 1450, error: 12.4, impact: 9 },
      rates: { availability: 0.85, latency: 88, error: 1.0, impact: 2.3, cost: 0.55 }, limit: 43,
      diagnostics: [
        ["ddb-metrics", "Comparar consumo y throttling", 2, 1, "La tabla usa 38% de capacidad total, pero una partición recibe casi todas las escrituras."],
        ["contributors", "Abrir Contributor Insights", 3, 2, "campaignId=FLASH-24 genera 86% de los accesos throttled."],
        ["key-schema", "Revisar patrón de partition key", 3, 1, "La clave no tiene sufijo distribuido y concentra la campaña en una partición."]
      ],
      mitigations: [
        ["write-sharding", "Aplicar write sharding y backoff", 5, 10, "optimal", "Las escrituras se reparten entre sufijos y los clientes reintentan con jitter."],
        ["on-demand", "Cambiar temporalmente a on-demand", 3, 18, "helpful", "Aporta margen adaptativo, aunque una única partición sigue teniendo un techo físico."],
        ["disable-backoff", "Reintentar inmediatamente", 2, 7, "wrong", "Los reintentos sincronizados amplifican la carga sobre la partición caliente."]
      ],
      optimal: { minutes: 10, budget: 13, path: ["Contributor Insights", "Esquema de clave", "Write sharding + backoff"] }
    }
  ].map((incident) => ({
    ...incident,
    diagnostics: incident.diagnostics.map((item) => ({ id: item[0], label: item[1], duration: item[2], cost: item[3], clue: item[4] })),
    mitigations: incident.mitigations.map((item) => ({ id: item[0], label: item[1], duration: item[2], cost: item[3], kind: item[4], consequence: item[5] }))
  }));

  let host = null;
  let exitCallback = null;
  let state = null;
  let tickTimer = null;
  let ownedStyle = null;
  const scheduledTimers = new Set();

  function defaultStats() {
    return {
      played: 0, wins: 0, bestScore: 0, incidentsResolved: 0,
      campaignProgress: 0, campaignsCompleted: 0, endlessBest: 0,
      totalCost: 0, totalMttr: 0, modeWins: {}, scenarioBest: {}
    };
  }

  function finite(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function readStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const stored = parsed && typeof parsed === "object" ? parsed : {};
      const defaults = defaultStats();
      return {
        played: finite(stored.played, defaults.played),
        wins: finite(stored.wins, defaults.wins),
        bestScore: finite(stored.bestScore, defaults.bestScore),
        incidentsResolved: finite(stored.incidentsResolved, defaults.incidentsResolved),
        campaignProgress: Math.min(INCIDENTS.length, finite(stored.campaignProgress, defaults.campaignProgress)),
        campaignsCompleted: finite(stored.campaignsCompleted, defaults.campaignsCompleted),
        endlessBest: finite(stored.endlessBest, defaults.endlessBest),
        totalCost: finite(stored.totalCost, defaults.totalCost),
        totalMttr: finite(stored.totalMttr, defaults.totalMttr),
        modeWins: stored.modeWins && typeof stored.modeWins === "object" ? { ...stored.modeWins } : {},
        scenarioBest: stored.scenarioBest && typeof stored.scenarioBest === "object" ? { ...stored.scenarioBest } : {}
      };
    } catch (_) {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Persistence is optional. */ }
  }

  function ensureStyles() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) =>
      link.href === STYLE_URL || link.dataset.incidentCommanderStyle !== undefined);
    if (existing) return;
    ownedStyle = document.createElement("link");
    ownedStyle.rel = "stylesheet";
    ownedStyle.href = STYLE_URL;
    ownedStyle.dataset.incidentCommanderStyle = "";
    document.head.appendChild(ownedStyle);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      scheduledTimers.delete(timer);
      callback();
    }, delay);
    scheduledTimers.add(timer);
    return timer;
  }

  function clearScheduled() {
    scheduledTimers.forEach((timer) => window.clearTimeout(timer));
    scheduledTimers.clear();
  }

  function incidentById(id) {
    return INCIDENTS.find((incident) => incident.id === id) || INCIDENTS[0];
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value || 0);
  }

  function formatTime(minutes) {
    const safe = Math.max(0, Math.round(minutes || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function createState(modeId, incident, carry) {
    const difficulty = modeId === "endless" ? 1 + Math.min(0.75, (carry && carry.streak || 0) * 0.08) : 1;
    const nodeStatus = {};
    incident.nodes.forEach((node) => { nodeStatus[node[0]] = node[2]; });
    return {
      modeId,
      incidentId: incident.id,
      status: "briefing",
      metrics: { ...incident.initial, cost: carry && carry.cost || 0 },
      startingCost: carry && carry.cost || 0,
      rates: Object.fromEntries(Object.entries(incident.rates).map(([key, value]) => [key, value * difficulty])),
      elapsed: 0,
      usedDiagnostics: new Set(),
      usedMitigations: new Set(),
      clues: [],
      logs: [],
      actionHistory: [],
      actionCount: 0,
      wrongActions: 0,
      availabilityTotal: incident.initial.availability,
      availabilitySamples: 1,
      nodeStatus,
      score: 0,
      breakdown: null,
      statsCommitted: false,
      pausedByVisibility: false,
      carry: carry || { streak: 0, score: 0, cost: 0, lastIncidentId: null }
    };
  }

  function currentIncident() {
    return state ? incidentById(state.incidentId) : null;
  }

  function averageAvailability() {
    return state ? state.availabilityTotal / Math.max(1, state.availabilitySamples) : 100;
  }

  function addLog(type, title, detail) {
    if (!state) return;
    state.logs.unshift({ minute: state.elapsed, type, title, detail });
    state.logs = state.logs.slice(0, 30);
  }

  function metricClass(type, value) {
    if (type === "availability") return value >= 97 ? "good" : value >= 75 ? "warn" : "bad";
    if (type === "latency") return value <= 650 ? "good" : value <= 1800 ? "warn" : "bad";
    if (type === "error") return value <= 2 ? "good" : value <= 12 ? "warn" : "bad";
    return value <= 15 ? "good" : value <= 55 ? "warn" : "bad";
  }

  function initialMarkup() {
    return `
      <section class="incident-commander-shell" aria-label="Incident Commander">
        <header class="ic-header">
          <div class="ic-title">
            <span class="ic-title-icon" aria-hidden="true"><i></i><b>!</b></span>
            <div><span>LIVE CLOUD OPERATIONS</span><h1>Incident Commander <b id="ic-mode-name">Standby</b></h1></div>
          </div>
          <div class="ic-header-actions">
            <span id="ic-clock-label" class="ic-clock-label">SIM CLOCK <b>00:00</b></span>
            <button type="button" data-ic-action="pause" id="ic-pause-button"><span>Ⅱ</span> Pausa</button>
            <button type="button" class="ic-modes-button" data-ic-action="modes"><span>⌁</span> Modos</button>
          </div>
        </header>
        <div class="ic-metrics" aria-label="Métricas operativas">
          <div class="ic-metric" data-ic-metric="availability"><span>AVAILABILITY</span><strong id="ic-availability">—</strong><small id="ic-availability-delta">Objetivo 99,9%</small></div>
          <div class="ic-metric" data-ic-metric="latency"><span>P95 LATENCY</span><strong id="ic-latency">—</strong><small>Objetivo &lt; 500 ms</small></div>
          <div class="ic-metric" data-ic-metric="error"><span>ERROR RATE</span><strong id="ic-error">—</strong><small>HTTP 5xx / throttles</small></div>
          <div class="ic-metric" data-ic-metric="impact"><span>CUSTOMER IMPACT</span><strong id="ic-impact">—</strong><small>Sesiones afectadas</small></div>
          <div class="ic-metric" data-ic-metric="cost"><span>RESPONSE COST</span><strong id="ic-cost">—</strong><small>Unidades operativas</small></div>
        </div>
        <div class="ic-workspace">
          <main class="ic-main-column">
            <section class="ic-panel ic-topology-panel" aria-labelledby="ic-topology-title">
              <div class="ic-panel-heading"><div><span>LIVE SERVICE MAP</span><h2 id="ic-topology-title">Topología</h2></div><span id="ic-severity" class="ic-severity">STANDBY</span></div>
              <div id="ic-topology" class="ic-topology" role="img" aria-label="Topología de servicios del incidente"></div>
              <div id="ic-incident-summary" class="ic-incident-summary"></div>
            </section>
            <section class="ic-panel ic-timeline-panel" aria-labelledby="ic-timeline-title">
              <div class="ic-panel-heading"><div><span>INCIDENT ACTIVITY</span><h2 id="ic-timeline-title">Timeline operacional</h2></div><span class="ic-live-dot"><i></i> LIVE</span></div>
              <ol id="ic-timeline" class="ic-timeline" aria-live="polite" aria-relevant="additions"></ol>
            </section>
          </main>
          <aside class="ic-actions-panel" aria-label="Panel de acciones">
            <div class="ic-action-heading"><div><span>COMMAND CONSOLE</span><h2>Responder</h2></div><span id="ic-action-count">0 acciones</span></div>
            <div class="ic-action-scroll">
              <section class="ic-action-group" aria-labelledby="ic-diagnostics-title">
                <div class="ic-group-title"><span class="ic-group-icon is-diagnostic">?</span><div><h3 id="ic-diagnostics-title">Diagnósticos</h3><p>Revelan evidencia, pero el incidente sigue degradándose.</p></div></div>
                <div id="ic-diagnostics" class="ic-action-list"></div>
              </section>
              <section class="ic-action-group" aria-labelledby="ic-mitigations-title">
                <div class="ic-group-title"><span class="ic-group-icon is-mitigation">✓</span><div><h3 id="ic-mitigations-title">Mitigaciones</h3><p>Elige según la evidencia. Una mala acción aumenta el impacto.</p></div></div>
                <div id="ic-mitigations" class="ic-action-list"></div>
              </section>
              <section class="ic-evidence" aria-labelledby="ic-evidence-title">
                <div class="ic-evidence-title"><span>EVIDENCE BOARD</span><strong id="ic-evidence-count">0 pistas</strong></div>
                <ul id="ic-evidence-list"><li>Ejecuta un diagnóstico para reunir evidencia.</li></ul>
                <div id="ic-root-cause" class="ic-root-cause" hidden></div>
              </section>
            </div>
          </aside>
          <div id="ic-overlay" class="ic-overlay" hidden></div>
        </div>
        <div class="ic-statusbar"><span><i class="healthy"></i> Healthy</span><span><i class="degraded"></i> Degraded</span><span><i class="critical"></i> Critical</span><p>1 segundo real = 1 minuto simulado. Diagnósticos y mitigaciones avanzan el reloj.</p></div>
        <div id="ic-notice" class="ic-notice" role="status" aria-live="polite"></div>
      </section>`;
  }

  function setText(selector, text) {
    const element = host && host.querySelector(selector);
    if (element) element.textContent = text;
  }

  function renderMetrics() {
    if (!host) return;
    const metrics = state ? state.metrics : null;
    setText("#ic-availability", metrics ? `${metrics.availability.toFixed(1)}%` : "—");
    setText("#ic-latency", metrics ? `${formatNumber(metrics.latency)} ms` : "—");
    setText("#ic-error", metrics ? `${metrics.error.toFixed(1)}%` : "—");
    setText("#ic-impact", metrics ? `${metrics.impact.toFixed(0)}%` : "—");
    setText("#ic-cost", metrics ? `${metrics.cost.toFixed(0)} u` : "—");
    setText("#ic-clock-label b", formatTime(state ? state.elapsed : 0));
    ["availability", "latency", "error", "impact"].forEach((type) => {
      const card = host.querySelector(`[data-ic-metric="${type}"]`);
      if (!card) return;
      card.classList.remove("is-good", "is-warn", "is-bad");
      if (metrics) card.classList.add(`is-${metricClass(type, metrics[type])}`);
    });
    const costCard = host.querySelector('[data-ic-metric="cost"]');
    if (costCard) costCard.classList.toggle("is-warn", Boolean(metrics && currentIncident() && metrics.cost > currentIncident().optimal.budget));
  }

  function renderTopology() {
    const element = host && host.querySelector("#ic-topology");
    const incident = currentIncident();
    if (!element) return;
    if (!incident || !state) {
      element.innerHTML = '<div class="ic-empty-map"><span>◇</span><p>Selecciona un modo para cargar la topología.</p></div>';
      return;
    }
    element.innerHTML = incident.nodes.map((node, index) => {
      const status = state.status === "resolved" ? "healthy" : (state.nodeStatus[node[0]] || node[2]);
      const connector = index < incident.nodes.length - 1 ? '<span class="ic-connector" aria-hidden="true"><i></i><b>→</b></span>' : "";
      return `<div class="ic-node-wrap"><div class="ic-node is-${status}"><span class="ic-node-icon">${escapeHtml(node[0])}</span><strong>${escapeHtml(node[1])}</strong><small><i></i>${status}</small></div>${connector}</div>`;
    }).join("");
    element.setAttribute("aria-label", incident.nodes.map((node) => `${node[1]} ${state.nodeStatus[node[0]] || node[2]}`).join(", "));
  }

  function renderIncidentSummary() {
    const element = host && host.querySelector("#ic-incident-summary");
    const incident = currentIncident();
    if (!element) return;
    if (!incident || !state) {
      element.innerHTML = '<span class="ic-summary-mark">OPS</span><div><small>COMMAND CENTER</small><strong>Esperando asignación</strong><p>Elige Campaign, Drill o Endless para comenzar.</p></div>';
      setText("#ic-severity", "STANDBY");
      return;
    }
    element.innerHTML = `<span class="ic-summary-mark">${escapeHtml(incident.code.split("-")[1])}</span><div><small>${escapeHtml(incident.code)} · ${escapeHtml(incident.domain)}</small><strong>${escapeHtml(incident.title)}</strong><p>${escapeHtml(incident.summary)}</p></div>`;
    setText("#ic-severity", incident.severity);
  }

  function renderTimeline() {
    const element = host && host.querySelector("#ic-timeline");
    if (!element) return;
    if (!state || !state.logs.length) {
      element.innerHTML = '<li class="ic-empty-timeline"><span>00:00</span><p>Los eventos de la respuesta aparecerán aquí.</p></li>';
      return;
    }
    element.innerHTML = state.logs.map((entry) => `
      <li class="is-${entry.type}">
        <time>${formatTime(entry.minute)}</time><span class="ic-log-dot"></span>
        <div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.detail)}</p></div>
      </li>`).join("");
  }

  function actionButton(action, type) {
    const used = type === "diagnostic" ? state.usedDiagnostics.has(action.id) : state.usedMitigations.has(action.id);
    const disabled = used || !["running", "paused"].includes(state.status);
    return `<button type="button" class="ic-action-card ${used ? "is-used" : ""}" data-ic-${type}="${escapeHtml(action.id)}" ${disabled ? "disabled" : ""}>
      <span><strong>${escapeHtml(action.label)}</strong><small>${type === "diagnostic" ? "Obtener evidencia" : "Ejecutar cambio operativo"}</small></span>
      <span class="ic-action-meta"><b>+${action.duration}m</b><em>${action.cost}u</em>${used ? "✓" : "→"}</span>
    </button>`;
  }

  function renderActions() {
    if (!host) return;
    const incident = currentIncident();
    const diagnostics = host.querySelector("#ic-diagnostics");
    const mitigations = host.querySelector("#ic-mitigations");
    if (!incident || !state) {
      if (diagnostics) diagnostics.innerHTML = '<p class="ic-actions-empty">Sin incidente activo.</p>';
      if (mitigations) mitigations.innerHTML = '<p class="ic-actions-empty">Sin incidente activo.</p>';
      setText("#ic-action-count", "0 acciones");
      return;
    }
    diagnostics.innerHTML = incident.diagnostics.map((action) => actionButton(action, "diagnostic")).join("");
    mitigations.innerHTML = incident.mitigations.map((action) => actionButton(action, "mitigation")).join("");
    setText("#ic-action-count", `${state.actionCount} ${state.actionCount === 1 ? "acción" : "acciones"}`);
  }

  function renderEvidence() {
    const list = host && host.querySelector("#ic-evidence-list");
    const root = host && host.querySelector("#ic-root-cause");
    const incident = currentIncident();
    if (!list || !root) return;
    setText("#ic-evidence-count", `${state ? state.clues.length : 0} pistas`);
    if (!state || !state.clues.length) list.innerHTML = "<li>Ejecuta un diagnóstico para reunir evidencia.</li>";
    else list.innerHTML = state.clues.map((clue) => `<li><span>✓</span>${escapeHtml(clue)}</li>`).join("");
    const revealed = Boolean(state && incident && state.clues.length >= 2);
    root.hidden = !revealed;
    if (revealed) root.innerHTML = `<span>CAUSA RAÍZ PROBABLE</span><p>${escapeHtml(incident.rootCause)}</p>`;
  }

  function renderAll() {
    if (!host) return;
    renderMetrics();
    renderTopology();
    renderIncidentSummary();
    renderTimeline();
    renderActions();
    renderEvidence();
    const mode = state && MODES[state.modeId];
    setText("#ic-mode-name", mode ? mode.name : "Standby");
    const pause = host.querySelector("#ic-pause-button");
    if (pause) pause.disabled = !state || !["running", "paused"].includes(state.status);
  }

  function showOverlay(content, wide) {
    const overlay = host && host.querySelector("#ic-overlay");
    if (!overlay) return;
    overlay.innerHTML = content;
    overlay.hidden = false;
    overlay.classList.toggle("is-wide", Boolean(wide));
    const focusTarget = overlay.querySelector("button:not([disabled])");
    if (focusTarget) schedule(() => focusTarget.focus(), 0);
  }

  function hideOverlay() {
    const overlay = host && host.querySelector("#ic-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    overlay.innerHTML = "";
    overlay.classList.remove("is-wide");
  }

  function showNotice(title, detail, tone) {
    const notice = host && host.querySelector("#ic-notice");
    if (!notice) return;
    notice.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
    notice.className = `ic-notice is-visible is-${tone || "info"}`;
    schedule(() => {
      if (notice) notice.classList.remove("is-visible");
    }, 3000);
  }

  function showModePicker() {
    clearScheduled();
    state = null;
    renderAll();
    const stats = readStats();
    const campaignLabel = stats.campaignProgress >= INCIDENTS.length
      ? "Campaña completada · volver a jugar"
      : `Incidente ${stats.campaignProgress + 1} de ${INCIDENTS.length}`;
    showOverlay(`
      <div class="ic-picker">
        <div class="ic-picker-heading"><span class="ic-eyebrow">ASSUME COMMAND</span><h2>Elige tu guardia</h2><p>Observa los síntomas, reúne evidencia y restaura el servicio antes de agotar el error budget.</p></div>
        <div class="ic-mode-grid">
          ${Object.values(MODES).map((mode) => `<button type="button" class="ic-mode-card tone-${mode.tone}" data-ic-mode="${mode.id}"><span class="ic-mode-icon">${mode.icon}</span><span><strong>${mode.name}</strong><small>${mode.description}</small><b>${mode.id === "campaign" ? campaignLabel : mode.detail}</b></span><i>→</i></button>`).join("")}
        </div>
        <div class="ic-picker-stats"><span><small>INCIDENTES</small><strong>${stats.incidentsResolved}</strong></span><span><small>MEJOR SCORE</small><strong>${formatNumber(stats.bestScore)}</strong></span><span><small>MEJOR RACHA</small><strong>${stats.endlessBest}</strong></span></div>
        <button type="button" class="ic-picker-exit" data-ic-action="exit">← Volver al centro de juegos</button>
      </div>`, true);
  }

  function showDrillPicker() {
    const stats = readStats();
    showOverlay(`
      <div class="ic-picker ic-scenario-picker">
        <div class="ic-picker-heading"><span class="ic-eyebrow">DRILL LIBRARY</span><h2>Selecciona un incidente</h2><p>Cada escenario tiene dinámicas, causa raíz y respuesta óptima propias.</p></div>
        <div class="ic-scenario-grid">
          ${INCIDENTS.map((incident) => `<button type="button" class="ic-scenario-card" data-ic-incident="${incident.id}"><span class="ic-scenario-icon">${escapeHtml(incident.nodes.find((node) => node[2] === "critical")[0])}</span><span><small>${incident.severity} · ${escapeHtml(incident.domain)}</small><strong>${escapeHtml(incident.title)}</strong><b>${stats.scenarioBest[incident.id] ? `Mejor: ${formatNumber(stats.scenarioBest[incident.id])}` : "Sin resolver"}</b></span><i>→</i></button>`).join("")}
        </div>
        <button type="button" class="ic-picker-exit" data-ic-action="back-modes">← Volver a modos</button>
      </div>`, true);
  }

  function prepareIncident(modeId, incidentId, carry) {
    clearScheduled();
    const incident = incidentById(incidentId);
    state = createState(modeId, incident, carry);
    addLog("alert", "Alarma declarada", incident.summary);
    renderAll();
    showBriefing();
  }

  function showBriefing() {
    const incident = currentIncident();
    if (!incident || !state) return;
    showOverlay(`
      <article class="ic-briefing">
        <div class="ic-briefing-top"><span class="ic-briefing-code">${escapeHtml(incident.code)}</span><span class="ic-severity">${incident.severity}</span></div>
        <span class="ic-eyebrow">INCIDENT BRIEFING · ${escapeHtml(incident.domain)}</span>
        <h2>${escapeHtml(incident.title)}</h2><p class="ic-briefing-summary">${escapeHtml(incident.summary)}</p>
        <div class="ic-symptoms"><h3>Síntomas confirmados</h3><ul>${incident.symptoms.map((symptom) => `<li><span>!</span>${escapeHtml(symptom)}</li>`).join("")}</ul></div>
        <div class="ic-briefing-objectives"><span><small>OBJETIVO</small><strong>Restaurar servicio</strong></span><span><small>VENTANA MÁXIMA</small><strong>${incident.limit} min</strong></span><span><small>BENCHMARK</small><strong>${incident.optimal.minutes} min</strong></span></div>
        <div class="ic-briefing-actions"><button type="button" class="ic-primary" data-ic-action="begin">Asumir mando <b>→</b></button><button type="button" data-ic-action="back-${state.modeId === "drill" ? "drills" : "modes"}">Cambiar escenario</button></div>
      </article>`);
  }

  function beginIncident() {
    if (!state || state.status !== "briefing") return;
    state.status = "running";
    const stats = readStats();
    stats.played += 1;
    saveStats(stats);
    addLog("system", "Mando asumido", "El reloj operativo está en marcha. Las métricas continúan degradándose.");
    hideOverlay();
    renderAll();
  }

  function chooseMode(modeId) {
    if (modeId === "drill") {
      showDrillPicker();
      return;
    }
    if (modeId === "campaign") {
      const progress = readStats().campaignProgress;
      const index = progress >= INCIDENTS.length ? 0 : progress;
      prepareIncident("campaign", INCIDENTS[index].id);
      return;
    }
    const candidate = INCIDENTS[Math.floor(Math.random() * INCIDENTS.length)];
    prepareIncident("endless", candidate.id, { streak: 0, score: 0, cost: 0, lastIncidentId: null });
  }

  function degradeOneMinute() {
    if (!state || state.status !== "running") return;
    const metrics = state.metrics;
    metrics.availability = clamp(metrics.availability - state.rates.availability, 0, 100);
    metrics.latency = clamp(metrics.latency + state.rates.latency, 0, 15000);
    metrics.error = clamp(metrics.error + state.rates.error, 0, 100);
    metrics.impact = clamp(metrics.impact + state.rates.impact + Math.max(0, 90 - metrics.availability) * 0.025, 0, 100);
    metrics.cost += state.rates.cost;
    state.elapsed += 1;
    state.availabilityTotal += metrics.availability;
    state.availabilitySamples += 1;
  }

  function checkFailure() {
    if (!state || state.status !== "running") return false;
    const incident = currentIncident();
    let reason = "Se agotó la ventana de respuesta y el incidente fue escalado fuera de tu mando.";
    if (state.metrics.availability <= 15) reason = "La disponibilidad cayó por debajo del 15% y el servicio entró en interrupción total.";
    else if (state.metrics.impact >= 100) reason = "El impacto alcanzó a toda la población de clientes expuesta.";
    else if (state.elapsed < incident.limit) return false;
    addLog("critical", "Incident command transferido", reason);
    finishIncident(false, reason);
    return true;
  }

  function advanceTime(minutes) {
    for (let minute = 0; minute < minutes; minute += 1) {
      if (!state || state.status !== "running") break;
      degradeOneMinute();
      if (checkFailure()) break;
    }
  }

  function performDiagnostic(id) {
    if (!state || state.status !== "running") return;
    const incident = currentIncident();
    const action = incident.diagnostics.find((item) => item.id === id);
    if (!action || state.usedDiagnostics.has(id)) return;
    state.usedDiagnostics.add(id);
    state.actionCount += 1;
    state.actionHistory.push(action.label);
    state.metrics.cost += action.cost;
    advanceTime(action.duration);
    if (!state || state.status !== "running") return;
    state.clues.push(action.clue);
    addLog("evidence", action.label, action.clue);
    showNotice("Evidencia obtenida", action.clue, "info");
    renderAll();
  }

  function applyMitigationEffect(kind) {
    if (!state) return;
    const metrics = state.metrics;
    if (kind === "helpful") {
      metrics.availability = clamp(metrics.availability + 7, 0, 100);
      metrics.latency = clamp(metrics.latency * 0.76, 0, 15000);
      metrics.error = clamp(metrics.error * 0.72, 0, 100);
      metrics.impact = clamp(metrics.impact - 5, 0, 100);
      ["availability", "latency", "error", "impact"].forEach((key) => { state.rates[key] *= 0.67; });
      Object.keys(state.nodeStatus).some((key) => {
        if (state.nodeStatus[key] === "critical") { state.nodeStatus[key] = "degraded"; return true; }
        return false;
      });
    } else if (kind === "wrong") {
      metrics.availability = clamp(metrics.availability - 9, 0, 100);
      metrics.latency = clamp(metrics.latency * 1.28 + 180, 0, 15000);
      metrics.error = clamp(metrics.error + 8, 0, 100);
      metrics.impact = clamp(metrics.impact + 11, 0, 100);
      ["availability", "latency", "error", "impact"].forEach((key) => { state.rates[key] *= 1.3; });
      Object.keys(state.nodeStatus).some((key) => {
        if (state.nodeStatus[key] === "healthy") { state.nodeStatus[key] = "degraded"; return true; }
        return false;
      });
    }
  }

  function performMitigation(id) {
    if (!state || state.status !== "running") return;
    const incident = currentIncident();
    const action = incident.mitigations.find((item) => item.id === id);
    if (!action || state.usedMitigations.has(id)) return;
    state.usedMitigations.add(id);
    state.actionCount += 1;
    if (action.kind === "wrong") state.wrongActions += 1;
    state.actionHistory.push(action.label);
    state.metrics.cost += action.cost;
    addLog(action.kind === "wrong" ? "critical" : "action", `Mitigación: ${action.label}`, `Cambio en curso · ventana estimada ${action.duration} min.`);
    advanceTime(action.duration);
    if (!state || state.status !== "running") return;
    if (action.kind === "optimal") {
      state.metrics.availability = clamp(state.metrics.availability + 12, 0, 99.95);
      state.metrics.latency = Math.max(280, state.metrics.latency * 0.38);
      state.metrics.error = Math.max(0.15, state.metrics.error * 0.15);
      state.metrics.impact = Math.max(0, state.metrics.impact - 9);
      Object.keys(state.nodeStatus).forEach((key) => { state.nodeStatus[key] = "healthy"; });
      addLog("resolved", "Servicio estabilizado", action.consequence);
      showNotice("Mitigación efectiva", "El servicio está recuperando sus SLO.", "success");
      finishIncident(true, action.consequence);
      return;
    }
    applyMitigationEffect(action.kind);
    addLog(action.kind === "wrong" ? "critical" : "action", action.kind === "wrong" ? "Consecuencia adversa" : "Alivio temporal", action.consequence);
    showNotice(action.kind === "wrong" ? "La situación empeoró" : "Impacto reducido", action.consequence, action.kind === "wrong" ? "danger" : "warning");
    if (!checkFailure()) renderAll();
  }

  function calculateScore(success) {
    if (!state) return { total: 0, mttr: 0, availability: 0, cost: 0, actions: 0 };
    const incident = currentIncident();
    const avg = averageAvailability();
    const mttrPenalty = Math.max(0, state.elapsed - incident.optimal.minutes) * 95;
    const availabilityPenalty = Math.max(0, 99.9 - avg) * 42;
    const incidentCost = state.metrics.cost - state.startingCost;
    const costPenalty = Math.max(0, incidentCost - incident.optimal.budget) * 28;
    const actionPenalty = Math.max(0, state.actionCount - incident.optimal.path.length) * 190 + state.wrongActions * 650;
    const base = success ? 10000 : 2600;
    const modeMultiplier = state.modeId === "endless" ? 1 + state.carry.streak * 0.06 : 1;
    const total = Math.max(0, Math.round((base - mttrPenalty - availabilityPenalty - costPenalty - actionPenalty) * modeMultiplier));
    return {
      total,
      mttr: Math.round(mttrPenalty),
      availability: Math.round(availabilityPenalty),
      cost: Math.round(costPenalty),
      actions: Math.round(actionPenalty)
    };
  }

  function commitResult(success) {
    if (!state || state.statsCommitted) return;
    state.statsCommitted = true;
    const stats = readStats();
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.totalCost += Math.round(state.metrics.cost - state.startingCost);
    stats.totalMttr += state.elapsed;
    if (success) {
      stats.wins += 1;
      stats.incidentsResolved += 1;
      stats.modeWins[state.modeId] = finite(stats.modeWins[state.modeId], 0) + 1;
      stats.scenarioBest[state.incidentId] = Math.max(finite(stats.scenarioBest[state.incidentId], 0), state.score);
      if (state.modeId === "campaign") {
        const index = INCIDENTS.findIndex((incident) => incident.id === state.incidentId);
        if (index === stats.campaignProgress) stats.campaignProgress = Math.min(INCIDENTS.length, index + 1);
        if (index === INCIDENTS.length - 1) stats.campaignsCompleted += 1;
      }
      if (state.modeId === "endless") stats.endlessBest = Math.max(stats.endlessBest, state.carry.streak + 1);
    }
    saveStats(stats);
  }

  function finishIncident(success, reason) {
    if (!state || !["running", "paused"].includes(state.status)) return;
    if (state.status === "paused") hideOverlay();
    state.status = success ? "resolved" : "failed";
    state.breakdown = calculateScore(success);
    state.score = state.breakdown.total;
    if (state.modeId === "endless" && success) {
      state.carry.streak += 1;
      state.carry.score += state.score;
      state.carry.cost = state.metrics.cost;
      state.carry.lastIncidentId = state.incidentId;
    }
    commitResult(success);
    renderAll();
    showPostmortem(success, reason);
  }

  function showPostmortem(success, reason) {
    const incident = currentIncident();
    if (!incident || !state) return;
    const avg = averageAvailability();
    const actualPath = state.actionHistory.length ? state.actionHistory : ["Sin acciones completadas"];
    const incidentIndex = INCIDENTS.findIndex((item) => item.id === incident.id);
    const campaignNext = state.modeId === "campaign" && success && incidentIndex < INCIDENTS.length - 1;
    const campaignComplete = state.modeId === "campaign" && success && incidentIndex === INCIDENTS.length - 1;
    const endlessNext = state.modeId === "endless" && success;
    const primaryAction = campaignNext ? "campaign-next" : endlessNext ? "endless-next" : campaignComplete ? "modes" : "retry";
    const primaryLabel = campaignNext ? "Siguiente incidente" : endlessNext ? "Continuar guardia" : campaignComplete ? "Campaña completada" : "Reintentar";
    const resultEyebrow = campaignComplete ? "CAMPAIGN COMPLETE" : success ? "INCIDENT RESOLVED" : "ERROR BUDGET EXHAUSTED";
    const resultTitle = campaignComplete ? "Guardia completada" : success ? "Servicio restaurado" : "Respuesta escalada";
    const totalScore = state.modeId === "endless" ? state.carry.score : state.score;
    const incidentCost = state.metrics.cost - state.startingCost;
    showOverlay(`
      <article class="ic-postmortem ${success ? "is-success" : "is-failure"}">
        <div class="ic-result-symbol">${success ? "✓" : "!"}</div>
        <span class="ic-eyebrow">${resultEyebrow}</span>
        <h2>${resultTitle}</h2>
        <p>${escapeHtml(reason || incident.rootCause)}</p>
        <div class="ic-result-score"><span><small>SCORE ${state.modeId === "endless" ? "DE GUARDIA" : "FINAL"}</small><strong>${formatNumber(totalScore)}</strong></span><span><small>MTTR</small><strong>${state.elapsed}m</strong></span><span><small>AVAIL. MEDIA</small><strong>${avg.toFixed(1)}%</strong></span><span><small>COSTE INCIDENTE</small><strong>${incidentCost.toFixed(0)}u</strong></span></div>
        <section class="ic-postmortem-review"><div class="ic-review-heading"><span>POSTMORTEM</span><h3>Tu respuesta frente a la óptima</h3></div>
          <div class="ic-comparison">
            <div><span>TU RESPUESTA</span><ol>${actualPath.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol><p>${state.wrongActions} decisiones adversas · ${state.actionCount} acciones</p></div>
            <div class="is-optimal"><span>RUTA ÓPTIMA</span><ol>${incident.optimal.path.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol><p>${incident.optimal.minutes} min · presupuesto ${incident.optimal.budget}u</p></div>
          </div>
          <div class="ic-root-review"><span>CAUSA RAÍZ</span><p>${escapeHtml(incident.rootCause)}</p></div>
          <div class="ic-score-breakdown"><span>Penalización MTTR <b>−${state.breakdown.mttr}</b></span><span>Disponibilidad <b>−${state.breakdown.availability}</b></span><span>Coste <b>−${state.breakdown.cost}</b></span><span>Acciones <b>−${state.breakdown.actions}</b></span></div>
        </section>
        <div class="ic-result-actions"><button type="button" class="ic-primary" data-ic-action="${primaryAction}">${primaryLabel} <b>→</b></button><button type="button" data-ic-action="modes">Elegir modo</button><button type="button" class="ic-text-button" data-ic-action="exit">Volver al centro</button></div>
      </article>`, true);
  }

  function pauseGame(forcePause, byVisibility) {
    if (!state || !["running", "paused"].includes(state.status)) return;
    if (state.status === "running" && forcePause !== false) {
      state.status = "paused";
      state.pausedByVisibility = Boolean(byVisibility);
      renderActions();
      showOverlay(`<div class="ic-pause-card"><span class="ic-result-symbol">Ⅱ</span><span class="ic-eyebrow">SIMULATION PAUSED</span><h2>Respuesta en pausa</h2><p>El reloj y la degradación temporal están detenidos.</p><button type="button" class="ic-primary" data-ic-action="resume">Continuar <b>→</b></button></div>`);
    } else if (state.status === "paused") {
      state.status = "running";
      state.pausedByVisibility = false;
      hideOverlay();
      renderActions();
    }
  }

  function nextEndlessIncident() {
    if (!state || state.modeId !== "endless") return;
    const carry = { ...state.carry };
    const candidates = INCIDENTS.filter((incident) => incident.id !== carry.lastIncidentId);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    prepareIncident("endless", next.id, carry);
  }

  function nextCampaignIncident() {
    if (!state || state.modeId !== "campaign") return;
    const index = INCIDENTS.findIndex((incident) => incident.id === state.incidentId);
    if (index >= 0 && index < INCIDENTS.length - 1) prepareIncident("campaign", INCIDENTS[index + 1].id);
    else showModePicker();
  }

  function tick() {
    if (!state || state.status !== "running") return;
    degradeOneMinute();
    if (checkFailure()) return;
    renderMetrics();
    if (state.elapsed % 5 === 0) {
      addLog("metric", "SLO continúa degradándose", `Availability ${state.metrics.availability.toFixed(1)}% · error rate ${state.metrics.error.toFixed(1)}%.`);
      renderTimeline();
    }
  }

  function handleClick(event) {
    if (!host) return;
    const mode = event.target.closest("[data-ic-mode]");
    if (mode && host.contains(mode)) { chooseMode(mode.dataset.icMode); return; }
    const scenario = event.target.closest("[data-ic-incident]");
    if (scenario && host.contains(scenario)) { prepareIncident("drill", scenario.dataset.icIncident); return; }
    const diagnostic = event.target.closest("[data-ic-diagnostic]");
    if (diagnostic && host.contains(diagnostic)) { performDiagnostic(diagnostic.dataset.icDiagnostic); return; }
    const mitigation = event.target.closest("[data-ic-mitigation]");
    if (mitigation && host.contains(mitigation)) { performMitigation(mitigation.dataset.icMitigation); return; }
    const action = event.target.closest("[data-ic-action]");
    if (!action || !host.contains(action)) return;
    const name = action.dataset.icAction;
    if (name === "begin") beginIncident();
    if (name === "pause") pauseGame();
    if (name === "resume") pauseGame(false);
    if (name === "modes") {
      if (state && state.status === "running" && !window.confirm("¿Abandonar el incidente activo y volver a los modos?")) return;
      showModePicker();
    }
    if (name === "back-modes") showModePicker();
    if (name === "back-drills") showDrillPicker();
    if (name === "retry" && state) prepareIncident(state.modeId, state.incidentId, state.modeId === "endless" ? { streak: 0, score: 0, cost: 0, lastIncidentId: null } : null);
    if (name === "campaign-next") nextCampaignIncident();
    if (name === "endless-next") nextEndlessIncident();
    if (name === "exit" && exitCallback) exitCallback();
  }

  function handleKeyDown(event) {
    if (!host || !state || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target && event.target.isContentEditable) return;
    if (["Escape", "p", "P"].includes(event.key) && ["running", "paused"].includes(state.status)) {
      event.preventDefault();
      pauseGame();
    }
  }

  function handleVisibilityChange() {
    if (document.hidden && state && state.status === "running") pauseGame(true, true);
  }

  function mount(container, onExit) {
    destroy();
    if (!container) throw new Error("IncidentCommander.mount requiere un contenedor válido.");
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    host.innerHTML = initialMarkup();
    host.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    tickTimer = window.setInterval(tick, 1000);
    renderAll();
    showModePicker();
  }

  function destroy() {
    window.clearInterval(tickTimer);
    tickTimer = null;
    clearScheduled();
    if (host) host.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (ownedStyle && ownedStyle.parentNode) ownedStyle.parentNode.removeChild(ownedStyle);
    ownedStyle = null;
    host = null;
    exitCallback = null;
    state = null;
  }

  window.IncidentCommander = {
    mount,
    destroy,
    getStats: readStats
  };
}());
