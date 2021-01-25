// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Bat is ERC20 {
    constructor() ERC20("Bat", "Brave Browser token") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
