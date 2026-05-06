const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { ethers } = require("hardhat");

describe("Phase 1 Vault Infrastructure", function () {
  async function deployFixture() {
    const [owner, user, treasury, stranger] = await ethers.getSigners();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vault = await VaultManager.deploy(await usdt.getAddress(), treasury.address);
    await vault.waitForDeployment();

    const StakingVault = await ethers.getContractFactory("StakingVault");
    const staking = await StakingVault.deploy(await usdt.getAddress());
    await staking.waitForDeployment();

    await vault.setStakingVault(await staking.getAddress());
    await staking.setVaultManager(await vault.getAddress());

    const depositAmount = ethers.parseUnits("1000", 18);
    await usdt.mint(user.address, depositAmount);

    return { owner, user, treasury, stranger, usdt, vault, staking, depositAmount };
  }

  it("accepts user USDT deposits and emits a Deposit event", async function () {
    const { user, usdt, vault, depositAmount } = await deployFixture();

    await usdt.connect(user).approve(await vault.getAddress(), depositAmount);

    await expect(vault.connect(user).deposit(depositAmount))
      .to.emit(vault, "Deposit")
      .withArgs(user.address, depositAmount, anyValue);

    expect(await usdt.balanceOf(await vault.getAddress())).to.equal(depositAmount);
  });

  it("lets only the owner execute approved withdrawals", async function () {
    const { owner, user, stranger, usdt, vault, depositAmount } = await deployFixture();
    await usdt.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount);

    const withdrawalAmount = ethers.parseUnits("125", 18);

    await expect(vault.connect(stranger).executeWithdrawal(user.address, withdrawalAmount))
      .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(vault.connect(owner).executeWithdrawal(user.address, withdrawalAmount))
      .to.emit(vault, "Withdrawal");

    expect(await usdt.balanceOf(user.address)).to.equal(withdrawalAmount);
  });

  it("distributes batch profit using the default 90/10 split", async function () {
    const { user, treasury, usdt, vault, staking, depositAmount } = await deployFixture();
    await usdt.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount);

    const profit = ethers.parseUnits("100", 18);
    await expect(vault.distributeBatchProfit(profit))
      .to.emit(vault, "ProfitDistributed")
      .withArgs(profit, ethers.parseUnits("90", 18), ethers.parseUnits("10", 18));

    expect(await usdt.balanceOf(await staking.getAddress())).to.equal(ethers.parseUnits("90", 18));
    expect(await usdt.balanceOf(treasury.address)).to.equal(ethers.parseUnits("10", 18));
    expect(await staking.totalRewardPool()).to.equal(ethers.parseUnits("90", 18));
  });

  it("rejects direct reward notifications not sent by VaultManager", async function () {
    const { stranger, staking } = await deployFixture();

    await expect(staking.connect(stranger).notifyRewardAmount(1n)).to.be.revertedWith("Only vault manager");
  });
});
