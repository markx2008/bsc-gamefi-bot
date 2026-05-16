"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Shield,
  Timer,
  Trophy,
  Vault,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { encodeFunctionData, formatUnits, parseAbi, parseUnits } from "viem";
import { statusLabel, transactionTypeLabel, translateUiError } from "@/lib/ui-labels";

type UserState = {
  id: number;
  walletAddress: string;
  balanceUsdt: string;
  pendingWithdrawalTotal: string;
  availableBalanceUsdt: string;
  isAdmin: boolean;
};

type Transaction = {
  id: number;
  type: string;
  amount: string;
  status: string;
  txHash: string | null;
  createdAt: string;
};

type Withdrawal = {
  id: number;
  amount: string;
  walletAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
};

type GameRound = {
  id: number;
  game: string;
  betAmount: string;
  playerChoice: string;
  outcome: string;
  result: string;
  payoutAmount: string;
  userBalanceDelta: string;
  houseProfit: string;
  serverSeedHash: string | null;
  serverSeed: string | null;
  clientSeed: string | null;
  nonce: number | null;
  randomDigest: string | null;
  createdAt: string;
};

type EarnPosition = {
  id: number;
  principal: string;
  status: string;
  lockedAt: string;
  unlockAt: string;
  redeemedAt: string | null;
  externalYieldAmount: string;
  bonusPoolRewardAmount: string;
  rewardAmount: string;
};

type EarnResponse = {
  positions: EarnPosition[];
  summary: {
    lockedPrincipal: string;
    activeCount: number;
    redeemablePrincipal: string;
    redeemableCount: number;
    earnBonusPool: string;
  };
  config: {
    lockDays: number;
    minLockAmount: number;
    apyCapPercent: number;
    externalApyPercent: number;
  };
};

type MeResponse = {
  user: UserState;
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  gameRounds: GameRound[];
  fairness: {
    nextServerSeedHash: string;
    nextNonce: number;
  };
  config: {
    vaultAddress: string | null;
    usdtAddress: string | null;
    network: string;
  };
};

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const VAULT_ABI = parseAbi([
  "function deposit(uint256 amount)",
]);

