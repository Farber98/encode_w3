import { MyERC721 } from './../typechain-types/contracts/MyERC721';
import { MyERC721__factory } from './../typechain-types/factories/contracts/MyERC721__factory';
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
const TEST_TOKEN_ID: BigNumber = BigNumber.from(42)
const MINTER_ROLE_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))


describe("NFT Shop", async () => {
    let tokenSaleContract: TokenSale
    let myERC20TokenContract: MyERC20
    let myERC721TokenContract: MyERC721
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

        // Deploy nft contract.
        const myERC721ContractFactory = new MyERC721__factory(deployer)
        myERC721TokenContract = await myERC721ContractFactory.deploy()
        await myERC721TokenContract.deployTransaction.wait()


        // Standard tokenSale contract.
        const tokenSaleContractFactory = new TokenSale__factory(deployer)
        tokenSaleContract = await tokenSaleContractFactory.deploy(TEST_TOKEN_RATIO, TEST_NFT_PRICE, myERC20TokenContract.address, myERC721TokenContract.address)
        await tokenSaleContract.deployTransaction.wait();

        // Give minter role of erc20 to token sale contract
        const giveMinterERC20RoleTx = await myERC20TokenContract.grantRole(
            MINTER_ROLE_HASH,
            tokenSaleContract.address)

        await giveMinterERC20RoleTx.wait()

        // Give minter role of erc721 to token sale contract
        const giveMinterRoleERC721Tx = await myERC721TokenContract.grantRole(
            MINTER_ROLE_HASH,
            tokenSaleContract.address)

        await giveMinterRoleERC721Tx.wait()
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

            beforeEach(async () => {
                tokenBalanceBeforeBuy = await myERC20TokenContract.balanceOf(account1.address)
                ethBalanceBeforeBuy = await account1.getBalance()
                // To burn tokens we need balance and allowance.
                const approveTx = await myERC20TokenContract.connect(account1).approve(tokenSaleContract.address, TEST_NFT_PRICE)
                const approveTxReceipt = await approveTx.wait()
                approveTxFee = approveTxReceipt.gasUsed.mul(approveTxReceipt.effectiveGasPrice)

                const buyTx = await tokenSaleContract.connect(account1).buyNFT(TEST_TOKEN_ID)
                const buyTxReceipt = await buyTx.wait()
                buyTxFee = buyTxReceipt.gasUsed.mul(buyTxReceipt.effectiveGasPrice)

            })


            it("charges the correct amount of ERC20 tokens", async () => {
                const tokenBalanceAfterBuy = await myERC20TokenContract.balanceOf(account1.address)
                expect(tokenBalanceAfterBuy).to.be.equal(tokenBalanceBeforeBuy.sub(TEST_NFT_PRICE))
            });

            it("gives the correct NFT", async () => {
                expect(await myERC721TokenContract.balanceOf(account1.address)).to.be.equal(BigNumber.from(1))
                expect(account1.address).to.be.equal(await myERC721TokenContract.ownerOf(TEST_TOKEN_ID))
            });

            it("updates the owner pool account correctly", async () => {
                const withdrawableAmount = await tokenSaleContract.withdrawableAmount();
                expect(withdrawableAmount).to.be.equal(TEST_NFT_PRICE.div(2))
            });

            describe("When a user burns their NFT at the Shop contract", async () => {
                let accountTokenBalanceBeforeBurn: BigNumber
                let accountTokenBalanceAfterBurn: BigNumber
                let contractTokenBalanceBeforeBurn: BigNumber
                let contractTokenBalanceAfterBurn: BigNumber
                beforeEach(async () => {
                    accountTokenBalanceBeforeBurn = await myERC20TokenContract.balanceOf(account1.address)
                    contractTokenBalanceBeforeBurn = await myERC20TokenContract.balanceOf(tokenSaleContract.address)
                    const approveNftTx = await myERC721TokenContract.connect(account1).approve(tokenSaleContract.address, TEST_TOKEN_ID)
                    await approveNftTx.wait()
                    const burnNftTx = await tokenSaleContract.connect(account1).burnNFT(TEST_TOKEN_ID)
                    await burnNftTx.wait()
                    accountTokenBalanceAfterBurn = await myERC20TokenContract.balanceOf(account1.address)
                    contractTokenBalanceAfterBurn = await myERC20TokenContract.balanceOf(tokenSaleContract.address)
                })

                it("gives the correct amount of ERC20 tokens", async () => {
                    expect(accountTokenBalanceAfterBurn).to.be.equal(accountTokenBalanceBeforeBurn.add(TEST_NFT_PRICE))
                });
                it("updates the public pool correctly", async () => {
                    expect(contractTokenBalanceAfterBurn).to.be.equal(contractTokenBalanceBeforeBurn.sub(TEST_NFT_PRICE))
                });
            });



            describe("When the owner withdraw from the Shop contract", async () => {
                let accountTokenBalanceBeforeWithdraw: BigNumber
                let accountTokenBalanceAfterWithdraw: BigNumber
                let contractTokenBalanceBeforeWithdraw: BigNumber
                let contractTokenBalanceAfterWithdraw: BigNumber
                let withdrawableBefore: BigNumber
                let withdrawableAfter: BigNumber
                const WITHDRAW_AMOUNT = TEST_NFT_PRICE.div(4)

                beforeEach(async () => {
                    accountTokenBalanceBeforeWithdraw = await myERC20TokenContract.balanceOf(deployer.address)
                    contractTokenBalanceBeforeWithdraw = await myERC20TokenContract.balanceOf(tokenSaleContract.address)
                    withdrawableBefore = await tokenSaleContract.withdrawableAmount()
                    const withdrawTx = await tokenSaleContract.connect(deployer).withdraw(WITHDRAW_AMOUNT)
                    await withdrawTx.wait()
                    accountTokenBalanceAfterWithdraw = await myERC20TokenContract.balanceOf(deployer.address)
                    contractTokenBalanceAfterWithdraw = await myERC20TokenContract.balanceOf(tokenSaleContract.address)
                    withdrawableAfter = await tokenSaleContract.withdrawableAmount()

                })

                it("recovers the right amount of ERC20 tokens", async () => {
                    expect(accountTokenBalanceAfterWithdraw).to.be.equal(accountTokenBalanceBeforeWithdraw.add(WITHDRAW_AMOUNT))
                });

                it("updates the owner pool account correctly", async () => {
                    expect(withdrawableAfter).to.be.equal(withdrawableBefore.sub(WITHDRAW_AMOUNT))
                });
            });
        });
    });
});
