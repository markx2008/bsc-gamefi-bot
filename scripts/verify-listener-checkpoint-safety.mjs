import fs from 'node:fs';
import assert from 'node:assert/strict';

const listener = fs
  .readFileSync(new URL('../server/src/services/listener.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

assert.match(
  listener,
  /export async function handleDeposit[\s\S]+catch \(error\) \{[\s\S]+console\.error\([\s\S]+throw error;[\s\S]+\}\n\}/,
  'handleDeposit must rethrow persistence errors so checkpoints never advance after a failed deposit write',
);

assert.match(
  listener,
  /await handleDeposit\(user as string, amount as bigint, txHash, blockNumber\);\n\s*if \(blockNumber\) await saveLastProcessedBlock\(blockNumber\);/,
  'live watcher must save checkpoints only after handleDeposit completes successfully',
);

assert.match(
  listener,
  /await handleDeposit\(user as string, amount as bigint, log\.transactionHash, log\.blockNumber\);[\s\S]+await saveLastProcessedBlock\(toBlock\);/,
  'backfill must save chunk checkpoints only after all deposits in the chunk complete successfully',
);
