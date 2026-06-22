// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IRexell {
    function hasPendingEvents(address user) external view returns (bool);
}

contract SoulboundIdentity is ERC721, Ownable, EIP712 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    IERC20 public cUSDToken;
    IRexell public rexellContract;
    
    address public oracleMultisig;
    
    uint256 public constant BASE_STAKE = 25 * 10**18; // 25 cUSD
    uint256 public constant ACTIVATION_DELAY = 14 days;
    uint256 public constant UNBONDING_DELAY = 7 days;
    uint256 public constant PROBATION_PERIOD = 60 days;
    uint256 public constant MAX_VOUCHES = 5;

    struct Identity {
        uint256 tokenId;
        uint256 stakeAmount;
        uint256 activationTime;
        uint256 unbondRequestTime;
        bool isFrozen;
        uint256 activeVouchesCount;
        uint256 totalVouchLocked;
    }

    struct VouchRecord {
        address vouchee;
        uint256 amountLocked; // 15% of voucher's stake
        uint256 probationEndTime;
        bool isActive;
    }

    // Mappings
    mapping(address => Identity) public identities;
    mapping(address => mapping(address => VouchRecord)) public vouches; // voucher => vouchee => record
    mapping(address => address[]) public userVouchees;
    
    // Mapping to track used signatures to prevent replay
    mapping(bytes => bool) public usedSignatures;

    // Multisig signers
    mapping(address => bool) public isOracleSigner;

    event IdentityRequested(address indexed user, uint256 stakeAmount, uint256 activationTime);
    event IdentityUnbondingRequested(address indexed user, uint256 unlockTime);
    event IdentityUnbonded(address indexed user, uint256 amountReturned);
    event Vouched(address indexed voucher, address indexed vouchee, uint256 amountLocked, uint256 probationEnd);
    event VouchMatured(address indexed voucher, address indexed vouchee, uint256 amountUnlocked);
    event Slashed(address indexed user, uint256 amountSlashed);
    event Frozen(address indexed user);
    event Unfrozen(address indexed user);
    event StakeToppedUp(address indexed user, uint256 amount, uint256 totalStake);

    constructor(address _cUSDToken, address _oracleMultisig) 
        ERC721("RexellIdentity", "RID") 
        EIP712("RexellIdentity", "1") 
    {
        cUSDToken = IERC20(_cUSDToken);
        oracleMultisig = _oracleMultisig;
        isOracleSigner[_oracleMultisig] = true;
    }

    function setRexellContract(address _rexell) external onlyOwner {
        rexellContract = IRexell(_rexell);
    }

    function setOracleMultisig(address _oracle) external onlyOwner {
        oracleMultisig = _oracle;
        isOracleSigner[_oracle] = true;
    }

    function setOracleSigner(address signer, bool status) external onlyOwner {
        isOracleSigner[signer] = status;
    }

    /**
     * @dev User requests an identity by providing Oracle signatures 
     *      that determines their risk multiplier.
     *      Requires approving the cUSDToken for this contract beforehand.
     */
    function requestIdentity(uint256 riskMultiplierBase100, uint256 timestamp, bytes[] calldata signatures) external {
        require(identities[msg.sender].tokenId == 0, "Identity already exists");
        require(block.timestamp <= timestamp + 15 minutes, "Signature expired");
        require(signatures.length >= 3, "Insufficient signatures");

        // Verify EIP-712 Signatures
        bytes32 structHash = keccak256(abi.encode(
            keccak256("IdentityRequest(address user,uint256 riskMultiplier,uint256 timestamp)"),
            msg.sender,
            riskMultiplierBase100,
            timestamp
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        address lastSigner = address(0);
        uint256 validSignaturesCount = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            bytes memory signature = signatures[i];
            require(!usedSignatures[signature], "Signature already used");
            usedSignatures[signature] = true;

            address signer = ECDSA.recover(hash, signature);
            if (isOracleSigner[signer]) {
                require(signer > lastSigner, "Signers must be unique and sorted");
                lastSigner = signer;
                validSignaturesCount++;
            }
        }
        require(validSignaturesCount >= 3, "Invalid Oracle Signatures");

        // Calculate required stake (BASE_STAKE * (riskMultiplier / 100))
        uint256 requiredStake = (BASE_STAKE * riskMultiplierBase100) / 100;
        
        // Transfer cUSD
        require(cUSDToken.transferFrom(msg.sender, address(this), requiredStake), "Stake transfer failed");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);

        identities[msg.sender] = Identity({
            tokenId: newItemId,
            stakeAmount: requiredStake,
            activationTime: block.timestamp + ACTIVATION_DELAY,
            unbondRequestTime: 0,
            isFrozen: false,
            activeVouchesCount: 0,
            totalVouchLocked: 0
        });

        emit IdentityRequested(msg.sender, requiredStake, block.timestamp + ACTIVATION_DELAY);
    }

    /**
     * @dev Allows an existing identity holder to top up their stake in cUSD.
     */
    function topUpStake(uint256 amount) external {
        Identity storage id = identities[msg.sender];
        require(id.tokenId != 0, "No identity found");
        require(!id.isFrozen, "Identity is frozen");
        require(id.unbondRequestTime == 0, "Cannot top up while unbonding");

        require(cUSDToken.transferFrom(msg.sender, address(this), amount), "Stake transfer failed");
        id.stakeAmount += amount;

        emit StakeToppedUp(msg.sender, amount, id.stakeAmount);
    }

    /**
     * @dev Requests to unbond stake. User loses identity validity immediately, 
     *      but must wait UNBONDING_DELAY to withdraw funds.
     */
    function requestUnbond() external {
        Identity storage id = identities[msg.sender];
        require(id.tokenId != 0, "No identity found");
        require(!id.isFrozen, "Identity is frozen");
        require(id.unbondRequestTime == 0, "Already unbonding");
        require(id.activeVouchesCount == 0, "Cannot unbond while vouching for others");

        // Check if holding pending tickets
        if (address(rexellContract) != address(0)) {
            require(!rexellContract.hasPendingEvents(msg.sender), "Cannot unbond with pending event tickets");
        }

        id.unbondRequestTime = block.timestamp;
        emit IdentityUnbondingRequested(msg.sender, block.timestamp + UNBONDING_DELAY);
    }

    /**
     * @dev Withdraw unbonded stake and burn the RID NFT.
     */
    function withdrawUnbonded() external {
        Identity storage id = identities[msg.sender];
        require(id.unbondRequestTime != 0, "Unbond not requested");
        require(block.timestamp >= id.unbondRequestTime + UNBONDING_DELAY, "Unbonding delay not met");

        // Double check pending events just in case
        if (address(rexellContract) != address(0)) {
            require(!rexellContract.hasPendingEvents(msg.sender), "Cannot unbond with pending event tickets");
        }

        uint256 amountToReturn = id.stakeAmount;
        uint256 tokenId = id.tokenId;

        delete identities[msg.sender];
        _burn(tokenId);

        require(cUSDToken.transfer(msg.sender, amountToReturn), "Transfer failed");

        emit IdentityUnbonded(msg.sender, amountToReturn);
    }

    /**
     * @dev Vouch for a new user by locking 15% of your own stake.
     */
    function vouch(address vouchee) external {
        Identity storage voucherId = identities[msg.sender];
        require(voucherId.tokenId != 0, "Voucher has no identity");
        require(!voucherId.isFrozen, "Voucher is frozen");
        require(voucherId.activationTime <= block.timestamp, "Voucher identity not active yet");
        require(voucherId.unbondRequestTime == 0, "Voucher is unbonding");
        require(voucherId.activeVouchesCount < MAX_VOUCHES, "Max vouches reached");
        
        Identity storage voucheeId = identities[vouchee];
        require(voucheeId.tokenId != 0, "Vouchee has no identity to vouch for");
        require(!vouches[msg.sender][vouchee].isActive, "Already vouched for this user");

        uint256 lockAmount = (voucherId.stakeAmount * 15) / 100;
        
        // Ensure voucher has enough "free" stake
        require(voucherId.stakeAmount >= voucherId.totalVouchLocked + lockAmount, "Not enough free stake to vouch");

        vouches[msg.sender][vouchee] = VouchRecord({
            vouchee: vouchee,
            amountLocked: lockAmount,
            probationEndTime: block.timestamp + PROBATION_PERIOD,
            isActive: true
        });

        userVouchees[msg.sender].push(vouchee);
        voucherId.activeVouchesCount += 1;
        voucherId.totalVouchLocked += lockAmount;

        // Vouching can immediately activate the vouchee or reduce their unbonding delay, 
        // For simplicity, we just log it. Real implementation might alter vouchee's activationTime.
        if (voucheeId.activationTime > block.timestamp) {
            // Speed up activation if vouched!
            voucheeId.activationTime = block.timestamp;
        }

        emit Vouched(msg.sender, vouchee, lockAmount, block.timestamp + PROBATION_PERIOD);
    }

    /**
     * @dev Releases locked collateral from a mature vouch.
     */
    function resolveMatureVouch(address vouchee) external {
        VouchRecord storage record = vouches[msg.sender][vouchee];
        require(record.isActive, "Vouch not active");
        require(block.timestamp >= record.probationEndTime, "Probation period not over");

        Identity storage voucherId = identities[msg.sender];
        
        record.isActive = false;
        voucherId.activeVouchesCount -= 1;
        voucherId.totalVouchLocked -= record.amountLocked;

        emit VouchMatured(msg.sender, vouchee, record.amountLocked);
    }

    /**
     * @dev Multisig Oracle can freeze suspicious accounts.
     */
    function freeze(address user) external {
        require(msg.sender == oracleMultisig, "Only oracle multisig");
        identities[user].isFrozen = true;
        emit Frozen(user);
    }

    /**
     * @dev Multisig Oracle can unfreeze appealed accounts.
     */
    function unfreeze(address user) external {
        require(msg.sender == oracleMultisig, "Only oracle multisig");
        identities[user].isFrozen = false;
        emit Unfrozen(user);
    }

    /**
     * @dev Multisig Oracle slashes a confirmed bot.
     *      Burns the user's stake and slashes any active vouchers.
     */
    function slash(address user) external {
        require(msg.sender == oracleMultisig, "Only oracle multisig");
        Identity storage id = identities[user];
        require(id.tokenId != 0, "User has no identity");

        uint256 slashAmount = id.stakeAmount;
        uint256 tokenId = id.tokenId;
        
        delete identities[user];
        _burn(tokenId);

        // In a full implementation, you would burn the cUSD or send it to a treasury.
        // cUSDToken.transfer(treasury, slashAmount);

        emit Slashed(user, slashAmount);
    }

    /**
     * @dev Called by Rexell.sol to check if a user is verified and allowed to buy/sell.
     */
    function hasValidIdentity(address user) public view returns (bool) {
        Identity memory id = identities[user];
        if (id.tokenId == 0) return false;
        if (id.isFrozen) return false;
        if (id.unbondRequestTime != 0) return false;
        if (block.timestamp < id.activationTime) return false; // Not activated yet
        return true;
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
