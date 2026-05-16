# Admin Health Dashboard MVP Design

## Context

The current web product already has wallet login, internal balance deposits and withdrawals, three internal-balance games, simulator-aligned pool accounting, and the Earn vault MVP. The next development stage is an Admin-only operational health panel that translates the `/simulator` health language into read-only production data from the database.

The product remains browser web only. This design does not add Telegram, TMA, wallet contract writes, or any backend writes from `/simulator`.

## Goals

- Add an Admin `/admin` operational health section.
- Keep the first version read-only.
- Reuse existing `/api/admin/overview` and existing Admin wallet authorization.
- Show whether the real platform state is healthy, warning, or unhealthy.
- Align the first health rules with `/simulator`: APY threshold 20%, no withdrawal shortfall, and non-negative game bankroll.

## Non-Goals

- No platform fee recommendation in this first version.
- No one-click platform setting changes.
- No new `/health` route.
- No user-facing health summary on `/`.
- No simulator-to-backend connection.
- No external messaging platform integration.

## Chosen Approach

Extend the existing Admin overview flow.

`/api/admin/overview` will compute health metrics alongside existing stats. `/admin` will render a new health section between the current high-level capital cards and the pool metric cards.

This is the smallest useful change because the data is already being aggregated in Admin overview, and the panel is only for operators. If the health logic later needs alerts, schedules, or a separate endpoint, it can be extracted after the first version proves the formulas and UI.

## API Shape

`GET /api/admin/overview` will add:

```ts
health: {
  overallStatus: "HEALTHY" | "WARNING" | "UNHEALTHY";
  instantApyPercent: string;
  realizedApyPercent: string;
  healthyApyThresholdPercent: string;
  withdrawalShortfall: string;
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
  warnings: string[];
}
```

Allowed warning codes:

- `APY_BELOW_THRESHOLD`
- `WITHDRAWAL_SHORTFALL`
- `GAME_BANKROLL_NEGATIVE`
- `NO_ACTIVE_EARN_PRINCIPAL`

`NO_ACTIVE_EARN_PRINCIPAL` is informational. It should not make `overallStatus` unhealthy by itself.

## Health Formulas

### Instant APY

Input:

- Active Earn principal from `EarnPosition` where `status = ACTIVE`.
- Current Earn bonus pool from `PlatformLedgerEntry` where `pool = EARN_BONUS_POOL`.
- Earn config from existing env helpers: lock days and APY cap.

Formula:

```txt
periodCapRate = apyCapPercent / 100 * lockDays / 365
poolSupportedPeriodRate = earnBonusPool / activeLockedPrincipal
instantPeriodRate = min(periodCapRate, poolSupportedPeriodRate)
instantApyPercent = instantPeriodRate * 365 / lockDays * 100
```

If active locked principal is zero, return `instantApyPercent = 0` and include `NO_ACTIVE_EARN_PRINCIPAL`.

### Realized APY

Input:

- Redeemed Earn positions from `EarnPosition` where `status = REDEEMED`.
- `principal`, `rewardAmount`, `lockedAt`, and `redeemedAt`.

Formula:

```txt
lockedDays = max(1 / 24, redeemedAt - lockedAt in days)
weightedPrincipalDays = sum(principal * lockedDays)
realizedApyPercent = sum(rewardAmount) / weightedPrincipalDays * 365 * 100
```

If there are no redeemed positions or the denominator is zero, return `0`.

### Game Bankroll

Use the existing Admin formula:

```txt
gameBankroll = INITIAL_GAME_BANKROLL_USDT + sum(PlatformLedgerEntry.amount where pool = GAME_BANKROLL)
```

Healthy when `gameBankroll >= 0`.

### Withdrawal Shortfall

The current DB does not model simulator-style delayed unpaid withdrawals separately. First version uses a liquidity-risk approximation:

```txt
withdrawalShortfall = max(0, pendingWithdrawalTotal - availableLiquidity)
```

Healthy when `withdrawalShortfall = 0`.

`availableLiquidity` means the value currently returned by Admin overview: `totalUserBalances - pendingWithdrawalTotal`. This value means "pending withdrawals exceed available user-liability liquidity" in the current system, not a complete delayed-withdrawal queue model.

## Overall Status

```txt
UNHEALTHY:
  gameBankroll < 0
  OR withdrawalShortfall > 0

HEALTHY:
  instantApyPercent >= 20
  AND withdrawalShortfall = 0
  AND gameBankroll >= 0

WARNING:
  anything else
```

The 20% threshold is fixed for the first version to match the simulator default. It can move to env or DB settings later.

## UI Design

Add a new `/admin` section titled `營運健康`.

The section contains:

- Overall status card:
  - `健康`, `注意`, or `不健康`
  - Short detail text using APY threshold, withdrawal shortfall, and game bankroll status
  - Green, amber, or red tone

- Metric cards:
  - `即時 APY`
  - `實現 APY`
  - `提款缺口`
  - `遊戲金庫健康`
  - `收益寶獎金池`
  - `鎖倉本金`

The UI remains dense and operational, matching the existing Admin dashboard style. It should not introduce a landing page, decorative hero, or unrelated visual redesign.

## Implementation Boundaries

Add a pure logic module:

```txt
src/lib/admin-health.ts
```

Responsibilities:

- Normalize numeric inputs.
- Calculate instant APY.
- Calculate realized APY.
- Calculate withdrawal shortfall.
- Produce `overallStatus`, booleans, and warning codes.

It must not import Prisma or read environment variables. API routes prepare data and call the pure functions.

The module should accept plain values (`string`, `number`, or date strings for redeemed positions) so the tests can exercise it without Prisma types.

Admin API responsibilities:

- Aggregate active Earn principal.
- Aggregate redeemed Earn reward/principal/duration inputs.
- Reuse existing pool totals.
- Pass normalized inputs into `admin-health`.

Admin UI responsibilities:

- Render the new `health` object.
- Translate status and warning codes into Chinese labels.
- Avoid crashing when `health` is missing during initial loading.

## Testing

Add:

```txt
scripts/verify-admin-health.mjs
npm script: test:admin-health
```

The test verifies:

- APY at or above 20%, no shortfall, and non-negative bankroll returns `HEALTHY`.
- APY below 20%, no shortfall, and non-negative bankroll returns `WARNING`.
- Withdrawal shortfall greater than zero returns `UNHEALTHY`.
- Negative game bankroll returns `UNHEALTHY`.
- Zero active Earn principal does not divide by zero and includes `NO_ACTIVE_EARN_PRINCIPAL`.

Update:

```txt
scripts/verify-web-mvp-routes.mjs
```

The route verification should assert:

- `/api/admin/overview` includes `health`.
- `/admin` displays `營運健康`, `即時 APY`, `實現 APY`, and `提款缺口`.

Required verification before completion:

```bash
npm run test:admin-health
npm run test:web-mvp
npm run test:simulator
npm run build
```

## Acceptance Criteria

- `/admin` shows the health section after Admin wallet login.
- The page works when there are no active Earn positions.
- The page works when there are no redeemed Earn positions.
- `instantApyPercent` is capped by the Earn APY cap and constrained by available Earn bonus pool.
- `realizedApyPercent` uses redeemed Earn position history.
- Pending withdrawal liquidity risk is visible as `withdrawalShortfall`.
- A negative game bankroll or positive withdrawal shortfall marks the system unhealthy.
- The feature does not change user balances, game settlement, Earn settlement, simulator behavior, or contract calls.
