export type GameKey = "coinFlip" | "dice" | "luckySpin";

export type SimulatorConfig = {
  seed: number;
  tickHours: number;
  initialGameBankroll: number;
  initialBonusPool: number;
  playerArrivalMin: number;
  playerArrivalMax: number;
  capitalMin: number;
  capitalMax: number;
  betSizeMin: number;
  betSizeMax: number;
  gameTrafficPercent: number;
  stakingTrafficPercent: number;
  coinFlipPercent: number;
  dicePercent: number;
  luckySpinPercent: number;
  houseEdgePercent: number;
  platformFeePercent: number;
  gameBankrollReservePercent: number;
  stakingLockDays: number;
  stakingPeriodRewardCapPercent: number;
  healthyApyPercent: number;
  withdrawalRequestPercent: number;
  withdrawalApprovalDelayHours: number;
};

export type LockedPosition = {
  amount: number;
  unlockHour: number;
  createdHour: number;
  rewardAccrued: number;
};

export type PendingWithdrawal = {
  amount: number;
  dueHour: number;
};

export type SimulatorEventEffect = {
  label: string;
  amount: number;
};

export type SimulatorEvent = {
  id: number;
  tick: number;
  type: "game" | "stake" | "reward" | "mature" | "withdrawal" | "warning";
  title: string;
  amount: number;
  detail: string;
  effects: SimulatorEventEffect[];
};

export type SimulatorSummary = {
  tick: number;
  simulatedDays: number;
  gameBankroll: number;
  bonusPool: number;
  lockedPrincipal: number;
  userWithdrawableBalance: number;
  pendingWithdrawals: number;
  withdrawalsPaid: number;
  withdrawalShortfall: number;
  platformLiquidity: number;
  platformRevenue: number;
  rewardsPaid: number;
  instantApyPercent: number;
  realizedApyPercent: number;
  warningCount: number;
  playersProcessed: number;
};

export type SimulatorHistoryPoint = SimulatorSummary;

export type SimulatorState = {
  rngState: number;
  nextEventId: number;
  lockedPositions: LockedPosition[];
  pendingWithdrawalQueue: PendingWithdrawal[];
  events: SimulatorEvent[];
  history: SimulatorHistoryPoint[];
  summary: SimulatorSummary;
};

export type FeeScenario = {
  feePercent: number;
  summary: SimulatorSummary;
  score: number;
  isHealthy: boolean;
};

export type FeeSweepResult = {
  recommendedFeePercent: number;
  scenarios: FeeScenario[];
};

export type GameProfitDistribution = {
  platformCut: number;
  gameBankrollReserve: number;
  bonusPoolCut: number;
};

const GAME_LABELS: Record<GameKey, string> = {
  coinFlip: "猜硬幣",
  dice: "骰子",
  luckySpin: "幸運轉盤",
};

const GAME_VOLATILITY: Record<GameKey, number> = {
  coinFlip: 0.9,
  dice: 1.2,
  luckySpin: 2.1,
};

export function getDefaultSimulatorConfig(): SimulatorConfig {
  return {
    seed: 42,
    tickHours: 1,
    initialGameBankroll: 100_000,
    initialBonusPool: 5_000,
    playerArrivalMin: 2,
    playerArrivalMax: 8,
    capitalMin: 50,
    capitalMax: 500,
    betSizeMin: 5,
    betSizeMax: 80,
    gameTrafficPercent: 70,
    stakingTrafficPercent: 30,
    coinFlipPercent: 40,
    dicePercent: 35,
    luckySpinPercent: 25,
    houseEdgePercent: 3,
    platformFeePercent: 10,
    gameBankrollReservePercent: 20,
    stakingLockDays: 7,
    stakingPeriodRewardCapPercent: 10,
    healthyApyPercent: 20,
    withdrawalRequestPercent: 2,
    withdrawalApprovalDelayHours: 24,
  };
}

