// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SoulboundIdentity is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Mapping from user address to their Identity Token ID
    mapping(address => uint256) public userToIdentity;
    // Mapping from token ID to verification score (0-100)
    mapping(uint256 => uint256) public verificationScores;
    // Mapping from token ID to KYC timestamp
    mapping(uint256 => uint256) public kycTimestamps;

    event IdentityMinted(address indexed user, uint256 tokenId, uint256 score);
    event IdentityBurned(address indexed user, uint256 tokenId);
    event ScoreUpdated(uint256 indexed tokenId, uint256 newScore);

    constructor() ERC721("RexellIdentity", "RID") {}

    function mintIdentity(address user, uint256 score) public onlyOwner {
        require(balanceOf(user) == 0, "User already has an identity");
        require(score <= 100, "Score must be between 0 and 100");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(user, newItemId);
        userToIdentity[user] = newItemId;
        verificationScores[newItemId] = score;
        kycTimestamps[newItemId] = block.timestamp;

        emit IdentityMinted(user, newItemId, score);
    }

    function updateScore(address user, uint256 newScore) public onlyOwner {
        require(balanceOf(user) > 0, "User has no identity");
        require(newScore <= 100, "Score must be between 0 and 100");

        uint256 tokenId = userToIdentity[user];
        verificationScores[tokenId] = newScore;
        
        emit ScoreUpdated(tokenId, newScore);
    }

    function burnIdentity(address user) public onlyOwner {
        require(balanceOf(user) > 0, "User has no identity");
        uint256 tokenId = userToIdentity[user];
        
        _burn(tokenId);
        delete userToIdentity[user];
        delete verificationScores[tokenId];
        delete kycTimestamps[tokenId];

        emit IdentityBurned(user, tokenId);
    }

    function hasValidIdentity(address user) public view returns (bool) {
        if (balanceOf(user) == 0) return false;
        uint256 tokenId = userToIdentity[user];
        // Example logic: Only valid if score > 70
        return verificationScores[tokenId] >= 70;
    }

    function getIdentityDetails(address user) public view returns (uint256 tokenId, uint256 score, uint256 timestamp) {
        require(balanceOf(user) > 0, "User has no identity");
        tokenId = userToIdentity[user];
        score = verificationScores[tokenId];
        timestamp = kycTimestamps[tokenId];
    }

    // Override transfer functions to make it Soulbound
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        require(from == address(0) || to == address(0), "Soulbound: Transfer not allowed");
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
    }
}
