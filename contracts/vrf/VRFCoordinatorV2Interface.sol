// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface VRFCoordinatorV2Interface {
    /**
     * @dev 向 VRF Coordinator 請求一組隨機數。
     * @param keyHash 指定使用的 VRF gas lane key hash。
     * @param subId 付款用的 VRF subscription ID。
     * @param minimumRequestConfirmations 回調前需要等待的區塊確認數。
     * @param callbackGasLimit Coordinator 呼叫 consumer 回調時可使用的 gas 上限。
     * @param numWords 要求回傳的隨機數數量。
     * @return requestId 本次 VRF 請求編號。
     */
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}