export function normalizeSimulatorConfig(config: Partial<SimulatorConfig>): SimulatorConfig {
  const defaults = getDefaultSimulatorConfig();
  return {
    ...defaults,
    ...config,
    tickHours: safeNumber(config.tickHours, defaults.tickHours),
    initialGameBankroll: safeNumber(config.initialGameBankroll, defaults.initialGameBankroll),
    initialBonusPool: safeNumber(config.initialBonusPool, defaults.initialBonusPool),
    playerArrivalMin: safeNumber(config.playerArrivalMin, defaults.playerArrivalMin),
    playerArrivalMax: safeNumber(config.playerArrivalMax, defaults.playerArrivalMax),
    capitalMin: safeNumber(config.capitalMin, defaults.capitalMin),
    capitalMax: safeNumber(config.capitalMax, defaults.capitalMax),
    betSizeMin: safeNumber(config.betSizeMin, defaults.betSizeMin),
    betSizeMax: safeNumber(config.betSizeMax, defaults.betSizeMax),
    gameTrafficPercent: safeNumber(config.gameTrafficPercent, defaults.gameTrafficPercent),
    stakingTrafficPercent: safeNumber(config.stakingTrafficPercent, defaults.stakingTrafficPercent),
    coinFlipPercent: safeNumber(config.coinFlipPercent, defaults.coinFlipPercent),
    dicePercent: safeNumber(config.dicePercent, defaults.dicePercent),
    luckySpinPercent: safeNumber(config.luckySpinPercent, defaults.luckySpinPercent),
    houseEdgePercent: safeNumber(config.houseEdgePercent, defaults.houseEdgePercent),
    platformFeePercent: safeNumber(config.platformFeePercent, defaults.platformFeePercent),
    gameBankrollReservePercent: safeNumber(config.gameBankrollReservePercent, defaults.gameBankrollReservePercent),
    stakingLockDays: safeNumber(config.stakingLockDays, defaults.stakingLockDays),
    stakingPeriodRewardCapPercent: safeNumber(config.stakingPeriodRewardCapPercent, defaults.stakingPeriodRewardCapPercent),
    healthyApyPercent: safeNumber(config.healthyApyPercent, defaults.healthyApyPercent),
    withdrawalRequestPercent: safeNumber(config.withdrawalRequestPercent, defaults.withdrawalRequestPercent),
    withdrawalApprovalDelayHours: safeNumber(config.withdrawalApprovalDelayHours, defaults.withdrawalApprovalDelayHours),
  };
}

export function createInitialSimulatorState(config: SimulatorConfig): SimulatorState {
  const normalizedConfig = normalizeSimulatorConfig(config);
  return {
    rngState: normalizeSeed(normalizedConfig.seed),
    nextEventId: 1,
    lockedPositions: [],
    pendingWithdrawalQueue: [],
    events: [],
    history: [],
    summary: {
      tick: 0,
      simulatedDays: 0,
      gameBankroll: normalizedConfig.initialGameBankroll,
      bonusPool: normalizedConfig.initialBonusPool,
      lockedPrincipal: 0,
      userWithdrawableBalance: 0,
      pendingWithdrawals: 0,
      withdrawalsPaid: 0,
      withdrawalShortfall: 0,
      platformLiquidity: normalizedConfig.initialGameBankroll + normalizedConfig.initialBonusPool,
      platformRevenue: 0,
      rewardsPaid: 0,
      instantApyPercent: 0,
      realizedApyPercent: 0,
      warningCount: 0,
      playersProcessed: 0,
    },
  };
}

export function runSimulation(config: SimulatorConfig, ticks: number): SimulatorState {
  const normalizedConfig = normalizeSimulatorConfig(config);
  let state = createInitialSimulatorState(normalizedConfig);
  for (let index = 0; index < ticks; index += 1) {
    state = stepSimulator(normalizedConfig, state);
  }
  return state;
}

