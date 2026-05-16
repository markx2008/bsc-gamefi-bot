import { getBearerSession } from "@/lib/auth";
import {
  calculateLuckySpinSettlement,
  getLuckySpinMaxPlayerProfit,
} from "@/lib/game-ledger";
import {
  assertBetWithinLimits,
  decimalFromNumber,
  getBetLimits,
  getGameLedgerConfig,
  parsePositiveDecimal,
  playInternalBalanceGame,
  serializeGameRound,
} from "@/lib/game-settlement";
import { pickLuckySpinSegmentFromDigest } from "@/lib/provably-fair";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = getBearerSession(request);
    const body = await request.json();
    const betAmount = parsePositiveDecimal(body.amount);
    const config = getGameLedgerConfig();
    assertBetWithinLimits(betAmount, getBetLimits("LUCKY_SPIN_BET_MAX_USDT"));

    const result = await playInternalBalanceGame({
      sessionWalletAddress: session.walletAddress,
      betAmount,
      clientSeed: body.clientSeed,
      game: "LUCKY_SPIN",
      playerChoice: "SPIN",
      ledgerNote: "Lucky spin settlement",
      maxPlayerProfit: decimalFromNumber(getLuckySpinMaxPlayerProfit(Number(betAmount.toString()), config)),
      buildSettlement: ({ randomDigest, betAmount: amount, config: activeConfig }) => {
        const settlement = calculateLuckySpinSettlement({
          betAmount: amount,
          segment: pickLuckySpinSegmentFromDigest(randomDigest),
          config: activeConfig,
        });
        return {
          ...settlement,
          outcome: settlement.segment,
          transactionAmount: settlement.playerProfit,
        };
      },
    });

    return NextResponse.json({
      round: serializeGameRound(result.round),
      fairness: result.fairness,
      user: result.user,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
