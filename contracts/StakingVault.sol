// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingVault
 * @dev 處理 USDT 鎖倉 7 天，並接收來自 VaultManager 的獎金分紅。
 */
contract StakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant REWARD_PRECISION = 1e18;

    IERC20 public immutable usdt;
    address public vaultManager;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 rewardDebt;
        uint256 accruedReward;
    }

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public totalStaked;
    uint256 public totalRewardPool;
    uint256 public accRewardPerShare;
    uint256 public queuedRewards;

    mapping(address => Stake) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward);
    event RewardAdded(uint256 amount);
    event VaultManagerUpdated(address indexed vaultManager);

    constructor(address _usdt) Ownable(msg.sender) {
        require(_usdt != address(0), "Invalid USDT");
        usdt = IERC20(_usdt);
    }

    function setVaultManager(address _vaultManager) external onlyOwner {
        require(_vaultManager != address(0), "Invalid vault manager");
        vaultManager = _vaultManager;
        emit VaultManagerUpdated(_vaultManager);
    }

    /**
     * @dev 使用者質押 USDT
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        _updateReward(msg.sender);
        usdt.safeTransferFrom(msg.sender, address(this), _amount);

        Stake storage userStake = stakes[msg.sender];
        userStake.startTime = block.timestamp;
        userStake.amount += _amount;
        userStake.rewardDebt = (userStake.amount * accRewardPerShare) / REWARD_PRECISION;
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev 接收來自 VaultManager 的獎金
     */
    function notifyRewardAmount(uint256 _amount) external {
        require(msg.sender == vaultManager, "Only vault manager");
        require(_amount > 0, "Amount must be > 0");
        totalRewardPool += _amount;

        if (totalStaked == 0) {
            queuedRewards += _amount;
        } else {
            uint256 distributableReward = _amount + queuedRewards;
            queuedRewards = 0;
            accRewardPerShare += (distributableReward * REWARD_PRECISION) / totalStaked;
        }

        emit RewardAdded(_amount);
    }

    /**
     * @dev 提現：必須滿 7 天，否則根據您的需求可設計罰金
     */
    function withdraw() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(block.timestamp >= userStake.startTime + LOCK_PERIOD, "Lock period not over");

        _updateReward(msg.sender);

        uint256 amountToWithdraw = userStake.amount;
        uint256 reward = userStake.accruedReward;

        totalStaked -= amountToWithdraw;
        if (reward > 0) {
            totalRewardPool -= reward;
        }
        delete stakes[msg.sender];

        usdt.safeTransfer(msg.sender, amountToWithdraw + reward);

        emit Withdrawn(msg.sender, amountToWithdraw, reward);
    }

    /**
     * @dev 查詢當前預計可得獎金
     */
    function pendingReward(address _user) public view returns (uint256) {
        Stake storage userStake = stakes[_user];
        if (userStake.amount == 0) return 0;
        uint256 accumulatedReward = (userStake.amount * accRewardPerShare) / REWARD_PRECISION;
        return userStake.accruedReward + accumulatedReward - userStake.rewardDebt;
    }

    function _updateReward(address _user) private {
        Stake storage userStake = stakes[_user];
        if (userStake.amount == 0) return;
        userStake.accruedReward = pendingReward(_user);
        userStake.rewardDebt = (userStake.amount * accRewardPerShare) / REWARD_PRECISION;
    }
}
