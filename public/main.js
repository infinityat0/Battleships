import { CELLS, SIZE, allSunk, chooseShot, createSide, fire, isSunk, publicView } from "./engine.js";

const COMPUTER_DELAY_MS = 450;

const $ = (id) => document.getElementById(id);
const enemyEl = $("enemy");
const playerEl = $("player");
const levelEl = $("level");
const messageEl = $("message");
const reshuffleBtn = $("reshuffle");

let player; // the human's side (the computer shoots at it)
let enemy; // the computer's side (the human shoots at it)
let turn = "player"; // player | computer | over
let started = false;
let focus = 0;
let lastEnemyShot = -1;
let lastPlayerShot = -1;
let pending = null;

const enemyCells = [];
const playerCells = [];

function buildGrid(el, store, interactive) {
  for (let i = 0; i < CELLS; i++) {
    const cell = document.createElement(interactive ? "button" : "div");
    cell.className = "cell";
    cell.dataset.i = i;
    if (interactive) {
      cell.type = "button";
      cell.tabIndex = -1;
    }
    store.push(cell);
    el.append(cell);
  }
}

function setMessage(text, kind = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${kind}`;
}

const coord = (i) => `${"ABCDEFGHIJ"[Math.floor(i / SIZE)]}${(i % SIZE) + 1}`;

function newGame() {
  clearTimeout(pending);
  player = createSide();
  enemy = createSide();
  turn = "player";
  started = false;
  lastEnemyShot = lastPlayerShot = -1;
  setMessage("Your move. Fire at enemy waters.");
  render();
}

function renderSide(side, cells, revealShips, last) {
  const sunkCells = new Set(side.ships.filter(isSunk).flatMap((s) => s.cells));
  side.shots.forEach((shot, i) => {
    const el = cells[i];
    const wasShot = el.classList.contains("shot");
    let cls = "cell";
    if (revealShips && side.grid[i] !== -1) cls += " ship";
    if (sunkCells.has(i)) cls += " ship sunk";
    if (shot) cls += ` shot ${shot}`;
    if (shot && !wasShot) cls += " fresh";
    if (i === last) cls += " last";
    el.className = cls;
    const status = sunkCells.has(i) ? "sunk ship" : shot === "hit" ? "hit" : shot === "miss" ? "miss" : revealShips && side.grid[i] !== -1 ? "your ship" : "open water";
    el.setAttribute("aria-label", `${coord(i)}: ${status}`);
  });
}

function renderFleet(side, el) {
  el.replaceChildren(
    ...side.ships.map((s) => {
      const li = document.createElement("li");
      if (isSunk(s)) li.className = "down";
      const pips = document.createElement("span");
      pips.className = "pips";
      for (let k = 0; k < s.size; k++) {
        const p = document.createElement("span");
        if (k < s.hits) p.className = "h";
        pips.append(p);
      }
      li.append(pips, s.name);
      return li;
    }),
  );
}

function renderEnemyFleet() {
  // Only sunk ships are known; show the rest without hit counts.
  const known = enemy.ships.map((s) => (isSunk(s) ? s : { ...s, hits: 0 }));
  renderFleet({ ships: known }, $("enemy-fleet"));
}

function render() {
  const over = turn === "over";
  renderSide(enemy, enemyCells, over, lastPlayerShot);
  renderSide(player, playerCells, true, lastEnemyShot);
  enemyCells.forEach((el, i) => (el.tabIndex = i === focus ? 0 : -1));
  enemyEl.classList.toggle("waiting", turn === "computer");
  renderEnemyFleet();
  renderFleet(player, $("player-fleet"));
  reshuffleBtn.disabled = started;

  const shots = enemy.shots.filter(Boolean).length;
  const hits = enemy.shots.filter((s) => s === "hit").length;
  $("shots").textContent = shots;
  $("hits").textContent = hits;
  $("accuracy").textContent = shots ? `${Math.round((hits / shots) * 100)}%` : "–";
}

function playerFire(i) {
  if (turn !== "player") return;
  const { result, ship } = fire(enemy, i);
  if (result === "repeat") {
    setMessage(`You already fired at ${coord(i)}.`, "error");
    return;
  }
  started = true;
  lastPlayerShot = i;
  if (allSunk(enemy)) {
    turn = "over";
    setMessage(`You sank the enemy fleet in ${enemy.shots.filter(Boolean).length} shots. Victory!`, "win");
    render();
    return;
  }
  const said = { miss: `${coord(i)}: miss.`, hit: `${coord(i)}: hit!`, sunk: `${coord(i)}: you sank their ${ship?.name}!` }[result];
  setMessage(`${said} Computer is aiming…`);
  turn = "computer";
  render();
  pending = setTimeout(() => computerFire(said), COMPUTER_DELAY_MS);
}

function computerFire(playerSummary) {
  const i = chooseShot(publicView(player), levelEl.value);
  const { result, ship } = fire(player, i);
  lastEnemyShot = i;
  if (allSunk(player)) {
    turn = "over";
    setMessage("The computer sank your whole fleet. Its remaining ships are revealed.", "lose");
    render();
    return;
  }
  const said = {
    miss: `Computer fired at ${coord(i)} and missed.`,
    hit: `Computer hit you at ${coord(i)}!`,
    sunk: `Computer sank your ${ship?.name}!`,
  }[result];
  setMessage(`${playerSummary} ${said}`, result === "miss" ? "" : "error");
  turn = "player";
  render();
}

enemyEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  focus = Number(cell.dataset.i);
  playerFire(focus);
});

enemyEl.addEventListener("keydown", (e) => {
  const step = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const next = focus + step;
  const sameRow = Math.abs(step) === 1 ? Math.floor(next / SIZE) === Math.floor(focus / SIZE) : true;
  if (next < 0 || next >= CELLS || !sameRow) return;
  focus = next;
  render();
  enemyCells[focus].focus();
});

reshuffleBtn.addEventListener("click", () => {
  if (started) return;
  player = createSide();
  render();
});
$("new").addEventListener("click", newGame);

buildGrid(enemyEl, enemyCells, true);
buildGrid(playerEl, playerCells, false);
newGame();
