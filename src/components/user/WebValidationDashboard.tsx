"use client";

import React, { useEffect, useState } from "react";
import { Home, Loader2, RefreshCw, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { encodeFunctionData, formatUnits, parseAbi, parseUnits } from "viem";
import { translateUiError } from "@/lib/ui-labels";

type UserState = {
  id: number;
  walletAddress: string;
  balanceUsdt: string;
  pendingWithdrawalTotal: string;
  availableBalanceUsdt: string;
  isAdmin: boolean;
};

type MeResponse = {
  user: UserState;
  config: {
    vaultAddress: string | null;
    usdtAddress: string | null;
    network: string;
  };
};

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
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

function walletLoginMessage(walletAddress: string) {
  return `Sign in to BSC GameFi Web with wallet ${walletAddress.toLowerCase()}`;
}

function vaultStatusMessage(data: MeResponse | null) {
  if (!data) return "請先登入錢包，系統會從 API 載入合約設定。";
  if (!data.config.usdtAddress) return "伺服器尚未設定 USDT_ADDRESS，無法充值 MockUSDT。";
  return `MockUSDT 位址：${data.config.usdtAddress}`;
}

export default function WebValidationDashboard() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<MeResponse | null>(null);
  const [mintAmount, setMintAmount] = useState("1000");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [depositAllowance, setDepositAllowance] = useState("0");
  const [lastTxHash, setLastTxHash] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function clearStoredSession() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setData(null);
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
    if (!window.ethereum) {
      throw new Error("此瀏覽器沒有可用的 MetaMask。");
    }
    return window.ethereum.request({ method, params }) as Promise<T>;
  }

  async function signInWithWallet() {
    setLoading(true);
    setStatus("");
    try {
      if (!window.ethereum) {
        throw new Error("此瀏覽器沒有可用的 MetaMask。");
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("MetaMask 尚未選擇錢包帳戶。");
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [walletLoginMessage(walletAddress), walletAddress],
      }) as string;

      const payload = await requestJson<{ token: string; resolvedDeposits: number }>("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature }),
      });
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      setStatus(payload.resolvedDeposits > 0 ? `錢包登入完成，已解析 ${payload.resolvedDeposits} 筆待處理入金。` : "錢包登入完成。");
      await loadMe(payload.token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登入失敗");
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
    } catch (error) {
      if (shouldClearSession(error)) clearStoredSession();
      setStatus(error instanceof Error ? error.message : "載入帳戶失敗");
    } finally {
      setLoading(false);
    }
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

    setTokenBalance(formatUnits(BigInt(balanceHex), TOKEN_DECIMALS));
    setDepositAllowance(formatUnits(BigInt(allowanceHex), TOKEN_DECIMALS));
  }

  async function sendWalletTransaction(to: string, data: `0x${string}`) {
    const accounts = await walletRequest<string[]>("eth_requestAccounts");
    const from = accounts[0];
    if (!from) throw new Error("MetaMask 尚未選擇錢包帳戶。");
    return walletRequest<string>("eth_sendTransaction", [{ from, to, data }]);
  }

  async function mintTestUsdt() {
    const walletAddress = data?.user.walletAddress;
    const usdtAddress = data?.config.usdtAddress;
    if (!walletAddress || !usdtAddress) {
      setStatus("請先登入錢包，並確認 USDT_ADDRESS 已設定。");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const amount = parseUnits(mintAmount || "0", TOKEN_DECIMALS);
      if (amount <= 0n) throw new Error("鑄造數量必須大於 0。");
      const txHash = await sendWalletTransaction(usdtAddress, encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "mint",
        args: [walletAddress as `0x${string}`, amount],
      }));
      setLastTxHash(txHash);
      setStatus("MockUSDT 充值交易已送出，確認後請刷新代幣狀態。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "充值 MockUSDT 失敗");
    } finally {
      setLoading(false);
    }
  }

  const user = data?.user;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-400">Debug 工具頁</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">MockUSDT 測試充值</h1>
            <p className="mt-2 text-sm text-zinc-400">只保留測試用工具；正式入金、提現與遊戲操作請回首頁使用。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/">
              <Home size={16} /> 回首頁
            </Link>
            {user?.isAdmin ? (
              <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/admin">
                <Shield size={16} /> 後台
              </Link>
            ) : null}
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => loadMe()} disabled={!token || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 刷新
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-base font-semibold text-white">錢包登入</h2>
            <p className="mt-1 text-sm text-zinc-400">Debug 工具仍需要錢包簽名，才能知道要充值到哪個地址。</p>
            <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={signInWithWallet} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />} 錢包簽名登入
            </button>
            {status ? <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">{status}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="鏈上 MockUSDT" value={`$${formatUsdt(tokenBalance)}`} tone="green" />
            <Metric label="VaultManager 授權額度" value={`$${formatUsdt(depositAllowance)}`} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Debug 狀態</h2>
                <p className="mt-1 text-sm text-zinc-400">檢查目前登入錢包、網路與測試合約設定。</p>
              </div>
              <Wallet className="text-emerald-400" size={22} />
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="錢包" value={shortAddress(user?.walletAddress)} />
              <Row label="網路" value={data?.config.network || "BSC Testnet"} />
              <Row label="USDT" value={shortAddress(data?.config.usdtAddress)} />
              <Row label="VaultManager" value={shortAddress(data?.config.vaultAddress)} />
            </dl>
            <p className={data?.config.vaultAddress ? "mt-4 text-xs leading-5 text-zinc-500" : "mt-4 text-xs leading-5 text-amber-300"}>
              {vaultStatusMessage(data)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => loadTokenState()} disabled={!user?.walletAddress || loading}>
                <RefreshCw size={15} /> 刷新代幣狀態
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-base font-semibold text-white">充值 MockUSDT</h2>
            <p className="mt-1 text-sm text-zinc-400">呼叫 MockUSDT 的 <span className="font-mono text-zinc-200">function mint(address to, uint256 amount)</span>，直接把測試幣打到目前登入錢包。</p>
            <label className="mt-5 block text-sm text-zinc-300" htmlFor="mintAmount">充值數量 USDT</label>
            <input
              id="mintAmount"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              inputMode="decimal"
              value={mintAmount}
              onChange={(event) => setMintAmount(event.target.value)}
              placeholder="1000"
            />
            <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={mintTestUsdt} disabled={!user?.walletAddress || loading}>
              充值到目前錢包
            </button>
            {lastTxHash ? <p className="mt-4 break-all text-xs text-zinc-500">最後交易：{lastTxHash}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={tone === "green" ? "mt-2 text-2xl font-semibold text-emerald-300" : "mt-2 text-2xl font-semibold text-white"}>{value}</p>
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
