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
  type SimulatorConfig,
  type SimulatorEvent,
  type SimulatorHistoryPoint,
  type SimulatorState,
} from "@/lib/simulator";

const DEFAULT_CONFIG = getDefaultSimulatorConfig();
const FEE_SWEEP_VALUES = [5, 10, 15, 20, 25, 30];

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

export default function SimulatorPage() {
  const [config, setConfig] = useState<SimulatorConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<SimulatorState>(() => createInitialSimulatorState(DEFAULT_CONFIG));
  const [running, setRunning] = useState(false);
  const [ticksPerFrame, setTicksPerFrame] = useState(3);

  const feeSweep = useMemo(() => sweepPlatformFees(config, FEE_SWEEP_VALUES, 240), [config]);
  const tenPercent = useMemo(() => runSimulation({ ...config, platformFeePercent: 10 }, 240).summary, [config]);
  const twentyPercent = useMemo(() => runSimulation({ ...config, platformFeePercent: 20 }, 240).summary, [config]);

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

  function stepOnce() {
    setRunning(false);
    setState((current) => stepSimulator(config, current));
  }

  const safeConfig = normalizeSimulatorConfig(config);
  const summary = state.summary;
  const recommendedScenario = feeSweep.scenarios.find((scenario) => scenario.feePercent === feeSweep.recommendedFeePercent);
  const apyHealthy = summary.instantApyPercent >= safeConfig.healthyApyPercent;
  const earnPoolPercent = Math.max(0, 100 - safeConfig.platformFeePercent - safeConfig.gameBankrollReservePercent);
  const platformFundsTotal = summary.gameBankroll + summary.platformRevenue + summary.bonusPool;
  const userFundsTotal = summary.lockedPrincipal + summary.userWithdrawableBalance;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
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

        <section className="grid gap-3 xl:grid-cols-2">
          <MetricGroup title="帳面平台資金" total={`$${formatMoney(platformFundsTotal)}`} detail="遊戲金庫 + 平台收益 + 收益寶獎金池">
            <Metric
              label="遊戲金庫"
              value={`$${formatMoney(summary.gameBankroll)}`}
              detail={summary.gameBankroll < 0 ? "金庫已透支，需要補金庫或降低波動" : "承受玩家贏錢波動"}
              tone={summary.gameBankroll < 0 ? "red" : "neutral"}
            />
            <Metric label="平台收益" value={`$${formatMoney(summary.platformRevenue)}`} detail={`${safeConfig.platformFeePercent}% 遊戲正利潤抽成`} tone="sky" />
            <Metric label="收益寶獎金池" value={`$${formatMoney(summary.bonusPool)}`} detail="未分配與上限保留資金" tone="green" />
            <Metric label="平台流動性" value={`$${formatMoney(summary.platformLiquidity)}`} detail="實際提款支付扣這裡" tone={summary.platformLiquidity < summary.withdrawalShortfall ? "amber" : "green"} />
          </MetricGroup>

          <MetricGroup title="用戶資金" total={`$${formatMoney(userFundsTotal)}`} detail="鎖倉本金 + 非鎖倉可提款">
            <Metric label="鎖倉本金" value={`$${formatMoney(summary.lockedPrincipal)}`} detail={`${safeConfig.stakingLockDays} 天 active principal`} />
            <Metric label="非鎖倉可提款" value={`$${formatMoney(summary.userWithdrawableBalance)}`} detail="到期本金、玩家淨贏與已發分紅" tone="sky" />
          </MetricGroup>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="待處理提款" value={`$${formatMoney(summary.pendingWithdrawals)}`} detail={`${safeConfig.withdrawalApprovalDelayHours} 小時審核延遲`} tone="amber" />
          <Metric label="逾期未付提款" value={`$${formatMoney(summary.withdrawalShortfall)}`} detail="尚未補付的提款負債" tone={summary.withdrawalShortfall > 0 ? "red" : "neutral"} />
          <Metric label="即時 APY" value={`${formatPercent(summary.instantApyPercent)}%`} detail={apyHealthy ? "高於健康門檻" : `低於 ${safeConfig.healthyApyPercent}% 門檻`} tone={apyHealthy ? "green" : "amber"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Panel title="參數" icon={<Settings2 size={18} />}>
            <div className="grid gap-4">
              <NumberField label="Seed" value={safeConfig.seed} min={1} max={99999} step={1} onChange={(value) => updateConfig({ seed: value })} />
              <NumberField label="每輪最少新玩家" value={safeConfig.playerArrivalMin} min={0} max={50} step={1} onChange={(value) => updateConfig({ playerArrivalMin: value })} />
              <NumberField label="每輪最多新玩家" value={safeConfig.playerArrivalMax} min={0} max={80} step={1} onChange={(value) => updateConfig({ playerArrivalMax: value })} />
              <RangeField label="跑速" value={ticksPerFrame} min={1} max={20} step={1} suffix="輪/刷新" onChange={setTicksPerFrame} />
              <RangeField label="進遊戲比例" value={safeConfig.gameTrafficPercent} min={0} max={100} step={5} suffix="%" onChange={setGameTraffic} />
              <ReadOnlyRow label="進收益寶比例" value={`${safeConfig.stakingTrafficPercent}%`} />
              <RangeField label="平台收益比例" value={safeConfig.platformFeePercent} min={0} max={100} step={1} suffix="%" onChange={setPlatformFeePercent} />
              <RangeField label="遊戲金庫保留比例" value={safeConfig.gameBankrollReservePercent} min={0} max={100 - safeConfig.platformFeePercent} step={1} suffix="%" onChange={setGameBankrollReservePercent} />
              <ReadOnlyRow label="收益寶獎金池比例" value={`${earnPoolPercent}%`} />
              <ReadOnlyRow label="正利潤分配合計" value={`${safeConfig.platformFeePercent + safeConfig.gameBankrollReservePercent + earnPoolPercent}%`} />
              <RangeField label="單期收益上限" value={safeConfig.stakingPeriodRewardCapPercent} min={0} max={100} step={1} suffix="%" onChange={(value) => updateConfig({ stakingPeriodRewardCapPercent: value })} />
              <RangeField label="莊家優勢" value={safeConfig.houseEdgePercent} min={0} max={8} step={0.5} suffix="%" onChange={(value) => updateConfig({ houseEdgePercent: value })} />
              <RangeField label="健康 APY 門檻" value={safeConfig.healthyApyPercent} min={0} max={80} step={1} suffix="%" onChange={(value) => updateConfig({ healthyApyPercent: value })} />
              <RangeField label="每輪提款申請比例" value={safeConfig.withdrawalRequestPercent} min={0} max={100} step={1} suffix="%" onChange={(value) => updateConfig({ withdrawalRequestPercent: value })} />
              <NumberField label="提款審核延遲小時" value={safeConfig.withdrawalApprovalDelayHours} min={0} max={168} step={1} onChange={(value) => updateConfig({ withdrawalApprovalDelayHours: value })} />
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel title="池子走勢" icon={<Activity size={18} />}>
              <div className="grid gap-4 lg:grid-cols-2">
                <LineChart title="遊戲金庫 / 收益寶獎金池" history={state.history} lines={[
                  { key: "gameBankroll", label: "遊戲金庫", color: "#38bdf8" },
                  { key: "bonusPool", label: "獎金池", color: "#34d399" },
                ]} />
                <LineChart title="鎖倉本金 / 可提款 / 待提款" history={state.history} lines={[
                  { key: "lockedPrincipal", label: "鎖倉本金", color: "#a78bfa" },
                  { key: "userWithdrawableBalance", label: "可提款", color: "#38bdf8" },
                  { key: "pendingWithdrawals", label: "待提款", color: "#fbbf24" },
                ]} />
                <LineChart title="平台收益 / 流動性 / 逾期未付提款" history={state.history} lines={[
                  { key: "platformRevenue", label: "平台收益", color: "#fbbf24" },
                  { key: "platformLiquidity", label: "平台流動性", color: "#22c55e" },
                  { key: "withdrawalShortfall", label: "逾期未付", color: "#f87171" },
                ]} />
                <LineChart title="即時 APY / 實現 APY" history={state.history} lines={[
                  { key: "instantApyPercent", label: "即時 APY", color: "#34d399" },
                  { key: "realizedApyPercent", label: "實現 APY", color: "#a78bfa" },
                ]} />
              </div>
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
                          <td className={scenario.summary.withdrawalShortfall > 0 ? "px-3 py-2 font-mono text-red-300" : "px-3 py-2 font-mono text-zinc-200"}>${formatMoney(scenario.summary.withdrawalShortfall)}</td>
                          <td className={scenario.isHealthy ? "px-3 py-2 text-emerald-300" : "px-3 py-2 text-amber-300"}>{scenario.isHealthy ? "健康" : "未達門檻"}</td>
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
                  <p className="mt-3 text-3xl font-semibold text-white">{feeSweep.recommendedFeePercent}%</p>
                    <p className="mt-2 text-sm text-zinc-400">規則：即時 APY 高於門檻、逾期未付為 0、金庫無警告時，選平台收益最高的抽成。</p>
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
                  ) : null}
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Panel title="遊戲與本金設定" icon={<Vault size={18} />}>
            <div className="grid gap-4">
              <RangeField label="猜硬幣比例" value={safeConfig.coinFlipPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => updateConfig({ coinFlipPercent: value })} />
              <RangeField label="骰子比例" value={safeConfig.dicePercent} min={0} max={100} step={5} suffix="%" onChange={(value) => updateConfig({ dicePercent: value })} />
              <RangeField label="幸運轉盤比例" value={safeConfig.luckySpinPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => updateConfig({ luckySpinPercent: value })} />
              <NumberField label="玩家本金下限" value={safeConfig.capitalMin} min={0} max={10000} step={10} onChange={(value) => updateConfig({ capitalMin: value })} />
              <NumberField label="玩家本金上限" value={safeConfig.capitalMax} min={0} max={20000} step={10} onChange={(value) => updateConfig({ capitalMax: value })} />
              <NumberField label="下注下限" value={safeConfig.betSizeMin} min={0} max={1000} step={1} onChange={(value) => updateConfig({ betSizeMin: value })} />
              <NumberField label="下注上限" value={safeConfig.betSizeMax} min={0} max={5000} step={1} onChange={(value) => updateConfig({ betSizeMax: value })} />
              <ReadOnlyRow label="已支付提款" value={`$${formatMoney(summary.withdrawalsPaid)}`} />
              <ReadOnlyRow label="實現 APY" value={`${formatPercent(summary.realizedApyPercent)}%`} />
            </div>
          </Panel>

          <Panel title="事件流" icon={<Activity size={18} />}>
            <div className="grid gap-2">
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

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function RangeField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="font-mono text-sm text-zinc-100">{value}{suffix}</span>
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

