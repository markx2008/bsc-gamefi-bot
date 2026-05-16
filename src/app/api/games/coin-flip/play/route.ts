import { getBearerSession } from "@/lib/auth";
import { calculateCoinFlipSettlement, normalizeCoinFlipChoice } from "@/lib/game-ledger";
import {
  assertBetWithinLimits,
  getBetLimits,
  parsePositiveDecimal,
  playInternalBalanceGame,
  serializeGameRound,
} from "@/lib/game-settlement";
import { pickCoinFlipOutcomeFromDigest } from "@/lib/provably-fair";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = getBearerSession(request);
    const body = await request.json();
    const betAmount = parsePositiveDecimal(body.amount);
    const playerChoice = normalizeCoinFlipChoice(String(body.choice || ""));
    assertBetWithinLimits(betAmount, getBetLimits());

    const result = await playInternalBalanceGame({
      sessionWalletAddress: session.walletAddress,
      betAmount,
      clientSeed: body.clientSeed,
      game: "COIN_FLIP",
      playerChoice,
      ledgerNote: "Coin flip settlement",
      buildSettlement: ({ randomDigest, betAmount: amount, config }) => {
        const settlement = calculateCoinFlipSettlement({
          betAmount: amount,
          playerChoice,
          outcome: pickCoinFlipOutcomeFromDigest(randomDigest),
          config,
        });
        return {
          ...settlement,
          outcome: settlement.outcome,
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
