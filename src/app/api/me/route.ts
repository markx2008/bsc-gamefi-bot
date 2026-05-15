import { Prisma } from "@prisma/client";
import { getBearerSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    const user = await prisma.user.findUnique({
      where: { tgId: session.tgId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        withdrawals: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pendingWithdrawals = await prisma.withdrawalRequest.aggregate({
      where: { userId: user.id, status: "PENDING" },
      _sum: { amount: true },
    });
    const pendingWithdrawalTotal = pendingWithdrawals._sum.amount ?? new Prisma.Decimal(0);

    return NextResponse.json({
      user: {
        id: user.id,
        tgId: user.tgId,
        walletAddress: user.walletAddress,
        balanceUsdt: user.balanceUsdt.toString(),
        pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
        availableBalanceUsdt: user.balanceUsdt.minus(pendingWithdrawalTotal).toString(),
        isAdmin: user.tgId === process.env.ADMIN_TG_ID,
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
      config: {
        vaultAddress: process.env.VAULT_ADDRESS || null,
        usdtAddress: process.env.USDT_ADDRESS || null,
        network: "BSC Testnet",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
