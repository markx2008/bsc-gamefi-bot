import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { assertAdminSession, getBearerSession } from "@/lib/auth";
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const prisma = getPrisma();
  try {
    const session = getBearerSession(request);
    assertAdminSession(session);
    const { id } = await context.params;
    const withdrawalId = Number(id);
    if (!Number.isInteger(withdrawalId)) throw new Error("Invalid withdrawal id");

    const existing = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!existing) throw new Error("Withdrawal not found");
    if (existing.status !== "PENDING") throw new Error("Withdrawal is not pending");

    const withdrawal = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "REJECTED",
        reviewedBy: session.walletAddress,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      withdrawal: {
        id: withdrawal.id,
        status: withdrawal.status,
        reviewedBy: withdrawal.reviewedBy,
        reviewedAt: withdrawal.reviewedAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
