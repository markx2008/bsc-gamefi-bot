import { getPrisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

function isDevLoginEnabled() {
  if (process.env.NODE_ENV === "production") {
    return process.env.WEB_MVP_ENABLE_DEV_LOGIN === "true";
  }
  return true;
}

function normalizeTgId(value: unknown) {
  const tgId = String(value || "").trim();
  if (!tgId) throw new Error("tgId is required");
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(tgId)) throw new Error("Invalid tgId");
  return tgId;
}

export async function POST(request: Request) {
  if (!isDevLoginEnabled()) {
    return NextResponse.json({ error: "Dev login is disabled" }, { status: 404 });
  }

  const prisma = getPrisma();

  try {
    const { tgId, role } = await request.json();
    const requestedTgId = role === "admin" ? process.env.ADMIN_TG_ID : normalizeTgId(tgId);
    if (!requestedTgId) throw new Error("ADMIN_TG_ID is required for admin dev login");

    const user = await prisma.user.upsert({
      where: { tgId: requestedTgId },
      create: { tgId: requestedTgId },
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
        isAdmin: user.tgId === process.env.ADMIN_TG_ID,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
