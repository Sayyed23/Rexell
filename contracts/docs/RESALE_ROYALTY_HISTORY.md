# Resale System with Royalty Fees and Ownership History

This document describes the enhanced resale system for the Rexell ticketing platform, which includes royalty fees for organizers and on-chain ownership history tracking.

## Overview

The enhanced resale system allows users to securely resell their NFT tickets while ensuring transparency through ownership history tracking and providing royalty fees to event organizers.

## Key Features

### 1. Smart Contract Enhancements

#### Royalty Fees
- 5% royalty fee automatically deducted from each resale transaction
- Royalty payments sent directly to the event organizer
- Configurable royalty percentage (up to 20%) by contract owner

#### Ownership History Tracking
- Complete on-chain record of all ticket owners
- Transparent ownership timeline for each ticket
- Immutable history that cannot be altered

#### Security Features
- Reentrancy protection using OpenZeppelin's ReentrancyGuard
- Ticket cancellation mechanism for emergency situations
- Validation checks to prevent unauthorized actions

### 2. Frontend Components

#### Marketplace Page (`/market`)
- Displays all available resale tickets
- Shows ticket details including price and ownership status
- Links to individual purchase pages

#### Resale Page (`/resale`)
- Allows users to list their tickets for resale
- Form for setting resale price
- Approval workflow integration

#### Buy Resale Ticket Page (`/buy/[id]`)
- Detailed view of resale tickets
- Purchase functionality with royalty fee calculation
- Transaction confirmation

#### Ownership History Page (`/history/[id]`)
- Complete ownership timeline for each ticket
- Visual representation of ownership transfers
- Timestamps for all ownership changes

### 3. Web3 Utilities

#### Enhanced Web3 Library
- Integration with viem and wagmi instead of ethers.js
- Price formatting and parsing functions
- Address shortening for better UX
- Public and wallet client utilities

#### UI Components
- Reusable TicketCard component for displaying tickets
- HistoryCard component for ownership history visualization

## Technical Implementation

### Smart Contract Functions

#### Core Resale Functions
```solidity
function requestResaleVerification(uint256 tokenId, uint256 price)
function approveResale(uint256 tokenId)
function rejectResale(uint256 tokenId)
function buyResaleTicket(uint256 tokenId, uint256 maxPrice)
```

#### Royalty and History Functions
```solidity
function setRoyaltyPercent(uint256 _royaltyPercent)
function getTicketOwnershipHistory(uint256 tokenId)
```

#### Security Functions
```solidity
function cancelTicket(uint256 tokenId)
function isTicketCancelled(uint256 tokenId)
```

### Frontend Pages

#### Marketplace (`/market/page.tsx`)
- Fetches and displays available resale tickets
- Loading states and empty state handling
- Navigation to purchase pages

#### Resale (`/resale/page.tsx`)
- User ticket selection interface
- Resale price input form
- Request submission workflow

#### Buy Resale Ticket (`/buy/[id]/page.tsx`)
- Ticket detail display
- Purchase confirmation with royalty information
- Transaction handling

#### Ownership History (`/history/[id]/page.tsx`)
- Timeline visualization of ownership changes
- Address display with privacy considerations
- Timestamp information

## Security Measures

1. **Reentrancy Protection**: All state-changing functions use the `nonReentrant` modifier
2. **Access Control**: Only authorized users can perform specific actions
3. **Input Validation**: Comprehensive validation of all user inputs
4. **Emergency Stop**: Ticket cancellation mechanism for emergency situations
5. **Ownership Verification**: Multiple checks to ensure only ticket owners can list for resale

## Testing

The system includes comprehensive tests covering:
- Complete resale workflow
- Royalty fee calculations
- Ownership history tracking
- Security features and edge cases

## Deployment

1. Deploy the updated Rexell.sol contract
2. Update the contract address in the frontend configuration
3. Verify all ABI functions are correctly exposed
4. Test the complete workflow on a testnet before mainnet deployment

## Future Enhancements

1. **Auction System**: Implement auction-style resales
2. **Filtering and Search**: Add filtering options to the marketplace
3. **QR Verification**: Integrate QR codes for event entry verification
4. **IPFS Metadata**: Store ticket metadata on IPFS for decentralization
5. **Mobile Optimization**: Enhanced mobile experience for all pages