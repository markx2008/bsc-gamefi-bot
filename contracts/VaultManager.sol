// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStakingVault {
    function notifyRewardAmount(uint256 _amount) external;
}

/**
 * @title VaultManager
 * @dev 處理 USDT 儲值、提現與分紅 (90% 收益寶, 10% 平台)。
 * 支持半託管模式：鏈上儲值拋出事件，由後端記錄並管理遊戲。
 */
contract VaultManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    address public stakingVault;
    address public platformTreasury;

    uint256 public rewardPercent = 90;
    uint256 public platformPercent = 10;
    uint256 public reservedLiabilities;
    uint256 public undistributedProfit;

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event GameProfitReceived(address indexed source, uint256 amount);
    event ProfitDistributed(uint256 totalAmount, uint256 rewardAmount, uint256 platformAmount);
    event RatiosUpdated(uint256 newRewardPercent, uint256 newPlatformPercent);
    event StakingVaultUpdated(address indexed stakingVault);
    event PlatformTreasuryUpdated(address indexed platformTreasury);

    constructor(address _usdt, address _platformTreasury) Ownable(msg.sender) {
        require(_usdt != address(0), "Invalid USDT");
        require(_platformTreasury != address(0), "Invalid treasury");
        usdt = IERC20(_usdt);
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev 用戶儲值 USDT 到全局金庫，後端 listener 依 Deposit event 入帳。
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        reservedLiabilities += _amount;
        usdt.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(msg.sender, _amount, block.timestamp);
    }

    /**
     * @dev 遊戲合約或後端熱錢包將已結算遊戲利潤轉入可分配 bucket。
     */
    function receiveGameProfit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        undistributedProfit += _amount;
        usdt.safeTransferFrom(msg.sender, address(this), _amount);
        emit GameProfitReceived(msg.sender, _amount);
    }

    /**
     * @dev 管理員審核後執行提現；用戶餘額扣減由後端資料庫事務處理。
     */
    function executeWithdrawal(address _user, uint256 _amount) external onlyOwner nonReentrant {
        require(_user != address(0), "Invalid user");
        require(_amount > 0, "Amount must be > 0");
        require(reservedLiabilities >= _amount, "Insufficient liabilities");
        reservedLiabilities -= _amount;
        usdt.safeTransfer(_user, _amount);
        emit Withdrawal(_user, _amount, block.timestamp);
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
        require(_stakingVault != address(0), "Invalid staking vault");
        stakingVault = _stakingVault;
        emit StakingVaultUpdated(_stakingVault);
    }

    function setPlatformTreasury(address _platformTreasury) external onlyOwner {
        require(_platformTreasury != address(0), "Invalid treasury");
        platformTreasury = _platformTreasury;
        emit PlatformTreasuryUpdated(_platformTreasury);
    }

    /**
     * @dev 每日結算：只允許分配已記錄的遊戲利潤，避免誤分用戶本金。
     */
    function distributeBatchProfit(uint256 _totalProfit) external onlyOwner nonReentrant {
        require(_totalProfit > 0, "Profit must be > 0");
        require(stakingVault != address(0), "Staking vault not set");
        require(undistributedProfit >= _totalProfit, "Insufficient profit");

        undistributedProfit -= _totalProfit;

        uint256 rewardAmount = (_totalProfit * rewardPercent) / 100;
        uint256 platformAmount = _totalProfit - rewardAmount;

        usdt.safeTransfer(stakingVault, rewardAmount);
        IStakingVault(stakingVault).notifyRewardAmount(rewardAmount);

        usdt.safeTransfer(platformTreasury, platformAmount);

        emit ProfitDistributed(_totalProfit, rewardAmount, platformAmount);
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
