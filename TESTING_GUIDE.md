# Resale System Testing Guide

This guide provides step-by-step instructions for testing the complete resale verification system.

## Prerequisites

Before testing, ensure:
1. Smart contract is deployed to Celo Alfajores testnet
2. Frontend is running (`npm run dev` in /app/frontend)
3. You have at least 2 test wallets with:
   - CELO tokens for gas fees
   - cUSD tokens for purchases
4. Contract address is updated in `/app/frontend/blockchain/abi/rexell-abi.ts`

## Getting Test Tokens

### CELO Tokens (for gas)
Visit: https://faucet.celo.org/alfajores
- Connect your wallet
- Request CELO tokens
- Wait for transaction confirmation

### cUSD Tokens (for payments)
Option 1 - Faucet:
- Visit: https://faucet.celo.org/alfajores
- Request cUSD tokens

Option 2 - Swap:
- Use Ubeswap or Mento to swap CELO for cUSD

## Test Scenario 1: Complete Resale Flow

### Setup (15 minutes)

**Wallet A (Event Organizer & Buyer)**
- Address: `<your-organizer-address>`
- Tokens needed: 10 CELO, 100 cUSD

**Wallet B (Ticket Holder & Seller)**
- Address: `<your-seller-address>`
- Tokens needed: 5 CELO, 50 cUSD

### Step 1: Create Event (Wallet A - Organizer)

1. Connect Wallet A to the application
2. Navigate to "Create Event"
3. Fill in event details:
   - Name: "Test Concert"
   - Venue: "Test Venue"
   - Category: "Music"
   - Date: Future date
   - Price: 10 cUSD
   - Tickets Available: 5
   - Description: "Test event for resale system"
4. Submit and wait for transaction confirmation
5. Verify event appears on "Events" page

**Expected Result**: ✅ Event created successfully

### Step 2: Buy Ticket (Wallet B - Buyer/Future Seller)

1. Disconnect Wallet A, connect Wallet B
2. Navigate to "Events" page
3. Find "Test Concert" event
4. Click "Buy Ticket"
5. Approve cUSD spending (10 cUSD)
6. Confirm purchase transaction
7. Wait for confirmation
8. Navigate to "My Tickets" to verify purchase

**Expected Result**: ✅ Ticket purchased and appears in "My Tickets"

### Step 3: Request Resale Verification (Wallet B)

1. Still connected as Wallet B
2. Go to "My Tickets"
3. Find the purchased ticket for "Test Concert"
4. Click "Request Resale Verification"
5. Enter resale price: 12 cUSD (20% markup)
6. Click "Submit Verification Request"
7. Confirm transaction
8. Verify status changes to "Pending"

**Expected Result**: ✅ Resale request submitted, status shows "Pending"

**Test Status Refresh**:
- Wait 10 seconds for auto-refresh
- Or click "Refresh Status" button
- Status should remain "Pending" until organizer acts

### Step 4: Review Resale Request (Wallet A - Organizer)

1. Disconnect Wallet B, connect Wallet A (organizer)
2. Navigate to `/owner/resale-requests`
3. Verify you see the pending request with:
   - Token ID
   - Owner address (Wallet B)
   - Requested price: 12 cUSD
   - Status: Pending

**Expected Result**: ✅ Resale request appears in organizer dashboard

**Test Rejection (Optional)**:
1. Click "Reject" button
2. Confirm transaction
3. Switch back to Wallet B
4. Verify status shows "Rejected"
5. Click "Submit New Request" to try again

### Step 5: Approve Resale Request (Wallet A - Organizer)

1. Connected as Wallet A
2. On `/owner/resale-requests` page
3. Find the pending request
4. Click "Approve" button
5. Confirm transaction
6. Wait for confirmation
7. Verify request moves to "Processed" section with "Approved" badge

**Expected Result**: ✅ Request approved, appears as processed

### Step 6: List Ticket for Resale (Wallet B - Seller)

1. Switch back to Wallet B
2. Go to "My Tickets"
3. Find the approved ticket
4. Status should show "Resale Approved"
5. Optionally adjust the resale price
6. Click "List Ticket for Resale"
7. Confirm transaction
8. Verify ticket is now listed

**Expected Result**: ✅ Ticket listed for resale

### Step 7: View Ticket in Market (Any Wallet)

1. Navigate to `/market` page
2. Verify the ticket appears with:
   - Ticket number
   - Seller address (Wallet B)
   - Price: 12 cUSD
   - "Resale" badge
   - "Buy Now" button

**Expected Result**: ✅ Ticket visible in market

**Note**: Wallet B should NOT see their own ticket in the market

### Step 8: Purchase Resale Ticket (Wallet A - Final Buyer)

1. Connect Wallet A (organizer buying the resale)
2. Go to `/market` page
3. Find the listed ticket
4. Click "Buy Now"
5. First transaction: Approve cUSD spending (12 cUSD)
6. Wait for approval confirmation
7. Second transaction: Purchase ticket
8. Confirm purchase transaction
9. Wait for confirmation

**Expected Result**: 
✅ Purchase successful
✅ Ticket appears in Wallet A's "My Tickets"
✅ Ticket removed from market
✅ Payments distributed:
  - Wallet B receives: 11.4 cUSD (95% of 12)
  - Platform receives: 0.6 cUSD (5% royalty)

