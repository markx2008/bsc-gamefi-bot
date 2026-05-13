import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();
  console.log("🚀 正在使用帳戶部署合約:", deployer.address);

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("💎 MockUSDT 部署於:", usdtAddress);

  const platformTreasury = process.env.PLATFORM_TREASURY || deployer.address;
  const VaultManager = await ethers.getContractFactory("VaultManager");
  const vault = await VaultManager.deploy(usdtAddress, platformTreasury);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("🏦 VaultManager 部署於:", vaultAddress);

  const StakingVault = await ethers.getContractFactory("StakingVault");
  const staking = await StakingVault.deploy(usdtAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("🥩 StakingVault 部署於:", stakingAddress);

  await vault.setStakingVault(stakingAddress);
  await staking.setVaultManager(vaultAddress);
  console.log("✅ 已將 VaultManager 與 StakingVault 雙向連結");

  console.log("\n--- 部署完成 ---");
  console.log("USDT_ADDRESS=", usdtAddress);
  console.log("VAULT_ADDRESS=", vaultAddress);
  console.log("STAKING_VAULT_ADDRESS=", stakingAddress);
  console.log("PLATFORM_TREASURY=", platformTreasury);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
