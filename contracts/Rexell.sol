// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Rexell is ERC721URIStorage, Ownable, ReentrancyGuard {
    IERC20 public cUSDToken;
    address public mine;
    uint256 public royaltyPercent = 5; // 5% royalty for resales
       
    // address public cUSDTokenAddress = // 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1 //testnet
    // 0x765DE816845861e75A25fCA122bb6898B8B1282a //mainnet

    constructor() ERC721("Rexell", "BTK") {
        mine = msg.sender;
        cUSDToken = IERC20(0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1);
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
    
    // Add events for resale functionality with royalty tracking
    event ResaleRequested(uint256 indexed tokenId, address indexed owner, uint256 price);
    event ResaleApproved(uint256 indexed tokenId, address indexed owner);
    event ResaleRejected(uint256 indexed tokenId, address indexed owner);
    event TicketResold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed organizer, uint256 amount);
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

    function buyTicket(uint eventId, string memory nftUri) public payable nonReentrant {
        Event storage _event = events[eventId];       
        require(_event.ticketsAvailable > 0, "No tickets available");
        
        // Transfer payment from buyer to organizer
        if (_event.price > 0) {
            require(cUSDToken.transferFrom(msg.sender, _event.organizer, _event.price), "Payment failed");
        }
        
        mintTicketNft(eventId, nftUri);
        _event.ticketsAvailable--;
        _event.ticketHolders.push(msg.sender);
    }

    // Add new function to buy multiple tickets
    function buyTickets(uint eventId, string[] memory nftUris, uint quantity) public payable nonReentrant {
        Event storage _event = events[eventId];
        require(quantity > 0, "Quantity must be greater than 0");
        require(_event.ticketsAvailable >= quantity, "Not enough tickets available");
        
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
        require(block.timestamp > _event.date/1000, "Rating can only be given after the event date");
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
                _event.totalRating
            
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
    function requestResaleVerification(uint256 tokenId, uint256 price) public nonReentrant {
        require(tokenId > 0, "Invalid token ID");
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this ticket");
        require(price > 0, "Price must be greater than 0");
        require(resaleRequests[tokenId].owner == address(0), "Resale request already exists for this ticket");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
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
        require(msg.sender == eventOrganizer || msg.sender == mine, "Only event organizer or contract owner can approve");
        
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
        require(msg.sender == eventOrganizer || msg.sender == mine, "Only event organizer or contract owner can reject");
        
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
        resaleRequests[tokenId].rejected = true; // Mark as "completed" (not literally rejected)
        
        // Transfer ticket to contract first
        _transfer(msg.sender, address(this), tokenId);
        
        // In a real implementation, you would handle payment here
        // For now, we'll just emit an event
        emit TicketResold(tokenId, msg.sender, address(0), price);
    }

    // New function to buy a resale ticket with royalty payment
    function buyResaleTicket(uint256 tokenId, uint256 maxPrice) public nonReentrant {
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) != msg.sender, "Cannot buy your own ticket");
        require(resaleRequests[tokenId].approved, "Resale not approved");
        require(!ticketCancelled[tokenId], "Ticket has been cancelled");
        
        ResaleRequest storage request = resaleRequests[tokenId];
        require(request.price <= maxPrice, "Price exceeds maximum allowed");
        
        address seller = request.owner;
        uint256 price = request.price;
        
        // Calculate royalty and seller amounts
        uint256 royaltyAmount = (price * royaltyPercent) / 100;
        uint256 sellerAmount = price - royaltyAmount;
        
        // Transfer payments
        require(cUSDToken.transferFrom(msg.sender, mine, royaltyAmount), "Royalty transfer failed");
        require(cUSDToken.transferFrom(msg.sender, seller, sellerAmount), "Payment to seller failed");
        
        // Transfer ticket ownership
        _transfer(address(this), msg.sender, tokenId);
        
        // Update ownership history
        ticketOwnershipHistory[tokenId].push(msg.sender);
        
        // Clean up resale request
        delete resaleRequests[tokenId];
        
        emit TicketResold(tokenId, seller, msg.sender, price);
        emit RoyaltyPaid(tokenId, mine, royaltyAmount);
    }

    // Function to get ticket ownership history
    function getTicketOwnershipHistory(uint256 tokenId) public view returns (address[] memory) {
        return ticketOwnershipHistory[tokenId];
    }

    // Function to set royalty percentage (only contract owner)
    function setRoyaltyPercent(uint256 _royaltyPercent) public onlyContractOwner {
        require(_royaltyPercent <= 20, "Royalty percent cannot exceed 20%");
        royaltyPercent = _royaltyPercent;
    }

    // Function to cancel a ticket (emergency function)
    function cancelTicket(uint256 tokenId) public {
        require(_exists(tokenId), "Ticket does not exist");
        require(ownerOf(tokenId) == msg.sender || msg.sender == mine, "Not authorized to cancel ticket");
        
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

    //function to withdraw from the contract
    function withdraw(address _address) public onlyContractOwner {
        require(cUSDToken.transfer(_address, cUSDToken.balanceOf(address(this))), "Unable to withdraw from contract");
    }

    //modifier for onlyOwner
    modifier onlyContractOwner() {
        require(msg.sender == mine , "Only owner can call this function");
        _;
    }
}