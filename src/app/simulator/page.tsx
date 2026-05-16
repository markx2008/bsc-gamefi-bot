"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Home,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Trophy,
  Vault,
} from "lucide-react";
import {
  createInitialSimulatorState,
  getDefaultSimulatorConfig,
  normalizeSimulatorConfig,
  runSimulation,
  stepSimulator,
  sweepPlatformFees,
  type GameKey,
  type SimulatorConfig,
  type SimulatorEvent,
  type SimulatorState,
} from "@/lib/simulator";

const DEFAULT_CONFIG = getDefaultSimulatorConfig();
const FEE_SWEEP_VALUES = [5, 10, 15, 20, 25, 30];
const GAME_STAT_ITEMS: { key: GameKey; label: string }[] = [
  { key: "coinFlip", label: "猜硬幣" },
  { key: "dice", label: "骰子" },
  { key: "luckySpin", label: "幸運轉盤" },
];

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatScenarioStatus(
  scenario: ReturnType<typeof sweepPlatformFees>["scenarios"][number],
  healthyApyPercent: number,
) {
  if (scenario.isHealthy) return "健康";

  const reasons: string[] = [];
  if (scenario.summary.instantApyPercent < healthyApyPercent) reasons.push("APY 未達");
  if (scenario.summary.withdrawalShortfall !== 0) reasons.push("提款逾期");
  if (scenario.summary.gameBankroll < 0) reasons.push("金庫透支");
  if (scenario.summary.warningCount > 0) reasons.push("警告");

  return reasons.length > 0 ? reasons.join(" / ") : "未達門檻";
}

function periodCapToApy(periodCapPercent: number, lockDays: number) {
  return periodCapPercent * (365 / Math.max(lockDays, 1 / 24));
}

