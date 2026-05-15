"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ExternalLink, KeyRound, Loader2, Shield, Wallet } from "lucide-react";
import Link from "next/link";

type UserState = {
  id: number;
  tgId: string;
  walletAddress: string | null;
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

type MeResponse = {
  user: UserState;
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  config: {
    vaultAddress: string | null;
    usdtAddress: string | null;
    network: string;
  };
};

declare global {
  interface Window {
    ethereum?: {
      request: (params: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const TOKEN_KEY = "web_mvp_session_token";

function formatUsdt(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function shortAddress(value: string | null | undefined) {
  if (!value) return "Not bound";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function walletBindingMessage(tgId: string, walletAddress: string) {
  return `Bind wallet ${walletAddress.toLowerCase()} to Telegram user ${tgId}`;
}

function vaultStatusMessage(data: MeResponse | null) {
  if (!data) return "Sign in first to load VaultManager settings from the API.";
  if (!data.config.vaultAddress) {
    return "VAULT_ADDRESS is not configured on the server. Set it before true BSC Testnet deposit validation.";
  }
  return `VaultManager address: ${data.config.vaultAddress}`;
}

export default function WebValidationDashboard() {
  const [token, setToken] = useState("");
  const [tgId, setTgId] = useState("test_user_001");
  const [data, setData] = useState<MeResponse | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

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
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload as T;
  }

  async function login(role: "user" | "admin") {
    setLoading(true);
    setStatus("");
    try {
      const payload = await requestJson<{ token: string }>("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgId, role }),
      });
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      setStatus(role === "admin" ? "Admin dev session ready." : "User dev session ready.");
      await loadMe(payload.token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }

  async function bindWallet() {
    if (!data?.user) {
      setStatus("Sign in with User dev login before binding a wallet.");
      return;
    }
    if (!window.ethereum) {
      setStatus("MetaMask is not available in this browser. Install the extension or open this page inside MetaMask browser.");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("No wallet account selected in MetaMask.");
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [walletBindingMessage(data.user.tgId, walletAddress), walletAddress],
      }) as string;

      await requestJson("/api/auth/bind-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ walletAddress, signature }),
      });
      setStatus("Wallet bound. Any pending deposits for this address will be resolved.");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet binding failed");
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
      setStatus("Withdrawal request submitted for admin review.");
      await loadMe();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Withdrawal request failed");
    } finally {
      setLoading(false);
    }
  }

  const user = data?.user;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-400">Web validation MVP</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">BSC GameFi 資金流驗證</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user?.isAdmin ? (
              <Link className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/admin">
                <Shield size={16} /> Admin
              </Link>
            ) : null}
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => loadMe()} disabled={!token || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />} Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Dev Login</h2>
            <p className="mt-1 text-sm text-zinc-400">用瀏覽器模擬 Telegram tgId，先驗證資金流程。</p>
            <label className="mt-5 block text-sm text-zinc-300" htmlFor="tgId">Test tgId</label>
            <input
              id="tgId"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={tgId}
              onChange={(event) => setTgId(event.target.value)}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500" onClick={() => login("user")} disabled={loading}>
                <KeyRound size={16} /> User
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500" onClick={() => login("admin")} disabled={loading}>
                <Shield size={16} /> Admin
              </button>
            </div>
            {status ? <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">{status}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Internal balance" value={`$${formatUsdt(user?.balanceUsdt)}`} />
            <Metric label="Pending withdrawals" value={`$${formatUsdt(user?.pendingWithdrawalTotal)}`} />
            <Metric label="Available balance" value={`$${formatUsdt(user?.availableBalanceUsdt)}`} tone="green" />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Wallet and Deposit</h2>
                <p className="mt-1 text-sm text-zinc-400">綁定錢包後，將 BSC Testnet USDT approve 並 deposit 到 VaultManager。</p>
              </div>
              <Wallet className="text-emerald-400" size={22} />
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="tgId" value={user?.tgId || "-"} />
              <Row label="Wallet" value={shortAddress(user?.walletAddress)} />
              <Row label="Network" value={data?.config.network || "BSC Testnet"} />
              <Row label="USDT" value={shortAddress(data?.config.usdtAddress)} />
              <Row label="VaultManager" value={shortAddress(data?.config.vaultAddress)} />
            </dl>
            <button className="mt-5 inline-flex items-center gap-2 rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60" onClick={bindWallet} disabled={loading}>
              <Wallet size={16} /> Bind wallet signature
            </button>
            <p className={data?.config.vaultAddress ? "mt-4 text-xs leading-5 text-zinc-500" : "mt-4 text-xs leading-5 text-amber-300"}>
              {vaultStatusMessage(data)}
            </p>
          </div>

          <form className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5" onSubmit={requestWithdrawal}>
            <h2 className="text-base font-semibold text-white">Withdrawal Request</h2>
            <p className="mt-1 text-sm text-zinc-400">送出後會進入 Admin 審核，pending 金額會佔用可提餘額。</p>
            <label className="mt-5 block text-sm text-zinc-300" htmlFor="withdrawAmount">Amount USDT</label>
            <input
              id="withdrawAmount"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="10"
            />
            <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500" disabled={!user?.walletAddress || loading}>
              <ArrowDownToLine size={16} /> Submit
            </button>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ActivityTable title="Recent Transactions" items={data?.transactions || []} />
          <ActivityTable title="Withdrawal Requests" items={data?.withdrawals || []} />
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

function ActivityTable({ title, items }: { title: string; items: Array<Transaction | Withdrawal> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Hash</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-zinc-500" colSpan={4}>No records</td></tr>
            ) : items.map((item) => (
              <tr className="border-t border-zinc-800" key={`${title}-${item.id}`}>
                <td className="px-5 py-3 text-zinc-200">{"type" in item ? item.type : "WITHDRAW"}</td>
                <td className="px-5 py-3 font-mono text-zinc-200">${formatUsdt(item.amount)}</td>
                <td className="px-5 py-3 text-zinc-400">{item.status}</td>
                <td className="px-5 py-3 text-zinc-500">
                  {item.txHash ? <span className="inline-flex items-center gap-1">{shortAddress(item.txHash)} <ExternalLink size={12} /></span> : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
