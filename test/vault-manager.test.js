const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { ethers } = require("hardhat");

const WEEK = 7 * 24 * 60 * 60;

describe("Phase 1 Vault Infrastructure", function () {
  async function deployFixture() {
    const [owner, user, treasury, stranger, secondUser, gameTreasury] = await ethers.getSigners();

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
    await usdt.mint(secondUser.address, depositAmount);
    await usdt.mint(gameTreasury.address, depositAmount);

    return { owner, user, treasury, stranger, secondUser, gameTreasury, usdt, vault, staking, depositAmount };
  }

  async function depositToVault(user, usdt, vault, amount) {
    await usdt.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount);
  }

  it("accepts user USDT deposits and emits a Deposit event", async function () {
    const { user, usdt, vault, depositAmount } = await deployFixture();

    await usdt.connect(user).approve(await vault.getAddress(), depositAmount);

    await expect(vault.connect(user).deposit(depositAmount))
      .to.emit(vault, "Deposit")
      .withArgs(user.address, depositAmount, anyValue);

    expect(await usdt.balanceOf(await vault.getAddress())).to.equal(depositAmount);
    expect(await vault.reservedLiabilities()).to.equal(depositAmount);
  });

  it("lets only the owner execute approved withdrawals and reduces reserved liabilities", async function () {
    const { owner, user, stranger, usdt, vault, depositAmount } = await deployFixture();
    await depositToVault(user, usdt, vault, depositAmount);

    const withdrawalAmount = ethers.parseUnits("125", 18);

    await expect(vault.connect(stranger).executeWithdrawal(user.address, withdrawalAmount))
      .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(vault.connect(owner).executeWithdrawal(user.address, withdrawalAmount))
      .to.emit(vault, "Withdrawal");

    expect(await usdt.balanceOf(user.address)).to.equal(withdrawalAmount);
    expect(await vault.reservedLiabilities()).to.equal(depositAmount - withdrawalAmount);
  });

  it("does not let the owner distribute user deposits as profit", async function () {
    const { user, usdt, vault, depositAmount } = await deployFixture();
    await depositToVault(user, usdt, vault, depositAmount);

    await expect(vault.distributeBatchProfit(ethers.parseUnits("100", 18))).to.be.revertedWith("Insufficient profit");
  });

  it("records game profit and distributes it using the default 90/10 split", async function () {
    const { user, treasury, gameTreasury, usdt, vault, staking, depositAmount } = await deployFixture();
    await depositToVault(user, usdt, vault, depositAmount);

    const profit = ethers.parseUnits("100", 18);
    await usdt.connect(gameTreasury).approve(await vault.getAddress(), profit);
    await expect(vault.connect(gameTreasury).receiveGameProfit(profit))
      .to.emit(vault, "GameProfitReceived")
      .withArgs(gameTreasury.address, profit);

    await expect(vault.distributeBatchProfit(profit))
      .to.emit(vault, "ProfitDistributed")
      .withArgs(profit, ethers.parseUnits("90", 18), ethers.parseUnits("10", 18));

    expect(await usdt.balanceOf(await staking.getAddress())).to.equal(ethers.parseUnits("90", 18));
    expect(await usdt.balanceOf(treasury.address)).to.equal(ethers.parseUnits("10", 18));
    expect(await staking.totalRewardPool()).to.equal(ethers.parseUnits("90", 18));
    expect(await vault.undistributedProfit()).to.equal(0n);
    expect(await vault.reservedLiabilities()).to.equal(depositAmount);
  });

  it("rejects direct reward notifications not sent by VaultManager", async function () {
    const { stranger, staking } = await deployFixture();

    await expect(staking.connect(stranger).notifyRewardAmount(1n)).to.be.revertedWith("Only vault manager");
  });

  it("resets the lock period when an existing staker adds more funds", async function () {
    const { user, usdt, staking } = await deployFixture();
    const firstStake = ethers.parseUnits("100", 18);
    const secondStake = ethers.parseUnits("50", 18);

    await usdt.connect(user).approve(await staking.getAddress(), firstStake + secondStake);
    await staking.connect(user).stake(firstStake);

    await ethers.provider.send("evm_increaseTime", [WEEK + 1]);
    await ethers.provider.send("evm_mine");

    await staking.connect(user).stake(secondStake);

    await expect(staking.connect(user).withdraw()).to.be.revertedWith("Lock period not over");
  });

  it("does not give old staking rewards to users who stake after rewards arrive", async function () {
    const { user, secondUser, gameTreasury, usdt, vault, staking } = await deployFixture();
    const stakeAmount = ethers.parseUnits("100", 18);
    const profit = ethers.parseUnits("100", 18);

    await usdt.connect(user).approve(await staking.getAddress(), stakeAmount);
    await staking.connect(user).stake(stakeAmount);

    await usdt.connect(gameTreasury).approve(await vault.getAddress(), profit);
    await vault.connect(gameTreasury).receiveGameProfit(profit);
    await vault.distributeBatchProfit(profit);

    await usdt.connect(secondUser).approve(await staking.getAddress(), stakeAmount);
    await staking.connect(secondUser).stake(stakeAmount);

    expect(await staking.pendingReward(user.address)).to.equal(ethers.parseUnits("90", 18));
    expect(await staking.pendingReward(secondUser.address)).to.equal(0n);

    await ethers.provider.send("evm_increaseTime", [WEEK + 1]);
    await ethers.provider.send("evm_mine");

    await staking.connect(secondUser).withdraw();
    expect(await usdt.balanceOf(secondUser.address)).to.equal(ethers.parseUnits("1000", 18));

    await staking.connect(user).withdraw();
    expect(await usdt.balanceOf(user.address)).to.equal(ethers.parseUnits("1090", 18));
  });
});
