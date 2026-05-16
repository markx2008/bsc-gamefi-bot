import crypto from "crypto";

export type FairGameKey = "COIN_FLIP" | "DICE" | "LUCKY_SPIN";
export type CoinFlipOutcome = "HEADS" | "TAILS";
export type LuckySpinSegment = "JACKPOT" | "BIG_WIN" | "SMALL_WIN" | "MISS";

export type FairRandomInput = {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  game: FairGameKey;
};

export function createServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

export function buildFairRandomDigest(input: FairRandomInput) {
  const message = `${input.clientSeed}:${input.nonce}:${input.game}`;
  return crypto.createHmac("sha256", input.serverSeed).update(message).digest("hex");
}

export function pickCoinFlipOutcomeFromDigest(digest: string): CoinFlipOutcome {
  return digestToUnitInterval(digest) < 0.5 ? "HEADS" : "TAILS";
}

export function pickDiceRollFromDigest(digest: string) {
  return Math.floor(digestToUnitInterval(digest) * 6) + 1;
}

export function pickLuckySpinSegmentFromDigest(digest: string): LuckySpinSegment {
  const roll = digestToUnitInterval(digest) * 100;
  if (roll < 2) return "JACKPOT";
  if (roll < 10) return "BIG_WIN";
  if (roll < 35) return "SMALL_WIN";
  return "MISS";
}

function digestToUnitInterval(digest: string) {
  const slice = digest.slice(0, 13);
  const value = Number.parseInt(slice, 16);
  return value / 0x10000000000000;
}
