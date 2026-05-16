# Admin Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Admin operational health panel that maps simulator health concepts onto real database state.

**Architecture:** Keep health calculation in a pure `src/lib/admin-health.ts` module, then wire it into the existing `/api/admin/overview` response and `/admin` dashboard. The first version extends existing Admin overview instead of adding a new endpoint or writable settings.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Tailwind CSS, Node verification scripts.

---

## File Structure

- Create `src/lib/admin-health.ts`
  - Owns numeric normalization and health formulas.
  - Does not import Prisma or read environment variables.
  - Exports `calculateAdminHealth()` plus supporting types.

- Create `scripts/verify-admin-health.mjs`
  - Transpiles `src/lib/admin-health.ts` with TypeScript and tests the pure logic.

- Modify `package.json`
  - Adds `test:admin-health`.

- Modify `src/app/api/admin/overview/route.ts`
  - Aggregates active Earn principal, redeemed Earn positions, pool totals, pending withdrawals, and available liquidity.
  - Calls `calculateAdminHealth()`.
  - Adds `health` to JSON response.

- Modify `src/app/admin/page.tsx`
  - Adds health DTO types.
  - Adds status/warning label helpers.
  - Renders a new `營運健康` section.

- Modify `scripts/verify-web-mvp-routes.mjs`
  - Asserts the Admin API and UI expose the new health concepts.

- Modify `README.md` and `DEVELOPMENT_PLAN.md`
  - Marks the Admin health monitor MVP as implemented after the code lands.

---

### Task 1: Pure Admin Health Logic

**Files:**
- Create: `scripts/verify-admin-health.mjs`
- Create: `src/lib/admin-health.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the failing admin health test script**

Create `scripts/verify-admin-health.mjs`:

```js
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/admin-health.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-admin-health-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `admin-health-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const health = await import(`file://${modulePath}`);
const { calculateAdminHealth } = health;

function almostEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(Number(actual) - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "HEALTHY");
  assert.equal(result.isApyHealthy, true);
  assert.equal(result.isWithdrawalHealthy, true);
  assert.equal(result.isGameBankrollHealthy, true);
  almostEqual(result.instantApyPercent, 25);
  assert.deepEqual(result.warnings, []);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "1",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "WARNING");
  assert.equal(result.isApyHealthy, false);
  assert.ok(result.warnings.includes("APY_BELOW_THRESHOLD"));
  almostEqual(result.instantApyPercent, 5.214285714285714);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "600",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "UNHEALTHY");
  assert.equal(result.isWithdrawalHealthy, false);
  assert.equal(result.withdrawalShortfall, "100");
  assert.ok(result.warnings.includes("WITHDRAWAL_SHORTFALL"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "-1",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "UNHEALTHY");
  assert.equal(result.isGameBankrollHealthy, false);
  assert.ok(result.warnings.includes("GAME_BANKROLL_NEGATIVE"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "0",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "0",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "WARNING");
  assert.equal(result.instantApyPercent, "0");
  assert.ok(result.warnings.includes("NO_ACTIVE_EARN_PRINCIPAL"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "0",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [
      {
        principal: "1000",
        rewardAmount: "10",
        lockedAt: "2026-05-01T00:00:00.000Z",
        redeemedAt: "2026-05-08T00:00:00.000Z",
      },
    ],
  });

  almostEqual(result.realizedApyPercent, 52.142857142857146);
}

console.log("Admin health checks passed");
```

- [ ] **Step 2: Add the npm script**

Modify `package.json` inside `scripts`:

```json
"test:admin-health": "node scripts/verify-admin-health.mjs",
```

- [ ] **Step 3: Run the test to verify RED**

Run:

```bash
npm run test:admin-health
```

Expected: fail because `src/lib/admin-health.ts` does not exist or `calculateAdminHealth` is not exported.

- [ ] **Step 4: Create the pure health implementation**

Create `src/lib/admin-health.ts`:

```ts
export type AdminHealthStatus = "HEALTHY" | "WARNING" | "UNHEALTHY";

export type AdminHealthWarning =
  | "APY_BELOW_THRESHOLD"
  | "WITHDRAWAL_SHORTFALL"
  | "GAME_BANKROLL_NEGATIVE"
  | "NO_ACTIVE_EARN_PRINCIPAL";

export type RedeemedEarnPositionInput = {
  principal: string | number;
  rewardAmount: string | number;
  lockedAt: string | Date;
  redeemedAt: string | Date | null;
};

export type AdminHealthInput = {
  activeLockedPrincipal: string | number;
  earnBonusPool: string | number;
  apyCapPercent: string | number;
  lockDays: string | number;
  healthyApyThresholdPercent: string | number;
  pendingWithdrawalTotal: string | number;
  availableLiquidity: string | number;
  gameBankroll: string | number;
  redeemedPositions: RedeemedEarnPositionInput[];
};

export type AdminHealthResult = {
  overallStatus: AdminHealthStatus;
  instantApyPercent: string;
  realizedApyPercent: string;
  healthyApyThresholdPercent: string;
  withdrawalShortfall: string;
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
  warnings: AdminHealthWarning[];
};

export function calculateAdminHealth(input: AdminHealthInput): AdminHealthResult {
  const activeLockedPrincipal = nonNegativeNumber(input.activeLockedPrincipal);
  const earnBonusPool = nonNegativeNumber(input.earnBonusPool);
  const apyCapPercent = nonNegativeNumber(input.apyCapPercent);
  const lockDays = Math.max(1 / 24, nonNegativeNumber(input.lockDays));
  const healthyApyThresholdPercent = nonNegativeNumber(input.healthyApyThresholdPercent);
  const pendingWithdrawalTotal = nonNegativeNumber(input.pendingWithdrawalTotal);
  const availableLiquidity = nonNegativeNumber(input.availableLiquidity);
  const gameBankroll = finiteNumber(input.gameBankroll);

  const instantApyPercent = calculateInstantApyPercent({
    activeLockedPrincipal,
    earnBonusPool,
    apyCapPercent,
    lockDays,
  });
  const realizedApyPercent = calculateRealizedApyPercent(input.redeemedPositions);
  const withdrawalShortfall = Math.max(0, pendingWithdrawalTotal - availableLiquidity);

  const warnings: AdminHealthWarning[] = [];
  if (activeLockedPrincipal <= 0) warnings.push("NO_ACTIVE_EARN_PRINCIPAL");
  if (instantApyPercent < healthyApyThresholdPercent) warnings.push("APY_BELOW_THRESHOLD");
  if (withdrawalShortfall > 0) warnings.push("WITHDRAWAL_SHORTFALL");
  if (gameBankroll < 0) warnings.push("GAME_BANKROLL_NEGATIVE");

  const isApyHealthy = instantApyPercent >= healthyApyThresholdPercent;
  const isWithdrawalHealthy = withdrawalShortfall <= 0;
  const isGameBankrollHealthy = gameBankroll >= 0;
  const overallStatus = getOverallStatus({
    isApyHealthy,
    isWithdrawalHealthy,
    isGameBankrollHealthy,
  });

  return {
    overallStatus,
    instantApyPercent: formatNumber(instantApyPercent),
    realizedApyPercent: formatNumber(realizedApyPercent),
    healthyApyThresholdPercent: formatNumber(healthyApyThresholdPercent),
    withdrawalShortfall: formatNumber(withdrawalShortfall),
    isApyHealthy,
    isWithdrawalHealthy,
    isGameBankrollHealthy,
    warnings,
  };
}

function calculateInstantApyPercent(params: {
  activeLockedPrincipal: number;
  earnBonusPool: number;
  apyCapPercent: number;
  lockDays: number;
}) {
  if (params.activeLockedPrincipal <= 0) return 0;
  const periodCapRate = (params.apyCapPercent / 100) * (params.lockDays / 365);
  const poolSupportedPeriodRate = params.earnBonusPool / params.activeLockedPrincipal;
  const instantPeriodRate = Math.min(periodCapRate, poolSupportedPeriodRate);
  return instantPeriodRate * (365 / params.lockDays) * 100;
}

function calculateRealizedApyPercent(positions: RedeemedEarnPositionInput[]) {
  let rewardTotal = 0;
  let weightedPrincipalDays = 0;

  for (const position of positions) {
    if (!position.redeemedAt) continue;
    const principal = nonNegativeNumber(position.principal);
    const rewardAmount = nonNegativeNumber(position.rewardAmount);
    const lockedAt = new Date(position.lockedAt).getTime();
    const redeemedAt = new Date(position.redeemedAt).getTime();
    if (!Number.isFinite(lockedAt) || !Number.isFinite(redeemedAt)) continue;
    const lockedDays = Math.max(1 / 24, (redeemedAt - lockedAt) / 86_400_000);
    rewardTotal += rewardAmount;
    weightedPrincipalDays += principal * lockedDays;
  }

  if (weightedPrincipalDays <= 0) return 0;
  return (rewardTotal / weightedPrincipalDays) * 365 * 100;
}

function getOverallStatus(params: {
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
}): AdminHealthStatus {
  if (!params.isWithdrawalHealthy || !params.isGameBankrollHealthy) return "UNHEALTHY";
  if (params.isApyHealthy) return "HEALTHY";
  return "WARNING";
}

function nonNegativeNumber(value: string | number) {
  return Math.max(0, finiteNumber(value));
}

function finiteNumber(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNumber(value: number) {
  return roundMoney(value).toString();
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
```

- [ ] **Step 5: Run the admin health test to verify GREEN**

Run:

```bash
npm run test:admin-health
```

Expected: `Admin health checks passed`.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json scripts/verify-admin-health.mjs src/lib/admin-health.ts
git commit -m "Add admin health calculations"
```

---

### Task 2: Wire Health Into Admin Overview API

**Files:**
- Modify: `src/app/api/admin/overview/route.ts`
- Modify: `scripts/verify-web-mvp-routes.mjs`

- [ ] **Step 1: Add failing route verification assertions**

In `scripts/verify-web-mvp-routes.mjs`, add these assertions after the existing Admin overview route assertions:

```js
assertIncludes(adminOverviewRoute, "calculateAdminHealth", "admin overview route");
assertIncludes(adminOverviewRoute, "health", "admin overview route");
assertIncludes(adminOverviewRoute, "healthyApyThresholdPercent", "admin overview route");
assertIncludes(adminOverviewRoute, "redeemedEarnPositions", "admin overview route");
```

- [ ] **Step 2: Run route verification to verify RED**

Run:

```bash
npm run test:web-mvp
```

Expected: fail because `calculateAdminHealth` and the new health fields are not in `src/app/api/admin/overview/route.ts`.

- [ ] **Step 3: Import health helpers**

In `src/app/api/admin/overview/route.ts`, add:

```ts
import { calculateAdminHealth } from "@/lib/admin-health";
import { getEarnConfigFromEnv } from "@/lib/earn-ledger";
```

- [ ] **Step 4: Add the health threshold helper**

Below `getInitialGameBankroll()` in `src/app/api/admin/overview/route.ts`, add:

```ts
function getHealthyApyThresholdPercent() {
  return Number(process.env.HEALTHY_APY_THRESHOLD_PERCENT || "20");
}
```

- [ ] **Step 5: Add redeemed Earn positions to the Admin query**

In the `Promise.all` destructuring inside `GET`, add `redeemedEarnPositions` after `earnExternalYield`:

```ts
      earnExternalYield,
      redeemedEarnPositions,
```

In the `Promise.all` list, add:

```ts
      prisma.earnPosition.findMany({
        where: { status: "REDEEMED" },
        select: {
          principal: true,
          rewardAmount: true,
          lockedAt: true,
          redeemedAt: true,
        },
        take: 500,
      }),
```

- [ ] **Step 6: Compute the health DTO**

After `const earnBonusPool = poolTotals.get("EARN_BONUS_POOL") ?? ZERO;`, add:

```ts
    const earnConfig = getEarnConfigFromEnv();
    const healthyApyThresholdPercent = getHealthyApyThresholdPercent();
    const availableLiquidity = totalUserBalances.minus(pendingWithdrawalTotal);
    const health = calculateAdminHealth({
      activeLockedPrincipal: decimalToString(earnActive._sum.principal),
      earnBonusPool: earnBonusPool.toString(),
      apyCapPercent: earnConfig.apyCapPercent,
      lockDays: earnConfig.lockDays,
      healthyApyThresholdPercent,
      pendingWithdrawalTotal: pendingWithdrawalTotal.toString(),
      availableLiquidity: availableLiquidity.toString(),
      gameBankroll: gameBankroll.toString(),
      redeemedPositions: redeemedEarnPositions.map((position) => ({
        principal: position.principal.toString(),
        rewardAmount: position.rewardAmount.toString(),
        lockedAt: position.lockedAt,
        redeemedAt: position.redeemedAt,
      })),
    });
```

Then replace the existing `availableLiquidity` stat value with the local variable:

```ts
        availableLiquidity: availableLiquidity.toString(),
```

- [ ] **Step 7: Return health in the response**

In the JSON response, add `health` immediately after `stats`:

```ts
      health,
```

- [ ] **Step 8: Run focused verification**

Run:

```bash
npm run test:admin-health
npm run test:web-mvp
```

Expected:

```txt
Admin health checks passed
Web MVP route verification passed.
```

- [ ] **Step 9: Commit Task 2**

```bash
git add src/app/api/admin/overview/route.ts scripts/verify-web-mvp-routes.mjs
git commit -m "Expose admin health metrics"
```

---

### Task 3: Render Admin Health UI

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `scripts/verify-web-mvp-routes.mjs`

- [ ] **Step 1: Add failing UI verification assertions**

In `scripts/verify-web-mvp-routes.mjs`, add these assertions after the existing Admin page assertions:

```js
assertIncludes(adminPage, "營運健康", "admin dashboard");
assertIncludes(adminPage, "即時 APY", "admin dashboard");
assertIncludes(adminPage, "實現 APY", "admin dashboard");
assertIncludes(adminPage, "提款缺口", "admin dashboard");
assertIncludes(adminPage, "healthStatusLabel", "admin dashboard");
assertIncludes(adminPage, "healthWarningLabel", "admin dashboard");
```

- [ ] **Step 2: Run route verification to verify RED**

Run:

```bash
npm run test:web-mvp
```

Expected: fail because the Admin page does not yet render `營運健康` or the helper names.

- [ ] **Step 3: Add health types**

In `src/app/admin/page.tsx`, add this type before `type AdminOverview`:

```ts
type AdminHealth = {
  overallStatus: "HEALTHY" | "WARNING" | "UNHEALTHY";
  instantApyPercent: string;
  realizedApyPercent: string;
  healthyApyThresholdPercent: string;
  withdrawalShortfall: string;
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
  warnings: string[];
};
```

Then add `health` to `AdminOverview`:

```ts
  health: AdminHealth;
```

- [ ] **Step 4: Add health label helpers**

Below `shortAddress()` in `src/app/admin/page.tsx`, add:

```ts
function formatPercent(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function healthStatusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    HEALTHY: "健康",
    WARNING: "注意",
    UNHEALTHY: "不健康",
  };
  return value ? labels[value] || value : "尚無資料";
}

function healthWarningLabel(value: string) {
  const labels: Record<string, string> = {
    APY_BELOW_THRESHOLD: "即時 APY 低於健康門檻",
    WITHDRAWAL_SHORTFALL: "待審提款超過可用流動性",
    GAME_BANKROLL_NEGATIVE: "遊戲金庫低於 0",
    NO_ACTIVE_EARN_PRINCIPAL: "目前沒有 active 收益寶本金",
  };
  return labels[value] || value;
}

function healthTone(value: string | null | undefined) {
  if (value === "HEALTHY") return "green";
  if (value === "UNHEALTHY") return "red";
  return "amber";
}
```

- [ ] **Step 5: Add a status card component**

Below the existing `Metric` component in `src/app/admin/page.tsx`, add:

```tsx
function HealthStatusCard({ health }: { health: AdminHealth | undefined }) {
  const tone = healthTone(health?.overallStatus);
  const toneClasses = {
    green: "border-emerald-800 bg-emerald-950/40 text-emerald-200",
    amber: "border-amber-800 bg-amber-950/40 text-amber-200",
    red: "border-red-800 bg-red-950/40 text-red-200",
  }[tone];

  return (
    <div className={`rounded-lg border p-5 ${toneClasses}`}>
      <p className="text-sm opacity-80">營運健康</p>
      <p className="mt-2 text-3xl font-semibold">{healthStatusLabel(health?.overallStatus)}</p>
      <p className="mt-2 text-sm opacity-80">
        APY 門檻 {formatPercent(health?.healthyApyThresholdPercent)}% / 提款缺口 ${formatUsdt(health?.withdrawalShortfall)}
      </p>
      {health?.warnings.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {health.warnings.map((warning) => (
            <span className="rounded-md border border-current px-2 py-1 text-xs" key={warning}>
              {healthWarningLabel(warning)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs opacity-70">所有健康條件目前達標。</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Render the health section**

In `AdminDashboard`, after:

```tsx
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="總入金" value={`$${formatUsdt(stats?.totalDeposits)}`} icon={<Wallet size={20} />} />
          <Metric label="使用者負債" value={`$${formatUsdt(stats?.totalUserBalances)}`} icon={<ShieldAlert size={20} />} />
          <Metric label="待審提現" value={`$${formatUsdt(stats?.pendingWithdrawalTotal)}`} detail={`${stats?.pendingWithdrawalCount ?? 0} 筆申請`} icon={<RefreshCw size={20} />} />
          <Metric label="使用者數" value={String(stats?.totalUsers ?? 0)} detail={`可用流動性 $${formatUsdt(stats?.availableLiquidity)}`} icon={<Users size={20} />} />
        </section>
```

Add:

```tsx
        <section className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
          <HealthStatusCard health={overview?.health} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Metric label="即時 APY" value={`${formatPercent(overview?.health?.instantApyPercent)}%`} detail={`健康門檻 ${formatPercent(overview?.health?.healthyApyThresholdPercent)}%`} icon={<RefreshCw size={20} />} />
            <Metric label="實現 APY" value={`${formatPercent(overview?.health?.realizedApyPercent)}%`} detail="已領回收益寶歷史" icon={<CheckCircle size={20} />} />
            <Metric label="提款缺口" value={`$${formatUsdt(overview?.health?.withdrawalShortfall)}`} detail="待審提款與可用流動性比較" icon={<ShieldAlert size={20} />} />
            <Metric label="遊戲金庫健康" value={`$${formatUsdt(stats?.gameBankroll)}`} detail={overview?.health?.isGameBankrollHealthy ? "金庫非負" : "金庫低於 0"} icon={<ShieldAlert size={20} />} />
            <Metric label="收益寶獎金池" value={`$${formatUsdt(stats?.earnBonusPool)}`} detail="可支撐鎖倉分紅" icon={<RefreshCw size={20} />} />
            <Metric label="鎖倉本金" value={`$${formatUsdt(stats?.earnActivePrincipal)}`} detail={`${stats?.earnActiveCount ?? 0} 筆 active`} icon={<Wallet size={20} />} />
          </div>
        </section>
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
npm run test:web-mvp
npm run build
```

Expected:

```txt
Web MVP route verification passed.
```

`npm run build` exits with code 0.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/app/admin/page.tsx scripts/verify-web-mvp-routes.mjs
git commit -m "Render admin health dashboard"
```

---

### Task 4: Update Product Documentation

**Files:**
- Modify: `README.md`
- Modify: `DEVELOPMENT_PLAN.md`

- [ ] **Step 1: Update README progress**

In `README.md`, replace:

```md
- [ ] 收益寶完整健康監控：即時 APY、實現 APY、逾期提款與抽成建議
```

With:

```md
- [x] Admin 營運健康面板 MVP：即時 APY、實現 APY、提款缺口、遊戲金庫與收益寶獎金池健康監控
- [ ] 收益寶完整健康監控：抽成建議、完整提款延遲模型與告警流程
```

- [ ] **Step 2: Update development plan Phase 3**

In `DEVELOPMENT_PLAN.md`, replace:

```md
- [ ] 開發完整動態 APY 與營運健康面板：即時 APY、實現 APY、遊戲金庫、平台收益、獎金池、待處理提款與逾期提款需與 `/simulator` 指標一致。
```

With:

```md
- [x] 開發 Admin 營運健康面板 MVP：即時 APY、實現 APY、遊戲金庫、收益寶獎金池、鎖倉本金與提款缺口接上真實 DB 狀態。
- [ ] 補齊完整動態 APY 與健康監控：抽成建議、完整提款延遲模型、逾期提款佇列與 `/simulator` 指標完全一致。
```

- [ ] **Step 3: Run documentation-related verification**

Run:

```bash
npm run test:web-mvp
```

Expected:

```txt
Web MVP route verification passed.
```

- [ ] **Step 4: Commit Task 4**

```bash
git add README.md DEVELOPMENT_PLAN.md
git commit -m "Document admin health dashboard MVP"
```

---

### Task 5: Final Verification

**Files:**
- Verify all files touched by previous tasks.

- [ ] **Step 1: Run all required verification commands**

Run:

```bash
npm run test:admin-health
npm run test:web-mvp
npm run test:simulator
npm run build
```

Expected:

```txt
Admin health checks passed
Web MVP route verification passed.
Simulator engine verification passed
```

`npm run build` exits with code 0.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged files unless a previous task intentionally left documentation or generated files. Do not commit build artifacts.

- [ ] **Step 3: If final verification required fixes, commit them**

If fixes were needed after Task 4, commit only those files:

```bash
git add <fixed-files>
git commit -m "Stabilize admin health dashboard"
```

If no fixes were needed, skip this commit.

---

## Self-Review Notes

- Spec coverage: Tasks cover pure formulas, Admin overview API, Admin UI, route verification, documentation, and final verification.
- Scope: The plan does not add fee recommendations, writable settings, a new route, user-facing health display, or simulator backend writes.
- Type consistency: `health`, `overallStatus`, `instantApyPercent`, `realizedApyPercent`, `healthyApyThresholdPercent`, `withdrawalShortfall`, and warning codes match the approved spec.
- Testing: The first implementation task starts with a failing test and each behavior change has verification before commit.
