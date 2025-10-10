// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ResaleTicket is ERC721URIStorage, Ownable, ReentrancyGuard {
    IERC20 public cUSDToken;
    address public organizer;
    uint256 public royaltyPercent = 5; // 5% royalty
    
    // Ticket struct with resale functionality
    struct Ticket {
        uint256 id;
        address owner;
        uint256 eventId;
        uint256 price;
        bool isForSale;
        bool isResale;
    }
    
    // Mappings
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => address[]) public ownershipHistory; // Track all previous owners
    mapping(uint256 => address) public ticketToOwner;
    mapping(uint256 => string) public ticketURIs; // Store ticket metadata URIs
    
    // Events
    event TicketListedForResale(uint256 indexed ticketId, address indexed seller, uint256 price);
    event TicketResold(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price);
    event RoyaltyPaid(uint256 indexed ticketId, address indexed organizer, uint256 amount);
    
    constructor(address _cUSDTokenAddress) {
        cUSDToken = IERC20(_cUSDTokenAddress);
        organizer = msg.sender;
    }
    
    /**
     * @dev List a ticket for resale
     * @param ticketId The ID of the ticket to list for resale
     * @param resalePrice The price at which to sell the ticket
     */
    function listForResale(uint256 ticketId, uint256 resalePrice) public {
        require(ticketToOwner[ticketId] == msg.sender, "You are not the owner");
        require(resalePrice > 0, "Invalid price");
        require(!tickets[ticketId].isForSale, "Ticket already listed for sale");
        
        Ticket storage t = tickets[ticketId];
        t.price = resalePrice;
        t.isForSale = true;
        t.isResale = true;
        
        emit TicketListedForResale(ticketId, msg.sender, resalePrice);
    }
    
    /**
     * @dev Buy a resale ticket
     * @param ticketId The ID of the ticket to buy
     */
    function buyResaleTicket(uint256 ticketId) public nonReentrant {
        Ticket storage t = tickets[ticketId];
        require(t.isForSale, "Ticket not for sale");
        require(msg.sender != t.owner, "Cannot buy your own ticket");
        
        uint256 price = t.price;
        address seller = t.owner;
        
        // Calculate royalty and seller amounts
        uint256 royaltyAmount = (price * royaltyPercent) / 100;
        uint256 sellerAmount = price - royaltyAmount;
        
        // Transfer payment from buyer to seller and organizer
        require(cUSDToken.transferFrom(msg.sender, organizer, royaltyAmount), "Royalty transfer failed");
        require(cUSDToken.transferFrom(msg.sender, seller, sellerAmount), "Payment to seller failed");
        
        // Transfer ownership
        t.owner = msg.sender;
        t.isForSale = false;
        ticketToOwner[ticketId] = msg.sender;
        
        // Track ownership history
        ownershipHistory[ticketId].push(msg.sender);
        
        emit TicketResold(ticketId, seller, msg.sender, price);
        emit RoyaltyPaid(ticketId, organizer, royaltyAmount);
    }
    
    /**
     * @dev Get the ownership history of a ticket
     * @param ticketId The ID of the ticket
     * @return The array of addresses that have owned this ticket
     */
    function getOwnershipHistory(uint256 ticketId) public view returns (address[] memory) {
        return ownershipHistory[ticketId];
    }
    
    /**
     * @dev Set the royalty percentage (only owner can call)
     * @param _royaltyPercent The new royalty percentage (0-100)
     */
    function setRoyaltyPercent(uint256 _royaltyPercent) public onlyOwner {
        require(_royaltyPercent <= 100, "Royalty percent cannot exceed 100");
        royaltyPercent = _royaltyPercent;
    }
    
    /**
     * @dev Mint a new ticket (for initial ticket creation)
     * @param ticketId The ID of the ticket
     * @param owner The owner of the ticket
     * @param eventId The event ID this ticket is for
     * @param price The original price of the ticket
     * @param nftUri The URI for the ticket metadata
     */
    function mintTicket(uint256 ticketId, address owner, uint256 eventId, uint256 price, string memory nftUri) public onlyOwner {
        require(!_exists(ticketId), "Ticket already exists");
        
        _mint(owner, ticketId);
        _setTokenURI(ticketId, nftUri);
        
        tickets[ticketId] = Ticket({
            id: ticketId,
            owner: owner,
            eventId: eventId,
            price: price,
            isForSale: false,
            isResale: false
        });
        
        ticketToOwner[ticketId] = owner;
        ticketURIs[ticketId] = nftUri;
        ownershipHistory[ticketId].push(owner); // Track initial owner
    }
    
    /**
     * @dev Cancel a resale listing
     * @param ticketId The ID of the ticket to cancel listing for
     */
    function cancelResaleListing(uint256 ticketId) public {
        require(ticketToOwner[ticketId] == msg.sender, "You are not the owner");
        require(tickets[ticketId].isForSale, "Ticket not listed for sale");
        
        tickets[ticketId].isForSale = false;
    }
    
    /**
     * @dev Update the price of a resale listing
     * @param ticketId The ID of the ticket
     * @param newPrice The new price for the ticket
     */
    function updateResalePrice(uint256 ticketId, uint256 newPrice) public {
        require(ticketToOwner[ticketId] == msg.sender, "You are not the owner");
        require(tickets[ticketId].isForSale, "Ticket not listed for sale");
        require(newPrice > 0, "Price must be greater than 0");
        
        tickets[ticketId].price = newPrice;
    }
    // Get all resale requests
function getAllResaleRequests() external view returns (ResaleRequest[] memory);

// Buy a resale ticket
function buyResaleTicket(uint256 tokenId) external payable;

// Update resale price after approval
function updateResalePrice(uint256 tokenId, uint256 newPrice) external;

// Cancel resale listing
function cancelResale(uint256 tokenId) external;

// Get token URI
function tokenURI(uint256 tokenId) external view returns (string memory);
}