/* Stack Solitaire: classic Klondike with AWS-inspired service cards. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:stack-solitaire:stats";
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = [
    {
      id: "compute", name: "Compute", symbol: "λ", group: "warm", color: "orange",
      services: ["Lambda", "Lightsail", "EC2", "Batch", "ECS", "EKS", "Fargate", "App Runner", "Beanstalk", "Auto Scaling", "Outposts", "Local Zones", "Wavelength"]
    },
    {
      id: "storage", name: "Storage", symbol: "S3", group: "cool", color: "green",
      services: ["S3", "EBS", "EFS", "FSx", "Backup", "Storage Gateway", "DataSync", "Transfer Family", "Snowcone", "Snowball", "Snowmobile", "File Cache", "Elastic DR"]
    },
    {
      id: "data", name: "Data", symbol: "DB", group: "cool", color: "blue",
      services: ["DynamoDB", "RDS", "Aurora", "ElastiCache", "MemoryDB", "DocumentDB", "Neptune", "Timestream", "Keyspaces", "Redshift", "OpenSearch", "Lake Formation", "Glue"]
    },
    {
      id: "security", name: "Security", symbol: "◆", group: "warm", color: "red",
      services: ["IAM", "Cognito", "KMS", "Secrets Manager", "ACM", "WAF", "Shield", "GuardDuty", "Inspector", "Macie", "Security Hub", "Detective", "Artifact"]
    }
  ];

  let host = null;
  let state = null;
  let timerId = null;
  let hintTimer = null;
  let exitCallback = null;

  function readStats() {
    try {
      return { played: 0, wins: 0, bestScore: 0, bestTime: null, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch (_) {
      return { played: 0, wins: 0, bestScore: 0, bestTime: null };
    }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Local storage is optional. */ }
  }

  function getSuit(id) {
    return SUITS.find((suit) => suit.id === id);
  }

  function createDeck() {
    return SUITS.flatMap((suit) => suit.services.map((service, index) => ({
      id: `${suit.id}-${index + 1}`,
      suit: suit.id,
      group: suit.group,
      rank: index + 1,
      service,
      faceUp: false
    })));
  }

  function shuffle(cards) {
    const result = cards.map((card) => ({ ...card }));
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function dealGame() {
    const deck = shuffle(createDeck());
    const tableau = Array.from({ length: 7 }, () => []);
    for (let column = 0; column < 7; column += 1) {
      for (let row = 0; row <= column; row += 1) {
        const card = deck.pop();
        card.faceUp = row === column;
        tableau[column].push(card);
      }
    }
    return {
      stock: deck,
      waste: [],
      foundations: Object.fromEntries(SUITS.map((suit) => [suit.id, []])),
      tableau
    };
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
    timerId = window.setInterval(() => {
      const timer = host?.querySelector("#sol-time");
      if (timer) timer.textContent = formatTime(elapsedSeconds());
    }, 1000);
  }

  function snapshot() {
    return {
      stock: state.stock.map((card) => ({ ...card })),
      waste: state.waste.map((card) => ({ ...card })),
      foundations: Object.fromEntries(SUITS.map((suit) => [suit.id, state.foundations[suit.id].map((card) => ({ ...card }))])),
      tableau: state.tableau.map((column) => column.map((card) => ({ ...card }))),
      score: state.score,
      moves: state.moves
    };
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 80) state.history.shift();
  }

  function rankLabel(rank) {
    return RANKS[rank - 1];
  }

  function cardLocationKey(location) {
    if (!location) return "";
    return `${location.source}-${location.column ?? location.suit ?? "top"}-${location.index ?? "top"}`;
  }

  function getCardAt(location) {
    if (!location) return null;
    if (location.source === "waste") return state.waste.at(-1) || null;
    if (location.source === "foundation") return state.foundations[location.suit].at(-1) || null;
    if (location.source === "tableau") return state.tableau[location.column][location.index] || null;
    return null;
  }

  function selectedCards() {
    if (!state.selected) return [];
    if (state.selected.source === "tableau") return state.tableau[state.selected.column].slice(state.selected.index);
    const card = getCardAt(state.selected);
    return card ? [card] : [];
  }

  function canPlaceOnTableau(card, target) {
    if (!target) return card.rank === 13;
    return target.faceUp && target.rank === card.rank + 1 && target.group !== card.group;
  }

  function canMoveToFoundation(card, suitId) {
    if (!card || card.suit !== suitId) return false;
    return card.rank === state.foundations[suitId].length + 1;
  }

  function isValidSequence(column, index) {
    const cards = column.slice(index);
    if (!cards.length || !cards[0].faceUp) return false;
    return cards.every((card, offset) => offset === cards.length - 1 || (
      card.rank === cards[offset + 1].rank + 1 && card.group !== cards[offset + 1].group
    ));
  }

  function removeSelected() {
    const location = state.selected;
    if (location.source === "waste") return [state.waste.pop()];
    if (location.source === "foundation") return [state.foundations[location.suit].pop()];
    return state.tableau[location.column].splice(location.index);
  }

  function revealTableauTop(columnIndex) {
    if (columnIndex === undefined) return false;
    const top = state.tableau[columnIndex].at(-1);
    if (top && !top.faceUp) {
      top.faceUp = true;
      state.score += 5;
      return true;
    }
    return false;
  }

  function finishMove(sourceColumn) {
    revealTableauTop(sourceColumn);
    state.selected = null;
    state.moves += 1;
    state.hint = null;
    render();
    evaluateWin();
  }

  function moveSelectedToTableau(columnIndex) {
    if (!state.selected) return false;
    if (state.selected.source === "tableau" && state.selected.column === columnIndex) return false;
    const cards = selectedCards();
    const target = state.tableau[columnIndex].at(-1) || null;
    if (!cards.length || !canPlaceOnTableau(cards[0], target)) return false;

    startTimer();
    pushHistory();
    const sourceColumn = state.selected.source === "tableau" ? state.selected.column : undefined;
    const sourceType = state.selected.source;
    const moved = removeSelected();
    state.tableau[columnIndex].push(...moved);
    state.score = Math.max(0, state.score + (sourceType === "foundation" ? -5 : 5));
    finishMove(sourceColumn);
    return true;
  }

  function moveSelectedToFoundation(suitId) {
    if (!state.selected) return false;
    const cards = selectedCards();
    if (cards.length !== 1 || !canMoveToFoundation(cards[0], suitId)) return false;

    startTimer();
    pushHistory();
    const sourceColumn = state.selected.source === "tableau" ? state.selected.column : undefined;
    const moved = removeSelected()[0];
    moved.faceUp = true;
    state.foundations[suitId].push(moved);
    state.score += 10;
    finishMove(sourceColumn);
    return true;
  }

  function drawFromStock() {
    if (state.finishedAt) return;
    if (!state.stock.length && !state.waste.length) return;
    startTimer();
    pushHistory();
    state.selected = null;
    state.hint = null;

    if (state.stock.length) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    } else {
      state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      state.waste = [];
      state.score = Math.max(0, state.score - 20);
    }
    state.moves += 1;
    render();
  }

  function selectCard(location) {
    if (state.finishedAt) return;
    const card = getCardAt(location);
    if (!card || !card.faceUp) return;
    if (location.source === "tableau" && !isValidSequence(state.tableau[location.column], location.index)) return;

    if (cardLocationKey(state.selected) === cardLocationKey(location)) {
      state.selected = null;
      render();
      return;
    }

    if (state.selected) {
      if (location.source === "foundation" && moveSelectedToFoundation(location.suit)) return;
      if (location.source === "tableau" && location.index === state.tableau[location.column].length - 1 && moveSelectedToTableau(location.column)) return;
    }

    state.selected = location;
    render();
  }

  function autoFoundation(location) {
    if (state.finishedAt) return;
    const card = getCardAt(location);
    if (!card || !card.faceUp) return;
    if (location.source === "tableau" && location.index !== state.tableau[location.column].length - 1) return;
    state.selected = location;
    if (!moveSelectedToFoundation(card.suit)) {
      state.selected = null;
      render();
    }
  }

  function undo() {
    if (!state.history.length || state.finishedAt) return;
    const previous = state.history.pop();
    const history = state.history;
    Object.assign(state, previous, { history, selected: null, hint: null });
    render();
  }

  function findHint() {
    const waste = state.waste.at(-1);
    if (waste) {
      if (canMoveToFoundation(waste, waste.suit)) return { cardId: waste.id, target: `foundation-${waste.suit}`, copy: `${waste.service} puede subir a su foundation.` };
      for (let column = 0; column < 7; column += 1) {
        if (canPlaceOnTableau(waste, state.tableau[column].at(-1) || null)) return { cardId: waste.id, target: `tableau-${column}`, copy: `${waste.service} puede moverse a la columna ${column + 1}.` };
      }
    }

    for (let column = 0; column < 7; column += 1) {
      const cards = state.tableau[column];
      const top = cards.at(-1);
      if (top?.faceUp && canMoveToFoundation(top, top.suit)) return { cardId: top.id, target: `foundation-${top.suit}`, copy: `${top.service} puede desplegarse en ${getSuit(top.suit).name}.` };
      for (let index = 0; index < cards.length; index += 1) {
        if (!isValidSequence(cards, index)) continue;
        for (let targetColumn = 0; targetColumn < 7; targetColumn += 1) {
          if (targetColumn !== column && canPlaceOnTableau(cards[index], state.tableau[targetColumn].at(-1) || null)) {
            return { cardId: cards[index].id, target: `tableau-${targetColumn}`, copy: `Mueve ${cards[index].service} a la columna ${targetColumn + 1}.` };
          }
        }
      }
    }

    if (state.stock.length) return { cardId: "stock", target: "waste", copy: "Despliega una carta nueva desde el stock." };
    if (state.waste.length) return { cardId: "waste", target: "stock", copy: "Recicla el descarte para seguir buscando movimientos." };
    return null;
  }

  function showHint() {
    if (state.finishedAt) return;
    window.clearTimeout(hintTimer);
    state.hint = findHint();
    if (!state.hint) {
      showNotice("Sin rutas disponibles", "Prueba deshaciendo el último movimiento o inicia un stack nuevo.");
      return;
    }
    state.score = Math.max(0, state.score - 20);
    render();
    showNotice("Sugerencia del arquitecto", state.hint.copy);
    hintTimer = window.setTimeout(() => {
      if (!state) return;
      state.hint = null;
      render();
    }, 2200);
  }

  function showNotice(title, copy) {
    const notice = host.querySelector("#sol-notice");
    window.clearTimeout(state.noticeTimer);
    notice.innerHTML = `<span>i</span><div><strong>${title}</strong><small>${copy}</small></div>`;
    notice.classList.add("is-visible");
    state.noticeTimer = window.setTimeout(() => notice.classList.remove("is-visible"), 3200);
  }

  function cardMarkup(card, location, top) {
    if (!card) return "";
    const suit = getSuit(card.suit);
    const selected = cardLocationKey(state.selected) === cardLocationKey(location);
    const hinted = state.hint?.cardId === card.id;
    const attrs = `data-card-source="${location.source}" ${location.column !== undefined ? `data-card-column="${location.column}" data-card-index="${location.index}"` : ""} ${location.suit ? `data-card-suit="${location.suit}"` : ""}`;

    if (!card.faceUp) {
      return `<button type="button" class="sol-card is-facedown" style="--card-top:${top}px" ${attrs} disabled aria-label="Carta oculta"><span class="sol-card-back"><i>CA</i></span></button>`;
    }

    return `
      <button type="button" class="sol-card suit-${suit.color} ${selected ? "is-selected" : ""} ${hinted ? "is-hinted" : ""}" style="--card-top:${top}px" ${attrs} aria-label="${rankLabel(card.rank)} de ${suit.name}, ${card.service}">
        <span class="card-corner"><strong>${rankLabel(card.rank)}</strong><i>${suit.symbol}</i></span>
        <span class="card-service-mark">${suit.symbol}</span>
        <span class="card-service-name">${card.service}</span>
        <span class="card-category">${suit.name}</span>
        <span class="card-corner is-bottom"><strong>${rankLabel(card.rank)}</strong><i>${suit.symbol}</i></span>
      </button>`;
  }

  function tableauMarkup() {
    return state.tableau.map((column, columnIndex) => {
      let top = 0;
      const cards = column.map((card, index) => {
        const markup = cardMarkup(card, { source: "tableau", column: columnIndex, index }, top);
        top += card.faceUp ? 31 : 18;
        return markup;
      }).join("");
      const hinted = state.hint?.target === `tableau-${columnIndex}`;
      return `<div class="sol-tableau-column ${hinted ? "is-hint-target" : ""}" data-tableau-target="${columnIndex}" style="--column-height:${Math.max(175, top + 132)}px"><span class="column-index">0${columnIndex + 1}</span>${cards}</div>`;
    }).join("");
  }

  function foundationMarkup() {
    return SUITS.map((suit) => {
      const pile = state.foundations[suit.id];
      const card = pile.at(-1);
      const hinted = state.hint?.target === `foundation-${suit.id}`;
      return `
        <div class="sol-foundation ${hinted ? "is-hint-target" : ""}" data-foundation-target="${suit.id}">
          <span class="foundation-empty suit-${suit.color}"><b>${suit.symbol}</b><small>${suit.name}</small></span>
          ${cardMarkup(card, { source: "foundation", suit: suit.id }, 0)}
        </div>`;
    }).join("");
  }

  function render() {
    if (!host || !state) return;
    const stockHint = state.hint?.cardId === "stock" || state.hint?.target === "stock";
    const wasteHint = state.hint?.cardId === "waste" || state.hint?.target === "waste";
    const wasteCard = state.waste.at(-1);

    host.querySelector("#sol-playfield").innerHTML = `
      <div class="sol-upper-row">
        <div class="sol-draw-zone">
          <div class="sol-pile-wrap"><span class="pile-label">STOCK · ${state.stock.length}</span>
            <button type="button" class="sol-stock ${state.stock.length ? "has-cards" : "is-recycle"} ${stockHint ? "is-hinted" : ""}" data-sol-action="draw" aria-label="${state.stock.length ? "Robar una carta" : "Reciclar descarte"}">
              ${state.stock.length ? '<span class="sol-card-back"><i>CA</i></span>' : '<span class="recycle-mark">↻</span>'}
            </button>
          </div>
          <div class="sol-pile-wrap ${wasteHint ? "is-hint-target" : ""}"><span class="pile-label">DESCARTE</span><div class="sol-waste">${cardMarkup(wasteCard, { source: "waste" }, 0)}</div></div>
        </div>
        <div class="sol-foundations">${foundationMarkup()}</div>
      </div>
      <div class="sol-divider"><span>TABLEAU / DEPLOYMENT PIPELINE</span><i></i></div>
      <div class="sol-tableau">${tableauMarkup()}</div>`;

    updateDashboard();
  }

  function updateDashboard() {
    const deployed = SUITS.reduce((total, suit) => total + state.foundations[suit.id].length, 0);
    host.querySelector("#sol-time").textContent = formatTime(elapsedSeconds());
    host.querySelector("#sol-score").textContent = state.score.toLocaleString("es-ES");
    host.querySelector("#sol-moves").textContent = state.moves;
    host.querySelector("#sol-deployed").textContent = `${deployed} / 52`;
    host.querySelector("#sol-progress-bar").style.width = `${(deployed / 52) * 100}%`;
    host.querySelector('[data-sol-action="undo"]').disabled = !state.history.length || Boolean(state.finishedAt);
  }

  function evaluateWin() {
    if (!SUITS.every((suit) => state.foundations[suit.id].length === 13)) return;
    state.finishedAt = Date.now();
    window.clearInterval(timerId);
    const stats = readStats();
    stats.wins += 1;
    stats.bestScore = Math.max(stats.bestScore || 0, state.score);
    const seconds = elapsedSeconds();
    stats.bestTime = stats.bestTime === null ? seconds : Math.min(stats.bestTime, seconds);
    saveStats(stats);
    const overlay = host.querySelector("#sol-overlay");
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="sol-win-card">
        <span class="sol-win-symbol">✓</span><span class="eyebrow">DEPLOYMENT COMPLETE</span>
        <h2>Stack desplegado</h2>
        <p>Organizaste los 52 servicios en ${formatTime(seconds)} y ${state.moves} movimientos.</p>
        <strong>${state.score.toLocaleString("es-ES")} puntos</strong>
        <div><button type="button" class="primary-button" data-sol-action="new">Nuevo stack <span>→</span></button><button type="button" class="secondary-button" data-sol-action="exit">Volver al centro</button></div>
      </div>`;
  }

  function initialMarkup() {
    return `
      <section class="solitaire-shell" aria-label="Stack Solitaire">
        <header class="sol-header">
          <div class="sol-title"><span class="sol-title-icon">♠</span><div><span>KLONDIKE / DRAW 1</span><h1>Stack Solitaire</h1></div></div>
          <div class="sol-controls">
            <button type="button" data-sol-action="undo"><span>↶</span> Deshacer</button>
            <button type="button" data-sol-action="hint"><span>◎</span> Pista</button>
            <button type="button" data-sol-action="new" class="sol-new-button"><span>＋</span> Nuevo stack</button>
          </div>
        </header>
        <div class="sol-dashboard">
          <div><span>TIEMPO</span><strong id="sol-time">00:00</strong></div>
          <div><span>PUNTUACIÓN</span><strong id="sol-score">0</strong></div>
          <div class="deployment-progress"><span>DEPLOYMENT PROGRESS</span><div><i id="sol-progress-bar"></i></div></div>
          <div><span>MOVIMIENTOS</span><strong id="sol-moves">0</strong></div>
          <div><span>DESPLEGADAS</span><strong id="sol-deployed">0 / 52</strong></div>
        </div>
        <div class="sol-board">
          <div class="sol-grid-bg"></div>
          <div id="sol-playfield" class="sol-playfield"></div>
          <div id="sol-overlay" class="sol-overlay" hidden></div>
        </div>
        <div class="sol-helpbar">
          <div class="sol-suit-legend">${SUITS.map((suit) => `<span class="suit-${suit.color}"><i>${suit.symbol}</i>${suit.name}</span>`).join("")}</div>
          <p><strong>Objetivo:</strong> ordena cada categoría de A a K. En las columnas, alterna colores y desciende de rango. Haz doble clic para desplegar una carta.</p>
        </div>
        <div id="sol-notice" class="sol-notice" role="status" aria-live="polite"></div>
      </section>`;
  }

  function newGame(skipConfirmation) {
    if (!skipConfirmation && state?.startedAt && !state.finishedAt && !window.confirm("¿Quieres abandonar este stack y repartir uno nuevo?")) return;
    window.clearInterval(timerId);
    window.clearTimeout(hintTimer);
    const deal = dealGame();
    state = {
      ...deal, selected: null, hint: null, history: [], score: 0, moves: 0,
      startedAt: null, finishedAt: null, noticeTimer: null
    };
    const stats = readStats();
    stats.played += 1;
    saveStats(stats);
    const overlay = host.querySelector("#sol-overlay");
    overlay.hidden = true;
    overlay.innerHTML = "";
    render();
  }

  function locationFromElement(element) {
    const source = element.dataset.cardSource;
    if (source === "tableau") return { source, column: Number(element.dataset.cardColumn), index: Number(element.dataset.cardIndex) };
    if (source === "foundation") return { source, suit: element.dataset.cardSuit };
    return { source: "waste" };
  }

  function handleClick(event) {
    const card = event.target.closest("[data-card-source]");
    if (card) { selectCard(locationFromElement(card)); return; }

    const foundation = event.target.closest("[data-foundation-target]");
    if (foundation && state.selected) { moveSelectedToFoundation(foundation.dataset.foundationTarget); return; }

    const tableau = event.target.closest("[data-tableau-target]");
    if (tableau && state.selected) { moveSelectedToTableau(Number(tableau.dataset.tableauTarget)); return; }

    const action = event.target.closest("[data-sol-action]")?.dataset.solAction;
    if (action === "draw") drawFromStock();
    if (action === "undo") undo();
    if (action === "hint") showHint();
    if (action === "new") newGame(false);
    if (action === "exit" && exitCallback) exitCallback();
  }

  function handleDoubleClick(event) {
    const card = event.target.closest("[data-card-source]");
    if (card) autoFoundation(locationFromElement(card));
  }

  function mount(container, onExit) {
    destroy();
    host = container;
    exitCallback = onExit;
    host.innerHTML = initialMarkup();
    host.addEventListener("click", handleClick);
    host.addEventListener("dblclick", handleDoubleClick);
    newGame(true);
  }

  function destroy() {
    window.clearInterval(timerId);
    window.clearTimeout(hintTimer);
    if (state?.noticeTimer) window.clearTimeout(state.noticeTimer);
    if (host) {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("dblclick", handleDoubleClick);
    }
    host = null;
    state = null;
    exitCallback = null;
  }

  window.StackSolitaire = { mount, destroy, getStats: readStats };
}());
