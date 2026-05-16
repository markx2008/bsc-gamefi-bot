export type CoinFlipChoice = "HEADS" | "TAILS";
export type GameRoundResult = "PLAYER_WIN" | "HOUSE_WIN";

export type GameLedgerConfig = {
  houseEdgePercent: number;
  platformFeePercent: number;
  gameBankrollReservePercent: number;
};

export type CoinFlipSettlementInput = {
  betAmount: number;
  playerChoice: CoinFlipChoice | string;
  outcome: CoinFlipChoice | string;
  config: GameLedgerConfig;
};

export type CoinFlipSettlement = {
  result: GameRoundResult;
  betAmount: number;
  playerChoice: CoinFlipChoice;
  outcome: CoinFlipChoice;
  playerProfit: number;
  payoutAmount: number;
  userBalanceDelta: number;
  houseProfit: number;
  platformCut: number;
  gameBankrollDelta: number;
  bonusPoolCut: number;
};

export function getDefaultGameLedgerConfig(): GameLedgerConfig {
  return {
    houseEdgePercent: 3,
    platformFeePercent: 5,
    gameBankrollReservePercent: 90,
  };
}

export function normalizeCoinFlipChoice(choice: string): CoinFlipChoice {
  const normalized = choice.trim().toUpperCase();
  if (normalized === "HEADS" || normalized === "TAILS") return normalized;
  throw new Error("Invalid coin flip choice");
}

export function calculateCoinFlipSettlement(input: CoinFlipSettlementInput): CoinFlipSettlement {
  const betAmount = Number(input.betAmount);
  if (!Number.isFinite(betAmount) || betAmount <= 0) throw new Error("Bet amount must be > 0");

  const playerChoice = normalizeCoinFlipChoice(input.playerChoice);
  const outcome = normalizeCoinFlipChoice(input.outcome);
  const result: GameRoundResult = playerChoice === outcome ? "PLAYER_WIN" : "HOUSE_WIN";

  if (result === "PLAYER_WIN") {
    const playerProfit = roundMoney(betAmount * playerProfitMultiplier(input.config.houseEdgePercent));
    return {
      result,
      betAmount,
      playerChoice,
      outcome,
      playerProfit,
      payoutAmount: roundMoney(betAmount + playerProfit),
      userBalanceDelta: playerProfit,
      houseProfit: -playerProfit,
      platformCut: 0,
      gameBankrollDelta: -playerProfit,
      bonusPoolCut: 0,
    };
  }

  const distribution = calculatePositiveHouseProfitDistribution(betAmount, input.config);
  return {
    result,
    betAmount,
    playerChoice,
    outcome,
    playerProfit: -betAmount,
    payoutAmount: 0,
    userBalanceDelta: -betAmount,
    houseProfit: betAmount,
    platformCut: distribution.platformCut,
    gameBankrollDelta: distribution.gameBankrollReserve,
    bonusPoolCut: distribution.bonusPoolCut,
  };
}

export function calculatePositiveHouseProfitDistribution(profit: number, config: GameLedgerConfig) {
  const platformPercent = clampPercent(config.platformFeePercent);
  const reservePercent = Math.min(clampPercent(config.gameBankrollReservePercent), 100 - platformPercent);
  const bonusPercent = Math.max(0, 100 - platformPercent - reservePercent);

  return {
    platformCut: roundMoney(profit * (platformPercent / 100)),
    gameBankrollReserve: roundMoney(profit * (reservePercent / 100)),
    bonusPoolCut: roundMoney(profit * (bonusPercent / 100)),
  };
}

function playerProfitMultiplier(houseEdgePercent: number) {
  return Math.max(0, 1 - (clampPercent(houseEdgePercent) / 50));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