export function stepSimulator(config: SimulatorConfig, state: SimulatorState): SimulatorState {
  const normalizedConfig = normalizeSimulatorConfig(config);
  let rngState = state.rngState;
  const events: SimulatorEvent[] = [];
  let nextEventId = state.nextEventId;
  const nextTick = state.summary.tick + 1;
  const previousHours = state.summary.simulatedDays * 24;
  const currentHours = previousHours + normalizedConfig.tickHours;
  const lockHours = normalizedConfig.stakingLockDays * 24;

  let gameBankroll = state.summary.gameBankroll;
  let bonusPool = state.summary.bonusPool;
  let userWithdrawableBalance = state.summary.userWithdrawableBalance;
  let withdrawalsPaid = state.summary.withdrawalsPaid;
  let withdrawalShortfall = state.summary.withdrawalShortfall;
  let platformLiquidity = state.summary.platformLiquidity;
  let platformRevenue = state.summary.platformRevenue;
  let rewardsPaid = state.summary.rewardsPaid;
  let warningCount = state.summary.warningCount;
  let playersProcessed = state.summary.playersProcessed;
  const pendingWithdrawalQueue: PendingWithdrawal[] = [];
  const carriedWithdrawalQueue: PendingWithdrawal[] = [];

  const activePositions: LockedPosition[] = [];
  let maturedPrincipal = 0;
  let maturedRewards = 0;
  let maturedWeightedApy = 0;
  for (const position of state.lockedPositions) {
    if (position.unlockHour <= currentHours) {
      maturedPrincipal += position.amount;
      const rewardAccrued = position.rewardAccrued ?? 0;
      maturedRewards += rewardAccrued;
      const lockDays = Math.max((position.unlockHour - position.createdHour) / 24, 1 / 24);
      const positionApy = (rewardAccrued / position.amount) * (365 / lockDays) * 100;
      maturedWeightedApy += positionApy * position.amount;
    } else {
      activePositions.push(position);
    }
  }

  if (maturedPrincipal > 0) {
    const maturedTotal = maturedPrincipal + maturedRewards;
    const maturedApy = maturedWeightedApy / maturedPrincipal;
    userWithdrawableBalance += maturedTotal;
    events.push({
      id: nextEventId,
      tick: nextTick,
      type: "mature",
      title: "收益寶到期",
      amount: maturedTotal,
      detail: "7 天鎖倉本金與累積分紅回到非鎖倉可提款餘額",
      effects: [
        { label: "鎖倉本金", amount: -maturedPrincipal },
        { label: "非鎖倉可提款", amount: maturedTotal },
        { label: "收益寶 APY", amount: maturedApy },
      ],
    });
    nextEventId += 1;
  }

  for (const withdrawal of state.pendingWithdrawalQueue) {
    if (withdrawal.dueHour > currentHours) {
      carriedWithdrawalQueue.push(withdrawal);
      continue;
    }

    const paid = Math.min(withdrawal.amount, Math.max(0, platformLiquidity));
    const shortfall = withdrawal.amount - paid;
    const isOverdue = withdrawal.dueHour < currentHours;
    platformLiquidity -= paid;
    withdrawalsPaid += paid;
    if (paid > 0) {
      if (isOverdue) {
        withdrawalShortfall -= paid;
      }
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "withdrawal",
        title: isOverdue ? "缺口補付" : "提款支付",
        amount: paid,
        detail: isOverdue ? "平台流動性恢復後補付逾期提款" : "待處理提款通過延遲後由平台流動性支付",
        effects: [
          { label: isOverdue ? "逾期未付提款" : "待處理提款", amount: -paid },
          { label: "平台流動性", amount: -paid },
        ],
      });
      nextEventId += 1;
    }
    if (shortfall > 0) {
      warningCount += 1;
      if (!isOverdue) {
        withdrawalShortfall += shortfall;
      }
      carriedWithdrawalQueue.push({
        amount: shortfall,
        dueHour: currentHours - normalizedConfig.tickHours,
      });
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "warning",
        title: "逾期未付提款",
        amount: shortfall,
        detail: "平台流動性不足，無法全額支付到期提款",
        effects: [
          { label: "逾期未付提款", amount: shortfall },
        ],
      });
      nextEventId += 1;
    }
  }

  const playerCountResult = randomInteger(rngState, normalizedConfig.playerArrivalMin, normalizedConfig.playerArrivalMax);
  rngState = playerCountResult.seed;
  const playerCount = playerCountResult.value;
  playersProcessed += playerCount;

  for (let index = 0; index < playerCount; index += 1) {
    const routeResult = randomFloat(rngState);
    rngState = routeResult.seed;
    const routeRoll = routeResult.value * 100;

    if (routeRoll < normalizedConfig.gameTrafficPercent) {
      const gameResult = pickGame(rngState, normalizedConfig);
      rngState = gameResult.seed;
      const betResult = randomRange(rngState, normalizedConfig.betSizeMin, normalizedConfig.betSizeMax);
      rngState = betResult.seed;
      const profitResult = simulateGameProfit(rngState, gameResult.game, betResult.value, normalizedConfig.houseEdgePercent);
      rngState = profitResult.seed;
      const profit = profitResult.value;

      if (profit > 0) {
        const distribution = calculateGameProfitDistribution(profit, normalizedConfig);
        platformLiquidity += profit;
        platformRevenue += distribution.platformCut;
        gameBankroll += distribution.gameBankrollReserve;
        bonusPool += distribution.bonusPoolCut;
      } else {
        gameBankroll += profit;
        userWithdrawableBalance += Math.abs(profit);
      }

      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "game",
        title: GAME_LABELS[gameResult.game],
        amount: profit,
        detail: profit >= 0 ? "莊家獲利，按費率分配平台與收益寶" : "玩家贏錢，先進入非鎖倉可提款，出金時才扣流動性",
        effects: profit >= 0
          ? [
            { label: "平台流動性", amount: profit },
            { label: "收益寶獎金池", amount: calculateGameProfitDistribution(profit, normalizedConfig).bonusPoolCut },
            { label: "遊戲金庫", amount: calculateGameProfitDistribution(profit, normalizedConfig).gameBankrollReserve },
            { label: "平台收益", amount: calculateGameProfitDistribution(profit, normalizedConfig).platformCut },
          ]
          : [
            { label: "遊戲金庫", amount: profit },
            { label: "非鎖倉可提款", amount: Math.abs(profit) },
          ],
      });
      nextEventId += 1;

      if (gameBankroll < 0) {
        warningCount += 1;
        events.push({
          id: nextEventId,
          tick: nextTick,
          type: "warning",
          title: "遊戲金庫透支",
          amount: gameBankroll,
          detail: "此情境代表 bankroll 不足以承受波動",
          effects: [
            { label: "遊戲金庫", amount: gameBankroll },
          ],
        });
        nextEventId += 1;
      }
    } else {
      const capitalResult = randomRange(rngState, normalizedConfig.capitalMin, normalizedConfig.capitalMax);
      rngState = capitalResult.seed;
      platformLiquidity += capitalResult.value;
      activePositions.push({
        amount: capitalResult.value,
        unlockHour: currentHours + lockHours,
        createdHour: currentHours,
        rewardAccrued: 0,
      });
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "stake",
        title: "加入收益寶",
        amount: capitalResult.value,
        detail: `${normalizedConfig.stakingLockDays} 天鎖倉本金`,
        effects: [
          { label: "鎖倉本金", amount: capitalResult.value },
          { label: "平台流動性", amount: capitalResult.value },
        ],
      });
      nextEventId += 1;
    }
  }

  const beforeRewardLockedPrincipal = sumLockedPrincipal(activePositions);
  const shouldDistribute = crossedDayBoundary(previousHours, currentHours);
  if (shouldDistribute && beforeRewardLockedPrincipal > 0 && bonusPool > 0) {
    const rewardBudget = bonusPool;
    let distributedReward = 0;
    for (const position of activePositions) {
      const targetReward = rewardBudget * (position.amount / beforeRewardLockedPrincipal);
      const rewardCap = position.amount * (normalizedConfig.stakingPeriodRewardCapPercent / 100);
      const remainingCapacity = Math.max(0, rewardCap - position.rewardAccrued);
      const positionReward = Math.min(targetReward, remainingCapacity);
      position.rewardAccrued += positionReward;
      distributedReward += positionReward;
    }
    bonusPool -= distributedReward;
    rewardsPaid += distributedReward;
    if (distributedReward > 0) {
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "reward",
        title: "收益寶浮動分紅",
        amount: distributedReward,
        detail: `單期收益上限 ${normalizedConfig.stakingPeriodRewardCapPercent}%，超出部分留在獎金池`,
        effects: [
          { label: "收益寶獎金池", amount: -distributedReward },
          { label: "鎖倉累積分紅", amount: distributedReward },
        ],
      });
      nextEventId += 1;
    }
  }

  const withdrawalRequest = userWithdrawableBalance * (normalizedConfig.withdrawalRequestPercent / 100);
  if (withdrawalRequest > 0) {
    userWithdrawableBalance -= withdrawalRequest;
    pendingWithdrawalQueue.push({
      amount: withdrawalRequest,
      dueHour: currentHours + normalizedConfig.withdrawalApprovalDelayHours,
    });
    events.push({
      id: nextEventId,
      tick: nextTick,
      type: "withdrawal",
      title: "提款申請",
      amount: withdrawalRequest,
      detail: `${normalizedConfig.withdrawalApprovalDelayHours} 小時審核延遲後支付`,
      effects: [
        { label: "非鎖倉可提款", amount: -withdrawalRequest },
        { label: "待處理提款", amount: withdrawalRequest },
      ],
    });
    nextEventId += 1;
  }

  const dueNow: PendingWithdrawal[] = [];
  const stillPending: PendingWithdrawal[] = [...carriedWithdrawalQueue];
  for (const withdrawal of pendingWithdrawalQueue) {
    if (withdrawal.dueHour <= currentHours) {
      dueNow.push(withdrawal);
    } else {
      stillPending.push(withdrawal);
    }
  }

  for (const withdrawal of dueNow) {
    const paid = Math.min(withdrawal.amount, Math.max(0, platformLiquidity));
    const shortfall = withdrawal.amount - paid;
    platformLiquidity -= paid;
    withdrawalsPaid += paid;
    if (paid > 0) {
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "withdrawal",
        title: withdrawal.dueHour < currentHours ? "缺口補付" : "提款支付",
        amount: paid,
        detail: withdrawal.dueHour < currentHours ? "平台流動性恢復後補付逾期提款" : "提款申請已由平台流動性支付",
        effects: [
          { label: withdrawal.dueHour < currentHours ? "逾期未付提款" : "待處理提款", amount: -paid },
          { label: "平台流動性", amount: -paid },
        ],
      });
      nextEventId += 1;
    }
    if (shortfall > 0) {
      warningCount += 1;
      if (withdrawal.dueHour < currentHours && paid > 0) {
        withdrawalShortfall -= paid;
      } else if (withdrawal.dueHour >= currentHours) {
        withdrawalShortfall += shortfall;
      }
      stillPending.push({
        amount: shortfall,
        dueHour: currentHours,
      });
      events.push({
        id: nextEventId,
        tick: nextTick,
        type: "warning",
        title: "逾期未付提款",
        amount: shortfall,
        detail: "平台流動性不足，無法全額支付提款申請",
        effects: [
          { label: "逾期未付提款", amount: shortfall },
        ],
      });
      nextEventId += 1;
    } else if (withdrawal.dueHour < currentHours) {
      withdrawalShortfall -= paid;
    }
  }

  const lockedPrincipal = sumLockedPrincipal(activePositions);
  const pendingWithdrawals = sumPendingWithdrawals(stillPending);
  const simulatedDays = currentHours / 24;
  const instantApyPercent = lockedPrincipal > 0
    ? (bonusPool / lockedPrincipal) * 365 * 100
    : 0;
  const realizedApyPercent = lockedPrincipal > 0 && simulatedDays > 0
    ? (rewardsPaid / lockedPrincipal) * (365 / simulatedDays) * 100
    : 0;
  const summary: SimulatorSummary = {
    tick: nextTick,
    simulatedDays,
    gameBankroll,
    bonusPool,
    lockedPrincipal,
    userWithdrawableBalance,
    pendingWithdrawals,
    withdrawalsPaid,
    withdrawalShortfall,
    platformLiquidity,
    platformRevenue,
    rewardsPaid,
    instantApyPercent,
    realizedApyPercent,
    warningCount,
    playersProcessed,
  };

  return {
    rngState,
    nextEventId,
    lockedPositions: activePositions,
    pendingWithdrawalQueue: stillPending,
    events: [...events, ...state.events].slice(0, 80),
    history: [...state.history, summary].slice(-360),
    summary,
  };
}

