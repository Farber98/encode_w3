import { MyERC20 } from './../typechain-types/contracts/MyERC20';
import { MyERC20__factory } from './../typechain-types/factories/contracts/MyERC20__factory';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TokenSale, TokenSale__factory } from "../typechain-types";
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

const TEST_TOKEN_RATIO: BigNumber = BigNumber.from(10)
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
        tokenSaleContract = await tokenSaleContractFactory.deploy(TEST_TOKEN_RATIO, myERC20TokenContract.address)
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
        let buyTokensFee: BigNumber
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
    });

    describe("When a user burns an ERC20 at the Shop contract", async () => {
        beforeEach(async () => {
        })

        it("gives the correct amount of ETH", async () => {
            throw new Error("Not implemented");
        });

        it("burns the correct amount of tokens", async () => {
            throw new Error("Not implemented");
        });
    });

    describe("When a user buys an NFT from the Shop contract", async () => {
        it("charges the correct amount of ERC20 tokens", async () => {
            throw new Error("Not implemented");
        });

        it("gives the correct NFT", async () => {
            throw new Error("Not implemented");
        });

        it("updates the owner pool account correctly", async () => {
            throw new Error("Not implemented");
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
