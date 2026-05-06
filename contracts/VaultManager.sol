// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IStakingVault {
    function notifyRewardAmount(uint256 _amount) external;
}

/**
 * @title VaultManager
 * @dev 處理 USDT 儲值、提現與分紅 (80% 收益寶, 20% 平台)。
 * 支持半託管模式：鏈上儲值拋出事件，由後端記錄並管理遊戲。
 */
contract VaultManager is Ownable, ReentrancyGuard {
    IERC20 public usdt;
    address public stakingVault;
    address public operationPool;
    address public platformTreasury;

    uint256 public rewardPercent = 90;
    uint256 public platformPercent = 10;

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event ProfitDistributed(uint256 totalAmount, uint256 rewardAmount, uint256 platformAmount);
    event RatiosUpdated(uint256 newRewardPercent, uint256 newPlatformPercent);

    constructor(address _usdt, address _platformTreasury) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev 讓管理員動態調整分紅比例 (總和需為 100)
     */
    function setDistributionRatios(uint256 _rewardPercent, uint256 _platformPercent) external onlyOwner {
        require(_rewardPercent + _platformPercent == 100, "Total must be 100");
        rewardPercent = _rewardPercent;
        platformPercent = _platformPercent;
        emit RatiosUpdated(_rewardPercent, _platformPercent);
    }

    function setStakingVault(address _stakingVault) external onlyOwner {
        stakingVault = _stakingVault;
    }

    function setPlatformTreasury(address _platformTreasury) external onlyOwner {
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev 每日結算：分紅邏輯改為動態比例
     */
    function distributeBatchProfit(uint256 _totalProfit) external onlyOwner nonReentrant {
        require(stakingVault != address(0), "Staking vault not set");
        require(usdt.balanceOf(address(this)) >= _totalProfit, "Insufficient balance");

        uint256 rewardAmount = (_totalProfit * rewardPercent) / 100;
        uint256 platformAmount = _totalProfit - rewardAmount;

        // 轉給收益寶
        require(usdt.transfer(stakingVault, rewardAmount), "Transfer failed");
        IStakingVault(stakingVault).notifyRewardAmount(rewardAmount);
        
        // 轉給平台國庫
        require(usdt.transfer(platformTreasury, platformAmount), "Transfer failed");

        emit ProfitDistributed(_totalProfit, rewardAmount, platformAmount);
    }

    // 緊急提取
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}
