import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { signSessionToken, verifyTelegramInitData } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { initData } = await request.json();
    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ error: "initData is required" }, { status: 400 });
    }

    const telegramUser = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN || "");
    const user = await prisma.user.upsert({
      where: { tgId: telegramUser.id },
      create: { tgId: telegramUser.id },
      update: {},
    });

    const token = signSessionToken({ tgId: user.tgId }, process.env.JWT_SECRET || "");

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        tgId: user.tgId,
        walletAddress: user.walletAddress,
        balanceUsdt: user.balanceUsdt.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
