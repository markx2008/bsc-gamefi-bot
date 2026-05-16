"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, ShieldAlert, Users, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { statusLabel, transactionTypeLabel, translateUiError } from "@/lib/ui-labels";

type AdminOverview = {
  stats: {
    totalUsers: number;
    totalDeposits: string;
    totalWithdrawals: string;
    totalUserBalances: string;
    pendingWithdrawalTotal: string;
    pendingWithdrawalCount: number;
    availableLiquidity: string;
    gameBankroll: string;
    platformRevenue: string;
    earnBonusPool: string;
    earnActivePrincipal: string;
    earnActiveCount: number;
    earnRedeemablePrincipal: string;
    earnRedeemableCount: number;
    earnExternalYieldTotal: string;
  };
  pendingWithdrawals: Array<{
    id: number;
    amount: string;
    walletAddress: string;
    status: string;
    createdAt: string;
    user: {
      id: number;
      walletAddress: string;
      balanceUsdt: string;
    };
  }>;
  recentUsers: Array<{
    id: number;
    walletAddress: string;
    balanceUsdt: string;
    updatedAt: string;
  }>;
  recentTransactions: Array<{
    id: number;
    type: string;
    amount: string;
    status: string;
    txHash: string | null;
    createdAt: string;
    user: {
      id: number;
      walletAddress: string;
    };
  }>;
};

const TOKEN_KEY = "web_mvp_session_token";

