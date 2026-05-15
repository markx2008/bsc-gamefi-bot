// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract VRFConsumerBaseV2 {
    error OnlyCoordinatorCanFulfill(address have, address want);

    address private immutable vrfCoordinator;

    /**
     * @dev 初始化 VRF consumer base，記錄允許呼叫回調的 Coordinator 地址。
     * @param _vrfCoordinator Chainlink VRF Coordinator 地址。
     */
    constructor(address _vrfCoordinator) {
        vrfCoordinator = _vrfCoordinator;
    }

    /**
     * @dev 子合約需實作的 VRF 隨機數處理邏輯。
     * @param requestId VRF 請求編號。
     * @param randomWords VRF 回傳的隨機數陣列。
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

    /**
     * @dev Coordinator 對外呼叫的入口，驗證呼叫者後轉交給子合約處理。
     * @param requestId VRF 請求編號。
     * @param randomWords VRF 回傳的隨機數陣列。
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill(msg.sender, vrfCoordinator);
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