declare global {
  interface Window {
    ethereum?: {
      request: (params: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const TOKEN_KEY = "web_mvp_session_token";
const TOKEN_DECIMALS = 18;

function formatUsdt(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function shortAddress(value: string | null | undefined) {
  if (!value) return "未連線";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortHash(value: string | null | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function formatSignedUsdt(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (numeric > 0) return `+$${formatUsdt(numeric)}`;
  if (numeric < 0) return `-$${formatUsdt(Math.abs(numeric))}`;
  return "$0";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoinSide(value: string) {
  return value === "HEADS" ? "正面" : "反面";
}

function formatDiceSide(value: string) {
  return value === "LOW" ? "小" : "大";
}

function formatGameRoundDetail(round: GameRound) {
  if (round.game === "COIN_FLIP") return `猜硬幣 ${formatCoinSide(round.playerChoice)} / ${formatCoinSide(round.outcome)}`;
  if (round.game === "DICE") return `骰子 ${formatDiceSide(round.playerChoice)} / ${round.outcome} 點`;
  if (round.game === "LUCKY_SPIN") return `幸運轉盤 ${formatLuckySpinSegment(round.outcome)}`;
  return round.game;
}

function formatLuckySpinSegment(value: string) {
  const labels: Record<string, string> = {
    JACKPOT: "頭獎",
    BIG_WIN: "大獎",
    SMALL_WIN: "小獎",
    MISS: "落空",
  };
  return labels[value] || value;
}

function formatGameResult(value: string) {
  return value === "PLAYER_WIN" ? "玩家獲勝" : "莊家獲勝";
}

function walletLoginMessage(walletAddress: string) {
  return `Sign in to BSC GameFi Web with wallet ${walletAddress.toLowerCase()}`;
}

function configStatus(data: MeResponse | null) {
  if (!data) return "連接錢包後載入合約設定。";
  if (!data.config.vaultAddress || !data.config.usdtAddress) return "合約設定尚未完整。";
  return `${data.config.network} 已就緒`;
}

export default function UserDashboard() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<MeResponse | null>(null);
  const [earnData, setEarnData] = useState<EarnResponse | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [earnAmount, setEarnAmount] = useState("10");
  const [coinFlipAmount, setCoinFlipAmount] = useState("10");
  const [coinFlipChoice, setCoinFlipChoice] = useState<"HEADS" | "TAILS">("HEADS");
  const [lastGameRound, setLastGameRound] = useState<GameRound | null>(null);
  const [diceAmount, setDiceAmount] = useState("10");
  const [diceChoice, setDiceChoice] = useState<"LOW" | "HIGH">("LOW");
  const [lastDiceRound, setLastDiceRound] = useState<GameRound | null>(null);
  const [luckySpinAmount, setLuckySpinAmount] = useState("10");
  const [lastLuckySpinRound, setLastLuckySpinRound] = useState<GameRound | null>(null);
  const [clientSeed, setClientSeed] = useState("default");
  const [chainBalance, setChainBalance] = useState("0");
  const [depositAllowance, setDepositAllowance] = useState("0");
  const [lastTxHash, setLastTxHash] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  function clearStoredSession() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setData(null);
    setEarnData(null);
  }

  function shouldClearSession(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    return message.includes("Invalid") || message.includes("Unauthorized") || message.includes("Session") || message.includes("User not found")
      || message.includes("無效") || message.includes("未授權") || message.includes("已過期") || message.includes("找不到使用者");
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY);
    if (savedToken) setToken(savedToken);
  }, []);

  useEffect(() => {
    if (token) void loadMe(token);
  }, [token]);

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = await response.json();
    if (!response.ok) throw new Error(translateUiError(payload.error || "請求失敗"));
    return payload as T;
  }

  async function walletRequest<T>(method: string, params?: unknown[]): Promise<T> {
    if (!window.ethereum) throw new Error("此瀏覽器沒有可用的 MetaMask。");
    return window.ethereum.request({ method, params }) as Promise<T>;
  }

  async function signInWithWallet() {
    setLoading(true);
    setStatus("");
    try {
      const accounts = await walletRequest<string[]>("eth_requestAccounts");
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("MetaMask 尚未選擇錢包帳戶。");
      const signature = await walletRequest<string>("personal_sign", [walletLoginMessage(walletAddress), walletAddress]);

      const payload = await requestJson<{ token: string; resolvedDeposits: number }>("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature }),
      });
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      setStatus(payload.resolvedDeposits > 0 ? `已解析 ${payload.resolvedDeposits} 筆待處理入金。` : "錢包已連接。");
      await loadMe(payload.token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "錢包登入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadMe(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    try {
      const payload = await requestJson<MeResponse>("/api/me", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      setData(payload);
      await loadTokenState(payload);
      await loadEarn(activeToken);
    } catch (error) {
      if (shouldClearSession(error)) clearStoredSession();
      setStatus(error instanceof Error ? error.message : "載入帳戶失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadEarn(activeToken = token) {
    if (!activeToken) return;
    const payload = await requestJson<EarnResponse>("/api/earn/positions", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    setEarnData(payload);
  }

  async function readContractString(to: string, data: `0x${string}`) {
    return walletRequest<string>("eth_call", [{ to, data }, "latest"]);
  }

  async function loadTokenState(snapshot = data) {
    const walletAddress = snapshot?.user.walletAddress;
    const usdtAddress = snapshot?.config.usdtAddress;
    const vaultAddress = snapshot?.config.vaultAddress;
    if (!walletAddress || !usdtAddress || !vaultAddress || !window.ethereum) return;

    const [balanceHex, allowanceHex] = await Promise.all([
      readContractString(usdtAddress, encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      })),
      readContractString(usdtAddress, encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [walletAddress as `0x${string}`, vaultAddress as `0x${string}`],
      })),
    ]);

    setChainBalance(formatUnits(BigInt(balanceHex), TOKEN_DECIMALS));
    setDepositAllowance(formatUnits(BigInt(allowanceHex), TOKEN_DECIMALS));
  }

  async function sendWalletTransaction(to: string, data: `0x${string}`) {
    const accounts = await walletRequest<string[]>("eth_requestAccounts");
    const from = accounts[0];
    if (!from) throw new Error("MetaMask 尚未選擇錢包帳戶。");
    return walletRequest<string>("eth_sendTransaction", [{ from, to, data }]);
  }

  async function approveDeposit() {
    const usdtAddress = data?.config.usdtAddress;
    const vaultAddress = data?.config.vaultAddress;
    if (!usdtAddress || !vaultAddress) {
      setStatus("授權前需要先設定 USDT_ADDRESS 與 VAULT_ADDRESS。");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const amount = parseUnits(depositAmount || "0", TOKEN_DECIMALS);
      if (amount <= 0n) throw new Error("入金數量必須大於 0。");
      const txHash = await sendWalletTransaction(usdtAddress, encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress as `0x${string}`, amount],
      }));
      setLastTxHash(txHash);
      setStatus("授權交易已送出，確認後請刷新代幣狀態。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "授權失敗");
    } finally {
      setLoading(false);
    }
  }

  async function submitDeposit() {
    const vaultAddress = data?.config.vaultAddress;
    if (!vaultAddress) {
      setStatus("入金前需要先設定 VAULT_ADDRESS。");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const amount = parseUnits(depositAmount || "0", TOKEN_DECIMALS);
      if (amount <= 0n) throw new Error("入金數量必須大於 0。");
      const txHash = await sendWalletTransaction(vaultAddress, encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amount],
      }));
      setLastTxHash(txHash);
      setStatus("VaultManager 入金交易已送出，監聽器入帳後請刷新。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "入金失敗");
    } finally {
      setLoading(false);
    }
  }

  async function requestWithdrawal(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      await requestJson("/api/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount: withdrawAmount }),
      });
      setWithdrawAmount("");
      setStatus("提現申請已送出，等待管理員審核。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提現申請失敗");
    } finally {
      setLoading(false);
    }
  }

  async function lockEarn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      await requestJson("/api/earn/lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount: earnAmount }),
      });
      setEarnAmount("10");
      setStatus("收益寶鎖倉已建立。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "收益寶鎖倉失敗");
    } finally {
      setLoading(false);
    }
  }

  async function redeemEarn(positionId: number) {
    setLoading(true);
    setStatus("");
    try {
      await requestJson("/api/earn/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ positionId }),
      });
      setStatus("收益寶本金與分紅已回到可提款餘額。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "收益寶領回失敗");
    } finally {
      setLoading(false);
    }
  }

  async function playCoinFlip() {
    setLoading(true);
    setStatus("");
    try {
      const payload = await requestJson<{ round: GameRound }>("/api/games/coin-flip/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount: coinFlipAmount, choice: coinFlipChoice, clientSeed }),
      });
      setLastGameRound(payload.round);
      setStatus(payload.round.result === "PLAYER_WIN" ? "猜硬幣結算：玩家獲勝。" : "猜硬幣結算：莊家獲勝。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "猜硬幣下注失敗");
    } finally {
      setLoading(false);
    }
  }

  async function playDice() {
    setLoading(true);
    setStatus("");
    try {
      const payload = await requestJson<{ round: GameRound }>("/api/games/dice/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount: diceAmount, choice: diceChoice, clientSeed }),
      });
      setLastDiceRound(payload.round);
      setStatus(payload.round.result === "PLAYER_WIN" ? "骰子結算：玩家獲勝。" : "骰子結算：莊家獲勝。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "骰子下注失敗");
    } finally {
      setLoading(false);
    }
  }

  async function playLuckySpin() {
    setLoading(true);
    setStatus("");
    try {
      const payload = await requestJson<{ round: GameRound }>("/api/games/lucky-spin/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount: luckySpinAmount, clientSeed }),
      });
      setLastLuckySpinRound(payload.round);
      setStatus(payload.round.result === "PLAYER_WIN" ? "幸運轉盤結算：玩家獲勝。" : "幸運轉盤結算：莊家獲勝。");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "幸運轉盤下注失敗");
    } finally {
      setLoading(false);
    }
  }

  const user = data?.user;
  const recentActivity = [
    ...(data?.transactions || []).map((item) => ({ id: `tx-${item.id}`, type: item.type, amount: item.amount, status: item.status, txHash: item.txHash })),
    ...(data?.withdrawals || []).map((item) => ({ id: `wd-${item.id}`, type: "WITHDRAW", amount: item.amount, status: item.status, txHash: item.txHash })),
  ].slice(0, 8);
  const earnPositions = earnData?.positions || [];
  const activeEarnPositions = earnPositions.filter((position) => position.status === "ACTIVE");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-400">BSC GameFi</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">使用者儀表板</h1>
            <p className="mt-2 text-sm text-zinc-400">{user ? shortAddress(user.walletAddress) : configStatus(data)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user?.isAdmin ? (
              <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/admin">
                <Shield size={16} /> 後台
              </Link>
            ) : null}
            <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/test">
              <History size={16} /> 測試頁
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/simulator">
              <BarChart3 size={16} /> 試算頁
            </Link>
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => loadMe()} disabled={!token || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 刷新
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={signInWithWallet} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />} {user ? "切換錢包" : "登入"}
            </button>
          </div>
        </header>

        {status ? <p className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">{status}</p> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="內部餘額" value={`$${formatUsdt(user?.balanceUsdt)}`} detail="可用於遊戲與提現" />
          <Metric label="可用餘額" value={`$${formatUsdt(user?.availableBalanceUsdt)}`} detail="扣除待審提現後" tone="green" />
          <Metric label="待審提現" value={`$${formatUsdt(user?.pendingWithdrawalTotal)}`} detail="等待管理員審核" />
          <Metric label="鏈上餘額" value={`$${formatUsdt(chainBalance)}`} detail="目前錢包的 MockUSDT" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">資金</h2>
                <p className="mt-1 text-sm text-zinc-400">從錢包存入內部餘額，之後可送出提現申請等待後台審核。</p>
              </div>
              <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400">{configStatus(data)}</span>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <dl className="space-y-3 text-sm">
                  <Row label="網路" value={data?.config.network || "BSC Testnet"} />
                  <Row label="錢包" value={shortAddress(user?.walletAddress)} />
                  <Row label="USDT" value={shortAddress(data?.config.usdtAddress)} />
                  <Row label="VaultManager" value={shortAddress(data?.config.vaultAddress)} />
                  <Row label="授權額度" value={`$${formatUsdt(depositAllowance)}`} />
                </dl>
              </div>
              <div className="grid gap-4">
                <label className="block text-sm text-zinc-300" htmlFor="depositAmount">入金數量 USDT</label>
                <input
                  id="depositAmount"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="10"
                />
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => loadTokenState()} disabled={!user?.walletAddress || loading}>
                    <RefreshCw size={15} /> 代幣狀態
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={approveDeposit} disabled={!user?.walletAddress || loading}>
                    授權
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={submitDeposit} disabled={!user?.walletAddress || loading}>
                    存入 VaultManager
                  </button>
                </div>
                {lastTxHash ? <p className="break-all text-xs text-zinc-500">最後交易：{lastTxHash}</p> : null}
              </div>
            </div>
          </div>

          <form className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5" onSubmit={requestWithdrawal}>
            <h2 className="text-base font-semibold text-white">提現</h2>
            <p className="mt-1 text-sm text-zinc-400">提現申請會佔用可用餘額，直到管理員完成審核。</p>
            <label className="mt-5 block text-sm text-zinc-300" htmlFor="withdrawAmount">提現數量 USDT</label>
            <input
              id="withdrawAmount"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="10"
            />
            <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={!user?.walletAddress || loading}>
              <ArrowDownToLine size={16} /> 送出申請
            </button>
          </form>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">遊戲</h2>
                <p className="mt-1 text-sm text-zinc-400">遊戲會使用內部餘額下注，並在平台帳本內結算。</p>
              </div>
              <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400">MVP</span>
            </div>
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr] lg:items-end">
                <label className="block text-sm text-zinc-300" htmlFor="clientSeed">
                  Client Seed
                  <input
                    id="clientSeed"
                    className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    value={clientSeed}
                    onChange={(event) => setClientSeed(event.target.value)}
                    maxLength={128}
                  />
                </label>
                <div className="text-xs text-zinc-500">
                  <p>下一局 Server Seed Hash</p>
                  <p className="mt-1 break-all font-mono text-zinc-300">{data?.fairness?.nextServerSeedHash || "-"}</p>
                  <p className="mt-1">Nonce：{data?.fairness?.nextNonce ?? "-"}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">猜硬幣</h3>
                    <p className="mt-1 text-xs text-zinc-500">選擇正面或反面，以內部餘額下注並立即結算。</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-24"
                      inputMode="decimal"
                      value={coinFlipAmount}
                      onChange={(event) => setCoinFlipAmount(event.target.value)}
                      aria-label="猜硬幣下注金額"
                    />
                    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-zinc-700">
                      <button
                        className={coinFlipChoice === "HEADS" ? "bg-emerald-700 px-3 py-2 text-sm text-white" : "px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"}
                        onClick={() => setCoinFlipChoice("HEADS")}
                        type="button"
                      >
                        正面
                      </button>
                      <button
                        className={coinFlipChoice === "TAILS" ? "bg-emerald-700 px-3 py-2 text-sm text-white" : "px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"}
                        onClick={() => setCoinFlipChoice("TAILS")}
                        type="button"
                      >
                        反面
                      </button>
                    </div>
                    <button
                      className="inline-flex min-w-[96px] items-center justify-center rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={playCoinFlip}
                      disabled={!user?.walletAddress || loading}
                      type="button"
                    >
                      下注
                    </button>
                  </div>
                </div>
                {lastGameRound ? (
                  <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                    <span>結果：{formatCoinSide(lastGameRound.outcome)}</span>
                    <span>輸贏：{formatGameResult(lastGameRound.result)}</span>
                    <span>餘額變化：{formatSignedUsdt(lastGameRound.userBalanceDelta)}</span>
                    <FairnessProof round={lastGameRound} />
                  </div>
                ) : null}
              </div>
              <div className="px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">骰子</h3>
                    <p className="mt-1 text-xs text-zinc-500">選擇小或大，擲出 1-3 為小、4-6 為大。</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-24"
                      inputMode="decimal"
                      value={diceAmount}
                      onChange={(event) => setDiceAmount(event.target.value)}
                      aria-label="骰子下注金額"
                    />
                    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-zinc-700">
                      <button
                        className={diceChoice === "LOW" ? "bg-emerald-700 px-3 py-2 text-sm text-white" : "px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"}
                        onClick={() => setDiceChoice("LOW")}
                        type="button"
                      >
                        小
                      </button>
                      <button
                        className={diceChoice === "HIGH" ? "bg-emerald-700 px-3 py-2 text-sm text-white" : "px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"}
                        onClick={() => setDiceChoice("HIGH")}
                        type="button"
                      >
                        大
                      </button>
                    </div>
                    <button
                      className="inline-flex min-w-[96px] items-center justify-center rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={playDice}
                      disabled={!user?.walletAddress || loading}
                      type="button"
                    >
                      下注
                    </button>
                  </div>
                </div>
                {lastDiceRound ? (
                  <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                    <span>點數：{lastDiceRound.outcome}</span>
                    <span>輸贏：{formatGameResult(lastDiceRound.result)}</span>
                    <span>餘額變化：{formatSignedUsdt(lastDiceRound.userBalanceDelta)}</span>
                    <FairnessProof round={lastDiceRound} />
                  </div>
                ) : null}
              </div>
              <div className="px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">幸運轉盤</h3>
                    <p className="mt-1 text-xs text-zinc-500">高波動玩法，下注前會先檢查遊戲金庫是否能承受頭獎。</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-24"
                      inputMode="decimal"
                      value={luckySpinAmount}
                      onChange={(event) => setLuckySpinAmount(event.target.value)}
                      aria-label="幸運轉盤下注金額"
                    />
                    <button
                      className="inline-flex min-w-[96px] items-center justify-center rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={playLuckySpin}
                      disabled={!user?.walletAddress || loading}
                      type="button"
                    >
                      轉動
                    </button>
                  </div>
                </div>
                {lastLuckySpinRound ? (
                  <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                    <span>結果：{formatLuckySpinSegment(lastLuckySpinRound.outcome)}</span>
                    <span>輸贏：{formatGameResult(lastLuckySpinRound.result)}</span>
                    <span>餘額變化：{formatSignedUsdt(lastLuckySpinRound.userBalanceDelta)}</span>
                    <FairnessProof round={lastLuckySpinRound} />
                  </div>
                ) : null}
              </div>
            </div>
            {data?.gameRounds?.length ? (
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950">
                {data.gameRounds.slice(0, 3).map((round) => (
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2 text-xs last:border-b-0" key={round.id}>
                    <span className="text-zinc-400">{formatGameRoundDetail(round)}</span>
                    <span className={round.result === "PLAYER_WIN" ? "font-mono text-emerald-300" : "font-mono text-red-300"}>{formatSignedUsdt(round.userBalanceDelta)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">收益寶</h2>
                <p className="mt-1 text-sm text-zinc-400">鎖倉本金模擬投入外部 DeFi，外部收益回歸收益寶獎金池，到期後本金與分紅回到可提款餘額。</p>
              </div>
              <Vault className="text-sky-300" size={22} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric label={earnData ? `${earnData.config.lockDays} 天鎖倉` : "7 天鎖倉"} value={`APY cap ${formatUsdt(earnData?.config.apyCapPercent ?? 15)}%`} icon={<Timer size={16} />} />
              <MiniMetric label="外部 DeFi APY" value={`${formatUsdt(earnData?.config.externalApyPercent ?? 8)}%`} icon={<Trophy size={16} />} />
              <MiniMetric label="可投入資金" value={`$${formatUsdt(user?.availableBalanceUsdt)}`} icon={<Wallet size={16} />} />
              <MiniMetric label="鎖倉本金" value={`$${formatUsdt(earnData?.summary.lockedPrincipal)}`} icon={<Vault size={16} />} />
              <MiniMetric label="可領回本金" value={`$${formatUsdt(earnData?.summary.redeemablePrincipal)}`} icon={<ArrowDownToLine size={16} />} />
              <MiniMetric label="收益寶獎金池" value={`$${formatUsdt(earnData?.summary.earnBonusPool)}`} icon={<RefreshCw size={16} />} />
            </div>
            <form className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4" onSubmit={lockEarn}>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="block text-sm font-medium text-zinc-200" htmlFor="earnAmount">鎖倉收益寶 USDT</label>
                  <input
                    id="earnAmount"
                    className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    inputMode="decimal"
                    min={earnData?.config.minLockAmount ?? 10}
                    value={earnAmount}
                    onChange={(event) => setEarnAmount(event.target.value)}
                    placeholder={String(earnData?.config.minLockAmount ?? 10)}
                  />
                  <p className="mt-2 text-xs text-zinc-500">最低 ${formatUsdt(earnData?.config.minLockAmount ?? 10)}，可同時建立多筆部位。</p>
                </div>
                <button className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={!user?.walletAddress || loading}>
                  鎖倉收益寶
                </button>
              </div>
            </form>
            <div className="mt-5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-200">收益寶部位</p>
                <span className="text-xs text-zinc-500">{earnData?.summary.activeCount ?? 0} 筆鎖倉 / {earnData?.summary.redeemableCount ?? 0} 筆可領回</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {activeEarnPositions.length ? activeEarnPositions.map((position) => {
                  const redeemable = new Date(position.unlockAt).getTime() <= Date.now();
                  return (
                    <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center" key={position.id}>
                      <div>
                        <p className="font-mono text-zinc-100">${formatUsdt(position.principal)}</p>
                        <p className="mt-1 text-xs text-zinc-500">鎖倉 {formatDateTime(position.lockedAt)} / 到期 {formatDateTime(position.unlockAt)}</p>
                      </div>
                      <button
                        className={redeemable ? "rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60" : "rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-500 disabled:cursor-not-allowed"}
                        disabled={!redeemable || loading}
                        onClick={() => redeemEarn(position.id)}
                        type="button"
                      >
                        {redeemable ? "領回" : "未到期"}
                      </button>
                    </div>
                  );
                }) : (
                  <p className="px-4 py-8 text-center text-sm text-zinc-500">目前沒有收益寶鎖倉部位</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-base font-semibold text-white">近期活動</h2>
            <span className="text-xs text-zinc-500">交易與提現紀錄</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">類型</th>
                  <th className="px-5 py-3 font-medium">金額</th>
                  <th className="px-5 py-3 font-medium">狀態</th>
                  <th className="px-5 py-3 font-medium">交易雜湊</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length ? recentActivity.map((item) => (
                  <tr className="border-t border-zinc-800" key={item.id}>
                    <td className="px-5 py-3 text-zinc-200">{transactionTypeLabel(item.type)}</td>
                    <td className="px-5 py-3 font-mono text-zinc-200">${formatUsdt(item.amount)}</td>
                    <td className="px-5 py-3 text-zinc-400">{statusLabel(item.status)}</td>
                    <td className="px-5 py-3 text-zinc-500">
                      {item.txHash ? <span className="inline-flex items-center gap-1">{shortAddress(item.txHash)} <ExternalLink size={12} /></span> : "-"}
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-8 text-center text-zinc-500" colSpan={4}>尚無活動紀錄</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "green" }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={tone === "green" ? "mt-2 text-2xl font-semibold text-emerald-300" : "mt-2 text-2xl font-semibold text-white"}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function MiniMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between text-zinc-500">
        <p className="text-xs">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function FairnessProof({ round }: { round: GameRound }) {
  if (!round.serverSeedHash || !round.serverSeed || !round.clientSeed || !round.nonce || !round.randomDigest) return null;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 sm:col-span-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <span>Server Seed：<span className="font-mono text-zinc-300">{shortHash(round.serverSeed)}</span></span>
        <span>Hash：<span className="font-mono text-zinc-300">{shortHash(round.serverSeedHash)}</span></span>
        <span>Client Seed：<span className="font-mono text-zinc-300">{round.clientSeed}</span></span>
        <span>Nonce：<span className="font-mono text-zinc-300">{round.nonce}</span></span>
        <span className="sm:col-span-2">Digest：<span className="font-mono text-zinc-300">{shortHash(round.randomDigest)}</span></span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-200">{value}</dd>
    </div>
  );
}
