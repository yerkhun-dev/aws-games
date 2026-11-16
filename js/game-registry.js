/*
 * Declarative game catalog.
 * To add a game, register its metadata here and expose a module with mount/destroy.
 */
window.CLOUD_ARCADE_GAMES = [
  {
    id: "cloudjong",
    title: "Cloudjong",
    kicker: "Mahjong Solitaire",
    description: "Libera una arquitectura cloud emparejando servicios y despejando cada capa del stack.",
    status: "available",
    module: "Cloudjong",
    accent: "#ff9900",
    tags: ["Estrategia", "AWS", "4 modos", "32 desafíos"],
    players: "1 jugador"
  },
  {
    id: "stack-solitaire",
    title: "Stack Solitaire",
    kicker: "AWS Klondike",
    description: "Ordena 52 servicios de Compute, Storage, Data y Security en stacks estables.",
    status: "available",
    module: "StackSolitaire",
    accent: "#8b5cf6",
    tags: ["Cartas", "AWS", "Klondike"],
    players: "1 jugador"
  },
  {
    id: "vpc-mines",
    title: "VPC Mines",
    kicker: "Network Defense",
    description: "Asegura nodos, marca amenazas y limpia tres entornos VPC antes de sufrir un breach.",
    status: "available",
    module: "VpcMines",
    accent: "#22c55e",
    tags: ["Lógica", "AWS", "3 modos"],
    players: "1 jugador"
  },
  {
    id: "packet-ascent",
    title: "Packet Ascent",
    kicker: "Security Group Runner",
    description: "Asciende como un paquete y elige destinos cuyas reglas permitan tu protocolo, puerto y origen.",
    status: "available",
    module: "PacketAscent",
    accent: "#f97316",
    tags: ["Plataformas", "Networking", "3 modos"],
    players: "1 jugador"
  },
  {
    id: "cloud-breaker",
    title: "Cloud Breaker",
    kicker: "AWS Brick Breaker",
    description: "Rebota requests, activa servicios y desmonta ocho arquitecturas con power-ups cloud.",
    status: "available",
    module: "CloudBreaker",
    accent: "#19a7ce",
    tags: ["Arcade", "Breakout", "3 modos"],
    players: "1 jugador"
  },
  {
    id: "cloud-stacker",
    title: "Cloud Stacker",
    kicker: "Infrastructure Blocks",
    description: "Encaja servicios, completa capas y entrega stacks con piezas de infraestructura AWS.",
    status: "available",
    module: "CloudStacker",
    accent: "#eab308",
    tags: ["Bloques", "Tetrominós", "3 modos"],
    players: "1 jugador"
  },
  {
    id: "cloud-defense",
    title: "Cloud Defense",
    kicker: "Reliability Tower Defense",
    description: "Filtra amenazas, sirve tráfico legítimo y protege el SLO con una arquitectura cloud por capas.",
    status: "available",
    module: "CloudDefense",
    accent: "#34d6ff",
    tags: ["Tower Defense", "SRE", "7 servicios"],
    players: "1 jugador"
  },
  {
    id: "incident-commander",
    title: "Incident Commander",
    kicker: "Cloud Operations Simulator",
    description: "Investiga métricas y logs, contiene incidentes y recupera arquitecturas antes de agotar el SLO.",
    status: "available",
    module: "IncidentCommander",
    accent: "#ef4444",
    tags: ["Simulación", "SRE", "9 incidentes"],
    players: "1 jugador"
  },
  {
    id: "cloudle",
    title: "Cloudle",
    kicker: "AWS Service Guess",
    description: "Descubre el servicio diario comparando caracteres y explorando un catálogo completo de AWS.",
    status: "available",
    module: "Cloudle",
    accent: "#22c55e",
    tags: ["Palabras", "Daily", "277 servicios"],
    players: "1 jugador"
  }
];