### Step 9: Verify Ownership Transfer

1. Still connected as Wallet A
2. Go to "My Tickets"
3. Verify the ticket now shows:
   - Token ID (same as before)
   - Owner: Wallet A address
   - Event: Test Concert

**Expected Result**: ✅ Ownership transferred successfully

## Test Scenario 2: Edge Cases

### Test 2.1: Duplicate Resale Request

1. Buy a ticket (Wallet B)
2. Request resale verification
3. Without waiting for approval, try requesting again
4. **Expected**: ❌ Error: "Resale request already exists for this ticket"

### Test 2.2: Non-Owner Approval Attempt

1. Create event with Wallet A
2. Buy ticket with Wallet B
3. B requests resale verification
4. Connect Wallet C (different address)
5. Try to approve request at `/owner/resale-requests`
6. **Expected**: Request not visible (only organizer sees their events)

### Test 2.3: Buy Own Ticket

1. After listing ticket for resale (Wallet B)
2. Try to buy your own ticket in `/market`
3. **Expected**: Your own ticket should not appear in the market list

### Test 2.4: Cancel Resale Request

1. Request resale verification (Wallet B)
2. Before organizer approves, click "Cancel Request"
3. Confirm transaction
4. Verify request disappears
5. Verify can submit new request
6. **Expected**: ✅ Request cancelled successfully

### Test 2.5: Insufficient cUSD Balance

1. Create new wallet with 0 cUSD
2. Try to buy resale ticket
3. **Expected**: ❌ Error: "Insufficient cUSD balance"

### Test 2.6: Price Change After Approval

1. Request resale with price X
2. Get approved
3. When listing, change price to Y
4. Verify market shows new price Y
5. **Expected**: ✅ Can adjust price after approval

## Test Scenario 3: Multiple Resales

### Test 3.1: Multiple Events

1. Wallet A creates Event 1 and Event 2
2. Wallet B buys tickets for both events
3. Wallet B requests resale for both tickets
4. Wallet A should see both requests in dashboard
5. Approve one, reject the other
6. **Expected**: Both requests handled independently

### Test 3.2: Multiple Tickets Same Event

1. Create event with 5 tickets
2. Wallet B buys 3 tickets
3. Request resale for all 3 tickets
4. Verify all 3 appear in organizer dashboard
5. Approve all 3
6. List all 3 in market
7. **Expected**: All 3 tickets visible in market

## Verification Checklist

After completing tests, verify:

### Smart Contract
- [ ] Event created successfully
- [ ] Ticket minted as NFT
- [ ] Resale request stored correctly
- [ ] Approval/rejection updates state
- [ ] Payment calculations correct (95% seller, 5% royalty)
- [ ] Ownership transfer works
- [ ] Events emitted correctly

### Frontend
- [ ] Resale verification UI shows correct states
- [ ] Owner dashboard displays requests
- [ ] Market page shows approved tickets
- [ ] Buy flow completes successfully
- [ ] Auto-refresh works (10s for status, 5s for lists)
- [ ] Error messages are clear and helpful
- [ ] Loading states display correctly

### Business Logic
- [ ] Only organizers can approve their events' resales
- [ ] Only ticket owners can request resale
- [ ] Cannot buy own ticket
- [ ] Cannot approve already processed request
- [ ] Royalty calculation accurate
- [ ] Ownership history tracked

## Troubleshooting

### "Transaction Failed"
- Check wallet has enough CELO for gas
- Verify cUSD approval was successful
- Check contract address is correct

### "Resale Not Approved"
- Verify organizer has approved the request
- Check request status in "My Tickets"
- Wait for blockchain confirmation

### "Request Not Visible"
- Ensure correct wallet is connected
- Verify you're the event organizer
- Check auto-refresh has occurred

### "Cannot Find Ticket"
- Confirm ticket ownership in "My Tickets"
- Verify token ID is correct
- Check transaction completed on blockchain

## Blockchain Explorer Verification

For each transaction, you can verify on Celo Explorer:
https://alfajores.celoscan.io/

Search for:
- Transaction hash
- Contract address
- Wallet address

Verify:
- Transaction status (Success/Failed)
- Gas used
- Events emitted
- Token transfers

## Performance Metrics

Track these metrics during testing:

| Metric | Target | Notes |
|--------|---------|-------|
| Request submission time | < 5s | Time to submit resale request |
| Approval time | < 5s | Time to approve/reject |
| Market listing time | < 5s | Time to appear in market |
| Purchase time | < 10s | Including cUSD approval |
| Auto-refresh accuracy | 100% | Status updates correctly |

## Test Report Template

```
Date: ___________
Tester: ___________
Contract Address: ___________

Test Scenario 1: [ ] Pass [ ] Fail
  Notes: ___________

Test Scenario 2: [ ] Pass [ ] Fail
  Notes: ___________

Test Scenario 3: [ ] Pass [ ] Fail
  Notes: ___________

Issues Found:
1. ___________
2. ___________

Recommendations:
1. ___________
2. ___________
```

## Next Steps After Testing

1. Fix any bugs discovered
2. Optimize gas usage if needed
3. Deploy to mainnet when ready
4. Update contract address in production
5. Monitor real transactions
6. Collect user feedback
