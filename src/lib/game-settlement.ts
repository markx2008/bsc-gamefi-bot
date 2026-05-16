import { Prisma, type GameKey, type GameRoundResult } from "@prisma/client";
import { prepareRoundFairness, type RoundFairness } from "@/lib/game-fairness";
import { getDefaultGameLedgerConfig, type GameLedgerConfig } from "@/lib/game-ledger";
import { getPrisma } from "@/lib/prisma";
import type { FairGameKey } from "@/lib/provably-fair";

const ZERO = new Prisma.Decimal(0);

export type NormalizedGameSettlement = {
  result: GameRoundResult;
  payoutAmount: number;
  userBalanceDelta: number;
  houseProfit: number;
  platformCut: number;
  gameBankrollDelta: number;
  bonusPoolCut: number;
  transactionAmount: number;
};

export type PlayGameParams = {
  sessionWalletAddress: string;
  betAmount: Prisma.Decimal;
  clientSeed: unknown;
  game: GameKey & FairGameKey;
  playerChoice: string;
  ledgerNote: string;
  maxPlayerProfit?: Prisma.Decimal;
  buildSettlement: (params: {
    randomDigest: string;
    betAmount: number;
    config: GameLedgerConfig;
  }) => NormalizedGameSettlement & { outcome: string };
};

export function decimalFromNumber(value: number) {
  return new Prisma.Decimal(value.toFixed(6));
}

export function parsePositiveDecimal(value: unknown) {
  const amount = new Prisma.Decimal(String(value || "0"));
  if (amount.lte(0)) throw new Error("Bet amount must be > 0");
  return amount;
}

export function getGameLedgerConfig() {
  const defaults = getDefaultGameLedgerConfig();
  return {
    houseEdgePercent: Number(process.env.GAME_HOUSE_EDGE_PERCENT || defaults.houseEdgePercent),
    platformFeePercent: Number(process.env.GAME_PLATFORM_FEE_PERCENT || defaults.platformFeePercent),
    gameBankrollReservePercent: Number(process.env.GAME_BANKROLL_RESERVE_PERCENT || defaults.gameBankrollReservePercent),
  };
}

export function getBetLimits(maxEnvName = "GAME_BET_MAX_USDT") {
  return {
    min: new Prisma.Decimal(process.env.GAME_BET_MIN_USDT || "5"),
    max: new Prisma.Decimal(process.env[maxEnvName] || process.env.GAME_BET_MAX_USDT || "80"),
  };
}

export function assertBetWithinLimits(betAmount: Prisma.Decimal, limits: { min: Prisma.Decimal; max: Prisma.Decimal }) {
  if (betAmount.lt(limits.min) || betAmount.gt(limits.max)) {
    throw new Error(`下注金額需介於 ${limits.min.toString()} 到 ${limits.max.toString()} USDT。`);
  }
}