function LineChart({ title, history, lines }: { title: string; history: SimulatorHistoryPoint[]; lines: { key: keyof SimulatorHistoryPoint; label: string; color: string }[] }) {
  const width = 640;
  const height = 220;
  const padding = 20;
  const values = history.flatMap((point) => lines.map((line) => Number(point[line.key])));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;

  function pathFor(key: keyof SimulatorHistoryPoint) {
    if (history.length < 2) return "";
    return history.map((point, index) => {
      const x = padding + (index / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - ((Number(point[key]) - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <div className="flex flex-wrap gap-3">
          {lines.map((line) => (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500" key={line.key}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
            </span>
          ))}
        </div>
      </div>
      <svg className="h-[220px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#27272a" />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#27272a" />
        {history.length < 2 ? (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#71717a" fontSize="14">等待模擬資料</text>
        ) : lines.map((line) => (
          <path d={pathFor(line.key)} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" key={line.key} />
        ))}
      </svg>
    </div>
  );
}

function EventRow({ event }: { event: SimulatorEvent }) {
  return (
    <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 sm:grid-cols-[88px_1fr_minmax(180px,280px)] sm:items-center">
      <span className="font-mono text-xs text-zinc-500">T+{event.tick}</span>
      <div>
        <p className="text-sm font-medium text-zinc-100">{event.title}</p>
        <p className="mt-1 text-xs text-zinc-500">{event.detail}</p>
      </div>
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
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
