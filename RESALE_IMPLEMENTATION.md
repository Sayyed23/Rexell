# Resale Verification System Implementation

## Overview
This document describes the complete implementation of the resale verification system for the Rexell ticketing platform with proper blockchain integration.

## Smart Contract Updates

### Key Changes to Rexell.sol

1. **Event Organizer Authorization**
   - Modified `approveResale()` and `rejectResale()` functions to allow event organizers to manage resale requests for their own events
   - Added `getEventOrganizerForToken()` helper function to determine which organizer owns an event for a given ticket
   - Contract owner retains ability to approve/reject any resale request

2. **New Helper Functions**
   ```solidity
   - getEventOrganizerForToken(uint256 tokenId) - Returns the organizer address for a ticket
   - getOrganizerResaleRequests(address organizer) - Returns all resale requests for organizer's events
   - getAllApprovedResaleTickets() - Returns all approved resale tickets for the marketplace
   ```

3. **Existing Resale Functions** (Maintained)
   ```solidity
   - requestResaleVerification(uint256 tokenId, uint256 price) - User requests resale
   - approveResale(uint256 tokenId) - Organizer/owner approves resale
   - rejectResale(uint256 tokenId) - Organizer/owner rejects resale
   - buyResaleTicket(uint256 tokenId, uint256 maxPrice) - Buy approved resale ticket
   - getResaleRequest(uint256 tokenId) - Get resale request details
   - cancelResaleRequest(uint256 tokenId) - User cancels their request
   ```

## Frontend Implementation

### 1. Owner Dashboard (`/owner/resale-requests`)
**Purpose**: Allow event organizers to review and manage resale requests

**Features**:
- Displays all resale requests for organizer's events using `getOrganizerResaleRequests()`
- Separates pending and processed requests
- One-click approve/reject buttons
- Real-time updates every 5 seconds
- Shows request details: token ID, owner address, requested price

**Key Functions**:
- Uses `useReadContract` with `getOrganizerResaleRequests` to fetch requests
- Calls `approveResale(tokenId)` or `rejectResale(tokenId)` on button clicks
- Auto-refreshes after actions

### 2. Market Page (`/market`)
**Purpose**: Display all approved resale tickets for purchase

**Features**:
- Shows all approved resale tickets using `getAllApprovedResaleTickets()`
- Filters out user's own tickets
- One-click purchase with cUSD approval flow
- Real-time updates every 5 seconds
- Visual ticket cards with pricing

**Purchase Flow**:
1. User clicks "Buy Now"
2. System requests cUSD approval for spending
3. System calls `buyResaleTicket(tokenId, price)`
4. Contract handles:
   - Royalty calculation (5% default)
   - Payment to seller (95%)
   - Payment to platform (5%)
   - Ticket ownership transfer
   - Ownership history tracking

### 3. Resale Verification Component (`ResaleVerificationNew.tsx`)
**Purpose**: Allow ticket owners to request resale verification

**Features**:
- Multi-state UI: none, pending, approved, rejected
- Price input validation
- Auto-refresh status every 10 seconds
- Clear status indicators with color coding
- Allows resubmission after rejection

**States**:
- **None**: Initial state, shows price input form
- **Pending**: Shows waiting animation, allows status refresh
- **Approved**: Shows success message, allows proceeding to resale
- **Rejected**: Shows rejection message, allows new request submission

### 4. Resale Ticket Component (`ResaleTicket.tsx`)
**Purpose**: Handle ticket listing after approval

**Features**:
- Displays approved resale status
- Allows price adjustment before final listing
- Shows important information about the resale process
- Cancel listing option

## Resale Flow

### Complete User Journey

1. **User Requests Resale**
   - User navigates to their ticket
   - Clicks "Request Resale Verification"
   - Enters desired resale price in cUSD
   - Calls `requestResaleVerification(tokenId, price)`
   - Status changes to "Pending"

2. **Organizer Reviews Request**
   - Organizer visits `/owner/resale-requests`
   - Sees pending request with price
   - Reviews and decides to approve or reject
   - Calls `approveResale(tokenId)` or `rejectResale(tokenId)`

3. **User Lists Ticket (if approved)**
   - User sees "Approved" status
   - Can adjust final resale price
   - Lists ticket for resale
   - Ticket appears in market

4. **Buyer Purchases Ticket**
   - Buyer browses `/market`
   - Sees available resale tickets
   - Clicks "Buy Now"
   - Approves cUSD spending
   - Purchases ticket via `buyResaleTicket(tokenId, price)`
   - Contract handles all payments and transfers

## Security Features

1. **Ownership Verification**
   - Only ticket owners can request resale
   - Only event organizers can approve their events' resales
   - Contract owner can manage all resales

2. **Payment Security**
   - cUSD approval required before purchase
   - Reentrancy protection on all payment functions
   - Automatic royalty calculation and distribution

3. **State Management**
   - Prevents duplicate requests
   - Validates all state transitions
   - Tracks ownership history

4. **Cancellation Safety**
   - Tickets can be cancelled in emergencies
   - Cannot resell cancelled tickets
   - Request cancellation before approval

## Smart Contract Events

```solidity
event ResaleRequested(uint256 indexed tokenId, address indexed owner, uint256 price);
event ResaleApproved(uint256 indexed tokenId, address indexed owner);
event ResaleRejected(uint256 indexed tokenId, address indexed owner);
event TicketResold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
event RoyaltyPaid(uint256 indexed tokenId, address indexed organizer, uint256 amount);
event TicketCancelled(uint256 indexed tokenId, address indexed owner);
```

## Deployment Instructions

### 1. Deploy Smart Contract

```bash
# Compile the contract
npx hardhat compile

# Deploy to Celo Alfajores testnet
npx hardhat run scripts/deploy.ts --network alfajores

# Note the deployed contract address
```

### 2. Update Frontend Configuration

Update `/app/frontend/blockchain/abi/rexell-abi.ts`:
```typescript
export const contractAddress = "YOUR_NEW_CONTRACT_ADDRESS";
```

### 3. Test the Implementation

1. **Test Resale Request**:
   - Buy a ticket
   - Request resale verification
   - Check status updates

2. **Test Organizer Dashboard**:
   - Login as event organizer
   - Visit `/owner/resale-requests`
   - Approve/reject requests

3. **Test Market Purchase**:
   - Visit `/market`
   - Buy an approved resale ticket
   - Verify payment and ownership transfer

## Configuration

### Royalty Settings
Default: 5% of resale price goes to platform
Maximum: 20%

To change royalty percentage (contract owner only):
```solidity
setRoyaltyPercent(newPercent); // newPercent <= 20
```

### Auto-Refresh Intervals
- Owner Dashboard: 5 seconds
- Market Page: 5 seconds
- Verification Status: 10 seconds

## Troubleshooting

### Common Issues

1. **"Resale request already exists"**
   - Solution: Cancel existing request first using `cancelResaleRequest()`

2. **"Only event organizer can approve"**
   - Solution: Ensure caller is the event organizer or contract owner

3. **"Insufficient cUSD balance"**
   - Solution: Ensure buyer has enough cUSD and has approved spending

4. **"Resale not approved"**
   - Solution: Wait for organizer approval or check request status

## Future Enhancements

1. **Email Notifications**: Notify organizers of new resale requests
2. **Price Limits**: Set maximum resale price based on original ticket price
3. **Time Limits**: Auto-reject requests after a certain time period
4. **Batch Operations**: Approve/reject multiple requests at once
5. **Analytics Dashboard**: Track resale metrics and revenue
