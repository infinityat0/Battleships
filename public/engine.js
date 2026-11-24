// Pure Battleships rules and computer strategy. No DOM access here.
// Cells are indices 0..99 on a 10x10 grid: index = row * 10 + col.

export const SIZE = 10;
export const CELLS = SIZE * SIZE;

export const FLEET = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];

const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;

export function orthogonal(i) {
  const out = [];
  const r = rowOf(i);
  const c = colOf(i);
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

/**
 * Randomly places the whole fleet: every ship straight, inside the grid, and
 * never overlapping another. Returns { ships, grid } where grid[i] is the
 * ship index at that cell or -1.
 */
export function placeFleet(rng = Math.random) {
  const grid = new Array(CELLS).fill(-1);
  const ships = [];
  FLEET.forEach((spec, shipIndex) => {
    for (;;) {
      const horizontal = rng() < 0.5;
      const r = Math.floor(rng() * (horizontal ? SIZE : SIZE - spec.size + 1));
      const c = Math.floor(rng() * (horizontal ? SIZE - spec.size + 1 : SIZE));
      const cells = Array.from({ length: spec.size }, (_, k) =>
        horizontal ? r * SIZE + c + k : (r + k) * SIZE + c,
      );
      if (cells.every((i) => grid[i] === -1)) {
        for (const i of cells) grid[i] = shipIndex;
        ships.push({ ...spec, cells, hits: 0 });
        return;
      }
    }
  });
  return { ships, grid };
}

/** A fresh side: fleet plus a shot record (null | "miss" | "hit"). */
export function createSide(rng = Math.random) {
  return { ...placeFleet(rng), shots: new Array(CELLS).fill(null) };
}

export const isSunk = (ship) => ship.hits === ship.size;
export const allSunk = (side) => side.ships.every(isSunk);

/**
 * Fires at a side. Mutates and returns
 * { result: "repeat" | "miss" | "hit" | "sunk", ship? }.
 */
export function fire(side, i) {
  if (side.shots[i] !== null) return { result: "repeat" };
  const shipIndex = side.grid[i];
  if (shipIndex === -1) {
    side.shots[i] = "miss";
    return { result: "miss" };
  }
  side.shots[i] = "hit";
  const ship = side.ships[shipIndex];
  ship.hits++;
  return { result: isSunk(ship) ? "sunk" : "hit", ship };
}

/**
 * Computer strategy. `view` is what the computer is allowed to know about
 * the player's side: shots taken, plus which cells belong to sunk ships
 * (sunk ships are revealed under the rules). `remaining` is the sizes of
 * ships not yet sunk.
 *
 * level "easy": random untried cell.
 * level "normal": hunt on a checkerboard, then target around unresolved hits,
 * following the line once two hits line up.
 */
export function chooseShot({ shots, sunkCells, remaining }, level = "normal", rng = Math.random) {
  const untried = [];
  for (let i = 0; i < CELLS; i++) if (shots[i] === null) untried.push(i);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  if (level === "easy") return pick(untried);

  const sunk = new Set(sunkCells);
  const open = [];
  for (let i = 0; i < CELLS; i++) if (shots[i] === "hit" && !sunk.has(i)) open.push(i);

  if (open.length) {
    // Prefer extending a line of two or more adjacent unresolved hits.
    const openSet = new Set(open);
    const lineTargets = [];
    for (const i of open) {
      for (const [step, sameLine] of [
        [1, (a, b) => rowOf(a) === rowOf(b)],
        [SIZE, () => true],
      ]) {
        if (!openSet.has(i + step) || !sameLine(i, i + step)) continue;
        // Walk to both ends of this run of hits.
        let lo = i;
        while (openSet.has(lo - step) && sameLine(lo, lo - step)) lo -= step;
        let hi = i + step;
        while (openSet.has(hi + step) && sameLine(hi, hi + step)) hi += step;
        for (const end of [lo - step, hi + step]) {
          const anchor = end === lo - step ? lo : hi;
          if (end >= 0 && end < CELLS && sameLine(anchor, end) && shots[end] === null) {
            lineTargets.push(end);
          }
        }
      }
    }
    if (lineTargets.length) return pick(lineTargets);

    const around = [...new Set(open.flatMap(orthogonal))].filter((n) => shots[n] === null);
    if (around.length) return pick(around);
  }

  // Hunt: a checkerboard is enough to find any ship of size >= 2.
  const smallest = Math.min(...remaining);
  const parity = untried.filter((i) => (rowOf(i) + colOf(i)) % smallest === 0);
  return pick(parity.length ? parity : untried);
}

/** What the computer may know about a side (see chooseShot). */
export function publicView(side) {
  return {
    shots: side.shots,
    sunkCells: side.ships.filter(isSunk).flatMap((s) => s.cells),
    remaining: side.ships.filter((s) => !isSunk(s)).map((s) => s.size),
  };
}