export async function playInternalBalanceGame(params: PlayGameParams) {
  const prisma = getPrisma();
  const config = getGameLedgerConfig();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { walletAddress: params.sessionWalletAddress } });
    if (!user) throw new Error("User not found");

    const fairness = await prepareRoundFairness({
      tx,
      userId: user.id,
      game: params.game,
      clientSeed: params.clientSeed,
    });
    const settlement = params.buildSettlement({
      randomDigest: fairness.randomDigest,
      betAmount: Number(params.betAmount.toString()),
      config,
    });
    const userBalanceDelta = decimalFromNumber(settlement.userBalanceDelta);
    const payoutAmount = decimalFromNumber(settlement.payoutAmount);
    const houseProfit = decimalFromNumber(settlement.houseProfit);
    const platformCut = decimalFromNumber(settlement.platformCut);
    const gameBankrollDelta = decimalFromNumber(settlement.gameBankrollDelta);
    const bonusPoolCut = decimalFromNumber(settlement.bonusPoolCut);
    const transactionAmount = decimalFromNumber(settlement.transactionAmount);

    const pendingWithdrawals = await tx.withdrawalRequest.aggregate({
      where: { userId: user.id, status: "PENDING" },
      _sum: { amount: true },
    });
    const pendingWithdrawalTotal = pendingWithdrawals._sum.amount ?? ZERO;
    const availableBalance = user.balanceUsdt.minus(pendingWithdrawalTotal);
    if (availableBalance.lt(params.betAmount)) throw new Error("Insufficient available balance");

    const requiredBankroll = requiredGameBankroll(gameBankrollDelta, params.maxPlayerProfit);
    if (requiredBankroll.gt(0)) {
      const gameBankrollTotals = await tx.platformLedgerEntry.aggregate({
        where: { pool: "GAME_BANKROLL" },
        _sum: { amount: true },
      });
      const currentGameBankroll = getInitialGameBankroll().plus(gameBankrollTotals._sum.amount ?? ZERO);
      if (currentGameBankroll.lt(requiredBankroll)) throw new Error("Game bankroll is insufficient");
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: balanceUpdate(userBalanceDelta),
    });

    const round = await tx.gameRound.create({
      data: {
        userId: user.id,
        game: params.game,
        betAmount: params.betAmount,
        playerChoice: params.playerChoice,
        outcome: settlement.outcome,
        result: settlement.result,
        payoutAmount,
        userBalanceDelta,
        houseProfit,
        platformCut,
        gameBankrollDelta,
        bonusPoolCut,
        serverSeedHash: fairness.serverSeedHash,
        serverSeed: fairness.serverSeed,
        clientSeed: fairness.clientSeed,
        nonce: fairness.nonce,
        randomDigest: fairness.randomDigest,
      },
    });

    const ledgerEntries = [
      { pool: "GAME_BANKROLL" as const, amount: gameBankrollDelta },
      { pool: "PLATFORM_REVENUE" as const, amount: platformCut },
      { pool: "EARN_BONUS_POOL" as const, amount: bonusPoolCut },
    ].filter((entry) => !entry.amount.eq(0));

    if (ledgerEntries.length > 0) {
      await tx.platformLedgerEntry.createMany({
        data: ledgerEntries.map((entry) => ({
          pool: entry.pool,
          source: "GAME_ROUND",
          sourceId: round.id,
          gameRoundId: round.id,
          amount: entry.amount,
          note: params.ledgerNote,
        })),
      });
    }

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: settlement.result === "PLAYER_WIN" ? "GAME_WIN" : "GAME_LOSS",
        amount: transactionAmount.abs(),
        status: "SUCCESS",
      },
    });

    return {
      round,
      user: {
        balanceUsdt: updatedUser.balanceUsdt.toString(),
        availableBalanceUsdt: updatedUser.balanceUsdt.minus(pendingWithdrawalTotal).toString(),
      },
      fairness: serializeFairness(fairness),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

export function serializeGameRound(round: Awaited<ReturnType<typeof playInternalBalanceGame>>["round"]) {
  return {
    id: round.id,
    game: round.game,
    betAmount: round.betAmount.toString(),
    playerChoice: round.playerChoice,
    outcome: round.outcome,
    result: round.result,
    payoutAmount: round.payoutAmount.toString(),
    userBalanceDelta: round.userBalanceDelta.toString(),
    houseProfit: round.houseProfit.toString(),
    platformCut: round.platformCut.toString(),
    gameBankrollDelta: round.gameBankrollDelta.toString(),
    bonusPoolCut: round.bonusPoolCut.toString(),
    serverSeedHash: round.serverSeedHash,
    serverSeed: round.serverSeed,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    randomDigest: round.randomDigest,
    createdAt: round.createdAt,
  };
}

function getInitialGameBankroll() {
  return new Prisma.Decimal(process.env.INITIAL_GAME_BANKROLL_USDT || "95000");
}

function balanceUpdate(delta: Prisma.Decimal) {
  if (delta.gte(0)) {
    return { balanceUsdt: { increment: delta } };
  }
  return { balanceUsdt: { decrement: delta.abs() } };
}

function requiredGameBankroll(gameBankrollDelta: Prisma.Decimal, maxPlayerProfit: Prisma.Decimal | undefined) {
  const settlementRequirement = gameBankrollDelta.lt(0) ? gameBankrollDelta.abs() : ZERO;
  if (!maxPlayerProfit) return settlementRequirement;
  return settlementRequirement.gt(maxPlayerProfit) ? settlementRequirement : maxPlayerProfit;
}

function serializeFairness(fairness: RoundFairness) {
  return {
    serverSeedHash: fairness.serverSeedHash,
    serverSeed: fairness.serverSeed,
    clientSeed: fairness.clientSeed,
    nonce: fairness.nonce,
    randomDigest: fairness.randomDigest,
    nextServerSeedHash: fairness.nextServerSeedHash,
  };
}
