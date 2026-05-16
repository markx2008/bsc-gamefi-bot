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
assertIncludes(meRoute, "fairness", "me route");
assertIncludes(meRoute, "nextServerSeedHash", "me route");

const adminOverviewRoute = read("src/app/api/admin/overview/route.ts");
assertIncludes(adminOverviewRoute, "assertAdminSession", "admin overview route");
assertIncludes(adminOverviewRoute, "totalDeposits", "admin overview route");
assertIncludes(adminOverviewRoute, "pendingWithdrawals", "admin overview route");
assertIncludes(adminOverviewRoute, "recentUsers", "admin overview route");
assertIncludes(adminOverviewRoute, "aggregate", "admin overview route");
assertIncludes(adminOverviewRoute, "earnActive", "admin overview route");
assertIncludes(adminOverviewRoute, "earnRedeemable", "admin overview route");
assertIncludes(adminOverviewRoute, "EARN_EXTERNAL_YIELD", "admin overview route");
assertIncludes(adminOverviewRoute, "calculateAdminHealth", "admin overview route");
assertIncludes(adminOverviewRoute, "health", "admin overview route");
assertIncludes(adminOverviewRoute, "healthyApyThresholdPercent", "admin overview route");
assertIncludes(adminOverviewRoute, "redeemedEarnPositions", "admin overview route");

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
assertIncludes(homePage, "BSC GameFi", "user dashboard");
assertIncludes(homePage, "使用者儀表板", "user dashboard");
assertIncludes(homePage, "遊戲", "user dashboard");
assertIncludes(homePage, "猜硬幣", "games panel");
assertIncludes(homePage, "骰子", "games panel");
assertIncludes(homePage, "幸運轉盤", "games panel");
assertIncludes(homePage, "/api/games/coin-flip/play", "games panel");
assertIncludes(homePage, "/api/games/dice/play", "games panel");
assertIncludes(homePage, "/api/games/lucky-spin/play", "games panel");
assertIncludes(homePage, "下注", "games panel");
assertIncludes(homePage, "轉動", "games panel");
assertIncludes(homePage, "Client Seed", "fairness panel");
assertIncludes(homePage, "Server Seed Hash", "fairness panel");
assertIncludes(homePage, "收益寶", "earn panel");
assertIncludes(homePage, "7 天鎖倉", "earn panel");
assertIncludes(homePage, "/api/earn/positions", "earn panel");
assertIncludes(homePage, "/api/earn/lock", "earn panel");
assertIncludes(homePage, "/api/earn/redeem", "earn panel");
assertIncludes(homePage, "鎖倉收益寶", "earn panel");
assertIncludes(homePage, "可領回本金", "earn panel");
assertIncludes(homePage, "外部 DeFi APY", "earn panel");
assertIncludes(homePage, "encodeFunctionData", "deposit panel");
assertIncludes(homePage, "approveDeposit", "deposit panel");
assertIncludes(homePage, "submitDeposit", "deposit panel");
assertIncludes(homePage, "鏈上餘額", "deposit panel");
assertIncludes(homePage, "授權額度", "deposit panel");
assertIncludes(homePage, "存入 VaultManager", "deposit panel");

const testPage = read("src/app/test/page.tsx");
assertIncludes(testPage, "WebValidationDashboard", "test route");
const testDashboard = read("src/components/user/WebValidationDashboard.tsx");
assertIncludes(testDashboard, "Debug 工具頁", "test dashboard");
assertIncludes(testDashboard, "回首頁", "test dashboard");
assertIncludes(testDashboard, "/api/auth/wallet-login", "test dashboard");
assertIncludes(testDashboard, "/api/me", "test dashboard");
assert.ok(!testDashboard.includes("/api/withdrawals"), "test dashboard should not duplicate withdrawal flow");
assert.ok(!testDashboard.includes("submitDeposit"), "test dashboard should not duplicate deposit flow");
assert.ok(!testDashboard.includes("approveDeposit"), "test dashboard should not duplicate approval flow");
assert.ok(!testDashboard.includes("requestWithdrawal"), "test dashboard should not duplicate withdrawal form");
assertIncludes(testDashboard, "充值 MockUSDT", "test dashboard");
assertIncludes(testDashboard, "function mint(address to, uint256 amount)", "test dashboard");
assertIncludes(testDashboard, "mintTestUsdt", "test dashboard");

