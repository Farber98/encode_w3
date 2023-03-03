// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMyERC20 is IERC20 {
    function mint(address to, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;

    function transfer(address to, uint256 amount) external returns (bool);
}

interface IMyERC721 is IERC721 {
    function transferFrom(address from, address to, uint256 amount) external;

    function safeMint(address to, uint256 tokenId) external;

    function burn(uint256 tokenId) external;
}

contract TokenSale is Ownable {
    uint256 public ratio;
    uint256 public nftPrice;
    uint256 public withdrawableAmount;
    IMyERC20 public token;
    IMyERC721 public nft;

    constructor(
        uint256 _ratio,
        uint256 _nftPrice,
        address _tokenAddress,
        address _nftAddress
    ) {
        ratio = _ratio;
        nftPrice = _nftPrice;
        token = IMyERC20(_tokenAddress);
        nft = IMyERC721(_nftAddress);
    }

    function buyTokens() external payable {
        uint amountToBeMinted = msg.value * ratio;
        token.mint(msg.sender, amountToBeMinted);
    }

    function burnTokens(uint256 amount) external {
        token.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount / ratio);
    }

    function buyNFT(uint256 tokenId) external payable {
        // Charge tokens
        token.transferFrom(msg.sender, address(this), nftPrice);
        // Mint NFT
        nft.safeMint(msg.sender, tokenId);
        // Update owner withdrawable account
        withdrawableAmount += nftPrice / 2;
    }

    function burnNFT(uint256 tokenId) external {
        // Burn the senders nft
        nft.burn(tokenId);
        // Transfer tokens
        token.transfer(msg.sender, nftPrice);
    }

    function withdraw(uint256 amount) external onlyOwner {
        // Update owner withdrawable account.
        withdrawableAmount -= amount;
        // Send tokens to owner
        token.transfer(owner(), amount);
    }
}
