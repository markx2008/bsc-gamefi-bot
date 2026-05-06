# 資金基礎設施 (Vault Infrastructure) 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個安全的半託管 USDT 儲值與提現系統，包含鏈上合約、後端帳號管理與對帳機制。

**Architecture:** 使用 Node.js (Viem) 監聽鏈上合約事件，將餘額同步至 PostgreSQL 資料庫，提現需管理員簽名審核。

**Tech Stack:** Solidity, Hardhat, Node.js, Viem, PostgreSQL.

---

### Task 1: 部署金庫合約 (Vault.sol) 並實作儲值事件

**Files:**
- Modify: `contracts/VaultManager.sol` (調整為支持儲值事件)
- Create: `test/Vault.test.js`

- [ ] **Step 1: 撰寫儲值測試案例**

```javascript
const { expect } = require("chai");
describe("Vault Deposit", function () {
  it("Should emit Deposit event when user transfers USDT", async function () {
    // 測試邏輯：模擬用戶轉帳並檢查事件
  });
});
```

- [ ] **Step 2: 執行測試並確認失敗**
- [ ] **Step 3: 修改合約以支援 Deposit 事件**

```solidity
event Deposit(address indexed user, uint256 amount, uint256 timestamp);
function deposit(uint256 _amount) external {
    require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    emit Deposit(msg.sender, _amount, block.timestamp);
}
```

- [ ] **Step 4: 執行測試並確認通過**
- [ ] **Step 5: Commit**

---

### Task 2: 後端儲值監聽器 (Deposit Listener)

**Files:**
- Create: `src/services/listener.ts`
- Create: `src/models/user.ts` (定義資料庫 Schema)

- [ ] **Step 1: 撰寫監聽器單元測試**
- [ ] **Step 2: 實作 Viem 監聽邏輯**
- [ ] **Step 3: 實作資料庫入帳邏輯 (Atomic Transaction)**
- [ ] **Step 4: 驗證儲值入帳成功**
- [ ] **Step 5: Commit**

---

### Task 3: 管理員提現審核與發放系統

**Files:**
- Create: `src/services/withdrawal.ts`
- Modify: `contracts/VaultManager.sol` (加入提現權限控制)

- [ ] **Step 1: 實作提現申請 API (凍結餘額)**
- [ ] **Step 2: 實作管理員審核邏輯 (Admin Approval)**
- [ ] **Step 3: 執行鏈上提現轉帳**
- [ ] **Step 4: 測試提現安全性 (防止超額提現)**
- [ ] **Step 5: Commit**

---

### Task 4: 自動對帳系統 (Reconciliation System)

**Files:**
- Create: `src/services/audit.ts`

- [ ] **Step 1: 實作每小時審計腳本**
- [ ] **Step 2: 撰寫「數據不一致」的報警測試**
- [ ] **Step 3: 實作 Telegram 警報發送邏輯**
- [ ] **Step 4: 驗證對帳報告生成**
- [ ] **Step 5: Commit**