const uiLabels = read("src/lib/ui-labels.ts");
assertIncludes(uiLabels, "入金", "UI labels");
assertIncludes(uiLabels, "提現", "UI labels");
assertIncludes(uiLabels, "收益寶鎖倉", "UI labels");
assertIncludes(uiLabels, "收益寶領回", "UI labels");
assertIncludes(uiLabels, "收益寶部位尚未到期。", "UI labels");
assertIncludes(uiLabels, "待處理", "UI labels");
assertIncludes(uiLabels, "高風險", "UI labels");
assertIncludes(uiLabels, "translateUiError", "UI labels");

const adminPage = read("src/app/admin/page.tsx");
assertIncludes(adminPage, "/api/admin/overview", "admin dashboard");
assertIncludes(adminPage, "handleReview", "admin dashboard");
assertIncludes(adminPage, "pendingWithdrawals", "admin dashboard");
assertIncludes(adminPage, "營運後台", "admin dashboard");
assertIncludes(adminPage, "待審提現", "admin dashboard");
assertIncludes(adminPage, "收益寶鎖倉本金", "admin dashboard");
assertIncludes(adminPage, "可領回本金", "admin dashboard");
assertIncludes(adminPage, "外部 DeFi 收益", "admin dashboard");
assertIncludes(adminPage, "營運健康", "admin dashboard");
assertIncludes(adminPage, "即時 APY", "admin dashboard");
assertIncludes(adminPage, "實現 APY", "admin dashboard");
assertIncludes(adminPage, "提款缺口", "admin dashboard");
assertIncludes(adminPage, "帳面遊戲金庫", "admin dashboard");
assertIncludes(adminPage, "healthStatusLabel", "admin dashboard");
assertIncludes(adminPage, "healthWarningLabel", "admin dashboard");
assertIncludes(adminPage, "核准", "admin dashboard");
assertIncludes(adminPage, "拒絕", "admin dashboard");

const adminUserPage = read("src/app/admin/users/[id]/page.tsx");
assertIncludes(adminUserPage, "/api/admin/users/", "admin user page");
assertIncludes(adminUserPage, "transactions", "admin user page");
assertIncludes(adminUserPage, "withdrawals", "admin user page");
assertIncludes(adminUserPage, "返回後台", "admin user page");
assertIncludes(adminUserPage, "使用者審核", "admin user page");
assertIncludes(adminUserPage, "交易紀錄", "admin user page");

const authSource = read("src/lib/auth.ts");
assertIncludes(authSource, "ADMIN_WALLET_ADDRESS", "auth helper");
assertIncludes(authSource, "walletAddress", "session payload");
assertIncludes(authSource, "assertWalletAddress(payload.walletAddress)", "session payload validation");

assertIncludes(homePage, "clearStoredSession", "user dashboard stale token handling");
assertIncludes(testDashboard, "clearStoredSession", "test dashboard stale token handling");

const prismaSchema = read("prisma/schema.prisma");
assertIncludes(prismaSchema, "walletAddress  String              @unique", "Prisma User model");
assertIncludes(prismaSchema, "model EarnPosition", "Prisma schema");
assertIncludes(prismaSchema, "EARN_LOCK", "Prisma schema");
assertIncludes(prismaSchema, "EARN_REDEEM", "Prisma schema");
assertIncludes(prismaSchema, "EARN_REWARD_RELEASE", "Prisma schema");
assert.ok(!/tgId|ADMIN_TG_ID|TELEGRAM_BOT_TOKEN|Telegram Mini App|TMA/.test(prismaSchema), "Prisma schema should not contain Telegram identity fields");

const readme = read("README.md");
assert.ok(!/Telegram|TMA|tgId|Bot/.test(readme), "README should describe the web-only product without Telegram references");

const developmentPlan = read("DEVELOPMENT_PLAN.md");
assert.ok(!/Telegram|TMA|tgId|Bot/.test(developmentPlan), "development plan should not point agents toward Telegram work");

const agentGuide = read("AGENTS.md");
assertIncludes(agentGuide, "web-only", "agent guide");
assertIncludes(agentGuide, "Do not add Telegram Bot or Telegram Mini App", "agent guide");

console.log("Web MVP route verification passed.");
