import { Prisma } from "@prisma/client";
import { assertAdminSession, getBearerSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ZERO = new Prisma.Decimal(0);

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return (value ?? ZERO).toString();
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
    ]);

    const totalUserBalances = userBalances._sum.balanceUsdt ?? ZERO;
    const pendingWithdrawalTotal = pendingWithdrawalTotals._sum.amount ?? ZERO;

    return NextResponse.json({
      stats: {
        totalUsers: userBalances._count,
        totalDeposits: decimalToString(depositTotals._sum.amount),
        totalWithdrawals: decimalToString(withdrawTotals._sum.amount),
        totalUserBalances: totalUserBalances.toString(),
        pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
        pendingWithdrawalCount: pendingWithdrawalTotals._count,
        availableLiquidity: totalUserBalances.minus(pendingWithdrawalTotal).toString(),
      },
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