export function sweepPlatformFees(config: SimulatorConfig, fees: number[], ticks: number): FeeSweepResult {
  const normalizedConfig = normalizeSimulatorConfig(config);
  const scenarios = fees.map((feePercent) => {
    const summary = runSimulation({ ...normalizedConfig, platformFeePercent: feePercent }, ticks).summary;
    const isHealthy = summary.instantApyPercent >= normalizedConfig.healthyApyPercent
      && summary.warningCount === 0
      && summary.withdrawalShortfall === 0
      && summary.gameBankroll >= 0;
    return {
      feePercent,
      summary,
      score: isHealthy ? summary.platformRevenue : summary.platformRevenue * 0.2,
      isHealthy,
    };
  });

  const healthyScenarios = scenarios.filter((scenario) => scenario.isHealthy);
  const candidates = healthyScenarios.length > 0 ? healthyScenarios : scenarios;
  const recommended = [...candidates].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.feePercent - left.feePercent;
  })[0];

  return {
    recommendedFeePercent: recommended?.feePercent ?? fees[0] ?? normalizedConfig.platformFeePercent,
    scenarios,
  };
}

export function calculateGameProfitDistribution(profit: number, config: SimulatorConfig): GameProfitDistribution {
  const normalizedConfig = normalizeSimulatorConfig(config);
  const platformPercent = clampPercent(normalizedConfig.platformFeePercent);
  const reservePercent = Math.min(clampPercent(normalizedConfig.gameBankrollReservePercent), 100 - platformPercent);
  const bonusPercent = Math.max(0, 100 - platformPercent - reservePercent);

  return {
    platformCut: profit * (platformPercent / 100),
    gameBankrollReserve: profit * (reservePercent / 100),
    bonusPoolCut: profit * (bonusPercent / 100),
  };
}

function safeNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizeSeed(seed: number) {
  const normalized = Math.trunc(seed) % 2_147_483_647;
  return normalized > 0 ? normalized : normalized + 2_147_483_646;
}

function nextSeed(seed: number) {
  return (seed * 16_807) % 2_147_483_647;
}

function randomFloat(seed: number) {
  const next = nextSeed(seed);
  return {
    seed: next,
    value: (next - 1) / 2_147_483_646,
  };
}

function randomRange(seed: number, min: number, max: number) {
  const result = randomFloat(seed);
  return {
    seed: result.seed,
    value: min + result.value * Math.max(0, max - min),
  };
}

function randomInteger(seed: number, min: number, max: number) {
  const minimum = Math.max(0, Math.trunc(min));
  const maximum = Math.max(minimum, Math.trunc(max));
  const result = randomFloat(seed);
  return {
    seed: result.seed,
    value: minimum + Math.floor(result.value * (maximum - minimum + 1)),
  };
}

function pickGame(seed: number, config: SimulatorConfig): { seed: number; game: GameKey } {
  const result = randomFloat(seed);
  const total = Math.max(1, config.coinFlipPercent + config.dicePercent + config.luckySpinPercent);
  const roll = result.value * total;

  if (roll < config.coinFlipPercent) {
    return { seed: result.seed, game: "coinFlip" };
  }
  if (roll < config.coinFlipPercent + config.dicePercent) {
    return { seed: result.seed, game: "dice" };
  }
  return { seed: result.seed, game: "luckySpin" };
}

function simulateGameProfit(seed: number, game: GameKey, betSize: number, houseEdgePercent: number) {
  const result = randomFloat(seed);
  const edge = houseEdgePercent / 100;
  const volatility = GAME_VOLATILITY[game];
  const playerWinChance = Math.max(0.02, Math.min(0.98, (1 - edge) / 2));
  const playerWins = result.value < playerWinChance;
  const houseExpectedProfit = betSize * edge;
  const swing = betSize * volatility;

  return {
    seed: result.seed,
    value: playerWins ? houseExpectedProfit - swing : houseExpectedProfit + swing,
  };
}

function crossedDayBoundary(previousHours: number, currentHours: number) {
  return Math.floor(previousHours / 24) < Math.floor(currentHours / 24);
}

function sumLockedPrincipal(positions: LockedPosition[]) {
  return positions.reduce((total, position) => total + position.amount, 0);
}

function sumPendingWithdrawals(withdrawals: PendingWithdrawal[]) {
  return withdrawals.reduce((total, withdrawal) => total + withdrawal.amount, 0);
}
