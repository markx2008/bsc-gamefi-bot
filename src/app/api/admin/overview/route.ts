import { Prisma } from "@prisma/client";
import { calculateAdminHealth } from "@/lib/admin-health";
import { assertAdminSession, getBearerSession } from "@/lib/auth";
import { getEarnConfigFromEnv } from "@/lib/earn-ledger";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ZERO = new Prisma.Decimal(0);

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return (value ?? ZERO).toString();
}

function getInitialGameBankroll() {
  return new Prisma.Decimal(process.env.INITIAL_GAME_BANKROLL_USDT || "95000");
}

function getHealthyApyThresholdPercent() {
  return Number(process.env.HEALTHY_APY_THRESHOLD_PERCENT || "20");
}

export async function GET(request: Request) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    assertAdminSession(session);

    const [
      userBalances,
      depositTotals,
      withdrawTotals,
      pendingWithdrawalTotals,
      pendingWithdrawals,
      recentUsers,
      recentTransactions,
      poolEntries,
      earnActive,
      earnRedeemable,
      earnExternalYield,
      redeemedEarnPositions,
    ] = await Promise.all([
      prisma.user.aggregate({ _sum: { balanceUsdt: true }, _count: true }),
      prisma.transaction.aggregate({
        where: { type: "DEPOSIT", status: "SUCCESS" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAW", status: "SUCCESS" },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.withdrawalRequest.findMany({
        where: { status: "PENDING" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.user.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.transaction.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.platformLedgerEntry.groupBy({
        by: ["pool"],
        _sum: { amount: true },
      }),
      prisma.earnPosition.aggregate({
        where: { status: "ACTIVE" },
        _sum: { principal: true },
        _count: true,
      }),
      prisma.earnPosition.aggregate({
        where: { status: "ACTIVE", unlockAt: { lte: new Date() } },
        _sum: { principal: true },
        _count: true,
      }),
      prisma.platformLedgerEntry.aggregate({
        where: { source: "EARN_EXTERNAL_YIELD" },
        _sum: { amount: true },
      }),
      prisma.earnPosition.findMany({
        where: { status: "REDEEMED" },
        select: {
          principal: true,
          rewardAmount: true,
          lockedAt: true,
          redeemedAt: true,
        },
        take: 500,
      }),
    ]);

    const totalUserBalances = userBalances._sum.balanceUsdt ?? ZERO;
    const pendingWithdrawalTotal = pendingWithdrawalTotals._sum.amount ?? ZERO;
    const poolTotals = new Map(poolEntries.map((entry) => [entry.pool, entry._sum.amount ?? ZERO]));
    const gameBankroll = getInitialGameBankroll().plus(poolTotals.get("GAME_BANKROLL") ?? ZERO);
    const platformRevenue = poolTotals.get("PLATFORM_REVENUE") ?? ZERO;
    const earnBonusPool = poolTotals.get("EARN_BONUS_POOL") ?? ZERO;
    const earnConfig = getEarnConfigFromEnv();
    const healthyApyThresholdPercent = getHealthyApyThresholdPercent();
    const availableLiquidity = totalUserBalances.minus(pendingWithdrawalTotal);
    const health = calculateAdminHealth({
      activeLockedPrincipal: decimalToString(earnActive._sum.principal),
      earnBonusPool: earnBonusPool.toString(),
      apyCapPercent: earnConfig.apyCapPercent,
      lockDays: earnConfig.lockDays,
      healthyApyThresholdPercent,
      pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
      availableLiquidity: availableLiquidity.toString(),
      gameBankroll: gameBankroll.toString(),
      redeemedPositions: redeemedEarnPositions.map((position) => ({
        principal: position.principal.toString(),
        rewardAmount: position.rewardAmount.toString(),
        lockedAt: position.lockedAt,
        redeemedAt: position.redeemedAt,
      })),
    });

    return NextResponse.json({
      stats: {
        totalUsers: userBalances._count,
        totalDeposits: decimalToString(depositTotals._sum.amount),
        totalWithdrawals: decimalToString(withdrawTotals._sum.amount),
        totalUserBalances: totalUserBalances.toString(),
        pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
        pendingWithdrawalCount: pendingWithdrawalTotals._count,
        availableLiquidity: availableLiquidity.toString(),
        gameBankroll: gameBankroll.toString(),
        platformRevenue: platformRevenue.toString(),
        earnBonusPool: earnBonusPool.toString(),
        earnActivePrincipal: decimalToString(earnActive._sum.principal),
        earnActiveCount: earnActive._count,
        earnRedeemablePrincipal: decimalToString(earnRedeemable._sum.principal),
        earnRedeemableCount: earnRedeemable._count,
        earnExternalYieldTotal: decimalToString(earnExternalYield._sum.amount),
      },
      health,
      pendingWithdrawals: pendingWithdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        amount: withdrawal.amount.toString(),
        walletAddress: withdrawal.walletAddress,
        status: withdrawal.status,
        txHash: withdrawal.txHash,
        createdAt: withdrawal.createdAt,
        user: {
          id: withdrawal.user.id,
          walletAddress: withdrawal.user.walletAddress,
          balanceUsdt: withdrawal.user.balanceUsdt.toString(),
        },
      })),
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        walletAddress: user.walletAddress,
        balanceUsdt: user.balanceUsdt.toString(),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      recentTransactions: recentTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        status: transaction.status,
        txHash: transaction.txHash,
        createdAt: transaction.createdAt,
        user: {
          id: transaction.user.id,
          walletAddress: transaction.user.walletAddress,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
