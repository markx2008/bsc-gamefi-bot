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
assert.equal(
  packageJson.scripts["test:web-mvp"],
  "node scripts/verify-web-mvp-routes.mjs",
  "package.json should expose test:web-mvp",
);

const devLoginRoute = read("src/app/api/auth/dev-login/route.ts");
assertIncludes(devLoginRoute, "NODE_ENV === \"production\"", "dev login route");
assertIncludes(devLoginRoute, "WEB_MVP_ENABLE_DEV_LOGIN", "dev login route");
assertIncludes(devLoginRoute, "signSessionToken", "dev login route");
assertIncludes(devLoginRoute, "ADMIN_TG_ID", "dev login route");
assertIncludes(devLoginRoute, "prisma.user.upsert", "dev login route");

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
assertIncludes(homePage, "/api/auth/dev-login", "web dashboard");
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

console.log("Web MVP route verification passed.");
