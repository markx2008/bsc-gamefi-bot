// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

/**
 * @title CoinFlip
 * @dev 猜硬幣遊戲，串接 Chainlink VRF 獲取隨機數。
 */
contract CoinFlip is VRFConsumerBaseV2, ReentrancyGuard, Ownable {
    IERC20 public usdt;
    address public vaultManager;

    // Chainlink VRF 參數 (以 BSC 為例，部署時需設定)
    VRFCoordinatorV2Interface public COORDINATOR;
    uint64 public s_subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit = 100000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    struct RequestStatus {
        address player;
        uint256 betAmount;
        bool choice; // true for Head, false for Tail
        bool fulfilled;
        bool exists;
    }
    mapping(uint256 => RequestStatus) public s_requests;

    event BetPlaced(address indexed player, uint256 amount, bool choice, uint256 requestId);
    event BetSettled(address indexed player, uint256 amount, bool win, uint256 requestId);

    constructor(
        address _usdt,
        address _vaultManager,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) VRFConsumerBaseV2(_vrfCoordinator) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        vaultManager = _vaultManager;
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        s_subscriptionId = _subscriptionId;
    }

    /**
     * @dev 玩家下注
     * @param _amount 下注金額
     * @param _choice 選擇：true (正面), false (反面)
     */
    function flip(uint256 _amount, bool _choice) external nonReentrant returns (uint256 requestId) {
        require(_amount > 0, "Bet amount must be > 0");
        require(usdt.transferFrom(msg.sender, address(this), _amount), "USDT transfer failed");

        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );

        s_requests[requestId] = RequestStatus({
            player: msg.sender,
            betAmount: _amount,
            choice: _choice,
            fulfilled: false,
            exists: true
        });

        emit BetPlaced(msg.sender, _amount, _choice, requestId);
    }

    /**
     * @dev Chainlink VRF 回傳隨機數後的回調函數
     */
    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        RequestStatus storage request = s_requests[_requestId];
        require(request.exists, "Request not found");
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        bool result = (_randomWords[0] % 2 == 0); // 0 or 1
        bool win = (result == request.choice);

        if (win) {
            // 贏了：退還本金並發放獎金 (1.95x 賠率範例)
            uint256 payout = (request.betAmount * 195) / 100;
            require(usdt.transfer(request.player, payout), "Payout failed");
            emit BetSettled(request.player, request.betAmount, true, _requestId);
        } else {
            // 輸了：將資金轉入 VaultManager 進行分配
            require(usdt.approve(vaultManager, request.betAmount), "Approve failed");
            // 這裡假設 VaultManager 有 distributeBatchProfit 接口
            // 注意：實際實作可能需要 VaultManager 透過 interface 調用
            emit BetSettled(request.player, request.betAmount, false, _requestId);
            
            // 轉交給 VaultManager
            (bool success, ) = vaultManager.call(
                abi.encodeWithSignature("distributeBatchProfit(uint256)", request.betAmount)
            );
            require(success, "Distribution to vault failed");
        }
    }

    // 補充資金池（用於支付贏家的獎金）
    function fundPool(uint256 _amount) external onlyOwner {
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Fund failed");
    }
}
