"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // 假設組件已存在或稍後補齊
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowUpCircle, Wallet, TrendingUp, ShieldAlert } from "lucide-react";

export default function AdminDashboard() {
  // 模擬數據，實際將從 API 獲取
  const [stats, setStats] = useState({
    totalDeposits: "1,240,000",
    stakingTvl: "850,000",
    availableLiquidity: "390,000",
    pendingRewards90: "12,450",
    platformTreasury10: "3,120",
  });

  return (
    <div className="p-8 bg-slate-950 text-slate-50 min-h-screen">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🛡️ 平台管理後台</h1>
        <div className="flex gap-4">
           <div className="bg-green-500/10 text-green-500 px-4 py-2 rounded-full border border-green-500/20 text-sm">
             系統對帳: 正常 (Audit Pass)
           </div>
           <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition">
             連結管理員錢包
           </button>
        </div>
      </header>

      {/* 五大財務指標 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatsCard title="儲值總金額" value={stats.totalDeposits} icon={<Wallet className="text-blue-400" />} />
        <StatsCard title="當前鎖倉量 (TVL)" value={stats.stakingTvl} icon={<ShieldAlert className="text-purple-400" />} />
        <StatsCard title="自由資金 (可出金)" value={stats.availableLiquidity} icon={<ArrowUpCircle className="text-green-400" />} />
        <StatsCard title="待分配 (90%)" value={stats.pendingRewards90} icon={<TrendingUp className="text-yellow-400" />} />
        <StatsCard title="平台餘額 (10%)" value={stats.platformTreasury10} icon={<AlertCircle className="text-red-400" />} btnText="提現" />
      </div>

      <Tabs defaultValue="withdrawals" className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="withdrawals">提現審核</TabsTrigger>
          <TabsTrigger value="games">遊戲統計</TabsTrigger>
          <TabsTrigger value="users">用戶分析</TabsTrigger>
        </TabsList>
        
        <TabsContent value="withdrawals" className="mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">待處理申請</h2>
            {/* 提現列表組件將放在這裡 */}
            <div className="text-slate-500 text-center py-10 italic">尚無待處理申請</div>
          </div>
        </TabsContent>

        <TabsContent value="games" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GameStatCard name="猜硬幣" volume="50,000" profit="+1,250" winRate="48.5%" />
              <GameStatCard name="骰子比大小" volume="120,000" profit="+2,400" winRate="49.2%" />
              <GameStatCard name="幸運轉盤" volume="35,000" profit="+3,100" winRate="46.8%" />
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsCard({ title, value, icon, btnText }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        {icon}
      </div>
      <div className="flex justify-between items-end">
        <h3 className="text-2xl font-bold text-slate-100">${value}</h3>
        {btnText && (
          <button className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-1 rounded hover:bg-red-500/20 transition">
            {btnText}
          </button>
        )}
      </div>
    </div>
  );
}

function GameStatCard({ name, volume, profit, winRate }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
      <h3 className="text-lg font-bold mb-4">{name}</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">總流水:</span>
          <span className="text-slate-200">${volume}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">莊家盈餘:</span>
          <span className="text-green-400 font-medium">{profit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">用戶勝率:</span>
          <span className="text-slate-200">{winRate}</span>
        </div>
      </div>
    </div>
  );
}
