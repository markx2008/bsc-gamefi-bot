// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VaultManager
 * @dev 負責遊戲資金分配：80% 給收益寶 (Staking), 20% 給平台利潤。
 */
contract VaultManager is Ownable, ReentrancyGuard {
    IERC20 public usdt;
    address public stakingVault;
    address public platformWallet;

    uint256 public constant REWARD_PERCENT = 80;
    uint256 public constant PLATFORM_PERCENT = 20;

    event FundsDistributed(uint256 totalAmount, uint256 rewardAmount, uint256 platformAmount);

    constructor(address _usdt, address _platformWallet) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        platformWallet = _platformWallet;
    }

    function setStakingVault(address _stakingVault) external onlyOwner {
        stakingVault = _stakingVault;
    }

    /**
     * @dev 當遊戲結束，莊家盈餘進入此函數進行分配
     */
    function distributeGameProfit(uint256 _amount) external nonReentrant {
        require(stakingVault != address(0), "Staking vault not set");
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        uint256 rewardAmount = (_amount * REWARD_PERCENT) / 100;
        uint256 platformAmount = _amount - rewardAmount;

        // 轉給收益寶
        require(usdt.transfer(stakingVault, rewardAmount), "Transfer to staking failed");
        
        // 轉給平台
        require(usdt.transfer(platformWallet, platformAmount), "Transfer to platform failed");

        emit FundsDistributed(_amount, rewardAmount, platformAmount);
    }

    // 允許管理員緊急提取（以防萬一）
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}
