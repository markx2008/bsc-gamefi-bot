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
    address public platformTreasury;

    uint256 public constant REWARD_PERCENT = 80;
    uint256 public constant PLATFORM_PERCENT = 20;

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event ProfitDistributed(uint256 totalAmount, uint256 rewardAmount, uint256 platformAmount);

    constructor(address _usdt, address _platformTreasury) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        platformTreasury = _platformTreasury;
    }

    function setStakingVault(address _stakingVault) external onlyOwner {
        stakingVault = _stakingVault;
    }

    function setPlatformTreasury(address _platformTreasury) external onlyOwner {
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev 用戶儲值 USDT 入金
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Deposit amount must be > 0");
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        emit Deposit(msg.sender, _amount, block.timestamp);
    }

    /**
     * @dev 管理員批准後的提現發放
     */
    function adminWithdrawForUser(address _user, uint256 _amount) external onlyOwner nonReentrant {
        require(usdt.balanceOf(address(this)) >= _amount, "Insufficient vault balance");
        require(usdt.transfer(_user, _amount), "Withdraw transfer failed");
        
        emit Withdrawal(_user, _amount, block.timestamp);
    }

    /**
     * @dev 每日結算：從後端計算昨日總利潤，一次性分紅
     * 此函數應由後端服務器（管理員）調用
     */
    function distributeBatchProfit(uint256 _totalProfit) external onlyOwner nonReentrant {
        require(stakingVault != address(0), "Staking vault not set");
        require(usdt.balanceOf(address(this)) >= _totalProfit, "Insufficient balance to distribute");

        uint256 rewardAmount = (_totalProfit * REWARD_PERCENT) / 100;
        uint256 platformAmount = _totalProfit - rewardAmount;

        // 轉給收益寶並通知
        require(usdt.transfer(stakingVault, rewardAmount), "Transfer to staking failed");
        IStakingVault(stakingVault).notifyRewardAmount(rewardAmount);
        
        // 轉給平台國庫 (用於運營與利潤)
        require(usdt.transfer(platformTreasury, platformAmount), "Transfer to treasury failed");

        emit ProfitDistributed(_totalProfit, rewardAmount, platformAmount);
    }

    // 緊急提取
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}
