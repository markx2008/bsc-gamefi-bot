import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getBearerSession } from "@/lib/auth";
function parsePositiveDecimal(value: unknown) {
  const amount = new Prisma.Decimal(String(value || "0"));
  if (amount.lte(0)) throw new Error("Amount must be > 0");
  return amount;
}

export async function POST(request: Request) {
  const prisma = getPrisma();
  try {
    const session = getBearerSession(request);
    const { amount } = await request.json();
    const withdrawAmount = parsePositiveDecimal(amount);

    const withdrawal = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { walletAddress: session.walletAddress } });
      if (!user) throw new Error("User not found");

      const pendingWithdrawals = await tx.withdrawalRequest.aggregate({
        where: { userId: user.id, status: "PENDING" },
        _sum: { amount: true },
      });
      const pendingWithdrawalTotal = pendingWithdrawals._sum.amount ?? new Prisma.Decimal(0);
      const totalRequested = pendingWithdrawalTotal.plus(withdrawAmount);
      if (user.balanceUsdt.lt(totalRequested)) throw new Error("Insufficient available balance");

      return tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          amount: withdrawAmount,
          walletAddress: user.walletAddress,
          status: "PENDING",
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount.toString(),
        walletAddress: withdrawal.walletAddress,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
