// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./SoulboundIdentity.sol";

contract Rexell is ERC721URIStorage, Ownable, ReentrancyGuard, EIP712 {
    IERC20 public cUSDToken;
    address public mine;
    address public constant ADMIN_WALLET = 0xE282B88468E0554477a7580956c1f65939B623D8;
    uint256 public royaltyPercent = 5; // 5% royalty for resales
    
    SoulboundIdentity public identityContract;
    address public platformFeeRecipient;
    uint256 public platformFeePercent = 2; // 2% platform fee
    
    uint256 public maxResaleMultiplier = 200; // 200% of original price
    uint256 public resaleCutoffHours = 48; // Stops 48h before event
       
    // address public cUSDTokenAddress = // 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1 //testnet
    // 0x765DE816845861e75A25fCA122bb6898B8B1282a //mainnet

    // Anti-Sybil Configuration
    struct IdentityAttestation {
        address user;
        uint256 score;
        uint256 expiresAt;
        uint256 nonce;
        bytes[] signatures;
    }

    uint256 public constant MIN_SCORE = 70;
    mapping(address => bool) public isOracleSigner;
    mapping(uint256 => bool) public usedAttestationNonces;

    event OracleSignerStatusChanged(address indexed signer, bool status);

    constructor(address _cUSDTokenAddress, address _identityContractAddress) 
        ERC721("Rexell", "BTK") 
        EIP712("Rexell", "1")
    {
        mine = msg.sender;
        platformFeeRecipient = msg.sender; // Default to deployer
        cUSDToken = IERC20(_cUSDTokenAddress);
        if (_identityContractAddress != address(0)) {
            identityContract = SoulboundIdentity(_identityContractAddress);
        }
    }

    function setOracleSigner(address signer, bool status) external onlyOwner {
        isOracleSigner[signer] = status;
        emit OracleSignerStatusChanged(signer, status);
    }

    function _verifyOracleSignature(IdentityAttestation calldata att) internal view returns (bool) {
        if (att.signatures.length < 3) {
            return false;
        }

        bytes32 structHash = keccak256(abi.encode(
            keccak256("IdentityAttestation(address user,uint256 score,uint256 expiresAt,uint256 nonce)"),
            att.user,
            att.score,
            att.expiresAt,
            att.nonce
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        address lastSigner = address(0);
        uint256 validSignaturesCount = 0;

        for (uint256 i = 0; i < att.signatures.length; i++) {
            address signer = ECDSA.recover(hash, att.signatures[i]);
            if (isOracleSigner[signer]) {
                require(signer > lastSigner, "Signers must be unique and sorted");
                lastSigner = signer;
                validSignaturesCount++;
            }
        }

        return validSignaturesCount >= 3;
    }

    struct Event {
        uint id;
        address organizer;
        string name;
        string venue;
        string category;
        uint date;
        string time;
        uint price;
        uint ticketsAvailable;
        string description;
        string ipfs;
        address[] ticketHolders;
        string[] nftUris;
        mapping(address => string[]) userToNftUris; // Map user address to NFT URIs for this event
        mapping(address => uint8) ratings; // Stores ratings by each attendee (1-5)
        Comment[] comments; // Array to store all comments for this event
        uint totalRating;
        uint ratingCount;
    }

    struct Comment {
        address commenter;
        string text;
        uint timestamp;
    }

    struct EventView {
        uint id;
        address organizer;
        string name;
        string venue;
        string category;
        uint date;
        string time;
        uint price;
        uint ticketsAvailable;
        string description;
        string ipfs;
        address[] ticketHolders;
        string[] nftUris;
        uint averageRating;
    }

    // Add structs for resale functionality with royalty and history tracking
    struct ResaleRequest {
        uint256 tokenId;
        address owner;
        uint256 price;
        bool approved;
        bool rejected;
    }

    struct TicketOwnership {
        uint256 tokenId;
        address[] owners; // Track all previous owners
    }

    Event[] public events;
    uint public nextEventId;
    uint public nextTicketId;

    // Add mappings for resale functionality with royalty and history tracking
    mapping(address => bool) public verifiedResellers;
    mapping(uint256 => ResaleRequest) public resaleRequests;
    mapping(address => uint256[]) public userResaleRequests;
    mapping(uint256 => address[]) public ticketOwnershipHistory; // Track ownership history
    
    // Security mappings
    mapping(address => uint256) public nonces; // Protection against replay attacks
    mapping(uint256 => bool) public ticketCancelled; // Track cancelled tickets

    struct SeatLock {
        address lockedBy;
        uint256 lockedUntil;
    }

    // Seat map mappings
    // eventId => seatLabel => owner
    mapping(uint256 => mapping(string => address)) public seatOwners;
    // eventId => user => list of seat labels
    mapping(uint256 => mapping(address => string[])) public userSeats;
    // eventId => list of all sold seat labels
    mapping(uint256 => string[]) public soldSeats;
    // eventId => seatCategory => price
    mapping(uint256 => mapping(string => uint256)) public seatCategoryPrices;
    // eventId => seatLabel => lock info
    mapping(uint256 => mapping(string => SeatLock)) public seatLocks;

    event SeatCategoryPriceSet(uint256 indexed eventId, string category, uint256 price);
    event SeatPurchased(uint256 indexed eventId, string seatLabel, address indexed buyer, string category);
    event SeatLocked(uint256 indexed eventId, string seatLabel, address indexed lockedBy, uint256 lockedUntil);
    event SeatUnlocked(uint256 indexed eventId, string seatLabel, address indexed unlockedBy);
    
    // Add events for resale functionality with royalty tracking
    event ResaleRequested(uint256 indexed tokenId, address indexed owner, uint256 price);
    event ResaleApproved(uint256 indexed tokenId, address indexed owner);
    event ResaleRejected(uint256 indexed tokenId, address indexed owner);
    event TicketResold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed organizer, uint256 amount);
    event PlatformFeePaid(uint256 indexed tokenId, uint256 amount);
    event TicketCancelled(uint256 indexed tokenId, address indexed owner);

    function createEvent(
        string memory name,
        string memory venue,
        string memory category,
        uint date,
        string memory time,
        uint price,
        string memory ipfs,
        uint ticketsAvailable,
        string memory description
    ) public {
        require(date > block.timestamp, "Event date should be in the future");
        require(ticketsAvailable > 0, "Tickets available should be greater than zero");

        Event storage newEvent = events.push();
        newEvent.id = nextEventId;
        newEvent.organizer = msg.sender;
        newEvent.name = name;
        newEvent.venue = venue;
        newEvent.category = category;
        newEvent.date = date;
        newEvent.time = time;
        newEvent.price = price;
        newEvent.ipfs = ipfs;
        newEvent.ticketsAvailable = ticketsAvailable;
        newEvent.description = description;

        nextEventId++;
    }

    function buyTicket(uint eventId, string memory nftUri, IdentityAttestation calldata att) public payable nonReentrant {
        Event storage _event = events[eventId];       
        require(_event.ticketsAvailable > 0, "No tickets available");
        
        // Prevent organizer from buying tickets for their own event
        require(_event.organizer != msg.sender, "Organizer cannot buy tickets for their own event");
        
        // Anti-scalping 4-seat cap per user/wallet
        require(_event.userToNftUris[msg.sender].length + 1 <= 4, "Purchase exceeds 4 tickets limit per user");
        
        // Anti-Sybil validation (normal buying only validates signature and nonce, score is not enforced)
        require(att.user == msg.sender, "Attestation user mismatch");
        require(att.expiresAt > block.timestamp, "Attestation expired");
        require(_verifyOracleSignature(att), "Invalid attestation");
        require(!usedAttestationNonces[att.nonce], "Replay detected");
        usedAttestationNonces[att.nonce] = true;

        // Transfer payment from buyer to organizer
        if (_event.price > 0) {
            require(cUSDToken.transferFrom(msg.sender, _event.organizer, _event.price), "Payment failed");
        }
        
        mintTicketNft(eventId, nftUri);
        _event.ticketsAvailable--;
        _event.ticketHolders.push(msg.sender);
    }

    // Add new function to buy multiple tickets
    function buyTickets(uint eventId, string[] memory nftUris, uint quantity, IdentityAttestation calldata att) public payable nonReentrant {
        Event storage _event = events[eventId];
        require(quantity > 0, "Quantity must be greater than 0");
        require(_event.ticketsAvailable >= quantity, "Not enough tickets available");
        
        // Prevent organizer from buying tickets for their own event
        require(_event.organizer != msg.sender, "Organizer cannot buy tickets for their own event");
        
        // Anti-scalping 4-seat cap per user/wallet
        require(_event.userToNftUris[msg.sender].length + quantity <= 4, "Purchase exceeds 4 tickets limit per user");
        
        // Anti-Sybil validation (normal buying only validates signature and nonce, score is not enforced)
        require(att.user == msg.sender, "Attestation user mismatch");
        require(att.expiresAt > block.timestamp, "Attestation expired");
        require(_verifyOracleSignature(att), "Invalid attestation");
        require(!usedAttestationNonces[att.nonce], "Replay detected");
        usedAttestationNonces[att.nonce] = true;

        // Transfer payment from buyer to organizer
        uint totalCost = _event.price * quantity;
        if (totalCost > 0) {
            require(cUSDToken.transferFrom(msg.sender, _event.organizer, totalCost), "Payment failed");
        }
        
        for (uint i = 0; i < quantity; i++) {
            mintTicketNft(eventId, nftUris[i]);
            _event.ticketHolders.push(msg.sender);
        }
        
        _event.ticketsAvailable -= quantity;
    }

    // Dynamic Seat Map buying function (Overloaded)
    function buyTickets(
        uint eventId, 
        string[] memory nftUris, 
        string[] memory seatLabels, 
        string[] memory categories,
        IdentityAttestation calldata att
    ) public payable nonReentrant {
        Event storage _event = events[eventId];
        uint quantity = nftUris.length;
        require(quantity > 0, "Quantity must be greater than 0");
        require(seatLabels.length == quantity, "Seat labels length mismatch");
        require(categories.length == quantity, "Categories length mismatch");
        require(_event.ticketsAvailable >= quantity, "Not enough tickets available");

        // Prevent organizer from buying tickets for their own event
        require(_event.organizer != msg.sender, "Organizer cannot buy tickets for their own event");

        // Anti-scalping 4-seat cap per user/wallet
        require(_event.userToNftUris[msg.sender].length + quantity <= 4, "Purchase exceeds 4 tickets limit per user");

        // Anti-Sybil validation (normal buying only validates signature and nonce, score is not enforced)
        require(att.user == msg.sender, "Attestation user mismatch");
        require(att.expiresAt > block.timestamp, "Attestation expired");
        require(_verifyOracleSignature(att), "Invalid attestation");
        require(!usedAttestationNonces[att.nonce], "Replay detected");
        usedAttestationNonces[att.nonce] = true;

        uint256 totalCost = 0;
        for (uint i = 0; i < quantity; i++) {
            string memory seatLabel = seatLabels[i];
            string memory category = categories[i];
            
            // On-chain validation prevents race conditions
            require(seatOwners[eventId][seatLabel] == address(0), "Seat already sold");

            // Check if seat is locked by someone else on-chain
            SeatLock memory currentLock = seatLocks[eventId][seatLabel];
            if (currentLock.lockedUntil > block.timestamp) {
                require(currentLock.lockedBy == msg.sender, "Seat locked by another user");
                // Clear lock on purchase
                delete seatLocks[eventId][seatLabel];
            }

            uint256 seatPrice = seatCategoryPrices[eventId][category];
            if (seatPrice == 0) {
                if (keccak256(bytes(category)) == keccak256(bytes("VIP"))) {
                    seatPrice = _event.price * 2;
                } else if (keccak256(bytes(category)) == keccak256(bytes("Premium"))) {
                    seatPrice = _event.price;
                } else if (keccak256(bytes(category)) == keccak256(bytes("Executive"))) {
                    seatPrice = (_event.price * 8) / 10;
                } else {
                    seatPrice = _event.price;
                }
            }
            totalCost += seatPrice;

            // Mark seat as owned
            seatOwners[eventId][seatLabel] = msg.sender;
            userSeats[eventId][msg.sender].push(seatLabel);
            soldSeats[eventId].push(seatLabel);

            emit SeatPurchased(eventId, seatLabel, msg.sender, category);
        }

        // Transfer payment from buyer to organizer
        if (totalCost > 0) {
            require(cUSDToken.transferFrom(msg.sender, _event.organizer, totalCost), "Payment failed");
        }

        for (uint i = 0; i < quantity; i++) {
            mintTicketNft(eventId, nftUris[i]);
            _event.ticketHolders.push(msg.sender);
        }

        _event.ticketsAvailable -= quantity;
    }

    function lockSeats(uint256 eventId, string[] memory seatLabels) public {
        require(eventId < events.length, "Event does not exist");
        for (uint i = 0; i < seatLabels.length; i++) {
            string memory seatLabel = seatLabels[i];
            require(seatOwners[eventId][seatLabel] == address(0), "Seat already sold");
            
            SeatLock memory currentLock = seatLocks[eventId][seatLabel];
            if (currentLock.lockedUntil > block.timestamp) {
                require(currentLock.lockedBy == msg.sender, "Seat locked by another user");
            }
            
            seatLocks[eventId][seatLabel] = SeatLock({
                lockedBy: msg.sender,
                lockedUntil: block.timestamp + 10 minutes
            });
            
            emit SeatLocked(eventId, seatLabel, msg.sender, block.timestamp + 10 minutes);
        }
    }

    function unlockSeats(uint256 eventId, string[] memory seatLabels) public {
        require(eventId < events.length, "Event does not exist");
        for (uint i = 0; i < seatLabels.length; i++) {
            string memory seatLabel = seatLabels[i];
            SeatLock memory currentLock = seatLocks[eventId][seatLabel];
            if (currentLock.lockedUntil > block.timestamp) {
                require(currentLock.lockedBy == msg.sender, "Only the locker can unlock");
                delete seatLocks[eventId][seatLabel];
                emit SeatUnlocked(eventId, seatLabel, msg.sender);
            }
        }
    }

    function setSeatCategoryPrice(uint256 eventId, string memory category, uint256 price) public {
        require(eventId < events.length, "Event does not exist");
        require(msg.sender == events[eventId].organizer || msg.sender == mine || msg.sender == ADMIN_WALLET, "Only event organizer or owner can set prices");
        seatCategoryPrices[eventId][category] = price;
        emit SeatCategoryPriceSet(eventId, category, price);
    }

    function getSoldSeats(uint256 eventId) public view returns (string[] memory) {
        return soldSeats[eventId];
    }

    function getUserSeats(uint256 eventId, address user) public view returns (string[] memory) {
        return userSeats[eventId][user];
    }

    function mintTicketNft(uint eventId, string memory nftUri) internal {
        Event storage _event = events[eventId];
        _event.nftUris.push(nftUri);
        _event.userToNftUris[msg.sender].push(nftUri);

        uint ticketId = nextTicketId;
        _mint(msg.sender, ticketId);
        _setTokenURI(ticketId, nftUri);
        
        // Track initial ownership
        ticketOwnershipHistory[ticketId].push(msg.sender);

        nextTicketId++;
    }

    function submitRating(uint eventId, uint8 rating) public {
        Event storage _event = events[eventId];
        require(block.timestamp > _event.date, "Rating can only be given after the event date");
        require(rating >= 1 && rating <= 5, "Rating should be between 1 and 5");
        require(_event.ratings[msg.sender] == 0, "You have already rated this event");

        _event.ratings[msg.sender] = rating;
        _event.totalRating += rating;
        _event.ratingCount += 1;
    }

    function getAverageRating(uint eventId) public view returns (uint) {
        Event storage _event = events[eventId];
        if (_event.ratingCount == 0) return 0;
        return _event.totalRating / _event.ratingCount;
    }

    function submitComment(uint eventId, string memory comment) public {
        Event storage _event = events[eventId];
        bool isTicketHolder = false;
        
        // Check if the sender is a ticket holder
        for (uint i = 0; i < _event.ticketHolders.length; i++) {
            if (_event.ticketHolders[i] == msg.sender) {
                isTicketHolder = true;
                break;
            }
        }

        require(isTicketHolder, "Only ticket holders can comment on the event");

        _event.comments.push(Comment(msg.sender, comment, block.timestamp));
    }

    function getAllComments(uint eventId) public view returns (Comment[] memory) {
        Event storage _event = events[eventId];
        return _event.comments;
    }

    function getEvent(uint eventId) public view returns (
        uint,
        address,
        string memory,
        string memory,
        string memory,
        uint,
        string memory,
        uint,
        uint,
        string memory,
        string memory,
        address[] memory,
        string[] memory,
        Comment[] memory,
        uint,
        uint
    ) {
        Event storage _event = events[eventId];
        return (
            _event.id,
            _event.organizer,
            _event.name,
            _event.venue,
            _event.category,
            _event.date,
            _event.time,
            _event.price,
            _event.ticketsAvailable,
            _event.description,
            _event.ipfs,
            _event.ticketHolders,
            _event.nftUris,
            _event.comments,            
            _event.totalRating,
            _event.ratingCount
        );
    }

    function getAllEvents() public view returns (EventView[] memory) {
        EventView[] memory result = new EventView[](events.length);
        for (uint i = 0; i < events.length; i++) {
            Event storage _event = events[i];
            uint averageRating = _event.ratingCount > 0 ? _event.totalRating / _event.ratingCount : 0;
            result[i] = EventView(
                _event.id,
                _event.organizer,
                _event.name,
                _event.venue,
                _event.category,
                _event.date,
                _event.time,
                _event.price,
                _event.ticketsAvailable,
                _event.description,
                _event.ipfs,
                _event.ticketHolders,
                _event.nftUris,
                averageRating
            );
        }
        return result;
    }

    function getUserPurchasedTickets(uint eventId, address user) public view returns (string[] memory) {
        Event storage _event = events[eventId];
        return _event.userToNftUris[user];
    }

    // New function to get token ID by user and URI
    function getTokenIdByUserAndUri(address user, string memory nftUri) public view returns (uint256) {
        // Iterate through all possible token IDs to find the matching one
        for (uint256 i = 0; i < nextTicketId; i++) {
            // Check if token exists
            if (_exists(i)) {
                // Check if owner matches
                if (ownerOf(i) == user) {
                    // Check if URI matches
                    if (keccak256(bytes(tokenURI(i))) == keccak256(bytes(nftUri))) {
                        return i;
                    }
                }
            }
        }
        // Return 0 if not found (0 is an invalid token ID in this contract)
        return 0;
    }

    function getUserPurchasedEvents(address user) public view returns (EventView[] memory) {
        uint count = 0;
        for (uint i = 0; i < events.length; i++) {
            for (uint j = 0; j < events[i].ticketHolders.length; j++) {
                if (events[i].ticketHolders[j] == user) {
                    count++;
                    break;
                }
            }
        }

        EventView[] memory result = new EventView[](count);
        uint index = 0;
        for (uint i = 0; i < events.length; i++) {
            for (uint j = 0; j < events[i].ticketHolders.length; j++) {
                if (events[i].ticketHolders[j] == user) {
                    Event storage _event = events[i];
                    result[index] = EventView(
                        _event.id,
                        _event.organizer,
                        _event.name,
                        _event.venue,
                        _event.category,
                        _event.date,
                        _event.time,
                        _event.price,
                        _event.ticketsAvailable,
                        _event.description,
                        _event.ipfs,
                        _event.ticketHolders,
                        _event.nftUris,
                        _event.totalRating
                    );
                    index++;
                    break;
                }
            }
        }

        return result;
    }

    function getEventsByOrganizer(address organizer) public view returns (EventView[] memory) {
        uint count = 0;
        for (uint i = 0; i < events.length; i++) {
            if (events[i].organizer == organizer) {
                count++;
            }
        }

        EventView[] memory result = new EventView[](count);
        uint index = 0;
        for (uint i = 0; i < events.length; i++) {
            if (events[i].organizer == organizer) {
                Event storage _event = events[i];
                result[index] = EventView(
                    _event.id,
                    _event.organizer,
                    _event.name,
                    _event.venue,
                    _event.category,
                    _event.date,
                    _event.time,
                    _event.price,
                    _event.ticketsAvailable,
                    _event.description,
                    _event.ipfs,
                    _event.ticketHolders,
                    _event.nftUris,
                    _event.totalRating
                );
                index++;
            }
        }
        return result;
    }

    function getUserTickets(address user) public view returns (string[] memory) {
        uint totalTickets = 0;

        // First, calculate the total number of tickets owned by the user
        for (uint i = 0; i < events.length; i++) {
            totalTickets += events[i].userToNftUris[user].length;
        }

        // Create an array to hold all ticket URIs
        string[] memory ticketUris = new string[](totalTickets);
        uint index = 0;

        // Populate the ticket URIs array
        for (uint i = 0; i < events.length; i++) {
            string[] storage userTickets = events[i].userToNftUris[user];
            for (uint j = 0; j < userTickets.length; j++) {
                ticketUris[index] = userTickets[j];
                index++;
            }
        }

        return ticketUris;
    }

    // Function to request resale verification
    function requestResaleVerification(uint256 tokenId, uint256 price, IdentityAttestation calldata att) public nonReentrant {
        // require(tokenId > 0, "Invalid token ID"); // Removed to allow token ID 0
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this ticket");
        require(price > 0, "Price must be greater than 0");
        require(resaleRequests[tokenId].owner == address(0), "Resale request already exists for this ticket");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
        // Anti-Sybil validation
        require(att.user == msg.sender, "Attestation user mismatch");
        require(att.expiresAt > block.timestamp, "Attestation expired");
        require(att.score >= MIN_SCORE, "Score below threshold");
        require(_verifyOracleSignature(att), "Invalid attestation");
        require(!usedAttestationNonces[att.nonce], "Replay detected");
        usedAttestationNonces[att.nonce] = true;

        // Find associated event to check rules
        bool eventFound = false;
        for (uint i = 0; i < events.length; i++) {
             string[] memory eventNftUris = events[i].nftUris;
             for (uint j = 0; j < eventNftUris.length; j++) {
                 // We need to match tokenURI. 
                 // Note: Loop is inefficient but works for this structure.
                 if (keccak256(bytes(eventNftUris[j])) == keccak256(bytes(tokenURI(tokenId)))) {
                     Event storage _event = events[i];
                     require(block.timestamp < _event.date - (resaleCutoffHours * 1 hours), "Resale period has ended");
                     
                     // Check max price
                     if (_event.price > 0) {
                        uint256 maxAllowed = (_event.price * maxResaleMultiplier) / 100;
                        require(price <= maxAllowed, "Price exceeds maximum allowed resale price");
                     }
                     
                     eventFound = true;
                     break;
                 }
             }
             if (eventFound) break;
        }

        require(eventFound, "Event for ticket not found");
        
        resaleRequests[tokenId] = ResaleRequest({
            tokenId: tokenId,
            owner: msg.sender,
            price: price,
            approved: false,
            rejected: false
        });
        
        userResaleRequests[msg.sender].push(tokenId);
        
        emit ResaleRequested(tokenId, msg.sender, price);
    }

    // Function for contract owner to verify a reseller (anti-scalping)
    function verifyReseller(address reseller) public onlyContractOwner {
        verifiedResellers[reseller] = true;
    }

    // Helper function to get event organizer for a token
    function getEventOrganizerForToken(uint256 tokenId) public view returns (address) {
        require(_exists(tokenId), "Ticket does not exist");
        
        // Get the token URI to find the event
        string memory uri = tokenURI(tokenId);
        
        // Search through all events to find which event this ticket belongs to
        for (uint i = 0; i < events.length; i++) {
            string[] memory eventNftUris = events[i].nftUris;
            for (uint j = 0; j < eventNftUris.length; j++) {
                if (keccak256(bytes(eventNftUris[j])) == keccak256(bytes(uri))) {
                    return events[i].organizer;
                }
            }
        }
        
        return address(0);
    }

    // Function for event organizer or contract owner to approve resale
    function approveResale(uint256 tokenId) public {
        require(_exists(tokenId), "Ticket does not exist");
        require(resaleRequests[tokenId].owner != address(0), "No resale request for this ticket");
        require(!resaleRequests[tokenId].approved, "Resale already approved");
        require(!resaleRequests[tokenId].rejected, "Resale already rejected");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
        // Check if caller is event organizer or contract owner
        address eventOrganizer = getEventOrganizerForToken(tokenId);
        require(msg.sender == eventOrganizer || msg.sender == mine || msg.sender == ADMIN_WALLET, "Only event organizer or contract owner can approve");
        
        resaleRequests[tokenId].approved = true;
        emit ResaleApproved(tokenId, resaleRequests[tokenId].owner);
    }

    // Function for event organizer or contract owner to reject resale
    function rejectResale(uint256 tokenId) public {
        require(_exists(tokenId), "Ticket does not exist");
        require(resaleRequests[tokenId].owner != address(0), "No resale request for this ticket");
        require(!resaleRequests[tokenId].approved, "Resale already approved");
        require(!resaleRequests[tokenId].rejected, "Resale already rejected");
        
        // Check if caller is event organizer or contract owner
        address eventOrganizer = getEventOrganizerForToken(tokenId);
        require(msg.sender == eventOrganizer || msg.sender == mine || msg.sender == ADMIN_WALLET, "Only event organizer or contract owner can reject");
        
        resaleRequests[tokenId].rejected = true;
        emit ResaleRejected(tokenId, resaleRequests[tokenId].owner);
    }

    // Function to get resale requests for a user
    function getUserResaleRequests(address user) public view returns (uint256[] memory) {
        return userResaleRequests[user];
    }

    // Function to get resale request details
    function getResaleRequest(uint256 tokenId) public view returns (ResaleRequest memory) {
        return resaleRequests[tokenId];
    }

    // Function to get all resale requests for events organized by an address
    function getOrganizerResaleRequests(address organizer) public view returns (ResaleRequest[] memory) {
        uint256 count = 0;
        
        // First, count how many requests exist for this organizer's events
        for (uint256 i = 0; i < nextTicketId; i++) {
            if (_exists(i) && resaleRequests[i].owner != address(0)) {
                address eventOrganizer = getEventOrganizerForToken(i);
                if (eventOrganizer == organizer) {
                    count++;
                }
            }
        }
        
        // Create array and populate it
        ResaleRequest[] memory requests = new ResaleRequest[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < nextTicketId; i++) {
            if (_exists(i) && resaleRequests[i].owner != address(0)) {
                address eventOrganizer = getEventOrganizerForToken(i);
                if (eventOrganizer == organizer) {
                    requests[index] = resaleRequests[i];
                    index++;
                }
            }
        }
        
        return requests;
    }

    // Function to get all approved resale tickets for the marketplace
    function getAllApprovedResaleTickets() public view returns (ResaleRequest[] memory) {
        uint256 count = 0;
        
        // Count approved resale tickets
        for (uint256 i = 0; i < nextTicketId; i++) {
            if (_exists(i) && resaleRequests[i].approved && !resaleRequests[i].rejected && resaleRequests[i].owner != address(0)) {
                count++;
            }
        }
        
        // Create array and populate it
        ResaleRequest[] memory approvedTickets = new ResaleRequest[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < nextTicketId; i++) {
            if (_exists(i) && resaleRequests[i].approved && !resaleRequests[i].rejected && resaleRequests[i].owner != address(0)) {
                approvedTickets[index] = resaleRequests[i];
                index++;
            }
        }
        
        return approvedTickets;
    }

    // Function to cancel resale request
    function cancelResaleRequest(uint256 tokenId) public {
        require(_exists(tokenId), "Ticket does not exist");
        require(resaleRequests[tokenId].owner == msg.sender, "You are not the owner of this resale request");
        require(!resaleRequests[tokenId].approved, "Resale already approved");
        require(!resaleRequests[tokenId].rejected, "Resale already rejected");
        
        delete resaleRequests[tokenId];
        emit ResaleRejected(tokenId, msg.sender);
    }

    // Enhanced function to resell ticket with royalty and ownership tracking
    function resellTicket(uint256 tokenId, uint256 price, string memory nftUri) public nonReentrant {
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this ticket");
        require(resaleRequests[tokenId].approved, "Resale not approved");
        require(!resaleRequests[tokenId].rejected, "Resale rejected");
        require(price > 0, "Price must be greater than 0");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
        // Mark the resale request as completed
        // resaleRequests[tokenId].rejected = true; // REMOVED: This hid the ticket from the market
        
        // Transfer ticket to contract first
        _transfer(msg.sender, address(this), tokenId);
        
        // In a real implementation, you would handle payment here
        // For now, we'll just emit an event
        emit TicketResold(tokenId, msg.sender, address(0), price);
    }

    // New function to buy a resale ticket with royalty payment
    function buyResaleTicket(uint256 tokenId, uint256 maxPrice, IdentityAttestation calldata att) public nonReentrant {
        require(_exists(tokenId), "Ticket does not exist");
        require(resaleRequests[tokenId].owner != msg.sender, "Cannot buy your own ticket");
        require(resaleRequests[tokenId].approved, "Resale not approved");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
        // Prevent organizer from buying resale tickets for their own event
        address organizer = getEventOrganizerForToken(tokenId);
        require(organizer != msg.sender, "Organizer cannot buy resale tickets for their own event");
        
        // Anti-Sybil validation for resale buyer
        require(att.user == msg.sender, "Attestation user mismatch");
        require(att.expiresAt > block.timestamp, "Attestation expired");
        require(att.score >= MIN_SCORE, "Score below threshold");
        require(_verifyOracleSignature(att), "Invalid attestation");
        require(!usedAttestationNonces[att.nonce], "Replay detected");
        usedAttestationNonces[att.nonce] = true;
        
        ResaleRequest storage request = resaleRequests[tokenId];
        require(request.price <= maxPrice, "Price exceeds maximum allowed");
        
        address seller = request.owner;
        uint256 price = request.price;
        
        // Calculate royalty, platform fee and seller amounts
        uint256 royaltyAmount = (price * royaltyPercent) / 100;
        uint256 platformFeeAmount = (price * platformFeePercent) / 100;
        uint256 sellerAmount = price - royaltyAmount - platformFeeAmount;
        
        // Get event organizer fallback if needed
        if (organizer == address(0)) {
            organizer = mine; // Fallback to contract owner
        }

        // Transfer payments
        require(cUSDToken.transferFrom(msg.sender, organizer, royaltyAmount), "Royalty transfer failed");
        require(cUSDToken.transferFrom(msg.sender, platformFeeRecipient, platformFeeAmount), "Platform fee transfer failed");
        require(cUSDToken.transferFrom(msg.sender, seller, sellerAmount), "Payment to seller failed");
        
        // Transfer ticket ownership
        _transfer(address(this), msg.sender, tokenId);
        
        // Update ownership history
        ticketOwnershipHistory[tokenId].push(msg.sender);
        
        // Clean up resale request
        delete resaleRequests[tokenId];
        
        emit TicketResold(tokenId, seller, msg.sender, price);
        emit RoyaltyPaid(tokenId, organizer, royaltyAmount);
        emit PlatformFeePaid(tokenId, platformFeeAmount);
    }

    // Function to get ticket ownership history
    function getTicketOwnershipHistory(uint256 tokenId) public view returns (address[] memory) {
        return ticketOwnershipHistory[tokenId];
    }

    function setRoyaltyPercent(uint256 _royaltyPercent) public onlyContractOwner {
        require(_royaltyPercent <= 20, "Royalty percent cannot exceed 20%");
        royaltyPercent = _royaltyPercent;
    }

    function setPlatformFeePercent(uint256 _platformFeePercent) public onlyContractOwner {
        require(_platformFeePercent <= 10, "Platform fee cannot exceed 10%");
        platformFeePercent = _platformFeePercent;
    }
    
    function setPlatformFeeRecipient(address _recipient) public onlyContractOwner {
        require(_recipient != address(0), "Invalid recipient");
        platformFeeRecipient = _recipient;
    }

    function setMaxResaleMultiplier(uint256 _multiplier) public onlyContractOwner {
        require(_multiplier >= 100, "Multiplier must be at least 100%");
        maxResaleMultiplier = _multiplier;
    }

    function setResaleCutoffHours(uint256 _hours) public onlyContractOwner {
        resaleCutoffHours = _hours;
    }
    
    function setIdentityContract(address _identityContract) public onlyContractOwner {
        identityContract = SoulboundIdentity(_identityContract);
    }

    // Function to cancel a ticket (emergency function)
    function cancelTicket(uint256 tokenId) public {
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender || msg.sender == mine || msg.sender == ADMIN_WALLET, "Not authorized to cancel ticket");
        
        ticketCancelled[tokenId] = true;
        emit TicketCancelled(tokenId, msg.sender);
    }

    // Function to check if a ticket is cancelled
    function isTicketCancelled(uint256 tokenId) public view returns (bool) {
        return ticketCancelled[tokenId];
    }

    // Function to mint resale ticket NFT
    function mintResaleTicketNft(uint256 originalTokenId, string memory nftUri, address buyer) internal {
        // This is a simplified version - in reality, you'd want to track the original event
        uint ticketId = nextTicketId;
        _mint(buyer, ticketId);
        _setTokenURI(ticketId, nftUri);
        
        // Track ownership history for resale ticket
        ticketOwnershipHistory[ticketId].push(buyer);
        
        nextTicketId++;
    }

    // Function to check if a user holds tickets for any pending (future) events
    // Called by SoulboundIdentity.sol to prevent unbonding if tickets are held
    function hasPendingEvents(address user) public view returns (bool) {
        for (uint256 i = 0; i < nextTicketId; i++) {
            if (_exists(i) && ownerOf(i) == user && !ticketCancelled[i]) {
                string memory uri = tokenURI(i);
                for (uint e = 0; e < events.length; e++) {
                    string[] memory eventNftUris = events[e].nftUris;
                    for (uint j = 0; j < eventNftUris.length; j++) {
                        if (keccak256(bytes(eventNftUris[j])) == keccak256(bytes(uri))) {
                            // If event date is in the future, return true
                            if (events[e].date > block.timestamp) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    //function to withdraw from the contract
    function withdraw(address _address) public onlyContractOwner {
        require(cUSDToken.transfer(_address, cUSDToken.balanceOf(address(this))), "Unable to withdraw from contract");
    }

    //modifier for onlyOwner
    modifier onlyContractOwner() {
        require(msg.sender == mine || msg.sender == ADMIN_WALLET, "Only owner can call this function");
        _;
    }
}