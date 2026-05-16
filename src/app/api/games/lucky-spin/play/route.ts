import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { getBearerSession } from "@/lib/auth";
import {
  calculateLuckySpinSettlement,
  getDefaultGameLedgerConfig,
  getLuckySpinMaxPlayerProfit,
  type LuckySpinSegment,
} from "@/lib/game-ledger";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ZERO = new Prisma.Decimal(0);

function decimalFromNumber(value: number) {
  return new Prisma.Decimal(value.toFixed(6));
}

function parsePositiveDecimal(value: unknown) {
  const amount = new Prisma.Decimal(String(value || "0"));
  if (amount.lte(0)) throw new Error("Bet amount must be > 0");
  return amount;
}

function getGameLedgerConfig() {
  const defaults = getDefaultGameLedgerConfig();
  return {
    houseEdgePercent: Number(process.env.GAME_HOUSE_EDGE_PERCENT || defaults.houseEdgePercent),
    platformFeePercent: Number(process.env.GAME_PLATFORM_FEE_PERCENT || defaults.platformFeePercent),
    gameBankrollReservePercent: Number(process.env.GAME_BANKROLL_RESERVE_PERCENT || defaults.gameBankrollReservePercent),
  };
}

function getBetLimits() {
  return {
    min: new Prisma.Decimal(process.env.GAME_BET_MIN_USDT || "5"),
    max: new Prisma.Decimal(process.env.LUCKY_SPIN_BET_MAX_USDT || process.env.GAME_BET_MAX_USDT || "80"),
  };
}

function getInitialGameBankroll() {
  return new Prisma.Decimal(process.env.INITIAL_GAME_BANKROLL_USDT || "95000");
}

function randomLuckySpinSegment(): LuckySpinSegment {
  const roll = crypto.randomInt(100);
  if (roll < 2) return "JACKPOT";
  if (roll < 10) return "BIG_WIN";
  if (roll < 35) return "SMALL_WIN";
  return "MISS";
}

function balanceUpdate(delta: Prisma.Decimal) {
  if (delta.gte(0)) {
    return { balanceUsdt: { increment: delta } };
  }
  return { balanceUsdt: { decrement: delta.abs() } };
}

export async function POST(request: Request) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    const body = await request.json();
    const betAmount = parsePositiveDecimal(body.amount);
    const config = getGameLedgerConfig();
    const limits = getBetLimits();

    if (betAmount.lt(limits.min) || betAmount.gt(limits.max)) {
      throw new Error(`下注金額需介於 ${limits.min.toString()} 到 ${limits.max.toString()} USDT。`);
    }

    const maxPlayerProfit = decimalFromNumber(getLuckySpinMaxPlayerProfit(Number(betAmount.toString()), config));
    const settlement = calculateLuckySpinSettlement({
      betAmount: Number(betAmount.toString()),
      segment: randomLuckySpinSegment(),
      config,
    });
    const userBalanceDelta = decimalFromNumber(settlement.userBalanceDelta);
    const playerProfit = decimalFromNumber(settlement.playerProfit);
    const payoutAmount = decimalFromNumber(settlement.payoutAmount);
    const houseProfit = decimalFromNumber(settlement.houseProfit);
    const platformCut = decimalFromNumber(settlement.platformCut);
    const gameBankrollDelta = decimalFromNumber(settlement.gameBankrollDelta);
    const bonusPoolCut = decimalFromNumber(settlement.bonusPoolCut);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { walletAddress: session.walletAddress } });
      if (!user) throw new Error("User not found");

      const pendingWithdrawals = await tx.withdrawalRequest.aggregate({
        where: { userId: user.id, status: "PENDING" },
        _sum: { amount: true },
      });
      const pendingWithdrawalTotal = pendingWithdrawals._sum.amount ?? ZERO;
      const availableBalance = user.balanceUsdt.minus(pendingWithdrawalTotal);
      if (availableBalance.lt(betAmount)) throw new Error("Insufficient available balance");

      const gameBankrollTotals = await tx.platformLedgerEntry.aggregate({
        where: { pool: "GAME_BANKROLL" },
        _sum: { amount: true },
      });
      const currentGameBankroll = getInitialGameBankroll().plus(gameBankrollTotals._sum.amount ?? ZERO);
      if (currentGameBankroll.lt(maxPlayerProfit)) throw new Error("Game bankroll is insufficient");
      if (gameBankrollDelta.lt(0) && currentGameBankroll.lt(gameBankrollDelta.abs())) {
        throw new Error("Game bankroll is insufficient");
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: balanceUpdate(userBalanceDelta),
      });

      const round = await tx.gameRound.create({
        data: {
          userId: user.id,
          game: "LUCKY_SPIN",
          betAmount,
          playerChoice: "SPIN",
          outcome: settlement.segment,
          result: settlement.result,
          payoutAmount,
          userBalanceDelta,
          houseProfit,
          platformCut,
          gameBankrollDelta,
          bonusPoolCut,
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
            note: "Lucky spin settlement",
          })),
        });
      }

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: settlement.result === "PLAYER_WIN" ? "GAME_WIN" : "GAME_LOSS",
          amount: playerProfit.abs(),
          status: "SUCCESS",
        },
      });

      return { round, updatedUser, pendingWithdrawalTotal };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      round: {
        id: result.round.id,
        game: result.round.game,
        betAmount: result.round.betAmount.toString(),
        playerChoice: result.round.playerChoice,
        outcome: result.round.outcome,
        result: result.round.result,
        payoutAmount: result.round.payoutAmount.toString(),
        userBalanceDelta: result.round.userBalanceDelta.toString(),
        houseProfit: result.round.houseProfit.toString(),
        platformCut: result.round.platformCut.toString(),
        gameBankrollDelta: result.round.gameBankrollDelta.toString(),
        bonusPoolCut: result.round.bonusPoolCut.toString(),
        createdAt: result.round.createdAt,
      },
      user: {
        balanceUsdt: result.updatedUser.balanceUsdt.toString(),
        availableBalanceUsdt: result.updatedUser.balanceUsdt.minus(result.pendingWithdrawalTotal).toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
