/* Cloud Arcade shell and hash-based navigation. */
(function () {
  "use strict";

  const root = document.getElementById("app");
  const games = window.CLOUD_ARCADE_GAMES || [];
  let activeModule = null;

  const brandIcon = `
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <path d="M22 3 38 12v20L22 41 6 32V12L22 3Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="m6 12 16 9 16-9M22 21v20" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="m14 8 16 9v10l-8 5-8-5V8Z" fill="currentColor" opacity=".16"/>
    </svg>`;

  function getModule(game) {
    return game && game.module ? window[game.module] : null;
  }

  function getArcadeStats() {
    return games.filter((game) => game.status === "available").reduce((total, game) => {
      const module = getModule(game);
      const stats = module && module.getStats ? module.getStats() : {};
      total.played += stats.played || 0;
      total.wins += stats.wins || 0;
      total.bestScore = Math.max(total.bestScore, stats.bestScore || 0);
      return total;
    }, { played: 0, wins: 0, bestScore: 0 });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-ES").format(value || 0);
  }

  function shell(content, homeActive) {
    return `
      <div class="site-shell">
        <header class="site-header">
          <button class="brand" type="button" data-route="home" aria-label="Ir al inicio">
            <span class="brand-mark">${brandIcon}</span>
            <span><strong>Cloud</strong> Arcade</span>
          </button>
          <nav class="site-nav" aria-label="Navegación principal">
            <button class="nav-link ${homeActive ? "is-active" : ""}" type="button" data-route="home">Juegos</button>
            <span class="status-pill"><i></i> Centro online</span>
          </nav>
        </header>
        ${content}
        <footer class="site-footer">
          <span>Cloud Arcade</span>
          <span>Un proyecto independiente inspirado en arquitectura cloud.</span>
        </footer>
      </div>`;
  }

  function gameArtwork(game) {
    if (game.id === "cloudjong") {
      return `
        <div class="card-art cloudjong-art" aria-hidden="true">
          <div class="art-glow"></div>
          <div class="mini-tile tile-one"><span>λ</span><small>Lambda</small></div>
          <div class="mini-tile tile-two"><span>S3</span><small>Storage</small></div>
          <div class="mini-tile tile-three"><span>EC2</span><small>Compute</small></div>
          <div class="mini-tile tile-four"><span>DB</span><small>Dynamo</small></div>
        </div>`;
    }

    if (game.id === "stack-solitaire") {
      return `
        <div class="card-art solitaire-art" aria-hidden="true">
          <div class="playing-card card-back"></div>
          <div class="playing-card card-front"><span>λ</span><small>A</small></div>
        </div>`;
    }

    if (game.id === "vpc-mines") {
      return `
        <div class="card-art mines-art" aria-hidden="true">
          <div class="network-ring"></div>
          <div class="network-node n1"></div><div class="network-node n2"></div>
          <div class="network-node n3"></div><div class="network-node n4"></div>
          <span class="shield-glyph">◆</span>
        </div>`;
    }

    if (game.id === "packet-ascent") {
      return `
        <div class="card-art packet-art" aria-hidden="true">
          <div class="packet-art-lines"></div>
          <div class="packet-art-gate gate-a"><span>22</span><small>sg-ssh</small></div>
          <div class="packet-art-gate gate-b"><span>443</span><small>sg-web</small></div>
          <div class="packet-art-gate gate-c"><span>5432</span><small>sg-db</small></div>
          <div class="packet-art-player">IP</div>
        </div>`;
    }

    if (game.id === "cloud-breaker") {
      return `
        <div class="card-art breaker-art" aria-hidden="true">
          <div class="breaker-art-grid"></div>
          <div class="breaker-bricks"><span>S3</span><span>λ</span><span>EC2</span><span>DB</span><span>CF</span><span>SQS</span></div>
          <i class="breaker-ball"></i><b class="breaker-paddle">ELB</b>
        </div>`;
    }

    if (game.id === "cloud-stacker") {
      return `
        <div class="card-art stacker-art" aria-hidden="true">
          <div class="stacker-art-grid"></div>
          <div class="stacker-piece piece-orange"><i></i><i></i><i></i><i></i></div>
          <div class="stacker-piece piece-blue"><i></i><i></i><i></i><i></i></div>
          <div class="stacker-piece piece-green"><i></i><i></i><i></i><i></i></div>
          <span>DEPLOY</span>
        </div>`;
    }

    if (game.id === "cloud-defense") {
      return `
        <div class="card-art defense-art" aria-hidden="true">
          <div class="defense-path"></div>
          <span class="defense-tower tower-waf">WAF</span><span class="defense-tower tower-shield">SH</span><span class="defense-tower tower-sqs">SQS</span>
          <i class="defense-enemy enemy-one"></i><i class="defense-enemy enemy-two"></i><i class="defense-enemy enemy-three"></i>
          <b class="defense-endpoint">API</b>
        </div>`;
    }

    if (game.id === "incident-commander") {
      return `
        <div class="card-art incident-art" aria-hidden="true">
          <div class="incident-pulse"></div>
          <div class="incident-topology"><span>ALB</span><i>→</i><span class="is-critical">ECS</span><i>→</i><span>RDS</span></div>
          <div class="incident-alert"><small>SEV-1 · INC-1042</small><strong>ERROR RATE</strong><b>18.4%</b></div>
          <div class="incident-chart"><i></i></div>
        </div>`;
    }

    if (game.id === "cloudle") {
      return `
        <div class="card-art cloudle-art" aria-hidden="true">
          <div class="cloudle-art-grid"></div>
          <div class="cloudle-word row-one"><i>C</i><i>L</i><i>O</i><i>U</i><i>D</i></div>
          <div class="cloudle-word row-two"><i class="correct">A</i><i class="present">T</i><i>H</i><i>E</i><i>N</i><i>A</i></div>
          <div class="cloudle-word row-three"><i class="correct">L</i><i class="correct">A</i><i class="correct">M</i><i class="correct">B</i><i class="correct">D</i><i class="correct">A</i></div>
          <span>DAILY SERVICE</span>
        </div>`;
    }

    return `
      <div class="card-art pipeline-art" aria-hidden="true">
        <div class="pipeline-art-grid"></div>
        <span class="pipeline-source">EVENTS</span>
        <div class="pipeline-art-flow"><i></i><i></i><i></i><i></i></div>
        <span class="pipeline-node node-kinesis">KIN</span><span class="pipeline-node node-lambda">λ</span><span class="pipeline-node node-s3">S3</span><span class="pipeline-node node-redshift">RS</span>
        <b>DATA FLOW: HEALTHY</b>
      </div>`;
  }

  function gameCard(game, featured) {
    const available = game.status === "available";
    return `
      <article class="game-card ${featured ? "is-featured" : ""} ${available ? "" : "is-locked"}" style="--game-accent:${game.accent}">
        ${gameArtwork(game)}
        <div class="game-card-body">
          <div class="game-card-heading">
            <div>
              <span class="game-kicker">${game.kicker}</span>
              <h3>${game.title}</h3>
            </div>
            ${available ? '<span class="live-badge">Jugar ahora</span>' : '<span class="soon-badge">En desarrollo</span>'}
          </div>
          <p>${game.description}</p>
          <div class="game-meta">
            ${game.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
          <button class="game-action" type="button" ${available ? `data-play="${game.id}"` : "disabled"}>
            <span>${available ? "Iniciar partida" : "Próximamente"}</span>
            ${available ? '<span aria-hidden="true">→</span>' : '<span aria-hidden="true">◇</span>'}
          </button>
        </div>
      </article>`;
  }

  function renderHome() {
    stopActiveGame();
    const stats = getArcadeStats();
    const available = games.filter((game) => game.status === "available").length;
    const featured = games.find((game) => game.id === "cloudle" && game.status === "available") || games.find((game) => game.status === "available");
    const upcoming = games.filter((game) => game.id !== featured?.id);

    const content = `
      <main class="home-view route-view">
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow"><i></i> JUEGO DESTACADO · CLOUDLE</span>
            <h1>Adivina el servicio.<br><em>Domina AWS.</em></h1>
            <p>Descubre el servicio diario, construye tu racha y explora un catálogo de 277 productos AWS.</p>
            <div class="hero-actions">
              <button class="primary-button" type="button" data-play="cloudle">Jugar Cloudle <span>→</span></button>
              <a class="text-link" href="#catalogo">Explorar colección</a>
            </div>
          </div>
          <div class="hero-visual" aria-hidden="true">
            <div class="orbit orbit-one"></div>
            <div class="orbit orbit-two"></div>
            <div class="cloud-core">
              <span class="core-mark">${brandIcon}</span>
              <b>CLOUD<br>ARCADE</b>
            </div>
            <span class="floating-chip chip-compute">EC2</span>
            <span class="floating-chip chip-storage">S3</span>
            <span class="floating-chip chip-serverless">λ</span>
            <span class="floating-chip chip-database">DB</span>
          </div>
        </section>

        <section class="stat-strip" aria-label="Estadísticas">
          <div><strong>${available}</strong><span>Juego disponible</span></div>
          <div><strong>${formatNumber(stats.played)}</strong><span>Partidas iniciadas</span></div>
          <div><strong>${formatNumber(stats.wins)}</strong><span>Stacks completados</span></div>
          <div><strong>${formatNumber(stats.bestScore)}</strong><span>Mejor puntuación</span></div>
        </section>

        <section class="catalog" id="catalogo">
          <div class="section-heading">
            <div><span class="eyebrow">SELECCIONA UN JUEGO</span><h2>La colección</h2></div>
            <p>Empieza por Cloudjong. Nuevos clásicos llegarán al mismo centro.</p>
          </div>
          <div class="featured-grid">${featured ? gameCard(featured, true) : ""}</div>
          <div class="upcoming-grid">${upcoming.map((game) => gameCard(game, false)).join("")}</div>
        </section>

        <section class="roadmap-banner">
          <div class="roadmap-icon">＋</div>
          <div><span class="eyebrow">UNA ARCADE QUE CRECE</span><h2>Un hogar para cada nuevo juego</h2><p>El catálogo, la navegación y los récords ya están separados del motor de cada juego.</p></div>
          <div class="roadmap-steps"><span class="done">10 juegos activos</span><i></i><span class="done">3 simuladores avanzados</span><i></i><span>Más desafíos</span></div>
        </section>
      </main>`;

    root.innerHTML = shell(content, true);
    window.scrollTo(0, 0);
  }

  function renderGame(gameId) {
    stopActiveGame();
    const game = games.find((entry) => entry.id === gameId && entry.status === "available");
    const module = getModule(game);

    if (!game || !module || typeof module.mount !== "function") {
      window.location.hash = "#home";
      return;
    }

    const content = `
      <main class="game-view route-view">
        <div class="game-route-header">
          <button class="back-button" type="button" data-route="home"><span>←</span> Todos los juegos</button>
          <div><span>${game.kicker}</span><strong>${game.title}</strong></div>
        </div>
        <div id="game-mount" class="game-mount"></div>
      </main>`;

    root.innerHTML = shell(content, false);
    activeModule = module;
    module.mount(document.getElementById("game-mount"), () => {
      window.location.hash = "#home";
    });
    window.scrollTo(0, 0);
  }

  function stopActiveGame() {
    if (activeModule && typeof activeModule.destroy === "function") activeModule.destroy();
    activeModule = null;
  }

  function route() {
    const match = window.location.hash.match(/^#game\/([a-z0-9-]+)$/);
    if (match) renderGame(match[1]);
    else renderHome();
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      window.location.hash = "#home";
      return;
    }

    const playButton = event.target.closest("[data-play]");
    if (playButton) window.location.hash = `#game/${playButton.dataset.play}`;
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", stopActiveGame);
  route();
}());
