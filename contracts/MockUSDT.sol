// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    /**
     * @dev 初始化測試用 USDT，並鑄造初始供應量給部署者。
     */
    constructor() ERC20("Mock USDT", "USDT") {
        _mint(msg.sender, 1000000 * 10**18); // 初始鑄造 100 萬個
    }

    /**
     * @dev 鑄造測試用 USDT 給指定地址。
     * @param to 接收新鑄造 token 的地址。
     * @param amount 要鑄造的 token 金額。
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
