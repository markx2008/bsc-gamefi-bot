"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { riskLabel, statusLabel, transactionTypeLabel, translateUiError } from "@/lib/ui-labels";

type AdminUserDetail = {
  user: {
    id: number;
    walletAddress: string;
    balanceUsdt: string;
    pendingWithdrawalTotal: string;
  };
  risk: {
    totalDeposit: string;
    totalWithdraw: string;
    gameProfit: string;
    stakingReward: string;
    riskLevel: string;
  };
  transactions: Array<{
    id: number;
    type: string;
    amount: string;
    status: string;
    txHash: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: number;
    amount: string;
    walletAddress: string;
    status: string;
    txHash: string | null;
    createdAt: string;
  }>;
};

const TOKEN_KEY = "web_mvp_session_token";

function formatUsdt(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function shortAddress(value: string | null | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function UserAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const [token, setToken] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
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
    if (token) void loadUser();
  }, [token]);

  async function loadUser() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`/api/admin/users/${resolvedParams.id}`, {
        headers: authHeaders,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(translateUiError(payload.error || "載入使用者失敗"));
      setDetail(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "載入使用者失敗");
    } finally {
      setLoading(false);
    }
  }

  const user = detail?.user;
  const risk = detail?.risk;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> 返回後台
          </Link>
          <button className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900" onClick={loadUser} disabled={!token || loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null} 刷新
          </button>
        </div>

        <header>
          <p className="text-sm font-medium text-sky-400">使用者審核</p>
          <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">{user?.walletAddress ? shortAddress(user.walletAddress) : `使用者 #${resolvedParams.id}`}</h1>
          <p className="mt-2 font-mono text-sm text-zinc-500">{user?.walletAddress || "-"}</p>
        </header>

        {status ? <p className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{status}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="餘額" value={`$${formatUsdt(user?.balanceUsdt)}`} />
          <Metric label="待審" value={`$${formatUsdt(user?.pendingWithdrawalTotal)}`} />
          <Metric label="總入金" value={`$${formatUsdt(risk?.totalDeposit)}`} />
          <Metric label="已提現" value={`$${formatUsdt(risk?.totalWithdraw)}`} />
          <Metric label="風險" value={riskLabel(risk?.riskLevel)} alert={risk?.riskLevel === "HIGH"} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RecordTable title="交易紀錄" rows={(detail?.transactions || []).map((transaction) => ({
            id: transaction.id,
            type: transactionTypeLabel(transaction.type),
            amount: transaction.amount,
            status: statusLabel(transaction.status),
            txHash: transaction.txHash,
          }))} />
          <RecordTable title="提現紀錄" rows={(detail?.withdrawals || []).map((withdrawal) => ({
            id: withdrawal.id,
            type: transactionTypeLabel("WITHDRAW"),
            amount: withdrawal.amount,
            status: statusLabel(withdrawal.status),
            txHash: withdrawal.txHash,
          }))} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        {label} {alert ? <ShieldAlert className="text-red-300" size={15} /> : null}
      </p>
      <p className={alert ? "mt-2 text-2xl font-semibold text-red-300" : "mt-2 text-2xl font-semibold text-white"}>{value}</p>
    </div>
  );
}

function RecordTable({ title, rows }: { title: string; rows: Array<{ id: number; type: string; amount: string; status: string; txHash: string | null }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">類型</th>
              <th className="px-5 py-3 font-medium">金額</th>
              <th className="px-5 py-3 font-medium">狀態</th>
              <th className="px-5 py-3 font-medium">交易雜湊</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr className="border-t border-zinc-800" key={`${title}-${row.id}`}>
                <td className="px-5 py-3 text-zinc-200">{row.type}</td>
                <td className="px-5 py-3 font-mono text-zinc-200">${formatUsdt(row.amount)}</td>
                <td className="px-5 py-3 text-zinc-400">{row.status}</td>
                <td className="px-5 py-3 text-zinc-500">
                  {row.txHash ? <span className="inline-flex items-center gap-1">{shortAddress(row.txHash)} <ExternalLink size={12} /></span> : "-"}
                </td>
              </tr>
            )) : <tr><td className="px-5 py-8 text-center text-zinc-500" colSpan={4}>尚無紀錄</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
