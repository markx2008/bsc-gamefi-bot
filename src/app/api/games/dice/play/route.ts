import { getBearerSession } from "@/lib/auth";
import { calculateDiceSettlement, normalizeDiceChoice } from "@/lib/game-ledger";
import {
  assertBetWithinLimits,
  getBetLimits,
  parsePositiveDecimal,
  playInternalBalanceGame,
  serializeGameRound,
} from "@/lib/game-settlement";
import { pickDiceRollFromDigest } from "@/lib/provably-fair";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = getBearerSession(request);
    const body = await request.json();
    const betAmount = parsePositiveDecimal(body.amount);
    const playerChoice = normalizeDiceChoice(String(body.choice || ""));
    assertBetWithinLimits(betAmount, getBetLimits());

    const result = await playInternalBalanceGame({
      sessionWalletAddress: session.walletAddress,
      betAmount,
      clientSeed: body.clientSeed,
      game: "DICE",
      playerChoice,
      ledgerNote: "Dice settlement",
      buildSettlement: ({ randomDigest, betAmount: amount, config }) => {
        const settlement = calculateDiceSettlement({
          betAmount: amount,
          playerChoice,
          roll: pickDiceRollFromDigest(randomDigest),
          config,
        });
        return {
          ...settlement,
          outcome: String(settlement.roll),
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
