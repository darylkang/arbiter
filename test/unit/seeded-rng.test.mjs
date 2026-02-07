import assert from "node:assert/strict";
import test from "node:test";

import { createRngForTrial, createSeededRng } from "../../dist/utils/seeded-rng.js";

test("createSeededRng is deterministic for the same seed", () => {
  const a = createSeededRng("arbiter-seed");
  const b = createSeededRng("arbiter-seed");

  const seqA = Array.from({ length: 5 }, () => a());
  const seqB = Array.from({ length: 5 }, () => b());

  assert.deepEqual(seqA, seqB);
});

test("createRngForTrial isolates streams by trial and stream id", () => {
  const baseRng = createRngForTrial("seed", "plan", 0);
  const sameRng = createRngForTrial("seed", "plan", 0);
  const differentTrialRng = createRngForTrial("seed", "plan", 1);
  const differentStreamRng = createRngForTrial("seed", "decode", 0);

  const base = Array.from({ length: 4 }, () => baseRng());
  const same = Array.from({ length: 4 }, () => sameRng());
  const differentTrial = Array.from({ length: 4 }, () => differentTrialRng());
  const differentStream = Array.from({ length: 4 }, () => differentStreamRng());

  assert.deepEqual(base, same);
  assert.notDeepEqual(base, differentTrial);
  assert.notDeepEqual(base, differentStream);
});

test("seeded RNG values stay in [0, 1)", () => {
  const rng = createSeededRng("bounds");
  for (let i = 0; i < 500; i += 1) {
    const value = rng();
    assert.equal(value >= 0, true);
    assert.equal(value < 1, true);
  }
});
