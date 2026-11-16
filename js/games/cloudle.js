(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:cloudle:stats";
  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const STYLE_URL = SCRIPT_URL ? new URL("../../css/cloudle.css", SCRIPT_URL).href : "css/cloudle.css";
  const MAX_ATTEMPTS = 6;
  const MODES = {
    daily: { name: "Daily", eyebrow: "RETO DIARIO", description: "La misma respuesta para todo el mundo. Una rotación determinista recorre todo el catálogo elegible antes de repetir." },
    infinite: { name: "Infinite", eyebrow: "PRÁCTICA LIBRE", description: "Juega tantas rondas como quieras y elige la longitud del token." },
    category: { name: "Category", eyebrow: "DOMINIO AWS", description: "Acota la respuesta a una categoría y una longitud concretas." },
    architect: { name: "Architect Clue", eyebrow: "PISTAS DE ARQUITECTURA", description: "Las pistas sobre el servicio aparecen progresivamente después de cada fallo." }
  };
  const MODE_ORDER = ["daily", "infinite", "category", "architect"];
  const MODE_ICONS = { daily: "◫", infinite: "∞", category: "⌘", architect: "◇" };
  const STATUS_RANK = { absent: 1, present: 2, correct: 3 };

  let host = null;
  let exitCallback = null;
  let ownedStyle = null;
  let services = [];
  let eligible = [];
  let state = null;
  const timers = new Set();

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function searchable(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function normalizeToken(value) {
    return searchable(value).replace(/\s+/g, "");
  }

  function finite(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function defaultStats() {
    return {
      played: 0, wins: 0, bestScore: 0, currentStreak: 0, bestStreak: 0,
      lastDailyWin: "", discovered: [], distribution: [0, 0, 0, 0, 0, 0],
      modePlayed: {}, modeWins: {}, dailyRecords: {}
    };
  }

  function readStats() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const base = defaultStats();
      if (!stored || typeof stored !== "object") return base;
      const distribution = Array.isArray(stored.distribution)
        ? base.distribution.map((_, index) => finite(stored.distribution[index], 0)) : base.distribution;
      const records = stored.dailyRecords && typeof stored.dailyRecords === "object" ? { ...stored.dailyRecords } : {};
      return {
        played: finite(stored.played, 0),
        wins: finite(stored.wins, 0),
        bestScore: finite(stored.bestScore, 0),
        currentStreak: finite(stored.currentStreak, 0),
        bestStreak: finite(stored.bestStreak, 0),
        lastDailyWin: typeof stored.lastDailyWin === "string" ? stored.lastDailyWin : "",
        discovered: Array.isArray(stored.discovered) ? stored.discovered.filter((item) => typeof item === "string").slice(-1000) : [],
        distribution,
        modePlayed: stored.modePlayed && typeof stored.modePlayed === "object" ? { ...stored.modePlayed } : {},
        modeWins: stored.modeWins && typeof stored.modeWins === "object" ? { ...stored.modeWins } : {},
        dailyRecords: records
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
      link.href === STYLE_URL || link.dataset.cloudleStyle !== undefined);
    if (existing) return;
    ownedStyle = document.createElement("link");
    ownedStyle.rel = "stylesheet";
    ownedStyle.href = STYLE_URL;
    ownedStyle.dataset.cloudleStyle = "";
    document.head.appendChild(ownedStyle);
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (host) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  function normalizeCatalog(catalog) {
    return catalog.map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const token = normalizeToken(entry.token);
      if (!token) return null;
      const displayName = String(entry.displayName || entry.token || "Servicio AWS").trim();
      const category = String(entry.category || "Other").trim() || "Other";
      const aliases = Array.isArray(entry.aliases) ? entry.aliases.map(String).filter(Boolean) : [];
      return {
        key: `service-${index}`,
        id: String(entry.id || `service-${index}`),
        displayName,
        token,
        category,
        description: String(entry.description || "Sin descripción disponible.").trim(),
        aliases,
        eligible: entry.eligible === true,
        search: searchable([displayName, token, category, entry.description, aliases.join(" ")].join(" "))
      };
    }).filter(Boolean);
  }

  function uniqueAnswers(items) {
    const seen = new Set();
    return items.filter((service) => {
      if (!service.eligible || seen.has(service.token)) return false;
      seen.add(service.token);
      return true;
    });
  }

  function categories(items) {
    return Array.from(new Set(items.map((service) => service.category))).sort((a, b) => a.localeCompare(b, "es"));
  }

  function lengths(items) {
    return Array.from(new Set(items.map((service) => service.token.length))).sort((a, b) => a - b);
  }

  function hash32(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFromSeed(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ result >>> 15, result | 1);
      result ^= result + Math.imul(result ^ result >>> 7, result | 61);
      return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(items, seed) {
    const copy = items.slice();
    const random = randomFromSeed(seed);
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function dateKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  function dayNumber(key) {
    const parts = key.split("-").map(Number);
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  }

  function cyclePermutation(pool, cycle) {
    const sorted = pool.slice().sort((a, b) => {
      const left = `${a.id}\u0000${a.token}`;
      const right = `${b.id}\u0000${b.token}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const permutation = shuffled(sorted, hash32(`cloudle-daily-v1:${cycle}:${sorted.length}`));
    if (cycle !== 0 && permutation.length > 1) {
      const previous = shuffled(sorted, hash32(`cloudle-daily-v1:${cycle - 1}:${sorted.length}`));
      if (previous[previous.length - 1].token === permutation[0].token) {
        const swappable = Math.max(1, permutation.length - 2);
        const swap = 1 + (hash32(`cloudle-boundary:${cycle}`) % swappable);
        [permutation[0], permutation[swap]] = [permutation[swap], permutation[0]];
      }
    }
    return permutation;
  }

  function dailyAnswer(key) {
    const pool = eligible;
    if (!pool.length) return null;
    const epoch = dayNumber("2025-01-01");
    const offset = dayNumber(key) - epoch;
    const cycle = Math.floor(offset / pool.length);
    const position = ((offset % pool.length) + pool.length) % pool.length;
    return cyclePermutation(pool, cycle)[position];
  }

  function evaluateGuess(guess, answer) {
    const result = Array(guess.length).fill("absent");
    const remaining = Object.create(null);
    for (let index = 0; index < answer.length; index += 1) {
      if (guess[index] === answer[index]) result[index] = "correct";
      else remaining[answer[index]] = (remaining[answer[index]] || 0) + 1;
    }
    for (let index = 0; index < guess.length; index += 1) {
      if (result[index] === "correct") continue;
      const character = guess[index];
      if (remaining[character] > 0) {
        result[index] = "present";
        remaining[character] -= 1;
      }
    }
    return result;
  }

  function setupCandidates() {
    if (!state) return [];
    let pool = eligible;
    if (state.setup.mode === "category" && state.setup.category !== "all") {
      pool = pool.filter((service) => service.category === state.setup.category);
    }
    if (["infinite", "category", "architect"].includes(state.setup.mode) && state.setup.length) {
      pool = pool.filter((service) => service.token.length === Number(state.setup.length));
    }
    if (state.setup.mode === "architect" && state.setup.category !== "all") {
      pool = pool.filter((service) => service.category === state.setup.category);
    }
    return pool;
  }

  function validLengthsForSetup() {
    let pool = eligible;
    if (["category", "architect"].includes(state.setup.mode) && state.setup.category !== "all") {
      pool = pool.filter((service) => service.category === state.setup.category);
    }
    return lengths(pool);
  }

  function reconcileSetup() {
    const valid = validLengthsForSetup();
    if (!valid.includes(Number(state.setup.length))) state.setup.length = valid[0] || null;
  }

  function chooseAnswer() {
    if (state.setup.mode === "daily") return dailyAnswer(state.today);
    const pool = setupCandidates();
    if (!pool.length) return null;
    let index = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && state.lastAnswerKey && pool[index].key === state.lastAnswerKey) index = (index + 1) % pool.length;
    return pool[index];
  }

  function categoryColor(category) {
    const palette = ["#f58536", "#2cae66", "#4d7cff", "#8b5cf6", "#e5484d", "#18a3a8", "#d85ad8", "#19a7ce", "#f7d154"];
    return palette[hash32(category) % palette.length];
  }

  function iconMarkup() {
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 35 12v16L20 37 5 28V12Z"/><path d="m5 12 15 9 15-9M20 21v16"/><circle cx="20" cy="20" r="5"/></svg>';
  }

  function topbarMarkup() {
    const stats = readStats();
    return `
      <header class="cl-topbar">
        <div class="cl-brand"><span class="cl-logo">${iconMarkup()}</span><div><small>GUESS THE AWS SERVICE</small><h1>Cloudle <b>${state && state.game ? escapeHtml(MODES[state.game.mode].name) : "AWS"}</b></h1></div></div>
        <div class="cl-summary" aria-label="Estadísticas de Cloudle">
          <span><b>${stats.played}</b><small>PARTIDAS</small></span><span><b>${stats.wins}</b><small>VICTORIAS</small></span><span><b>${stats.currentStreak}</b><small>RACHA</small></span>
        </div>
        <nav class="cl-toolbar" aria-label="Acciones de Cloudle">
          <button type="button" data-cl-action="modes">Modos</button>
          <button type="button" data-cl-action="focus-catalog">Catálogo</button>
          <button type="button" data-cl-action="exit">Salir</button>
        </nav>
      </header>`;
  }

  function shellMarkup() {
    return `
      <section class="cloudle-shell" aria-label="Cloudle, adivina el servicio AWS">
        ${topbarMarkup()}
        <div class="cl-workspace">
          <main class="cl-center" id="cl-center"></main>
          <aside class="cl-catalog" id="cl-catalog" aria-label="Catálogo permanente de servicios AWS"></aside>
        </div>
        <div class="cl-toast" id="cl-toast" role="status" aria-live="polite"></div>
        <p class="cl-sr-only" id="cl-live" aria-live="assertive"></p>
      </section>`;
  }

  function modeCardsMarkup() {
    return MODE_ORDER.map((mode) => {
      const data = MODES[mode];
      const selected = state.setup.mode === mode;
      return `<button type="button" class="cl-mode-card ${selected ? "is-selected" : ""}" data-cl-mode="${mode}" aria-pressed="${selected}">
        <span class="cl-mode-icon">${MODE_ICONS[mode]}</span><span><small>${data.eyebrow}</small><strong>${data.name}</strong><em>${data.description}</em></span><i>${selected ? "✓" : "→"}</i>
      </button>`;
    }).join("");
  }

  function optionMarkup(values, selected, allLabel) {
    const first = allLabel == null ? "" : `<option value="all" ${selected === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`;
    return first + values.map((value) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
  }

  function setupControlsMarkup() {
    const mode = state.setup.mode;
    if (mode === "daily") {
      const answer = dailyAnswer(state.today);
      return `<div class="cl-daily-card"><span>RETO ${escapeHtml(state.today)}</span><strong>${answer ? answer.token.length : "—"} caracteres</strong><small>Rotación activa: ${eligible.length} respuestas únicas</small></div>`;
    }
    const showCategory = ["category", "architect"].includes(mode);
    const setupCategories = categories(eligible);
    const validLengths = validLengthsForSetup();
    return `<div class="cl-config-grid">
      ${showCategory ? `<label><span>Categoría de respuesta</span><select data-cl-setup="category">${optionMarkup(setupCategories, state.setup.category, mode === "architect" ? "Todas las categorías" : null)}</select></label>` : ""}
      <label><span>Longitud del token</span><select data-cl-setup="length">${optionMarkup(validLengths, state.setup.length)}</select></label>
      <div class="cl-pool-size"><span>POOL ELEGIBLE</span><strong>${setupCandidates().length}</strong><small>servicios posibles</small></div>
    </div>`;
  }

  function setupMarkup() {
    const stats = readStats();
    return `<section class="cl-setup">
      <div class="cl-setup-heading"><span>SELECT GAME MODE</span><h2>Adivina el token del servicio</h2><p>No escribes la respuesta: filtra los servicios compatibles, elige uno y despliega tu intento.</p></div>
      <div class="cl-mode-grid">${modeCardsMarkup()}</div>
      <section class="cl-configuration" aria-label="Configuración de partida"><div><span>${escapeHtml(MODES[state.setup.mode].eyebrow)}</span><h3>${escapeHtml(MODES[state.setup.mode].name)}</h3></div>${setupControlsMarkup()}</section>
      <div class="cl-start-row"><div><span><b>${stats.discovered.length}</b> servicios descubiertos</span><span><b>${stats.bestStreak}</b> mejor racha diaria</span></div><button type="button" class="cl-primary" data-cl-action="start" ${setupCandidates().length || state.setup.mode === "daily" ? "" : "disabled"}>Iniciar partida <b>→</b></button></div>
    </section>`;
  }

  function clueMarkup() {
    if (!state.game || state.game.mode !== "architect") return "";
    const game = state.game;
    const answer = game.answer;
    const failures = game.guesses.filter((guess) => guess.token !== answer.token).length;
    const nameWords = answer.displayName.split(/\s+/).filter(Boolean);
    const initialPattern = nameWords.map((word) => `${word.charAt(0).toUpperCase()}${"•".repeat(Math.max(0, word.length - 1))}`).join(" ");
    const clues = [
      [0, "DOMINIO", answer.category],
      [1, "DESCRIPCIÓN", answer.description],
      [3, "SILUETA DEL NOMBRE", `${initialPattern} · ${nameWords.length} ${nameWords.length === 1 ? "palabra" : "palabras"}`],
      [4, "ALIAS", answer.aliases.length ? answer.aliases.join(" · ") : "Este servicio no tiene alias registrados."]
    ];
    const visibleClues = clues.filter(([at]) => failures >= at).length;
    return `<section class="cl-clues" aria-label="Pistas de arquitectura"><div class="cl-section-title"><span>ARCHITECT CLUES</span><small>${visibleClues} / ${clues.length} visibles</small></div><div>${clues.map(([at, label, text]) => failures >= at
      ? `<article class="is-visible"><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></article>`
      : `<article class="is-locked"><span>PISTA BLOQUEADA</span><p>Disponible tras ${at - failures} ${at - failures === 1 ? "fallo" : "fallos"} más.</p></article>`).join("")}</div></section>`;
  }

  function tileMarkup(character, status, index, revealing) {
    const classes = ["cl-tile", status ? `is-${status}` : "", revealing ? "is-revealing" : ""].filter(Boolean).join(" ");
    return `<span class="${classes}" style="--i:${index}" aria-label="${character ? `${escapeHtml(character)}, ${status || "sin evaluar"}` : "vacía"}">${escapeHtml(character || "")}</span>`;
  }

  function boardMarkup() {
    const game = state.game;
    const length = game.answer.token.length;
    const rows = [];
    for (let row = 0; row < MAX_ATTEMPTS; row += 1) {
      const guess = game.guesses[row];
      const pending = !guess && row === game.guesses.length ? game.selected : null;
      const token = guess ? guess.token : pending ? pending.token : "";
      const evaluation = guess ? guess.evaluation : [];
      const revealing = Boolean(guess && game.phase === "revealing" && row === game.guesses.length - 1);
      const cells = Array.from({ length }, (_, index) => tileMarkup(token[index], evaluation[index], index, revealing)).join("");
      rows.push(`<div class="cl-row ${pending ? "is-pending" : ""}" style="--length:${length}" aria-label="Intento ${row + 1}">${cells}</div>`);
    }
    return `<div class="cl-board ${length >= 15 ? "is-long" : ""}" style="--token-length:${length}" aria-label="Tablero, ${MAX_ATTEMPTS} intentos de ${length} caracteres">${rows.join("")}</div>`;
  }

  function keyboardMarkup() {
    const used = {};
    state.game.guesses.forEach((guess) => guess.token.split("").forEach((character, index) => {
      const status = guess.evaluation[index];
      if (!used[character] || STATUS_RANK[status] > STATUS_RANK[used[character]]) used[character] = status;
    }));
    const answerChars = new Set(state.game.answer.token.split(""));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    "0123456789-_/.".split("").forEach((character) => { if (answerChars.has(character) || used[character]) alphabet.push(character); });
    const rows = [alphabet.slice(0, 10), alphabet.slice(10, 19), alphabet.slice(19)];
    return `<div class="cl-keyboard" aria-label="Teclado visual de estados">${rows.map((row) => `<div>${row.map((character) => `<span class="${used[character] ? `is-${used[character]}` : ""}" aria-label="${character}${used[character] ? `, ${used[character]}` : ""}">${escapeHtml(character)}</span>`).join("")}</div>`).join("")}</div>`;
  }

  function serviceCardMarkup(service, selected) {
    return `<button type="button" class="cl-service ${selected ? "is-selected" : ""}" data-cl-service="${service.key}" aria-pressed="${selected}" style="--category:${categoryColor(service.category)}">
      <span class="cl-service-mark">${escapeHtml(service.token.slice(0, 2))}</span><span><strong>${escapeHtml(service.token)}</strong><small>${escapeHtml(service.displayName)}</small></span><em>${escapeHtml(service.category)}</em><i>${selected ? "✓" : "+"}</i>
    </button>`;
  }

  function pickerMatches() {
    const game = state.game;
    if (!game) return [];
    return services.filter((service) => service.token.length === game.answer.token.length)
      .filter((service) => state.picker.category === "all" || service.category === state.picker.category)
      .filter((service) => !state.picker.search || service.search.includes(searchable(state.picker.search)))
      .sort((a, b) => a.token.localeCompare(b.token));
  }

  function pickerMarkup() {
    const game = state.game;
    const matches = pickerMatches();
    const availableCategories = categories(services.filter((service) => service.token.length === game.answer.token.length));
    return `<section class="cl-picker" aria-label="Selector de servicios válidos">
      <div class="cl-section-title"><span>SELECT SERVICE · ${game.answer.token.length} CHARS</span><small>${matches.length} compatibles</small></div>
      <div class="cl-picker-tools"><label><span class="cl-sr-only">Buscar servicio para el intento</span><input id="cl-picker-search" type="search" value="${escapeHtml(state.picker.search)}" placeholder="Buscar token, nombre o descripción…" autocomplete="off"></label><label><span class="cl-sr-only">Filtrar selector por categoría</span><select id="cl-picker-category">${optionMarkup(availableCategories, state.picker.category, "Todas las categorías")}</select></label></div>
      <div class="cl-service-list" id="cl-service-list">${matches.length ? matches.map((service) => serviceCardMarkup(service, game.selected && game.selected.key === service.key)).join("") : '<p class="cl-empty">No hay servicios compatibles con estos filtros.</p>'}</div>
      <div class="cl-submit-row"><div>${game.selected ? `<span>SELECCIONADO</span><strong>${escapeHtml(game.selected.token)}</strong><small>${escapeHtml(game.selected.displayName)}</small>` : "<span>ELIGE UN SERVICIO</span><small>Solo aparecen tokens de la longitud requerida.</small>"}</div><button type="button" class="cl-primary" data-cl-action="submit" ${!game.selected || game.phase !== "active" ? "disabled" : ""}>Desplegar intento</button></div>
    </section>`;
  }

  function resultGrid() {
    return state.game.guesses.map((guess) => guess.evaluation.map((status) => status === "correct" ? "🟩" : status === "present" ? "🟨" : "⬛").join("")).join("\n");
  }

  function scoreForGame() {
    const game = state.game;
    const attempts = game.guesses.length;
    const modeBonus = game.mode === "daily" ? 150 : game.mode === "architect" ? 100 : 0;
    return Math.max(100, (MAX_ATTEMPTS + 1 - attempts) * 120 + modeBonus);
  }

  function resultMarkup() {
    const game = state.game;
    if (!game || !["won", "lost"].includes(game.phase)) return "";
    const won = game.phase === "won";
    const score = won ? scoreForGame() : 0;
    return `<section class="cl-result ${won ? "is-win" : "is-loss"}" role="dialog" aria-modal="false" aria-labelledby="cl-result-title">
      <div class="cl-result-icon">${won ? "✓" : "!"}</div><span>${won ? "STACK IDENTIFIED" : "ATTEMPTS EXHAUSTED"}</span><h2 id="cl-result-title">${won ? "Servicio descubierto" : "Era " + escapeHtml(game.answer.token)}</h2>
      <p><strong>${escapeHtml(game.answer.displayName)}</strong> · ${escapeHtml(game.answer.category)}</p><p>${escapeHtml(game.answer.description)}</p>
      <div class="cl-result-metrics"><span><b>${won ? game.guesses.length : "X"}/6</b><small>INTENTOS</small></span><span><b>${score}</b><small>SCORE</small></span><span><b>${readStats().currentStreak}</b><small>RACHA DAILY</small></span></div>
      <pre aria-label="Resultado en cuadrados de colores">${resultGrid()}</pre>
      <div class="cl-result-actions"><button type="button" class="cl-primary" data-cl-action="share">Compartir resultado</button><button type="button" data-cl-action="retry">${game.mode === "daily" ? "Repetir Daily" : "Nueva respuesta"}</button><button type="button" data-cl-action="modes">Elegir modo</button></div>
    </section>`;
  }

  function gameMarkup() {
    const game = state.game;
    return `<section class="cl-game">
      <div class="cl-game-heading"><div><span>${escapeHtml(MODES[game.mode].eyebrow)}</span><h2>${escapeHtml(MODES[game.mode].name)}</h2></div><div><span>LONGITUD</span><strong>${game.answer.token.length}</strong><small>${game.guesses.length} / ${MAX_ATTEMPTS} intentos</small></div></div>
      ${clueMarkup()}
      <section class="cl-board-panel">${boardMarkup()}${keyboardMarkup()}</section>
      ${resultMarkup() || pickerMarkup()}
    </section>`;
  }

  function catalogMatches() {
    return services.filter((service) => state.catalog.category === "all" || service.category === state.catalog.category)
      .filter((service) => state.catalog.length === "all" || service.token.length === Number(state.catalog.length))
      .filter((service) => !state.catalog.search || service.search.includes(searchable(state.catalog.search)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  }

  function catalogMarkup() {
    const matches = catalogMatches();
    const stats = readStats();
    const discovered = new Set(stats.discovered);
    return `<div class="cl-catalog-head"><span>EXPLORE AWS</span><h2>Catálogo de servicios</h2><p>Consulta todos los servicios sin abandonar la partida.</p></div>
      <div class="cl-catalog-tools"><label><span class="cl-sr-only">Buscar en el catálogo</span><input id="cl-catalog-search" type="search" value="${escapeHtml(state.catalog.search)}" placeholder="Buscar servicio…" autocomplete="off"></label><div><label><span class="cl-sr-only">Categoría del catálogo</span><select id="cl-catalog-category">${optionMarkup(categories(services), state.catalog.category, "Todas las categorías")}</select></label><label><span class="cl-sr-only">Longitud del catálogo</span><select id="cl-catalog-length">${optionMarkup(lengths(services), state.catalog.length, "Cualquier longitud")}</select></label></div></div>
      <div class="cl-catalog-count"><span>${matches.length} de ${services.length}</span><span>${stats.discovered.length} descubiertos</span></div>
      <div class="cl-catalog-list" id="cl-catalog-list">${matches.length ? matches.map((service) => `<article style="--category:${categoryColor(service.category)}"><span class="cl-catalog-icon">${escapeHtml(service.token.slice(0, 2))}</span><div><strong>${escapeHtml(service.displayName)}</strong><code>${escapeHtml(service.token)} · ${service.token.length}</code><small>${escapeHtml(service.category)}</small><p>${escapeHtml(service.description)}</p>${service.aliases.length ? `<em>${escapeHtml(service.aliases.join(" · "))}</em>` : ""}</div><i title="${discovered.has(service.id) ? "Descubierto" : "No descubierto"}">${discovered.has(service.id) ? "✓" : "·"}</i></article>`).join("") : '<p class="cl-empty">No hay servicios que coincidan.</p>'}</div>`;
  }

  function errorMarkup(message) {
    return `<section class="cloudle-shell cl-error" role="alert"><div class="cl-error-icon">!</div><span>CLOUDLE UNAVAILABLE</span><h1>No se pudo cargar el catálogo AWS</h1><p>${escapeHtml(message)}</p><code>window.AWS_SERVICE_CATALOG</code><button type="button" data-cl-action="exit">Volver al centro</button></section>`;
  }

  function renderCenter() {
    if (!host || !state) return;
    const center = host.querySelector("#cl-center");
    if (center) center.innerHTML = state.screen === "game" ? gameMarkup() : setupMarkup();
  }

  function renderCatalog() {
    if (!host || !state) return;
    const catalog = host.querySelector("#cl-catalog");
    if (catalog) catalog.innerHTML = catalogMarkup();
  }

  function renderAll() {
    if (!host || !state) return;
    host.innerHTML = shellMarkup();
    renderCenter();
    renderCatalog();
  }

  function showToast(message) {
    const toast = host && host.querySelector("#cl-toast");
    const live = host && host.querySelector("#cl-live");
    if (live) live.textContent = message;
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    schedule(() => toast.classList.remove("is-visible"), 2200);
  }

  function markStarted() {
    const game = state.game;
    if (game.started) return;
    game.started = true;
    const stats = readStats();
    if (game.mode === "daily") {
      const record = stats.dailyRecords[state.today] || {};
      if (!record.started) {
        record.started = true;
        stats.played += 1;
        stats.modePlayed.daily = finite(stats.modePlayed.daily, 0) + 1;
      }
      stats.dailyRecords[state.today] = record;
    } else {
      stats.played += 1;
      stats.modePlayed[game.mode] = finite(stats.modePlayed[game.mode], 0) + 1;
    }
    trimDailyRecords(stats);
    saveStats(stats);
  }

  function trimDailyRecords(stats) {
    const keys = Object.keys(stats.dailyRecords).sort();
    keys.slice(0, Math.max(0, keys.length - 400)).forEach((key) => { delete stats.dailyRecords[key]; });
  }

  function previousDateKey(key) {
    const date = new Date(`${key}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return dateKey(date);
  }

  function commitResult(won) {
    const game = state.game;
    if (game.committed) return;
    game.committed = true;
    const stats = readStats();
    let countWin = won;
    if (game.mode === "daily") {
      const record = stats.dailyRecords[state.today] || { started: true };
      countWin = won && !record.won;
      if (won) record.won = true;
      else if (!record.won) record.lost = true;
      stats.dailyRecords[state.today] = record;
      if (countWin) {
        stats.currentStreak = stats.lastDailyWin === previousDateKey(state.today) ? stats.currentStreak + 1 : 1;
        stats.lastDailyWin = state.today;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else if (!won && !record.won) stats.currentStreak = 0;
    }
    if (countWin) {
      stats.wins += 1;
      stats.modeWins[game.mode] = finite(stats.modeWins[game.mode], 0) + 1;
      stats.distribution[game.guesses.length - 1] += 1;
      if (!stats.discovered.includes(game.answer.id)) stats.discovered.push(game.answer.id);
      stats.bestScore = Math.max(stats.bestScore, scoreForGame());
    }
    trimDailyRecords(stats);
    saveStats(stats);
  }

  function startGame(reuseAnswer) {
    reconcileSetup();
    const previousAnswer = state.game && state.game.answer ? state.game.answer : null;
    if (previousAnswer) state.lastAnswerKey = previousAnswer.key;
    const answer = reuseAnswer && previousAnswer ? previousAnswer : chooseAnswer();
    if (!answer) {
      showToast("No hay respuestas elegibles para esta configuración.");
      return;
    }
    state.game = {
      mode: state.setup.mode, answer, guesses: [], selected: null,
      phase: "active", started: false, committed: false
    };
    state.picker = { search: "", category: "all" };
    state.screen = "game";
    renderAll();
  }

  function submitGuess() {
    const game = state && state.game;
    if (!game || game.phase !== "active" || !game.selected) return;
    markStarted();
    const selected = game.selected;
    const evaluation = evaluateGuess(selected.token, game.answer.token);
    game.guesses.push({ service: selected, token: selected.token, evaluation });
    game.selected = null;
    game.phase = "revealing";
    renderCenter();
    const won = selected.token === game.answer.token;
    schedule(() => {
      if (!state || !state.game || state.game !== game) return;
      if (won) game.phase = "won";
      else if (game.guesses.length >= MAX_ATTEMPTS) game.phase = "lost";
      else game.phase = "active";
      if (won || game.phase === "lost") commitResult(won);
      renderAll();
      showToast(won ? `Correcto: ${game.answer.displayName}` : game.phase === "lost" ? `La respuesta era ${game.answer.token}` : "Pista actualizada. Elige otro servicio.");
    }, Math.min(1500, 380 + selected.token.length * 72));
  }

  function selectService(key) {
    const game = state && state.game;
    if (!game || game.phase !== "active") return;
    const service = services.find((item) => item.key === key);
    if (!service || service.token.length !== game.answer.token.length) return;
    game.selected = service;
    renderCenter();
    const submit = host.querySelector('[data-cl-action="submit"]');
    if (submit) submit.focus();
  }

  function updatePickerList() {
    if (!host || !state || !state.game) return;
    const list = host.querySelector("#cl-service-list");
    if (!list) return;
    const matches = pickerMatches();
    list.innerHTML = matches.length ? matches.map((service) => serviceCardMarkup(service, state.game.selected && state.game.selected.key === service.key)).join("") : '<p class="cl-empty">No hay servicios compatibles con estos filtros.</p>';
    const count = host.querySelector(".cl-picker .cl-section-title small");
    if (count) count.textContent = `${matches.length} compatibles`;
  }

  function updateCatalogList() {
    if (!host || !state) return;
    renderCatalog();
  }

  function shareText() {
    const game = state.game;
    const result = game.phase === "won" ? `${game.guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const daily = game.mode === "daily" ? ` ${state.today}` : "";
    return `Cloudle ${MODES[game.mode].name}${daily} ${result}\n${resultGrid()}\n\nCloud Arcade`;
  }

  async function shareResult() {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ title: "Cloudle", text });
      else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      showToast("Resultado copiado para compartir.");
    } catch (_) {
      showToast("No se pudo compartir el resultado.");
    }
  }

  function confirmLeaveGame() {
    return !state.game || state.game.phase !== "active" || state.game.guesses.length === 0 || window.confirm("¿Abandonar la partida actual?");
  }

  function handleClick(event) {
    if (!host) return;
    const modeButton = event.target.closest("[data-cl-mode]");
    if (modeButton && host.contains(modeButton)) {
      state.setup.mode = modeButton.dataset.clMode;
      state.setup.category = state.setup.mode === "category" ? categories(eligible)[0] || "all" : "all";
      reconcileSetup();
      renderCenter();
      return;
    }
    const serviceButton = event.target.closest("[data-cl-service]");
    if (serviceButton && host.contains(serviceButton)) { selectService(serviceButton.dataset.clService); return; }
    const actionButton = event.target.closest("[data-cl-action]");
    if (!actionButton || !host.contains(actionButton)) return;
    const action = actionButton.dataset.clAction;
    if (action === "start") startGame(false);
    if (action === "submit") submitGuess();
    if (action === "share") shareResult();
    if (action === "retry") startGame(state.game && state.game.mode === "daily");
    if (action === "modes" && confirmLeaveGame()) { state.screen = "setup"; state.game = null; renderAll(); }
    if (action === "focus-catalog") {
      const input = host.querySelector("#cl-catalog-search");
      if (input) { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleInput(event) {
    if (!state) return;
    if (event.target.id === "cl-picker-search") { state.picker.search = event.target.value; updatePickerList(); }
    if (event.target.id === "cl-catalog-search") { state.catalog.search = event.target.value; updateCatalogList(); const input = host.querySelector("#cl-catalog-search"); if (input) { input.focus(); input.setSelectionRange(state.catalog.search.length, state.catalog.search.length); } }
  }

  function handleChange(event) {
    if (!state) return;
    if (event.target.dataset.clSetup === "category") {
      state.setup.category = event.target.value;
      reconcileSetup();
      renderCenter();
    }
    if (event.target.dataset.clSetup === "length") { state.setup.length = Number(event.target.value); renderCenter(); }
    if (event.target.id === "cl-picker-category") { state.picker.category = event.target.value; updatePickerList(); }
    if (event.target.id === "cl-catalog-category") { state.catalog.category = event.target.value; updateCatalogList(); }
    if (event.target.id === "cl-catalog-length") { state.catalog.length = event.target.value; updateCatalogList(); }
  }

  function handleKeyDown(event) {
    if (!host || !state || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target && event.target.isContentEditable) return;
    if (event.key === "Enter" && state.game && state.game.selected) { event.preventDefault(); submitGuess(); }
    if (event.key === "Escape" && state.game && state.game.selected) { state.game.selected = null; renderCenter(); }
  }

  function mount(container, onExit) {
    destroy();
    if (!container) throw new Error("Cloudle.mount requiere un contenedor válido.");
    ensureStyles();
    host = container;
    exitCallback = typeof onExit === "function" ? onExit : null;
    if (!Array.isArray(window.AWS_SERVICE_CATALOG)) {
      host.innerHTML = errorMarkup("Carga window.AWS_SERVICE_CATALOG antes de montar Cloudle. Debe ser un array de entradas {id, displayName, token, category, description, aliases, eligible}.");
      host.addEventListener("click", handleClick);
      return;
    }
    services = normalizeCatalog(window.AWS_SERVICE_CATALOG);
    eligible = uniqueAnswers(services);
    if (!services.length || !eligible.length) {
      host.innerHTML = errorMarkup(!services.length ? "El catálogo no contiene tokens válidos." : "El catálogo no contiene servicios con eligible: true.");
      host.addEventListener("click", handleClick);
      return;
    }
    const availableLengths = lengths(eligible);
    state = {
      today: dateKey(new Date()), screen: "setup", game: null, lastAnswerKey: "",
      setup: { mode: "daily", category: "all", length: availableLengths[0] || null },
      picker: { search: "", category: "all" },
      catalog: { search: "", category: "all", length: "all" }
    };
    host.addEventListener("click", handleClick);
    host.addEventListener("input", handleInput);
    host.addEventListener("change", handleChange);
    document.addEventListener("keydown", handleKeyDown);
    renderAll();
  }

  function destroy() {
    clearTimers();
    const mountedHost = host;
    if (mountedHost) {
      mountedHost.removeEventListener("click", handleClick);
      mountedHost.removeEventListener("input", handleInput);
      mountedHost.removeEventListener("change", handleChange);
      mountedHost.innerHTML = "";
    }
    document.removeEventListener("keydown", handleKeyDown);
    if (ownedStyle && ownedStyle.parentNode) ownedStyle.parentNode.removeChild(ownedStyle);
    ownedStyle = null;
    host = null;
    exitCallback = null;
    services = [];
    eligible = [];
    state = null;
  }

  window.Cloudle = { mount, destroy, getStats: readStats };
}());
