import { MyERC20 } from './../typechain-types/contracts/MyERC20';
import { MyERC20__factory } from './../typechain-types/factories/contracts/MyERC20__factory';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TokenSale, TokenSale__factory } from "../typechain-types";
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

// Each nft is 4 tokens = 2 eth.
const TEST_NFT_PRICE: BigNumber = BigNumber.from(4)
// Each token is 0.5eth
const TEST_TOKEN_RATIO: number = 2
const MINTER_ROLE_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))


describe("NFT Shop", async () => {
    let tokenSaleContract: TokenSale
    let myERC20TokenContract: MyERC20
    let deployer: SignerWithAddress
    let account1: SignerWithAddress
    let account2: SignerWithAddress
    let account3: SignerWithAddress


    beforeEach(async () => {
        // Deconstruct addresses
        [deployer, account1, account2, account3] = await ethers.getSigners()

        // Deploy token contract.
        const myERC20ContractFactory = new MyERC20__factory(deployer)
        myERC20TokenContract = await myERC20ContractFactory.deploy()
        await myERC20TokenContract.deployTransaction.wait()


        // Standard tokenSale contract.
        const tokenSaleContractFactory = new TokenSale__factory(deployer)
        tokenSaleContract = await tokenSaleContractFactory.deploy(TEST_TOKEN_RATIO, TEST_NFT_PRICE, myERC20TokenContract.address)
        await tokenSaleContract.deployTransaction.wait();

        // Give minter role to token sale contract
        const giveMinterRoleTx = await myERC20TokenContract.grantRole(
            MINTER_ROLE_HASH,
            tokenSaleContract.address)

        await giveMinterRoleTx.wait()
    });

    describe("When the Shop contract is deployed", async () => {
        it("defines the ratio as provided in parameters", async () => {
            expect(await tokenSaleContract.ratio()).to.be.eq(TEST_TOKEN_RATIO)
        });

        it("uses a valid ERC20 as payment token", async () => {
            expect(await myERC20TokenContract.name()).not.to.be.empty
            expect(await myERC20TokenContract.symbol()).not.to.be.empty
            expect(await myERC20TokenContract.totalSupply()).not.to.be.empty
            expect(await myERC20TokenContract.balanceOf(ethers.constants.AddressZero)).not.to.be.empty
            expect(await myERC20TokenContract.decimals()).to.be.eq(BigNumber.from(18))
        });
    });

    describe("When a user buys an ERC20 from the Token contract", async () => {
        let tokenBalanceBeforeMint: BigNumber
        let ethBalanceBeforeMint: BigNumber
        const ETHER_TO_SPEND: BigNumber = ethers.utils.parseEther("10")
        let mintTxFee: BigNumber


        beforeEach(async () => {
            // Get values before buying
            tokenBalanceBeforeMint = await myERC20TokenContract.balanceOf(account1.address)
            ethBalanceBeforeMint = await account1.getBalance()

            // Do the minting.  
            const mintTx = await tokenSaleContract.connect(account1).buyTokens({ value: ETHER_TO_SPEND })
            const mintTexReceipt = await mintTx.wait()
            mintTxFee = mintTexReceipt.gasUsed.mul(mintTexReceipt.effectiveGasPrice)

        });

        it("charges the correct amount of ETH", async () => {
            const ethBalanceAfterMint = await account1.getBalance()
            // Also subtracting tx fee.
            expect(ethBalanceAfterMint).to.be.eq(ethBalanceBeforeMint.sub(ETHER_TO_SPEND).sub(mintTxFee))
        });

        it("gives the correct amount of tokens", async () => {
            const tokenBalanceAfterMint = await myERC20TokenContract.balanceOf(account1.address)
            expect(tokenBalanceAfterMint).to.be.eq(tokenBalanceBeforeMint.add(ETHER_TO_SPEND.mul(TEST_TOKEN_RATIO)))
        });

        describe("When a user burns an ERC20 at the Shop contract", async () => {
            let tokenBalanceBeforeBurn: BigNumber
            let ethBalanceBeforeBurn: BigNumber
            let burnTxFee: BigNumber
            let approveTxFee: BigNumber
            let tokensToBurn: BigNumber

            beforeEach(async () => {
                tokenBalanceBeforeBurn = await myERC20TokenContract.balanceOf(account1.address)
                ethBalanceBeforeBurn = await account1.getBalance()
                tokensToBurn = tokenBalanceBeforeBurn.div(2)
                // To burn tokens we need balance and allowance.
                const approveTx = await myERC20TokenContract.connect(account1).approve(tokenSaleContract.address, tokensToBurn)
                const approveTxReceipt = await approveTx.wait()
                approveTxFee = approveTxReceipt.gasUsed.mul(approveTxReceipt.effectiveGasPrice)

                const burnTx = await tokenSaleContract.connect(account1).burnTokens(tokensToBurn)
                const burnTxReceipt = await burnTx.wait()
                burnTxFee = burnTxReceipt.gasUsed.mul(burnTxReceipt.effectiveGasPrice)
            })

            it("gives the correct amount of ETH", async () => {
                const ethBalanceAfterBurn = await account1.getBalance()
                expect(ethBalanceAfterBurn).to.be.equal(ethBalanceBeforeBurn.sub(approveTxFee).sub(burnTxFee).add(tokensToBurn.div(TEST_TOKEN_RATIO)))

            });

            it("burns the correct amount of tokens", async () => {
                const tokenBalanceAfterBurn = await myERC20TokenContract.balanceOf(account1.address)
                expect(tokenBalanceAfterBurn).to.be.equal(tokenBalanceBeforeBurn.sub(tokensToBurn))
            });
        });


        describe("When a user buys an NFT from the Shop contract", async () => {
            let tokenBalanceBeforeBuy: BigNumber
            let buyTxFee: BigNumber
            let ethBalanceBeforeBuy: BigNumber
            let approveTxFee: BigNumber
            const NFT_PRICE = BigNumber.from(5)

            beforeEach(async () => {
                tokenBalanceBeforeBuy = await myERC20TokenContract.balanceOf(account1.address)
                ethBalanceBeforeBuy = await account1.getBalance()
                // To burn tokens we need balance and allowance.
                const approveTx = await myERC20TokenContract.connect(account1).approve(tokenSaleContract.address, NFT_PRICE)
                const approveTxReceipt = await approveTx.wait()
                approveTxFee = approveTxReceipt.gasUsed.mul(approveTxReceipt.effectiveGasPrice)

                const buyTx = await tokenSaleContract.connect(account1).buyNFT()
                const buyTxReceipt = await buyTx.wait()
                buyTxFee = buyTxReceipt.gasUsed.mul(buyTxReceipt.effectiveGasPrice)
            })


            it("charges the correct amount of ERC20 tokens", async () => {
                const tokenBalanceAfterBuy = await myERC20TokenContract.balanceOf(account1.address)
                expect(tokenBalanceAfterBuy).to.be.equal(tokenBalanceBeforeBuy.sub(NFT_PRICE))
            });

            it("gives the correct NFT", async () => {
                throw new Error("Not implemented");
            });

            it("updates the owner pool account correctly", async () => {
                throw new Error("Not implemented");
            });
        });

    });


    describe("When a user burns their NFT at the Shop contract", async () => {
        it("gives the correct amount of ERC20 tokens", async () => {
            throw new Error("Not implemented");
        });
        it("updates the public pool correctly", async () => {
            throw new Error("Not implemented");
        });
    });

    describe("When the owner withdraw from the Shop contract", async () => {
        it("recovers the right amount of ERC20 tokens", async () => {
            throw new Error("Not implemented");
        });

        it("updates the owner pool account correctly", async () => {
            throw new Error("Not implemented");
        });
    });
});