declare global {
  interface Window {
    ethereum?: {
      request: (params: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

function formatUsdt(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function shortAddress(value: string | null | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function walletLoginMessage(walletAddress: string) {
  return `Sign in to BSC GameFi Web with wallet ${walletAddress.toLowerCase()}`;
}

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
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
    if (token) void loadOverview(token);
  }, [token]);

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = await response.json();
    if (!response.ok) throw new Error(translateUiError(payload.error || "請求失敗"));
    return payload as T;
  }

  async function loginAdmin() {
    setLoading(true);
    setStatus("");
    try {
      if (!window.ethereum) throw new Error("此瀏覽器沒有可用的 MetaMask。");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("MetaMask 尚未選擇錢包帳戶。");
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [walletLoginMessage(walletAddress), walletAddress],
      }) as string;

      const payload = await requestJson<{ token: string }>("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature }),
      });
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      await loadOverview(payload.token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "管理員登入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadOverview(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    setStatus("");
    try {
      const payload = await requestJson<AdminOverview>("/api/admin/overview", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      setOverview(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "載入後台總覽失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id: number, action: "approve" | "reject") {
    setLoading(true);
    setStatus("");
    try {
      await requestJson(`/api/admin/withdrawals/${id}/${action}`, {
        method: "POST",
        headers: authHeaders,
      });
      setStatus(action === "approve" ? "提現核准已送出。" : "提現已拒絕。");
      await loadOverview();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "審核失敗");
    } finally {
      setLoading(false);
    }
  }

  const stats = overview?.stats;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-400">營運後台</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">資金流營運後台</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" href="/">使用者頁</Link>
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={() => loadOverview()} disabled={!token || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 刷新
            </button>
            <button className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500" onClick={loginAdmin} disabled={loading}>管理員錢包登入</button>
          </div>
        </header>

        {status ? <p className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{status}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="總入金" value={`$${formatUsdt(stats?.totalDeposits)}`} icon={<Wallet size={20} />} />
          <Metric label="使用者負債" value={`$${formatUsdt(stats?.totalUserBalances)}`} icon={<ShieldAlert size={20} />} />
          <Metric label="待審提現" value={`$${formatUsdt(stats?.pendingWithdrawalTotal)}`} detail={`${stats?.pendingWithdrawalCount ?? 0} 筆申請`} icon={<RefreshCw size={20} />} />
          <Metric label="使用者數" value={String(stats?.totalUsers ?? 0)} detail={`可用流動性 $${formatUsdt(stats?.availableLiquidity)}`} icon={<Users size={20} />} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="遊戲金庫" value={`$${formatUsdt(stats?.gameBankroll)}`} detail="初始金庫 + 遊戲輸贏分錄" icon={<ShieldAlert size={20} />} />
          <Metric label="平台收益" value={`$${formatUsdt(stats?.platformRevenue)}`} detail="遊戲正利潤抽成" icon={<Wallet size={20} />} />
          <Metric label="收益寶獎金池" value={`$${formatUsdt(stats?.earnBonusPool)}`} detail="遊戲補貼與外部收益分錄" icon={<RefreshCw size={20} />} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="收益寶鎖倉本金" value={`$${formatUsdt(stats?.earnActivePrincipal)}`} detail={`${stats?.earnActiveCount ?? 0} 筆 active`} icon={<Wallet size={20} />} />
          <Metric label="可領回本金" value={`$${formatUsdt(stats?.earnRedeemablePrincipal)}`} detail={`${stats?.earnRedeemableCount ?? 0} 筆到期`} icon={<CheckCircle size={20} />} />
          <Metric label="外部 DeFi 收益" value={`$${formatUsdt(stats?.earnExternalYieldTotal)}`} detail="外部收益回歸收益寶獎金池" icon={<RefreshCw size={20} />} />
        </section>

        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-base font-semibold text-white">待審提現</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">使用者</th>
                  <th className="px-5 py-3 font-medium">錢包</th>
                  <th className="px-5 py-3 font-medium">金額</th>
                  <th className="px-5 py-3 font-medium">使用者餘額</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {overview?.pendingWithdrawals.length ? overview.pendingWithdrawals.map((withdrawal) => (
                  <tr className="border-t border-zinc-800" key={withdrawal.id}>
                    <td className="px-5 py-3 text-zinc-200">
                      <Link className="hover:text-sky-300" href={`/admin/users/${withdrawal.user.id}`}>{shortAddress(withdrawal.user.walletAddress)}</Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-zinc-400">{shortAddress(withdrawal.walletAddress)}</td>
                    <td className="px-5 py-3 font-mono text-zinc-100">${formatUsdt(withdrawal.amount)}</td>
                    <td className="px-5 py-3 font-mono text-zinc-400">${formatUsdt(withdrawal.user.balanceUsdt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="inline-flex items-center gap-1 rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950" onClick={() => handleReview(withdrawal.id, "approve")} disabled={loading}>
                          <CheckCircle size={14} /> 核准
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950" onClick={() => handleReview(withdrawal.id, "reject")} disabled={loading}>
                          <XCircle size={14} /> 拒絕
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-8 text-center text-zinc-500" colSpan={5}>目前沒有待審提現</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SimpleList title="近期使用者" rows={(overview?.recentUsers || []).map((user) => ({
            left: shortAddress(user.walletAddress),
            right: `$${formatUsdt(user.balanceUsdt)}`,
            href: `/admin/users/${user.id}`,
          }))} />
          <SimpleList title="近期交易" rows={(overview?.recentTransactions || []).map((transaction) => ({
            left: `${transactionTypeLabel(transaction.type)} / ${shortAddress(transaction.user.walletAddress)}`,
            right: `${statusLabel(transaction.status)} $${formatUsdt(transaction.amount)}`,
          }))} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between text-zinc-400">
        <p className="text-sm">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

function SimpleList({ title, rows }: { title: string; rows: Array<{ left: string; right: string; href?: string }> }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-zinc-800">
        {rows.length ? rows.map((row, index) => (
          <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm" key={`${row.left}-${index}`}>
            {row.href ? <Link className="text-zinc-200 hover:text-sky-300" href={row.href}>{row.left}</Link> : <span className="text-zinc-200">{row.left}</span>}
            <span className="font-mono text-zinc-400">{row.right}</span>
          </div>
        )) : <p className="px-5 py-8 text-center text-sm text-zinc-500">尚無紀錄</p>}
      </div>
    </div>
  );
}
