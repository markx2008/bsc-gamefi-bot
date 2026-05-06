// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title StakingVault
 * @dev 處理 USDT 鎖倉 7 天，並接收來自 VaultManager 的獎金分紅。
 */
contract StakingVault is Ownable, ReentrancyGuard {
    IERC20 public usdt;
    
    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastRewardWithdrawTime;
    }

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public totalStaked;
    
    mapping(address => Stake) public stakes;
    
    // 總獎金池（來自遊戲獲利）
    uint256 public totalRewardPool;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward);
    event RewardAdded(uint256 amount);

    constructor(address _usdt) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
    }

    /**
     * @dev 使用者質押 USDT
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        Stake storage userStake = stakes[msg.sender];
        
        // 如果原本就有質押，先結算舊的（這裡簡單處理，實際可做更複雜的複利）
        if (userStake.amount > 0) {
            // 此處可擴充獎金領取邏輯
        }

        userStake.amount += _amount;
        userStake.startTime = block.timestamp;
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev 接收來自 VaultManager 的獎金
     */
    function notifyRewardAmount(uint256 _amount) external {
        // 這裡應該限制只有 VaultManager 能調用，或直接接收轉帳
        totalRewardPool += _amount;
        emit RewardAdded(_amount);
    }

    /**
     * @dev 提現：必須滿 7 天，否則根據您的需求可設計罰金
     */
    function withdraw() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(block.timestamp >= userStake.startTime + LOCK_PERIOD, "Lock period not over");

        uint256 amountToWithdraw = userStake.amount;
        
        // 計算該用戶應得獎金比例（簡單模型：按總質押佔比）
        uint256 reward = 0;
        if (totalStaked > 0) {
            reward = (totalRewardPool * amountToWithdraw) / totalStaked;
        }

        // 更新狀態
        totalStaked -= amountToWithdraw;
        totalRewardPool -= reward;
        delete stakes[msg.sender];

        // 轉帳給用戶
        require(usdt.transfer(msg.sender, amountToWithdraw + reward), "Withdrawal transfer failed");

        emit Withdrawn(msg.sender, amountToWithdraw, reward);
    }

    /**
     * @dev 查詢當前預計可得獎金
     */
    function pendingReward(address _user) external view returns (uint256) {
        Stake storage userStake = stakes[_user];
        if (totalStaked == 0) return 0;
        return (totalRewardPool * userStake.amount) / totalStaked;
    }
}
