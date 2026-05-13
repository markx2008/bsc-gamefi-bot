import fs from 'node:fs';
import assert from 'node:assert/strict';

const approveRoute = fs
  .readFileSync(new URL('../src/app/api/admin/withdrawals/[id]/approve/route.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

assert.match(
  approveRoute,
  /withdrawalRequest\.updateMany\(\{\n\s*where: \{ id: withdrawalId, status: "PENDING" \}/,
  'approval must atomically claim exactly one PENDING withdrawal before side effects',
);

assert.match(
  approveRoute,
  /user\.updateMany\(\{\n\s*where: \{\n\s*id: claimedWithdrawal\.userId,[\s\S]+balanceUsdt: \{ gte: claimedWithdrawal\.amount \}/,
  'approval must atomically debit only if the user still has enough balance',
);

assert.match(
  approveRoute,
  /waitForOnChainWithdrawal\(txHash\)/,
  'approval must wait for an on-chain receipt before marking the withdrawal as sent',
);

assert.match(
  approveRoute,
  /receipt\.status !== "success"/,
  'approval must treat reverted on-chain receipts as failed withdrawals',
);

assert.match(
  approveRoute,
  /if \(approvedWithdrawal && !approvedWithdrawal\.txHash\)/,
  'approval must not refund after a transaction hash has been broadcast but receipt confirmation is inconclusive',
);
