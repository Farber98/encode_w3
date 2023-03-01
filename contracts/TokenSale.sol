// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMyERC20 {
    function mint(address to, uint256 amount) external;
}

contract TokenSale {
    uint256 public ratio;
    IMyERC20 public token;

    constructor(uint256 _ratio, address _tokenAddress) {
        ratio = _ratio;
        token = IMyERC20(_tokenAddress);
    }

    function buyTokens() external payable {
        uint amountToBeMinted = msg.value * ratio;
        token.mint(msg.sender, amountToBeMinted);
    }
}
