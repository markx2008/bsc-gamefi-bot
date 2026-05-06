import { Prisma, PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { getBearerSession } from "@/lib/auth";

const prisma = new PrismaClient();

function parsePositiveDecimal(value: unknown) {
  const amount = new Prisma.Decimal(String(value || "0"));
  if (amount.lte(0)) throw new Error("Amount must be > 0");
  return amount;
}

export async function POST(request: Request) {
  try {
    const session = getBearerSession(request);
    const { amount } = await request.json();
    const withdrawAmount = parsePositiveDecimal(amount);

    const user = await prisma.user.findUnique({ where: { tgId: session.tgId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.walletAddress) return NextResponse.json({ error: "Wallet not bound" }, { status: 400 });
    if (user.balanceUsdt.lt(withdrawAmount)) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        userId: user.id,
        amount: withdrawAmount,
        walletAddress: user.walletAddress,
        status: "PENDING",
      },
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
