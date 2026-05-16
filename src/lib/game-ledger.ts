export type CoinFlipChoice = "HEADS" | "TAILS";
export type DiceChoice = "LOW" | "HIGH";
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

export type DiceSettlementInput = {
  betAmount: number;
  playerChoice: DiceChoice | string;
  roll: number;
  config: GameLedgerConfig;
};

export type DiceSettlement = {
  result: GameRoundResult;
  betAmount: number;
  playerChoice: DiceChoice;
  outcome: DiceChoice;
  roll: number;
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

export function normalizeDiceChoice(choice: string): DiceChoice {
  const normalized = choice.trim().toUpperCase();
  if (normalized === "LOW" || normalized === "HIGH") return normalized;
  throw new Error("Invalid dice choice");
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

export function calculateDiceSettlement(input: DiceSettlementInput): DiceSettlement {
  const roll = Math.trunc(input.roll);
  if (roll < 1 || roll > 6) throw new Error("Dice roll must be between 1 and 6");
  const playerChoice = normalizeDiceChoice(input.playerChoice);
  const outcome: DiceChoice = roll <= 3 ? "LOW" : "HIGH";
  const settlement = calculateBinarySettlement({
    betAmount: input.betAmount,
    playerChoice,
    outcome,
    config: input.config,
  });

  return {
    ...settlement,
    playerChoice,
    outcome,
    roll,
  };
}

function calculateBinarySettlement(input: {
  betAmount: number;
  playerChoice: CoinFlipChoice | DiceChoice;
  outcome: CoinFlipChoice | DiceChoice;
  config: GameLedgerConfig;
}): CoinFlipSettlement {
  const betAmount = Number(input.betAmount);
  if (!Number.isFinite(betAmount) || betAmount <= 0) throw new Error("Bet amount must be > 0");

  const result: GameRoundResult = input.playerChoice === input.outcome ? "PLAYER_WIN" : "HOUSE_WIN";

  if (result === "PLAYER_WIN") {
    const playerProfit = roundMoney(betAmount * playerProfitMultiplier(input.config.houseEdgePercent));
    return {
      result,
      betAmount,
      playerChoice: input.playerChoice as CoinFlipChoice,
      outcome: input.outcome as CoinFlipChoice,
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
    playerChoice: input.playerChoice as CoinFlipChoice,
    outcome: input.outcome as CoinFlipChoice,
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
