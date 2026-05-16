import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/provably-fair.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-provably-fair-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `provably-fair-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const fair = await import(`file://${modulePath}`);
const {
  buildFairRandomDigest,
  createServerSeed,
  hashServerSeed,
  pickCoinFlipOutcomeFromDigest,
  pickDiceRollFromDigest,
  pickLuckySpinSegmentFromDigest,
} = fair;

{
  const seed = createServerSeed();
  assert.match(seed, /^[a-f0-9]{64}$/);
  assert.match(hashServerSeed(seed), /^[a-f0-9]{64}$/);
  assert.notEqual(hashServerSeed(seed), seed);
}

{
  const params = {
    serverSeed: "0".repeat(64),
    clientSeed: "player-seed",
    nonce: 12,
    game: "COIN_FLIP",
  };
  assert.equal(buildFairRandomDigest(params), buildFairRandomDigest(params));
  assert.notEqual(buildFairRandomDigest(params), buildFairRandomDigest({ ...params, nonce: 13 }));
  assert.notEqual(buildFairRandomDigest(params), buildFairRandomDigest({ ...params, game: "DICE" }));
}

{
  assert.equal(pickCoinFlipOutcomeFromDigest("0".repeat(64)), "HEADS");
  assert.equal(pickCoinFlipOutcomeFromDigest("f".repeat(64)), "TAILS");
  assert.equal(pickDiceRollFromDigest("0".repeat(64)), 1);
  assert.equal(pickDiceRollFromDigest("f".repeat(64)), 6);
  assert.equal(pickLuckySpinSegmentFromDigest("0".repeat(64)), "JACKPOT");
  assert.equal(pickLuckySpinSegmentFromDigest("08".padEnd(64, "0")), "BIG_WIN");
  assert.equal(pickLuckySpinSegmentFromDigest("3f".padEnd(64, "0")), "SMALL_WIN");
  assert.equal(pickLuckySpinSegmentFromDigest("ff".padEnd(64, "0")), "MISS");
}

console.log("Provably fair checks passed");
