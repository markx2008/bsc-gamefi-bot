import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} should exist`);
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), `${label} should include ${expected}`);
}

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.name, "bsc-gamefi-web", "package should use web-oriented project name");
assert.equal(
  packageJson.scripts["test:web-mvp"],
  "node scripts/verify-web-mvp-routes.mjs",
  "package.json should expose test:web-mvp",
);

assert.ok(!existsSync(path.join(root, "src/app/api/auth/telegram/route.ts")), "Telegram auth route should not exist");
assert.ok(!existsSync(path.join(root, "src/app/api/auth/dev-login/route.ts")), "tgId dev login route should not exist");
assert.ok(!existsSync(path.join(root, "src/app/api/auth/bind-wallet/route.ts")), "wallet binding route should be replaced by wallet login");

const walletLoginRoute = read("src/app/api/auth/wallet-login/route.ts");
assertIncludes(walletLoginRoute, "signSessionToken", "wallet login route");
assertIncludes(walletLoginRoute, "verifyWalletLoginSignature", "wallet login route");
assertIncludes(walletLoginRoute, "resolvePendingDepositsForUser", "wallet login route");
assertIncludes(walletLoginRoute, "user.upsert", "wallet login route");

const meRoute = read("src/app/api/me/route.ts");
assertIncludes(meRoute, "getBearerSession", "me route");
assertIncludes(meRoute, "transactions", "me route");
assertIncludes(meRoute, "withdrawals", "me route");
assertIncludes(meRoute, "pendingWithdrawalTotal", "me route");

const adminOverviewRoute = read("src/app/api/admin/overview/route.ts");
assertIncludes(adminOverviewRoute, "assertAdminSession", "admin overview route");
assertIncludes(adminOverviewRoute, "totalDeposits", "admin overview route");
assertIncludes(adminOverviewRoute, "pendingWithdrawals", "admin overview route");
assertIncludes(adminOverviewRoute, "recentUsers", "admin overview route");
assertIncludes(adminOverviewRoute, "aggregate", "admin overview route");

const adminUserRoute = read("src/app/api/admin/users/[id]/route.ts");
assertIncludes(adminUserRoute, "assertAdminSession", "admin user route");
assertIncludes(adminUserRoute, "transactions", "admin user route");
assertIncludes(adminUserRoute, "withdrawals", "admin user route");
assertIncludes(adminUserRoute, "risk", "admin user route");

const withdrawalsRoute = read("src/app/api/withdrawals/route.ts");
assertIncludes(withdrawalsRoute, "pendingWithdrawalTotal", "withdrawals route");
assertIncludes(withdrawalsRoute, "totalRequested", "withdrawals route");
assertIncludes(withdrawalsRoute, "TransactionIsolationLevel.Serializable", "withdrawals route");

const homePage = read("src/app/page.tsx");
assertIncludes(homePage, "/api/auth/wallet-login", "web dashboard");
assertIncludes(homePage, "/api/me", "web dashboard");
assertIncludes(homePage, "/api/withdrawals", "web dashboard");
assertIncludes(homePage, "VaultManager", "web dashboard");
assertIncludes(homePage, "encodeFunctionData", "deposit panel");
assertIncludes(homePage, "approveDeposit", "deposit panel");
assertIncludes(homePage, "submitDeposit", "deposit panel");
assertIncludes(homePage, "MockUSDT balance", "deposit panel");
assertIncludes(homePage, "Allowance", "deposit panel");
assertIncludes(homePage, "VaultManager.deposit", "deposit panel");

const adminPage = read("src/app/admin/page.tsx");
assertIncludes(adminPage, "/api/admin/overview", "admin dashboard");
assertIncludes(adminPage, "handleReview", "admin dashboard");
assertIncludes(adminPage, "pendingWithdrawals", "admin dashboard");

const adminUserPage = read("src/app/admin/users/[id]/page.tsx");
assertIncludes(adminUserPage, "/api/admin/users/", "admin user page");
assertIncludes(adminUserPage, "transactions", "admin user page");
assertIncludes(adminUserPage, "withdrawals", "admin user page");

const authSource = read("src/lib/auth.ts");
assertIncludes(authSource, "ADMIN_WALLET_ADDRESS", "auth helper");
assertIncludes(authSource, "walletAddress", "session payload");

const prismaSchema = read("prisma/schema.prisma");
assertIncludes(prismaSchema, "walletAddress  String              @unique", "Prisma User model");
assert.ok(!/tgId|ADMIN_TG_ID|TELEGRAM_BOT_TOKEN|Telegram Mini App|TMA/.test(prismaSchema), "Prisma schema should not contain Telegram identity fields");

const readme = read("README.md");
assert.ok(!/Telegram|TMA|tgId|Bot/.test(readme), "README should describe the web-only product without Telegram references");

const developmentPlan = read("DEVELOPMENT_PLAN.md");
assert.ok(!/Telegram|TMA|tgId|Bot/.test(developmentPlan), "development plan should not point agents toward Telegram work");

const agentGuide = read("AGENTS.md");
assertIncludes(agentGuide, "web-only", "agent guide");
assertIncludes(agentGuide, "Do not add Telegram Bot or Telegram Mini App", "agent guide");

console.log("Web MVP route verification passed.");
