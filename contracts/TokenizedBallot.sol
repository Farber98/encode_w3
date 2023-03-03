// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

interface IVotingERC20Token is IVotes {
    function getPastVotes(
        address account,
        uint256 blockNumber
    ) external view returns (uint256);
}

/// @title Voting with delegation.
contract TokenizedBallot {
    // This is a type for a single proposal.
    struct Proposal {
        bytes32 name; // short name (up to 32 bytes)
        uint voteCount; // number of accumulated votes
    }

    // A dynamically-sized array of `Proposal` structs.
    Proposal[] public proposals;

    // Voting token contract.
    IVotingERC20Token public tokenContract;

    // Last block number that will track the voting power of the accounts.
    // All voting actions after that block will not be considered.
    uint256 public blockId;

    // Track spent voting power
    mapping(address => uint256) public votingPowerSpent;

    /// Create a new ballot to choose one of `proposalNames`.
    constructor(
        bytes32[] memory proposalNames,
        address _tokenContract,
        uint256 _blockId
    ) {
        // For each of the provided proposal names,
        // create a new proposal object and add it
        // to the end of the array.
        for (uint i = 0; i < proposalNames.length; i++) {
            // `Proposal({...})` creates a temporary
            // Proposal object and `proposals.push(...)`
            // appends it to the end of `proposals`.
            proposals.push(Proposal({name: proposalNames[i], voteCount: 0}));
        }

        tokenContract = IVotingERC20Token(_tokenContract);
        blockId = _blockId;
    }

    // Votes certain amount for certain proposal.
    function vote(uint proposal, uint256 amount) external {
        // Check if msg.sender has voting power
        require(votingPower(msg.sender) > 0, "No voting power.");
        // Update spent voting power to track remaining voting power.
        votingPowerSpent[msg.sender] += amount;

        // Update proposal vote count.
        proposals[proposal].voteCount += amount;
    }

    // using get past votes to prevent the election of being fraudulent.
    // only considering voting power until blockId
    // subtracting votingPowerSpent to get remaining voting power.
    function votingPower(address account) public view returns (uint256) {
        return
            tokenContract.getPastVotes(account, blockId) -
            votingPowerSpent[account];
    }

    /// @dev Computes the winning proposal taking all
    /// previous votes into account.
    function winningProposal() public view returns (uint winningProposal_) {
        uint winningVoteCount = 0;
        for (uint p = 0; p < proposals.length; p++) {
            if (proposals[p].voteCount > winningVoteCount) {
                winningVoteCount = proposals[p].voteCount;
                winningProposal_ = p;
            }
        }
    }

    // Calls winningProposal() function to get the index
    // of the winner contained in the proposals array and then
    // returns the name of the winner
    function winnerName() external view returns (bytes32 winnerName_) {
        winnerName_ = proposals[winningProposal()].name;
    }
}
