"use client";

import React from "react";
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function UserAuditPage({ params }: { params: { id: string } }) {
  // 模擬用戶數據
  const userSummary = {
    tgId: "TG_88291",
    address: "0x71C...3921",
    totalDeposit: 1000.0,
    totalWithdraw: 200.0,
    gameProfit: 850.5,
    netBalance: 1650.5,
  };

  // 模擬流水數據
  const transactions = [
    { id: 1, type: "DEPOSIT", amount: "+1,000.00", status: "SUCCESS", time: "2026-05-01 10:00:00", hash: "0x123...abc" },
    { id: 2, type: "GAME_LOSS", amount: "-100.00", status: "SUCCESS", time: "2026-05-01 10:05:00", game: "猜硬幣" },
    { id: 3, type: "GAME_WIN", amount: "+950.50", status: "SUCCESS", time: "2026-05-01 10:10:00", game: "骰子比大小" },
    { id: 4, type: "WITHDRAW", amount: "-200.00", status: "SUCCESS", time: "2026-05-02 09:00:00", hash: "0x456...def" },
    { id: 5, type: "WITHDRAW", amount: "1,600.00", status: "PENDING", time: "2026-05-05 14:00:00", note: "當前申請" },
  ];

  return (
    <div className="p-8 bg-slate-950 text-slate-50 min-h-screen">
      <div className="mb-6">
        <Link href="/admin" className="flex items-center text-slate-400 hover:text-white transition">
          <ArrowLeft size={16} className="mr-2" /> 返回管理後台
        </Link>
      </div>

      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">用戶審核: {userSummary.tgId}</h1>
          <p className="text-slate-500 mt-1">錢包地址: {userSummary.address}</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition">
            <XCircle size={18} className="mr-2" /> 拒絕並凍結
          </button>
          <button className="flex items-center bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition">
            <CheckCircle size={18} className="mr-2" /> 核准提現
          </button>
        </div>
      </header>

      {/* 用戶財務總結 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="總儲值 (In)" value={`$${userSummary.totalDeposit}`} color="text-slate-200" />
        <SummaryCard 
          title="遊戲總盈虧" 
          value={`+ $${userSummary.gameProfit}`} 
          color="text-green-400" 
          extra={userSummary.gameProfit > userSummary.totalDeposit ? <ShieldAlert size={16} className="text-red-500" title="高獲利警告" /> : null}
        />
        <SummaryCard title="已提現 (Out)" value={`$${userSummary.totalWithdraw}`} color="text-slate-400" />
        <SummaryCard title="當前總結餘" value={`$${userSummary.netBalance}`} color="text-blue-400" />
      </div>

      {/* 詳細流水表 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="font-semibold text-slate-200">全量交易流水 (Audit Logs)</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
              <th className="px-6 py-4 font-medium">時間</th>
              <th className="px-6 py-4 font-medium">類型</th>
              <th className="px-6 py-4 font-medium">金額 (USDT)</th>
              <th className="px-6 py-4 font-medium">狀態</th>
              <th className="px-6 py-4 font-medium">詳情/憑證</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                <td className="px-6 py-4 text-slate-400">{tx.time}</td>
                <td className="px-6 py-4 font-medium">
                   <span className={tx.type.includes('WIN') ? 'text-green-500' : tx.type.includes('LOSS') ? 'text-red-400' : 'text-slate-200'}>
                     {tx.type}
                   </span>
                </td>
                <td className="px-6 py-4 font-mono font-medium">{tx.amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] ${tx.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {tx.game ? `遊戲: ${tx.game}` : tx.hash ? <span className="flex items-center cursor-pointer hover:text-blue-400">{tx.hash} <ExternalLink size={12} className="ml-1" /></span> : tx.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color, extra }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
      <p className="text-slate-500 text-xs font-medium uppercase mb-1 flex items-center gap-2">
        {title} {extra}
      </p>
      <h3 className={`text-xl font-bold ${color}`}>{value}</h3>
    </div>
  );
}
