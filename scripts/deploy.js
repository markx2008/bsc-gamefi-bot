const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 正在使用帳戶部署合約:", deployer.address);

  // 1. 部署 USDT 模擬代幣 (僅用於測試網，如果是主網則填寫真實地址)
  // 這裡假設我們需要一個測試用的 USDT
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.deployed();
  console.log("💎 MockUSDT 部署於:", usdt.address);

  // 2. 部署 VaultManager
  const platformTreasury = deployer.address; // 暫時設為部署者地址
  const VaultManager = await hre.ethers.getContractFactory("VaultManager");
  const vault = await VaultManager.deploy(usdt.address, platformTreasury);
  await vault.deployed();
  console.log("🏦 VaultManager 部署於:", vault.address);

  // 3. 部署 StakingVault
  const StakingVault = await hre.ethers.getContractFactory("StakingVault");
  const staking = await StakingVault.deploy(usdt.address);
  await staking.deployed();
  console.log("🥩 StakingVault 部署於:", staking.address);

  // 設定關聯
  await vault.setStakingVault(staking.address);
  console.log("✅ 已將 StakingVault 連結至 VaultManager");

  console.log("\n--- 部署完成 ---");
  console.log("請將以上地址填入您的 .env 檔案中。");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
