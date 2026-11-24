import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELLS,
  FLEET,
  SIZE,
  allSunk,
  chooseShot,
  createSide,
  fire,
  orthogonal,
  placeFleet,
  publicView,
} from "../public/engine.js";

test("fleet placement is always in bounds, straight, and non-overlapping", () => {
  for (let n = 0; n < 1000; n++) {
    const { ships, grid } = placeFleet();
    assert.equal(ships.length, FLEET.length);
    const all = ships.flatMap((s) => s.cells);
    assert.equal(new Set(all).size, all.length, "no overlaps");
    assert.equal(grid.filter((g) => g !== -1).length, all.length);
    for (const s of ships) {
      for (const i of s.cells) assert.ok(i >= 0 && i < CELLS);
      const rows = new Set(s.cells.map((i) => Math.floor(i / SIZE)));
      const cols = new Set(s.cells.map((i) => i % SIZE));
      assert.ok(rows.size === 1 || cols.size === 1, "straight");
      const sorted = [...s.cells].sort((a, b) => a - b);
      const step = rows.size === 1 ? 1 : SIZE;
      for (let k = 1; k < sorted.length; k++) assert.equal(sorted[k] - sorted[k - 1], step, "contiguous");
    }
  }
});

test("firing reports miss, hit, sunk and repeat", () => {
  const side = createSide();
  const destroyer = side.ships.find((s) => s.name === "Destroyer");
  const water = side.grid.indexOf(-1);
  assert.equal(fire(side, water).result, "miss");
  assert.equal(fire(side, water).result, "repeat");
  assert.equal(fire(side, destroyer.cells[0]).result, "hit");
  const last = fire(side, destroyer.cells[1]);
  assert.equal(last.result, "sunk");
  assert.equal(last.ship.name, "Destroyer");
  assert.equal(allSunk(side), false);
});

test("sinking every ship ends the game", () => {
  const side = createSide();
  for (const s of side.ships) for (const i of s.cells) fire(side, i);
  assert.equal(allSunk(side), true);
});

function playOut(level) {
  const side = createSide();
  let shots = 0;
  while (!allSunk(side)) {
    const i = chooseShot(publicView(side), level);
    assert.equal(side.shots[i], null, "computer never repeats a cell");
    fire(side, i);
    shots++;
    assert.ok(shots <= CELLS);
  }
  return shots;
}

test("computer always finishes a game without repeating shots", () => {
  for (let n = 0; n < 100; n++) {
    playOut("easy");
    playOut("normal");
  }
});

test("normal computer is much stronger than random", () => {
  const avg = (level) => {
    let total = 0;
    for (let n = 0; n < 200; n++) total += playOut(level);
    return total / 200;
  };
  const easy = avg("easy");
  const normal = avg("normal");
  assert.ok(normal < 70, `normal averaged ${normal}`);
  assert.ok(easy - normal > 15, `easy ${easy} vs normal ${normal}`);
});

test("after a lone hit the computer fires next to it", () => {
  const shots = new Array(CELLS).fill(null);
  shots[44] = "hit";
  for (let n = 0; n < 50; n++) {
    const i = chooseShot({ shots, sunkCells: [], remaining: [5, 4, 3, 3, 2] });
    assert.ok(orthogonal(44).includes(i));
  }
});

test("two hits in a row are extended along the line, not across", () => {
  const shots = new Array(CELLS).fill(null);
  shots[44] = "hit";
  shots[45] = "hit";
  for (let n = 0; n < 50; n++) {
    const i = chooseShot({ shots, sunkCells: [], remaining: [5, 4, 3, 3, 2] });
    assert.ok([43, 46].includes(i), `got ${i}`);
  }
});

test("line extension never wraps around a row edge", () => {
  const shots = new Array(CELLS).fill(null);
  shots[8] = "hit";
  shots[9] = "hit"; // row 0, right edge
  for (let n = 0; n < 50; n++) {
    const i = chooseShot({ shots, sunkCells: [], remaining: [5] });
    assert.equal(i, 7);
  }
});

test("hits on sunk ships are ignored when targeting", () => {
  const shots = new Array(CELLS).fill(null);
  shots[0] = "hit";
  shots[1] = "hit";
  for (let n = 0; n < 50; n++) {
    const i = chooseShot({ shots, sunkCells: [0, 1], remaining: [5, 4, 3, 3] });
    // Back in hunt mode: shots follow the hunt pattern for the smallest ship (3).
    assert.equal((Math.floor(i / 10) + (i % 10)) % 3, 0, `got ${i}`);
  }
});
