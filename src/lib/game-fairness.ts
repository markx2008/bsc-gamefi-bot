import {
  buildFairRandomDigest,
  createServerSeed,
  type FairGameKey,
  hashServerSeed,
} from "@/lib/provably-fair";

type FairnessTx = {
  gameFairnessCommitment: {
    findUnique: (args: { where: { userId: number } }) => Promise<{
      id: number;
      userId: number;
      serverSeed: string;
      serverSeedHash: string;
      nonce: number;
    } | null>;
    create: (args: { data: { userId: number; serverSeed: string; serverSeedHash: string; nonce: number } }) => Promise<{
      id: number;
      userId: number;
      serverSeed: string;
      serverSeedHash: string;
      nonce: number;
    }>;
    update: (args: { where: { userId: number }; data: { serverSeed: string; serverSeedHash: string; nonce: number } }) => Promise<unknown>;
  };
};

export type RoundFairness = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  randomDigest: string;
  nextServerSeedHash: string;
};

export async function ensureFairnessCommitment(tx: FairnessTx, userId: number) {
  const existing = await tx.gameFairnessCommitment.findUnique({ where: { userId } });
  if (existing) return existing;

  const serverSeed = createServerSeed();
  return tx.gameFairnessCommitment.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      nonce: 0,
    },
  });
}

export async function prepareRoundFairness(params: {
  tx: FairnessTx;
  userId: number;
  game: FairGameKey;
  clientSeed: unknown;
}): Promise<RoundFairness> {
  const commitment = await ensureFairnessCommitment(params.tx, params.userId);
  const clientSeed = normalizeClientSeed(params.clientSeed);
  const nonce = commitment.nonce + 1;
  const randomDigest = buildFairRandomDigest({
    serverSeed: commitment.serverSeed,
    clientSeed,
    nonce,
    game: params.game,
  });
  const nextServerSeed = createServerSeed();
  const nextServerSeedHash = hashServerSeed(nextServerSeed);

  await params.tx.gameFairnessCommitment.update({
    where: { userId: params.userId },
    data: {
      serverSeed: nextServerSeed,
      serverSeedHash: nextServerSeedHash,
      nonce,
    },
  });

  return {
    serverSeed: commitment.serverSeed,
    serverSeedHash: commitment.serverSeedHash,
    clientSeed,
    nonce,
    randomDigest,
    nextServerSeedHash,
  };
}

function normalizeClientSeed(value: unknown) {
  const seed = String(value || "").trim();
  if (!seed) return "default";
  return seed.slice(0, 128);
}