function apyToPeriodCap(apyPercent: number, lockDays: number) {
  return apyPercent * (Math.max(lockDays, 1 / 24) / 365);
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

export default function SimulatorPage() {
  const [config, setConfig] = useState<SimulatorConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<SimulatorState>(() => createInitialSimulatorState(DEFAULT_CONFIG));
  const [running, setRunning] = useState(false);
  const [ticksPerFrame, setTicksPerFrame] = useState(3);

  useEffect(() => {
    if (!running) return undefined;
    const intervalId = window.setInterval(() => {
      setState((current) => {
        let next = current;
        for (let index = 0; index < ticksPerFrame; index += 1) {
          next = stepSimulator(config, next);
        }
        return next;
      });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [config, running, ticksPerFrame]);

  function reset(nextConfig = config) {
    setRunning(false);
    setState(createInitialSimulatorState(nextConfig));
  }

  function updateConfig(patch: Partial<SimulatorConfig>) {
    setConfig((current) => {
      const next = normalizeSimulatorConfig({ ...current, ...patch });
      setState(createInitialSimulatorState(next));
      setRunning(false);
      return next;
    });
  }

  function setGameTraffic(value: number) {
    updateConfig({
      gameTrafficPercent: value,
      stakingTrafficPercent: 100 - value,
    });
  }

  function setPlatformFeePercent(value: number) {
    updateConfig({
      platformFeePercent: value,
      gameBankrollReservePercent: Math.min(safeConfig.gameBankrollReservePercent, 100 - value),
    });
  }

  function setGameBankrollReservePercent(value: number) {
    updateConfig({
      gameBankrollReservePercent: Math.min(value, 100 - safeConfig.platformFeePercent),
    });
  }

  function setGamePercent(game: GameKey, value: number) {
    const nextValue = Math.max(0, Math.min(100, value));
    const current = {
      coinFlip: safeConfig.coinFlipPercent,
      dice: safeConfig.dicePercent,
      luckySpin: safeConfig.luckySpinPercent,
    };
    const otherGames = GAME_STAT_ITEMS.map((item) => item.key).filter((key) => key !== game);
    const remaining = 100 - nextValue;
    const otherTotal = otherGames.reduce((total, key) => total + current[key], 0);
    const firstOther = otherGames[0];
    const secondOther = otherGames[1];
    const firstValue = otherTotal > 0
      ? roundPercent(remaining * (current[firstOther] / otherTotal))
      : roundPercent(remaining / 2);
    const secondValue = roundPercent(remaining - firstValue);
    const next = {
      ...current,
      [game]: nextValue,
      [firstOther]: firstValue,
      [secondOther]: secondValue,
    };

    updateConfig({
      coinFlipPercent: next.coinFlip,
      dicePercent: next.dice,
      luckySpinPercent: next.luckySpin,
    });
  }

  function stepOnce() {
    setRunning(false);
    setState((current) => stepSimulator(config, current));
  }

  const safeConfig = normalizeSimulatorConfig(config);
  const summary = state.summary;
  const feeSweepTicks = Math.max(240, summary.tick);
  const feeSweep = useMemo(() => sweepPlatformFees(config, FEE_SWEEP_VALUES, feeSweepTicks), [config, feeSweepTicks]);
  const tenPercent = useMemo(() => runSimulation({ ...config, platformFeePercent: 10 }, feeSweepTicks).summary, [config, feeSweepTicks]);
  const twentyPercent = useMemo(() => runSimulation({ ...config, platformFeePercent: 20 }, feeSweepTicks).summary, [config, feeSweepTicks]);
  const recommendedScenario = feeSweep.recommendedFeePercent === null
    ? null
    : feeSweep.scenarios.find((scenario) => scenario.feePercent === feeSweep.recommendedFeePercent);
  const apyHealthy = summary.instantApyPercent >= safeConfig.healthyApyPercent;
  const hasWithdrawalAccountingError = summary.withdrawalShortfall < -0.000001;
  const earnPoolPercent = Math.max(0, 100 - safeConfig.platformFeePercent - safeConfig.gameBankrollReservePercent);
  const platformFundsTotal = summary.gameBankroll + summary.platformRevenue + summary.bonusPool;
  const userFundsTotal = summary.lockedPrincipal + summary.userWithdrawableBalance;
  const gameTotals = GAME_STAT_ITEMS.reduce((totals, game) => {
    const stats = summary.gameStats[game.key];
    totals.rounds += stats.rounds;
    totals.totalBetAmount += stats.totalBetAmount;
    totals.houseNetProfit += stats.houseNetProfit;
    totals.houseWinAmount += stats.houseWinAmount;
    totals.playerWinAmount += stats.playerWinAmount;
    totals.houseWinRounds += stats.houseWinRounds;
    totals.playerWinRounds += stats.playerWinRounds;
    return totals;
  }, {
    rounds: 0,
    totalBetAmount: 0,
    houseNetProfit: 0,
    houseWinAmount: 0,
    playerWinAmount: 0,
    houseWinRounds: 0,
    playerWinRounds: 0,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-4 px-4 py-4 sm:px-6 2xl:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-400">BSC GameFi 試算</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">三遊戲與收益寶池子模擬</h1>
            <p className="mt-2 text-sm text-zinc-400">純前端計算，不連錢包、不串合約，用同一組 seed 比較平台抽成與池子健康。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/">
              <Home size={16} /> 回首頁
            </Link>
            <button className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500" onClick={() => setRunning((value) => !value)}>
              {running ? <Pause size={16} /> : <Play size={16} />} {running ? "暫停" : "開始"}
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={stepOnce}>
              <SkipForward size={16} /> 跑一輪
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => reset()}>
              <RotateCcw size={16} /> 重置
            </button>
          </div>
        </header>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.75fr)_minmax(340px,0.75fr)]">
          <MetricGroup title="帳面平台資金" total={`$${formatMoney(platformFundsTotal)}`} detail="遊戲金庫 + 平台收益 + 收益寶獎金池">
            <Metric
              label="遊戲金庫"
              value={`$${formatMoney(summary.gameBankroll)}`}
              detail={summary.gameBankroll < 0 ? "金庫已透支，需要補金庫或降低波動" : "承受玩家贏錢波動"}
              tone={summary.gameBankroll < 0 ? "red" : "neutral"}
            />
            <Metric label="平台收益" value={`$${formatMoney(summary.platformRevenue)}`} detail={`${safeConfig.platformFeePercent}% 遊戲正利潤抽成`} tone="sky" />
            <Metric label="收益寶獎金池" value={`$${formatMoney(summary.bonusPool)}`} detail="未分配與上限保留資金" tone="green" />
          </MetricGroup>

          <MetricGroup title="用戶資金" total={`$${formatMoney(userFundsTotal)}`} detail="鎖倉本金 + 非鎖倉可提款">
            <Metric label="鎖倉本金" value={`$${formatMoney(summary.lockedPrincipal)}`} detail={`${safeConfig.stakingLockDays} 天 active principal`} />
            <Metric label="非鎖倉可提款" value={`$${formatMoney(summary.userWithdrawableBalance)}`} detail="到期本金、玩家淨贏與已發分紅" tone="sky" />
          </MetricGroup>

          <MetricGroup title="運行狀態" total={`T+${summary.tick}`} detail={`${formatPercent(summary.simulatedDays)} 天 / ${summary.playersProcessed} players`}>
            <Metric label="可用現金" value={`$${formatMoney(summary.platformLiquidity)}`} detail="平台錢包現金餘額" tone={summary.platformLiquidity < summary.withdrawalShortfall ? "amber" : "green"} />
            <Metric label="待處理提款" value={`$${formatMoney(summary.pendingWithdrawals)}`} detail={`${safeConfig.withdrawalApprovalDelayHours} 小時審核延遲`} tone="amber" />
            <Metric label="逾期未付提款" value={`$${formatMoney(summary.withdrawalShortfall)}`} detail={hasWithdrawalAccountingError ? "提款缺口會計異常" : "尚未補付的提款負債"} tone={summary.withdrawalShortfall !== 0 ? "red" : "neutral"} />
            <Metric label="即時 APY" value={`${formatPercent(summary.instantApyPercent)}%`} detail={apyHealthy ? "受單期上限限制，高於門檻" : `受單期上限限制，低於 ${safeConfig.healthyApyPercent}% 門檻`} tone={apyHealthy ? "green" : "amber"} />
          </MetricGroup>
        </section>

        <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_420px]">
          <div className="grid content-start gap-4">
            <Panel title="運行參數" icon={<Settings2 size={18} />}>
              <div className="grid gap-4">
                <NumberField label="Seed" value={safeConfig.seed} min={1} max={99999} step={1} onChange={(value) => updateConfig({ seed: value })} />
                <NumberField label="每輪最少新玩家" value={safeConfig.playerArrivalMin} min={0} max={50} step={1} onChange={(value) => updateConfig({ playerArrivalMin: value })} />
                <NumberField label="每輪最多新玩家" value={safeConfig.playerArrivalMax} min={0} max={80} step={1} onChange={(value) => updateConfig({ playerArrivalMax: value })} />
                <RangeField label="跑速" value={ticksPerFrame} min={1} max={200} step={1} suffix="輪/刷新" onChange={setTicksPerFrame} />
                <RangeField label="進遊戲比例" value={safeConfig.gameTrafficPercent} min={0} max={100} step={5} suffix="%" onChange={setGameTraffic} />
                <ReadOnlyRow label="進收益寶比例" value={`${safeConfig.stakingTrafficPercent}%`} />
              </div>
            </Panel>

            <Panel title="平台與提款" icon={<Settings2 size={18} />}>
              <div className="grid gap-4">
                <RangeField label="平台收益比例" value={safeConfig.platformFeePercent} min={0} max={100} step={1} suffix="%" onChange={setPlatformFeePercent} />
                <RangeField label="遊戲金庫保留比例" value={safeConfig.gameBankrollReservePercent} min={0} max={100 - safeConfig.platformFeePercent} step={1} suffix="%" onChange={setGameBankrollReservePercent} />
                <ReadOnlyRow label="收益寶獎金池比例" value={`${earnPoolPercent}%`} />
                <ReadOnlyRow label="正利潤分配合計" value={`${safeConfig.platformFeePercent + safeConfig.gameBankrollReservePercent + earnPoolPercent}%`} />
                <RangeField label="每輪提款申請比例" value={safeConfig.withdrawalRequestPercent} min={0} max={100} step={1} suffix="%" onChange={(value) => updateConfig({ withdrawalRequestPercent: value })} />
                <NumberField label="提款審核延遲小時" value={safeConfig.withdrawalApprovalDelayHours} min={0} max={168} step={0.5} onChange={(value) => updateConfig({ withdrawalApprovalDelayHours: value })} />
              </div>
            </Panel>

            <Panel title="收益寶設定" icon={<Vault size={18} />}>
              <div className="grid gap-4">
                <RangeField label={`${safeConfig.stakingLockDays}天收益上限`} value={safeConfig.stakingPeriodRewardCapPercent} min={0} max={10} step={0.01} suffix="%" onChange={(value) => updateConfig({ stakingPeriodRewardCapPercent: value })} />
                <NumberField label={`${safeConfig.stakingLockDays}天收益上限輸入`} value={roundPercent(safeConfig.stakingPeriodRewardCapPercent)} min={0} max={10} step={0.01} onChange={(value) => updateConfig({ stakingPeriodRewardCapPercent: value })} />
                <NumberField label="收益寶 APY 上限" value={roundPercent(periodCapToApy(safeConfig.stakingPeriodRewardCapPercent, safeConfig.stakingLockDays))} min={0} max={periodCapToApy(10, safeConfig.stakingLockDays)} step={0.01} onChange={(value) => updateConfig({ stakingPeriodRewardCapPercent: apyToPeriodCap(value, safeConfig.stakingLockDays) })} />
                <RangeField label="外部鎖倉 APY" value={safeConfig.externalEarnApyPercent} min={0} max={80} step={0.5} suffix="%" onChange={(value) => updateConfig({ externalEarnApyPercent: value })} />
                <RangeField label="健康 APY 門檻" value={safeConfig.healthyApyPercent} min={0} max={80} step={1} suffix="%" onChange={(value) => updateConfig({ healthyApyPercent: value })} />
              </div>
            </Panel>

            <Panel title="遊戲與本金設定" icon={<Vault size={18} />}>
              <div className="grid gap-4">
                <RangeField label="猜硬幣比例" value={safeConfig.coinFlipPercent} min={0} max={100} step={0.1} suffix="%" onChange={(value) => setGamePercent("coinFlip", value)} />
                <RangeField label="骰子比例" value={safeConfig.dicePercent} min={0} max={100} step={0.1} suffix="%" onChange={(value) => setGamePercent("dice", value)} />
                <RangeField label="幸運轉盤比例" value={safeConfig.luckySpinPercent} min={0} max={100} step={0.1} suffix="%" onChange={(value) => setGamePercent("luckySpin", value)} />
                <ReadOnlyRow label="遊戲比例合計" value={`${formatPercent(safeConfig.coinFlipPercent + safeConfig.dicePercent + safeConfig.luckySpinPercent)}%`} />
                <RangeField label="莊家優勢" value={safeConfig.houseEdgePercent} min={0} max={8} step={0.5} suffix="%" onChange={(value) => updateConfig({ houseEdgePercent: value })} />
                <NumberField label="玩家本金下限" value={safeConfig.capitalMin} min={0} max={10000} step={10} onChange={(value) => updateConfig({ capitalMin: value })} />
                <NumberField label="玩家本金上限" value={safeConfig.capitalMax} min={0} max={20000} step={10} onChange={(value) => updateConfig({ capitalMax: value })} />
                <NumberField label="下注下限" value={safeConfig.betSizeMin} min={0} max={1000} step={1} onChange={(value) => updateConfig({ betSizeMin: value })} />
                <NumberField label="下注上限" value={safeConfig.betSizeMax} min={0} max={5000} step={1} onChange={(value) => updateConfig({ betSizeMax: value })} />
                <ReadOnlyRow label="已支付提款" value={`$${formatMoney(summary.withdrawalsPaid)}`} />
                <ReadOnlyRow label="實現 APY" value={`${formatPercent(summary.realizedApyPercent)}%`} />
              </div>
            </Panel>
          </div>

          <div className="grid min-w-0 content-start gap-4">
            <Panel title="遊戲輸贏" icon={<BarChart3 size={18} />}>
              <GameTotalRow totals={gameTotals} />
              <div className="grid gap-3 lg:grid-cols-3">
                {GAME_STAT_ITEMS.map((game) => (
                  <GameStatCard game={game.label} stats={summary.gameStats[game.key]} key={game.key} />
                ))}
              </div>
            </Panel>

            <Panel title="收益寶盈虧" icon={<Vault size={18} />}>
              <EarnStatsPanel stats={summary.earnStats} bonusPool={summary.bonusPool} lockedPrincipal={summary.lockedPrincipal} />
            </Panel>

            <Panel title="費率最佳化" icon={<BarChart3 size={18} />}>
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">抽成</th>
                        <th className="px-3 py-2 font-medium">平台收益</th>
                        <th className="px-3 py-2 font-medium">獎金池</th>
                        <th className="px-3 py-2 font-medium">已發分紅</th>
                        <th className="px-3 py-2 font-medium">即時 APY</th>
                        <th className="px-3 py-2 font-medium">實現 APY</th>
                        <th className="px-3 py-2 font-medium">逾期未付</th>
                        <th className="px-3 py-2 font-medium">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeSweep.scenarios.map((scenario) => (
                        <tr className="border-t border-zinc-800" key={scenario.feePercent}>
                          <td className="px-3 py-2 font-mono text-zinc-100">{scenario.feePercent}%</td>
                          <td className="px-3 py-2 font-mono text-sky-300">${formatMoney(scenario.summary.platformRevenue)}</td>
                          <td className="px-3 py-2 font-mono text-emerald-300">${formatMoney(scenario.summary.bonusPool)}</td>
                          <td className="px-3 py-2 font-mono text-zinc-200">${formatMoney(scenario.summary.rewardsPaid)}</td>
                          <td className="px-3 py-2 font-mono text-zinc-200">{formatPercent(scenario.summary.instantApyPercent)}%</td>
                          <td className="px-3 py-2 font-mono text-zinc-200">{formatPercent(scenario.summary.realizedApyPercent)}%</td>
                          <td className={scenario.summary.withdrawalShortfall !== 0 ? "px-3 py-2 font-mono text-red-300" : "px-3 py-2 font-mono text-zinc-200"}>${formatMoney(scenario.summary.withdrawalShortfall)}</td>
                          <td className={scenario.isHealthy ? "px-3 py-2 text-emerald-300" : "px-3 py-2 text-amber-300"}>{formatScenarioStatus(scenario, safeConfig.healthyApyPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs">推薦抽成</span>
                    <Trophy size={16} />
                  </div>
                  <p className={recommendedScenario ? "mt-3 text-3xl font-semibold text-white" : "mt-3 text-3xl font-semibold text-amber-300"}>
                    {recommendedScenario ? `${feeSweep.recommendedFeePercent}%` : "無合格方案"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">以目前 T+{feeSweepTicks} 重跑同一組 seed。規則：即時 APY 高於門檻、逾期未付為 0、金庫無警告時，才推薦平台收益最高的健康抽成。</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <CompareTile label="10% 收益" value={`$${formatMoney(tenPercent.platformRevenue)}`} />
                    <CompareTile label="20% 收益" value={`$${formatMoney(twentyPercent.platformRevenue)}`} />
                    <CompareTile label="10% 即時APY" value={`${formatPercent(tenPercent.instantApyPercent)}%`} />
                    <CompareTile label="20% 即時APY" value={`${formatPercent(twentyPercent.instantApyPercent)}%`} />
                    <CompareTile label="10% 逾期" value={`$${formatMoney(tenPercent.withdrawalShortfall)}`} />
                    <CompareTile label="20% 逾期" value={`$${formatMoney(twentyPercent.withdrawalShortfall)}`} />
                  </div>
                  {recommendedScenario ? (
                    <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
                      目前 seed 下，{recommendedScenario.feePercent}% 抽成的試算平台收益為 ${formatMoney(recommendedScenario.summary.platformRevenue)}，即時 APY 為 {formatPercent(recommendedScenario.summary.instantApyPercent)}%。
                    </p>
                  ) : (
                    <p className="mt-4 rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                      目前 seed 下沒有任何抽成同時滿足 APY 門檻、提款與金庫健康條件。
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="xl:col-span-2 2xl:sticky 2xl:top-4 2xl:col-span-1 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-hidden" title="事件流" icon={<Activity size={18} />}>
            <div className="grid gap-2 2xl:max-h-[calc(100vh-8rem)] 2xl:overflow-y-auto 2xl:pr-1">
              {state.events.length ? state.events.map((event) => <EventRow event={event} key={event.id} />) : (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
                  點「開始」或「跑一輪」後，這裡會顯示隨機玩家、遊戲輸贏、收益寶加入與分紅事件。
                </div>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function GameStatCard({ game, stats }: { game: string; stats: SimulatorState["summary"]["gameStats"][GameKey] }) {
  const averageBet = stats.rounds > 0 ? stats.totalBetAmount / stats.rounds : 0;
  const netTone = stats.houseNetProfit >= 0 ? "text-emerald-300" : "text-red-300";
  const netPrefix = stats.houseNetProfit >= 0 ? "+" : "-";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{game}</p>
          <p className="mt-1 text-xs text-zinc-500">{stats.rounds} 局 / 平均下注 ${formatMoney(averageBet)}</p>
        </div>
        <p className={`font-mono text-lg font-semibold ${netTone}`}>{netPrefix}${formatMoney(Math.abs(stats.houseNetProfit))}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <StatPill label="下注總額" value={`$${formatMoney(stats.totalBetAmount)}`} />
        <StatPill label="莊家淨輸贏" value={`${netPrefix}$${formatMoney(Math.abs(stats.houseNetProfit))}`} valueClass={netTone} />
        <StatPill label="莊家贏局" value={`${stats.houseWinRounds} 局`} />
        <StatPill label="玩家贏局" value={`${stats.playerWinRounds} 局`} />
        <StatPill label="莊家吃掉" value={`$${formatMoney(stats.houseWinAmount)}`} valueClass="text-emerald-300" />
        <StatPill label="玩家贏走" value={`$${formatMoney(stats.playerWinAmount)}`} valueClass="text-red-300" />
      </div>
    </div>
  );
}

function GameTotalRow({ totals }: { totals: SimulatorState["summary"]["gameStats"][GameKey] }) {
  const averageBet = totals.rounds > 0 ? totals.totalBetAmount / totals.rounds : 0;
  const netTone = totals.houseNetProfit >= 0 ? "text-emerald-300" : "text-red-300";
  const netPrefix = totals.houseNetProfit >= 0 ? "+" : "-";

  return (
    <div className="mb-3 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-4">
      <StatPill label="總局數" value={`${totals.rounds} 局`} />
      <StatPill label="總下注" value={`$${formatMoney(totals.totalBetAmount)}`} />
      <StatPill label="平均下注" value={`$${formatMoney(averageBet)}`} />
      <StatPill label="莊家總淨輸贏" value={`${netPrefix}$${formatMoney(Math.abs(totals.houseNetProfit))}`} valueClass={netTone} />
      <StatPill label="莊家贏局" value={`${totals.houseWinRounds} 局`} />
      <StatPill label="玩家贏局" value={`${totals.playerWinRounds} 局`} />
      <StatPill label="莊家吃掉總額" value={`$${formatMoney(totals.houseWinAmount)}`} valueClass="text-emerald-300" />
      <StatPill label="玩家贏走總額" value={`$${formatMoney(totals.playerWinAmount)}`} valueClass="text-red-300" />
    </div>
  );
}

function EarnStatsPanel({ stats, bonusPool, lockedPrincipal }: { stats: SimulatorState["summary"]["earnStats"]; bonusPool: number; lockedPrincipal: number }) {
  const userProfit = stats.rewardsReleased + stats.activeRewardAccrued;
  const selfProfit = stats.externalYieldIncome - stats.rewardsAccrued;
  const subsidyProfit = stats.externalYieldIncome + stats.gameSubsidyIncome - stats.rewardsAccrued;
  const fullyFundedProfit = stats.initialBonusPool + subsidyProfit;
  const principalReturnedRate = stats.totalPrincipalLocked > 0
    ? (stats.maturedPrincipal / stats.totalPrincipalLocked) * 100
    : 0;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SignedStatPill label="自身盈虧" value={selfProfit} />
      <SignedStatPill label="含遊戲補貼盈虧" value={subsidyProfit} />
      <SignedStatPill label="含初始補貼盈虧" value={fullyFundedProfit} />
      <StatPill label="外部收益收入" value={`$${formatMoney(stats.externalYieldIncome)}`} valueClass="text-emerald-300" />
      <StatPill label="遊戲補貼收入" value={`$${formatMoney(stats.gameSubsidyIncome)}`} valueClass="text-sky-300" />
      <StatPill label="初始補貼" value={`$${formatMoney(stats.initialBonusPool)}`} valueClass="text-sky-300" />
      <StatPill label="本金流入" value={`$${formatMoney(stats.totalPrincipalLocked)}`} />
      <StatPill label="目前鎖倉" value={`$${formatMoney(lockedPrincipal)}`} />
      <StatPill label="到期本金" value={`$${formatMoney(stats.maturedPrincipal)}`} />
      <StatPill label="本金到期率" value={`${formatPercent(principalReturnedRate)}%`} />
      <StatPill label="累積分紅" value={`$${formatMoney(stats.rewardsAccrued)}`} valueClass="text-emerald-300" />
      <StatPill label="已釋放分紅" value={`$${formatMoney(stats.rewardsReleased)}`} valueClass="text-emerald-300" />
      <StatPill label="待到期分紅" value={`$${formatMoney(stats.activeRewardAccrued)}`} valueClass="text-amber-300" />
      <StatPill label="用戶淨收益" value={`+$${formatMoney(userProfit)}`} valueClass="text-emerald-300" />
      <StatPill label="獎金池餘額" value={`$${formatMoney(bonusPool)}`} valueClass="text-sky-300" />
    </div>
  );
}

function SignedStatPill({ label, value }: { label: string; value: number }) {
  const tone = value >= 0 ? "text-emerald-300" : "text-red-300";
  const prefix = value >= 0 ? "+" : "-";
  return <StatPill label={label} value={`${prefix}$${formatMoney(Math.abs(value))}`} valueClass={tone} />;
}

function StatPill({ label, value, valueClass = "text-zinc-100" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2">
      <p className="text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}

function Panel({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-zinc-500">{icon}</span>
      </div>
      {children}
    </section>
  );
}

function MetricGroup({ title, total, detail, children }: { title: string; total: string; detail: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{total}</p>
        </div>
        <p className="text-xs text-zinc-500">{detail}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "green" | "sky" | "amber" | "red" }) {
  const toneClass = {
    neutral: "text-white",
    green: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 truncate text-xl font-semibold 2xl:text-2xl ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function RangeField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  const displayValue = suffix === "%" ? formatPercent(value) : value;

  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="font-mono text-sm text-zinc-100">{displayValue}{suffix}</span>
      </div>
      <input className="mt-2 w-full accent-emerald-500" type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm text-zinc-300">
      <span>{label}</span>
      <input
        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-100">{value}</span>
    </div>
  );
}

function CompareTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-zinc-100">{value}</p>
    </div>
  );
}

function EventRow({ event }: { event: SimulatorEvent }) {
  return (
    <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 sm:grid-cols-[88px_1fr_minmax(180px,280px)] sm:items-center 2xl:grid-cols-1 2xl:items-start">
      <span className="font-mono text-xs text-zinc-500">T+{event.tick}</span>
      <div>
        <p className="text-sm font-medium text-zinc-100">{event.title}</p>
        <p className="mt-1 text-xs text-zinc-500">{event.detail}</p>
      </div>
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end 2xl:justify-start">
        {event.effects.map((effect) => {
          const isNegative = effect.amount < 0;
          const amountClass = isNegative ? "text-red-300" : "text-emerald-300";
          const value = effect.label.includes("APY")
            ? `${formatPercent(effect.amount)}%`
            : `${isNegative ? "-" : "+"}$${formatMoney(Math.abs(effect.amount))}`;
          return (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs" key={`${effect.label}-${effect.amount}`}>
              <span className="text-zinc-500">{effect.label}</span>
              <span className={`font-mono ${amountClass}`}>{value}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
