// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMyERC20 is IERC20 {
    function mint(address to, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;

    function buyNFT() external;
}

contract TokenSale {
    uint256 public ratio;
    uint256 public nftPrice;
    IMyERC20 public token;

    constructor(uint256 _ratio, uint256 _nftPrice, address _tokenAddress) {
        ratio = _ratio;
        nftPrice = _nftPrice;
        token = IMyERC20(_tokenAddress);
    }

    function buyTokens() external payable {
        uint amountToBeMinted = msg.value * ratio;
        token.mint(msg.sender, amountToBeMinted);
    }

    function burnTokens(uint256 amount) external {
        token.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount / ratio);
    }

    function buyNFT() external payable {
        // Charge tokens
        token.transferFrom(msg.sender, address(this), nftPrice);
        // Mint NFT

        // Update owner withdrawable account
    }
}
