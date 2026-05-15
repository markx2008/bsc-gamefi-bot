import { Prisma } from "@prisma/client";
import { assertAdminSession, getBearerSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ZERO = new Prisma.Decimal(0);

export async function GET(request: Request, context: RouteContext) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    assertAdminSession(session);
    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) throw new Error("Invalid user id");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        withdrawals: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const risk = user.transactions.reduce((summary, transaction) => {
      if (transaction.status !== "SUCCESS" && transaction.status !== "PENDING") return summary;
      if (transaction.type === "DEPOSIT") summary.totalDeposit = summary.totalDeposit.plus(transaction.amount);
      if (transaction.type === "WITHDRAW") summary.totalWithdraw = summary.totalWithdraw.plus(transaction.amount);
      if (transaction.type === "GAME_WIN") summary.gameProfit = summary.gameProfit.plus(transaction.amount);
      if (transaction.type === "GAME_LOSS") summary.gameProfit = summary.gameProfit.minus(transaction.amount);
      if (transaction.type === "REWARD") summary.stakingReward = summary.stakingReward.plus(transaction.amount);
      return summary;
    }, {
      totalDeposit: ZERO,
      totalWithdraw: ZERO,
      gameProfit: ZERO,
      stakingReward: ZERO,
    });

    const pendingWithdrawalTotal = user.withdrawals
      .filter((withdrawal) => withdrawal.status === "PENDING")
      .reduce((total, withdrawal) => total.plus(withdrawal.amount), ZERO);

    return NextResponse.json({
      user: {
        id: user.id,
        tgId: user.tgId,
        walletAddress: user.walletAddress,
        balanceUsdt: user.balanceUsdt.toString(),
        pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      risk: {
        totalDeposit: risk.totalDeposit.toString(),
        totalWithdraw: risk.totalWithdraw.toString(),
        gameProfit: risk.gameProfit.toString(),
        stakingReward: risk.stakingReward.toString(),
        riskLevel: risk.totalDeposit.gt(0) && risk.gameProfit.gt(risk.totalDeposit.mul(2)) ? "HIGH" : "NORMAL",
      },
      transactions: user.transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        txHash: transaction.txHash,
        status: transaction.status,
        blockNumber: transaction.blockNumber?.toString() ?? null,
        createdAt: transaction.createdAt,
      })),
      withdrawals: user.withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        amount: withdrawal.amount.toString(),
        walletAddress: withdrawal.walletAddress,
        status: withdrawal.status,
        txHash: withdrawal.txHash,
        reviewedBy: withdrawal.reviewedBy,
        reviewedAt: withdrawal.reviewedAt,
        createdAt: withdrawal.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
