# Rexell - Comprehensive Test Case Table

> Full application scan covering \\\*\\\*Frontend\\\*\\\*, \\\*\\\*Blockchain (Smart Contracts)\\\*\\\*, and \\\*\\\*AI / Bot-Detection\\\*\\\* modules.

\---

## Module 1: Blockchain / Smart Contracts

### 1.1 Rexell.sol - Event Management

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-1|Create Event - Valid|Call `createEvent()` with valid future date, >0 tickets, all fields|Wallet connected, celo network|Event created, `nextEventId` incremented, event stored in `events\\\[]`|P0|✅ Pass|
|BC-2|Create Event - Past Date|Call `createEvent()` with a past date|Wallet connected|Revert: "Event date should be in the future"|P0|✅ Pass|
|BC-3|Create Event - Zero Tickets|Call `createEvent()` with `ticketsAvailable = 0`|Wallet connected|Revert: "Tickets available should be greater than zero"|P0|✅ Pass|
|BC-4|Get All Events|Call `getAllEvents()` after creating multiple events|Events exist on-chain|Returns `EventView\\\[]` with correct data, averageRating computed|P1|✅ Pass|
|BC-5|Get Event By ID|Call `getEvent(eventId)` for a valid ID|Event exists|Returns full tuple with all 16 fields|P1|✅ Pass|
|BC-6|Get Events By Organizer|Call `getEventsByOrganizer(address)`|Organizer has created events|Returns only events by that organizer|P1|✅ Pass|

### 1.2 Rexell.sol - Ticket Purchase (Primary Market)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-7|[IMP] Buy Single Ticket (Paid)|Call `buyTicket()` for a paid event|cUSD approved, tickets available|NFT minted, cUSD transferred to organizer, `ticketsAvailable` decremented|P0|✅ Pass|
|BC-8|Buy Single Ticket (Free)|Call `buyTicket()` for a free event (price=0)|Tickets available|NFT minted, no cUSD transfer, `ticketsAvailable` decremented|P0|✅ Pass|
|BC-9|Buy Ticket - Sold Out|Call `buyTicket()` when `ticketsAvailable == 0`|All tickets sold|Revert: "No tickets available"|P0|✅ Pass|
|BC-10|[IMP] Buy Ticket - Payment Fails|Call `buyTicket()` without cUSD approval|Paid event|Revert: "Payment failed"|P0|✅ Pass|
|BC-11|[IMP] Buy Multiple Tickets (GA)|Call `buyTickets(eventId, nftUris, quantity)` with quantity > 1|Enough tickets available, cUSD approved|Multiple NFTs minted, total cost transferred, `ticketsAvailable -= quantity`|P0|✅ Pass|
|BC-12|Buy Multiple - Insufficient Tickets|Call `buyTickets()` with quantity > ticketsAvailable|Not enough tickets|Revert: "Not enough tickets available"|P0|✅ Pass|
|BC-13|Buy Multiple - Quantity Zero|Call `buyTickets()` with quantity = 0|N/A|Revert: "Quantity must be greater than 0"|P1|✅ Pass|

### 1.3 Rexell.sol - Seat Map (Dynamic Pricing)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-14|Set Seat Category Price|Organizer calls `setSeatCategoryPrice()`|Caller is event organizer or owner|Price stored, `SeatCategoryPriceSet` emitted|P0|✅ Pass|
|BC-15|Set Seat Price - Unauthorized|Non-organizer calls `setSeatCategoryPrice()`|Caller is not organizer/owner|Revert: "Only event organizer or owner can set prices"|P0|✅ Pass|
|BC-16|Buy Tickets With Seats|Call `buyTickets(eventId, nftUris, seatLabels, categories)`|Seats available, cUSD approved|Seats marked as owned, NFTs minted, correct category prices charged|P0|✅ Pass|
|BC-17|[IMP] Buy Already Sold Seat|Attempt to buy a seat that is already owned|Seat already sold|Revert: "Seat already sold"|P0|✅ Pass|
|BC-18|[IMP] Buy Seat Locked By Another|Attempt to buy a seat locked by another user (lock not expired)|Seat locked by different address|Revert: "Seat locked by another user"|P0|✅ Pass|
|BC-19|Buy Own Locked Seat|Buy a seat that the buyer previously locked|Seat locked by buyer|Purchase succeeds, lock cleared|P1|✅ Pass|
|BC-20|Lock Seats|Call `lockSeats()` for available seats|Event exists, seats not sold/locked|Seats locked for 10 minutes, `SeatLocked` emitted|P0|✅ Pass|
|BC-21|Lock Already Sold Seat|Call `lockSeats()` for a sold seat|Seat already sold|Revert: "Seat already sold"|P1|✅ Pass|
|BC-22|Unlock Seats|Call `unlockSeats()` by the locker|Seat locked by caller, lock not expired|Lock deleted, `SeatUnlocked` emitted|P1|✅ Pass|
|BC-23|Unlock Seats - Wrong User|Non-locker calls `unlockSeats()`|Seat locked by different user|Revert: "Only the locker can unlock"|P1|✅ Pass|
|BC-24|Get Sold Seats|Call `getSoldSeats(eventId)`|Some seats sold|Returns all sold seat labels|P2|✅ Pass|
|BC-25|Get User Seats|Call `getUserSeats(eventId, user)`|User has purchased seats|Returns user's seat labels for that event|P2|✅ Pass|

### 1.4 Rexell.sol - Resale Market

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-26|Request Resale Verification|Call `requestResaleVerification(tokenId, price)`|Caller owns ticket, identity verified, within cutoff, price <= max|Resale request created, `ResaleRequested` emitted|P0|✅ Pass|
|BC-27|Resale - Not Ticket Owner|Call `requestResaleVerification()` by non-owner|Caller does not own the token|Revert: "You are not the owner of this ticket"|P0|✅ Pass|
|BC-28|[IMP] Resale - Price Exceeds Max|Set resale price > `maxResaleMultiplier` \* original price|maxResaleMultiplier = 200%|Revert: "Price exceeds maximum allowed resale price"|P0|✅ Pass|
|BC-29|[IMP] Resale - Cutoff Passed|Request resale within `resaleCutoffHours` (48h) before event|Event within 48 hours|Revert: "Resale period has ended"|P0|✅ Pass|
|BC-30|[IMP] Resale - No SoulboundIdentity|Seller without valid SoulboundIdentity (score < 70)|SoulboundIdentity contract set|Revert: "Seller not verified via Soulbound Identity"|P0|✅ Pass|
|BC-31|Resale - Duplicate Request|Call `requestResaleVerification()` twice for same tokenId|First request exists|Revert: "Resale request already exists for this ticket"|P1|✅ Pass|
|BC-32|Resale - Cancelled Ticket|Attempt resale on a cancelled ticket|Ticket is cancelled|Revert: "Ticket has been cancelled"|P1|✅ Pass|
|BC-33|Approve Resale|Organizer calls `approveResale(tokenId)`|Pending resale request exists|Request marked approved, `ResaleApproved` emitted|P0|✅ Pass|
|BC-34|Approve Resale - Unauthorized|Non-organizer/non-owner calls `approveResale()`|Caller is not organizer/owner|Revert: "Only event organizer or contract owner can approve"|P0|✅ Pass|
|BC-35|Approve Resale - Already Approved|Call `approveResale()` on already approved request|Request already approved|Revert: "Resale already approved"|P1|✅ Pass|
|BC-36|Reject Resale|Organizer calls `rejectResale(tokenId)`|Pending resale request|Request marked rejected, `ResaleRejected` emitted|P0|✅ Pass|
|BC-37|Reject Resale - Already Rejected|Call `rejectResale()` on already rejected request|Request already rejected|Revert: "Resale already rejected"|P1|✅ Pass|
|BC-38|Buy Resale Ticket|Buyer calls `buyResaleTicket(tokenId, maxPrice)`|Resale approved, cUSD approved|5% royalty to organizer, 2% platform fee, remainder to seller, NFT transferred, ownership history updated|P0|✅ Pass|
|BC-39|Buy Resale - Own Ticket|Owner tries to buy own resale ticket|Caller is the seller|Revert: "Cannot buy your own ticket"|P1|✅ Pass|
|BC-40|Buy Resale - Price Changed|Buy with `maxPrice` < actual resale price|Price exceeds maxPrice|Revert: "Price exceeds maximum allowed"|P1|✅ Pass|
|BC-41|[IMP] Buy Resale - Payment Splits|Verify royalty (5%), platform fee (2%), seller amount (93%)|Successful resale purchase|cUSD split correctly: organizer gets royalty, platform gets fee, seller gets remainder|P0|✅ Pass|
|BC-42|Cancel Resale Request|Owner calls `cancelResaleRequest(tokenId)`|Pending request, not yet approved/rejected|Request deleted, `ResaleRejected` emitted|P1|✅ Pass|
|BC-43|Cancel Resale - Not Owner|Non-owner calls `cancelResaleRequest()`|Caller is not request owner|Revert: "You are not the owner of this resale request"|P1|✅ Pass|
|BC-44|Finalize Listing (resellTicket)|Seller calls `resellTicket()` after approval|Resale approved, caller owns ticket|Ticket transferred to contract, `TicketResold` emitted|P0|✅ Pass|
|BC-45|Get Approved Resale Tickets|Call `getAllApprovedResaleTickets()`|Some approved resale tickets exist|Returns only approved, non-rejected tickets with valid owners|P1|✅ Pass|
|BC-46|Get Organizer Resale Requests|Call `getOrganizerResaleRequests(organizer)`|Organizer has events with resale requests|Returns all resale requests for that organizer's events|P1|✅ Pass|
|BC-47|Get Ticket Ownership History|Call `getTicketOwnershipHistory(tokenId)`|Ticket has been resold|Returns array of all historical owners|P1|✅ Pass|

### 1.5 Rexell.sol - Ratings \& Comments

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-48|Submit Rating|Call `submitRating(eventId, 4)` after event date|Event has passed, caller is ticket holder|Rating stored, totalRating/ratingCount updated|P1|✅ Pass|
|BC-49|Submit Rating - Before Event|Call `submitRating()` before event date|Event has not occurred yet|Revert: "Rating can only be given after the event date"|P1|✅ Pass|
|BC-50|Submit Rating - Out of Range|Call `submitRating()` with rating 0 or 6|N/A|Revert: "Rating should be between 1 and 5"|P1|✅ Pass|
|BC-51|Submit Rating - Duplicate|Rate same event twice from same address|Already rated|Revert: "You have already rated this event"|P1|✅ Pass|
|BC-52|Get Average Rating|Call `getAverageRating(eventId)`|Event has ratings|Returns correct integer average|P2|✅ Pass|
|BC-53|Submit Comment|Call `submitComment(eventId, text)`|Caller is ticket holder|Comment added with commenter, text, timestamp|P1|✅ Pass|
|BC-54|Submit Comment - Not Holder|Non-holder calls `submitComment()`|Caller has no ticket for event|Revert: "Only ticket holders can comment on the event"|P1|✅ Pass|
|BC-55|Get All Comments|Call `getAllComments(eventId)`|Event has comments|Returns `Comment\\\[]` array|P2|✅ Pass|

### 1.6 Rexell.sol - Admin Functions

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-56|Set Royalty Percent|Owner calls `setRoyaltyPercent(10)`|Caller is contract owner, value <= 20|`royaltyPercent` updated|P1|✅ Pass|
|BC-57|Set Royalty - Exceeds Max|Call `setRoyaltyPercent(25)`|N/A|Revert: "Royalty percent cannot exceed 20%"|P1|✅ Pass|
|BC-58|Set Platform Fee|Owner calls `setPlatformFeePercent(5)`|Value <= 10|`platformFeePercent` updated|P1|✅ Pass|
|BC-59|Set Platform Fee - Exceeds Max|Call `setPlatformFeePercent(15)`|N/A|Revert: "Platform fee cannot exceed 10%"|P1|✅ Pass|
|BC-60|Set Platform Fee Recipient|Owner calls `setPlatformFeeRecipient(newAddr)`|Valid non-zero address|`platformFeeRecipient` updated|P2|✅ Pass|
|BC-61|Set Max Resale Multiplier|Owner sets multiplier >= 100|Valid value|`maxResaleMultiplier` updated|P2|✅ Pass|
|BC-62|Set Resale Cutoff Hours|Owner sets cutoff hours|N/A|`resaleCutoffHours` updated|P2|✅ Pass|
|BC-63|Cancel Ticket|Owner or ticket holder calls `cancelTicket()`|Token exists|`ticketCancelled\\\[tokenId] = true`, `TicketCancelled` emitted|P1|✅ Pass|
|BC-64|Cancel Ticket - Unauthorized|Third party calls `cancelTicket()`|Caller is not owner/ticket holder|Revert: "Not authorized to cancel ticket"|P1|✅ Pass|
|BC-65|Withdraw|Owner calls `withdraw(address)`|Contract has cUSD balance|cUSD transferred to specified address|P2|✅ Pass|
|BC-66|OnlyContractOwner Modifier|Non-owner calls admin-only functions|Caller is not contract owner|Revert: "Only owner can call this function"|P0|✅ Pass|

### 1.7 SoulboundIdentity.sol

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-67|[IMP] Mint Identity|Owner calls `mintIdentity(user, 85)`|User has no identity, score <= 100|SBT minted, mappings updated, `IdentityMinted` emitted|P0|✅ Pass|
|BC-68|Mint Identity - Duplicate|Call `mintIdentity()` for user who already has one|User already has identity|Revert: "User already has an identity"|P0|✅ Pass|
|BC-69|Mint Identity - Invalid Score|Call `mintIdentity(user, 101)`|Score > 100|Revert: "Score must be between 0 and 100"|P1|✅ Pass|
|BC-70|Update Score|Owner calls `updateScore(user, 90)`|User has identity|Score updated, `ScoreUpdated` emitted|P1|✅ Pass|
|BC-71|Burn Identity|Owner calls `burnIdentity(user)`|User has identity|SBT burned, all mappings cleared, `IdentityBurned` emitted|P1|✅ Pass|
|BC-72|[IMP] Has Valid Identity - Score >= 70|Call `hasValidIdentity(user)` with score 85|User has identity with score 85|Returns `true`|P0|✅ Pass|
|BC-73|[IMP] Has Valid Identity - Score < 70|Call `hasValidIdentity(user)` with score 50|User has identity with score 50|Returns `false`|P0|✅ Pass|
|BC-74|Has Valid Identity - No Identity|Call `hasValidIdentity(user)` for new user|User has no identity|Returns `false`|P0|✅ Pass|
|BC-75|Transfer Blocked (Soulbound)|Attempt to transfer SBT between non-zero addresses|Both from and to are non-zero|Revert: "Soulbound: Transfer not allowed"|P0|✅ Pass|
|BC-76|Get Identity Details|Call `getIdentityDetails(user)`|User has identity|Returns tokenId, score, kycTimestamp|P2|✅ Pass|

### 1.8 MockCUSD.sol

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-77|Constructor Mints Supply|Deploy MockCUSD|N/A|Deployer receives 1,000,000 cUSD|P2|✅ Pass|
|BC-78|Mint Function|Call `mint(to, amount)`|Any caller|Mints specified amount to address|P2|✅ Pass|
|BC-79|Create Event - Gas Limit Exceeded|Call `createEvent()` with extremely long string fields|Wallet connected, Celo network|Revert: "Gas limit exceeded" or out of gas exception|P2|❌ Fail|
|BC-80|Identity Score Verification - Overflow|Call `mintIdentity()` with score > max uint256|Wallet connected|Revert: "SafeCast or arithmetic overflow"|P1|❌ Fail|
|BC-81|Withdraw - Reentrancy on Custom ERC20|Deploy malicious custom ERC20 contract and attempt withdrawal reentrancy|Contract has cUSD balance|Revert: "ReentrancyGuard: reentrant call"|P0|❌ Fail|

\---

## Module 2: Frontend (Next.js)

### 2.1 Landing / Marketing Page

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-1|Landing Page Renders|Navigate to `/`|N/A|Landing page loads with hero, features, testimonials, CTA, footer|P0|✅ Pass|
|FE-2|CTA Navigate to Events|Click "Get Started" CTA button|N/A|Redirects to `/events` page|P1|✅ Pass|
|FE-3|Header Navigation Links|Click header nav items|N/A|Links to events, create-event, my-tickets work|P1|✅ Pass|

### 2.2 Wallet Connection

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-4|Connect Wallet|Click wallet connect button|MetaMask/wallet installed|Wallet connects, address displayed in header|P0|✅ Pass|
|FE-5|[IMP] Wallet Not Connected Guards|Visit protected pages without wallet|No wallet connected|"Connect your wallet" message shown on events, my-tickets, market, resale-approval pages|P0|✅ Pass|
|FE-6|Celo Sepolia Chain|Connect wallet on wrong chain|Wallet on different network|Prompt to switch to Celo Sepolia or display error|P0|✅ Pass|

### 2.3 Events Page (`/events`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-7|List All Events|Navigate to `/events` with wallet connected|Events exist on-chain|Grid of event cards with name, price, date, time, tickets, image from IPFS|P0|✅ Pass|
|FE-8|Ended Event Overlay|View event card for a past event|Event date has passed|"Ended" overlay displayed on the card, ticket count shows "--"|P1|✅ Pass|
|FE-9|Free Event Display|View event with price = 0|Free event exists|Price shows "Free" instead of "0 cUSD"|P1|✅ Pass|
|FE-10|Event Card Click|Click on an event card|Events loaded|Navigates to `/event-details/{index}`|P0|✅ Pass|
|FE-11|No Events State|Load events page with no events|No events on-chain|"No events found" message displayed|P1|✅ Pass|
|FE-12|Error State|Load events with contract error (wrong chain)|Wrong network|Error message with "Please make sure you are connected to Celo Sepolia"|P1|✅ Pass|
|FE-13|Auto-Refresh Polling|Wait 10 seconds after page load|Events page open|`refetch()` called every 10 seconds to update event list|P2|✅ Pass|
|FE-14|Loading Skeleton|Page load with pending data|Fetching events|4 skeleton placeholders displayed|P2|✅ Pass|

### 2.4 Create Event Page (`/create-event`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-15|Create Event Form|Fill all fields and submit|Wallet connected, valid inputs, image uploaded|Contract `createEvent()` called, success toast, redirect to `/events`|P0|✅ Pass|
|FE-16|Image Upload - Valid|Upload JPG/PNG/GIF < 5MB|N/A|File uploaded to IPFS, CID stored|P0|✅ Pass|
|FE-17|Image Upload - Invalid Type|Upload PDF or other invalid type|N/A|Toast error: "Only JPG, PNG, and GIF files are allowed"|P0|✅ Pass|
|FE-18|Image Upload - Exceeds 5MB|Upload file > 5MB|N/A|Toast error: "File size must be less than 5 MB"|P0|✅ Pass|
|FE-19|[IMP] Past Date Validation|Select a past date + time|N/A|Toast error: "Please select a future date and time", `timeError` shown|P0|✅ Pass|
|FE-20|No Category Selected|Submit without selecting category|N/A|Toast error: "Please select an event category"|P1|✅ Pass|
|FE-21|No Wallet Connected|Submit form without wallet|No wallet connected|Toast error: "Please connect your wallet"|P0|✅ Pass|
|FE-22|Min Date Enforcement|Check date input field|N/A|`min` attribute set to today's date, past dates disabled|P1|✅ Pass|
|FE-23|Price in Wei Conversion|Enter price "1.5" cUSD|N/A|Contract receives `BigInt(1.5 \\\* 10^18)`|P1|✅ Pass|
|FE-24|Date Seconds Conversion|Submit with a valid date|N/A|Contract receives `dateInSeconds = Math.floor(dateMs / 1000)`|P1|✅ Pass|
|FE-25|Category Selection|Select "Sports" from dropdown|N/A|Category state updates, passed correctly to contract|P1|✅ Pass|

### 2.5 Event Details Page (`/event-details/\\\[index]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-26|Event Details Display|Navigate to event details|Event exists|Shows name, venue, date, time, price, tickets available, description, image, comments, rating|P0|✅ Pass|
|FE-27|Buy Single Ticket (GA)|Click buy with quantity = 1|Wallet connected, cUSD balance sufficient, tickets available|NFT image generated, uploaded to IPFS, `buyTickets()` called, redirect to `/tickets/{id}`|P0|✅ Pass|
|FE-28|Buy Multiple Tickets (GA)|Set quantity > 1 and buy|Enough tickets, cUSD sufficient|Multiple NFT images generated \& uploaded, `buyTickets(eventId, uris, qty)` called|P0|✅ Pass|
|FE-29|Buy Ticket - Own Event|Organizer tries to buy own ticket|Caller == event organizer|Toast: "You cannot buy your own ticket!" with link to dashboard|P0|✅ Pass|
|FE-30|Buy Ticket - Insufficient cUSD|Buy when balance < totalCost|Low cUSD balance|Toast error: "Insufficient cUSD balance. You need X cUSD..."|P0|✅ Pass|
|FE-31|[IMP] cUSD Approval Flow|Buy paid ticket requiring approval|Allowance < totalCost|First calls `approve()`, waits for receipt, then calls `buyTickets()`|P0|✅ Pass|
|FE-32|cUSD Allowance Skip|Buy when existing allowance >= cost|Sufficient allowance|Skips approval, directly calls `buyTickets()`|P1|✅ Pass|
|FE-33|Seat Map Purchase|Select seats via SeatMap, buy|Seats available, cUSD sufficient|Overloaded `buyTickets(eventId, uris, seatLabels, categories)` called with correct args|P0|✅ Pass|
|FE-34|Bot Detection Guard - Allow|Bot detection returns "allow"|Backend reachable, low risk|Purchase proceeds, verification token consumed after tx|P0|✅ Pass|
|FE-35|Bot Detection Guard - Challenge|Bot detection returns "challenge"|Medium risk score|BotChallengeModal shown, purchase halted until verified|P0|✅ Pass|
|FE-36|Bot Detection Guard - Block|Bot detection returns "block"|High risk score|Toast: "Purchase blocked", purchase halted|P0|✅ Pass|
|FE-37|Bot Detection - Degraded|Backend unreachable|Bot-detection service down|Logs warning, purchase proceeds in degraded mode|P0|✅ Pass|
|FE-38|AI Mode - WARNING|AI risk assessment returns WARNING|Medium bot/scalping score|WarningModal appears with risk details; user can confirm or cancel|P0|✅ Pass|
|FE-39|AI Mode - BLOCK|AI risk assessment returns BLOCK|High bot/scalping score|Toast: "Transaction Blocked by AI Mode", purchase prevented|P0|✅ Pass|
|FE-40|Post-Event Rating Stars|Visit event after event date|Event date passed|Rating stars component visible, user can submit 1-5 rating|P1|✅ Pass|
|FE-41|Comment Submission|Submit a comment as ticket holder|User holds ticket for event|Comment appears in comments section|P1|✅ Pass|
|FE-42|On-Chain Seat Lock|Click "Reserve on-chain" button|Seats selected in SeatMap|`lockSeats()` contract call made, success toast|P1|✅ Pass|

### 2.6 Seat Map Component

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-43|Seat Selection|Click available seat|Wallet connected, seat available|Seat turns green (selected), off-chain Redis lock acquired, toast confirms|P0|✅ Pass|
|FE-44|Seat Deselection|Click selected seat|Seat currently selected by user|Seat unlocked (Redis), removed from selection|P0|✅ Pass|
|FE-45|Sold Seat Disabled|Click on sold seat|Seat already purchased|Button disabled, shows gray, no action|P0|✅ Pass|
|FE-46|Locked Seat Display|View seat locked by another user|Another user has Redis lock|Seat shows amber, disabled, "Locked (Redis)"|P0|✅ Pass|
|FE-47|10-Min Lock Timer|Select a seat, wait 10 minutes|Seat selected|Timer counts down; at 0, all locks released, seats cleared, error toast|P0|✅ Pass|
|FE-48|Category Pricing|View VIP / Premium / Executive seats|Category prices set or defaults|Correct prices displayed per category (VIP=2x, Premium=1x, Executive=0.8x)|P1|✅ Pass|
|FE-49|Lock Status Polling|Wait 5 seconds on SeatMap|N/A|`/api/seats/status` polled every 5s, lockedSeats updated|P2|✅ Pass|

### 2.7 My Tickets Page (`/my-tickets`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-50|Display Purchased Tickets|Navigate to My Tickets|User has purchased tickets|Events grouped, each with ticket items showing QR codes, ticket IDs|P0|✅ Pass|
|FE-51|QR Code Generation|View ticket item|Token ID resolved|QR code rendered with token ID value|P0|✅ Pass|
|FE-52|Sell Ticket Button|Click "Sell Ticket" on a ticket without active resale request|Token ID known, no existing resale|Navigates to `/resell/{tokenId}?eventId={eventId}`|P0|✅ Pass|
|FE-53|Pending Approval Badge|View ticket with pending resale request|Resale request submitted, not approved/rejected|"PENDING APPROVAL" badge shown, "Waiting for Review..." button disabled|P1|✅ Pass|
|FE-54|Approved - Finalize Listing|Click "Finalize Listing" on approved ticket|Resale request approved|`resellTicket()` contract call, success toast|P0|✅ Pass|
|FE-55|Rejected Badge|View ticket with rejected resale|Resale rejected|"Listing Closed / Rejected" text shown|P1|✅ Pass|
|FE-56|No Tickets State|Visit page with no purchases|User has no tickets|"No tickets found" with "Browse Events" link|P1|✅ Pass|
|FE-57|Event Details Link|Click "Event Details" from ticket group header|N/A|Navigates to `/event-details/{eventId}`|P2|✅ Pass|

### 2.8 Resell Page (`/resell/\\\[tokenId]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-58|[IMP] KYC Verification Required|Visit resell page without SoulboundIdentity|User not verified|"Verification Required to Sell" message, KYCFlow component shown|P0|✅ Pass|
|FE-59|[IMP] KYC Flow Complete|Complete KYC (upload ID, face scan, processing)|Wallet connected|Progress bar 0-100%, `mintIdentity()` called, success toast, "Verified Seller" badge|P0|✅ Pass|
|FE-60|Set Resale Price|Enter valid price within max resale multiplier|Verified seller, ticket found|Price accepted, fee breakdown shown (royalty %, platform fee %, seller receives)|P0|✅ Pass|
|FE-61|Price Exceeds Max|Enter price > maxAllowed|Max price enforced|Submit button disabled, toast: "Price cannot exceed X cUSD"|P0|✅ Pass|
|FE-62|Resale Cutoff Expired|Visit resell page for event within cutoff|Event within 48h|Error card: "Resale period has ended for this event"|P0|✅ Pass|
|FE-63|AI Price Suggestion|ResalePriceSuggestion component loads|eventId and originalPrice available|Fetches `/api/ai/forecast` for price suggestion, "Apply" button fills price field|P1|✅ Pass|
|FE-64|Fee Breakdown Calculation|Enter price "100"|Royalty 5%, Platform 2%|Displays: Royalty -5.00, Platform -2.00, You Receive 93.00|P1|✅ Pass|
|FE-65|Submit Resale Request|Click "Confirm \& List"|Valid price, verified seller|`requestResaleVerification()` called, success toast, redirect to `/my-tickets`|P0|✅ Pass|

### 2.9 Resale Approval Dashboard (`/resale-approval`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-66|Tab Navigation|Click Pending / Approved / Rejected tabs|Wallet connected|Active tab styling changes, correct list displayed|P1|✅ Pass|
|FE-67|Pending Requests List|View pending tab|Organizer has pending requests|List of pending resale requests with approve/reject buttons|P0|✅ Pass|
|FE-68|Approve Resale Request|Click approve on a pending request|Organizer logged in|`approveResale()` called, request moves to approved tab|P0|✅ Pass|
|FE-69|Reject Resale Request|Click reject on a pending request|Organizer logged in|`rejectResale()` called, request moves to rejected tab|P0|✅ Pass|
|FE-70|No Pending Requests|View pending tab with no requests|No pending resale requests|Empty state message|P1|✅ Pass|

### 2.10 Market Page (`/market`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-71|Display Approved Tickets|Navigate to marketplace|Approved resale tickets exist|Grid of ticket cards with tokenId, seller address, price, "Buy Now" button|P0|✅ Pass|
|FE-72|Filter Own Listings|View market with own listings|User has listed tickets|Own tickets show "Listed" badge and disabled buy button|P1|✅ Pass|
|FE-73|Buy Resale Ticket|Click "Buy Now" on a ticket|cUSD sufficient, not own ticket|cUSD approve -> `buyResaleTicket()` called, success toast, market refreshes|P0|✅ Pass|
|FE-74|Bot Detection on Market Buy|Buy triggers bot detection|Backend reachable|Guard runs before purchase; block/challenge/allow handled|P0|✅ Pass|
|FE-75|No Tickets Available|Visit market with no approved tickets|No approved resale tickets|"No Resale Tickets Available" message|P1|✅ Pass|
|FE-76|Auto-Refresh|Wait on market page|N/A|Market data refetches every 5 seconds|P2|✅ Pass|
|FE-77|Buy Error Handling|Purchase fails with various errors|Various failure modes|Correct error toasts for: not approved, price changed, insufficient funds, user rejected|P1|✅ Pass|

### 2.11 Buy Resale Page (`/buy/\\\[id]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-78|Ticket Details Display|Navigate to buy page for a valid resale ticket|Approved resale exists|Shows ticket#, seller, price, royalty breakdown, total|P0|✅ Pass|
|FE-79|Ticket Not Available|Navigate for unapproved/sold ticket|Ticket not approved|"Ticket Not Available" card with "Browse Marketplace" link|P1|✅ Pass|
|FE-80|AI Warning on Resale Buy|AI returns WARNING for resale purchase|Medium risk|WarningModal shows risk level, dominant risk, confidence; confirm/cancel|P1|✅ Pass|
|FE-81|Verification Token Consumed|Successful resale purchase|Bot detection allowed with token|`consumeBotToken()` called with token and tx hash|P1|✅ Pass|

### 2.12 Ownership History Page (`/history/\\\[id]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-82|Display Ownership Timeline|Navigate to history for a resold ticket|Ticket has ownership history|Timeline with numbered owners, "Original Owner" label for first|P1|✅ Pass|
|FE-83|Ticket Not Found|Navigate for non-existent ticket ID|Token doesn't exist|"Ticket Not Found" with link to marketplace|P1|✅ Pass|
|FE-84|Empty History|View ticket with no history|No ownership records|"No ownership history available" message|P2|✅ Pass|

### 2.13 My Events Page (`/my-events`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-85|List Organizer's Events|Navigate to My Events|Organizer has created events|Grid of event cards with name, date, venue, attendee count|P0|✅ Pass|
|FE-86|No Events State|Visit as user with no created events|No events by this organizer|"You have not created any event yet" message|P1|✅ Pass|
|FE-87|View Event Link|Click "View Event" or card|Event exists|Navigates to `/my-events/{eventId}`|P1|✅ Pass|

### 2.14 Frontend API Routes

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-88|POST /api/files|Upload file to IPFS via Pinata|Valid file in FormData|Returns `{ IpfsHash: "Qm..." }`|P0|✅ Pass|
|FE-89|POST /api/ai/forecast|Proxy resale price forecast|AI service running|Returns price suggestion from AI Insights|P1|✅ Pass|
|FE-90|POST /api/ai/forecast - Service Down|Proxy when AI service is unreachable|Service offline|Returns 503 with `{ error: 'AI service unavailable' }`|P1|✅ Pass|
|FE-91|POST /api/ai/assistant|Proxy RAG question|AI service running|Returns answer from RAG engine|P1|✅ Pass|
|FE-92|POST /api/ai/assistant - Service Down|Proxy when AI offline|Service offline|Returns 503 with fallback message|P1|✅ Pass|
|FE-93|POST /api/seats/lock - Lock|Lock seats via Redis|Valid eventId, seatLabels, wallet|Returns `{ success: true }`, Redis key set with 600s TTL|P0|✅ Pass|
|FE-94|POST /api/seats/lock - Already Locked|Lock seat already locked by another|Seat locked by different wallet|Returns 409: "Seat X is already locked by another user", previous locks rolled back|P0|✅ Pass|
|FE-95|POST /api/seats/lock - Unlock|Unlock previously locked seats|Valid unlock request|Locks released from Redis|P0|✅ Pass|
|FE-96|POST /api/seats/lock - Invalid Params|Send request with missing fields|Missing eventId/seatLabels/wallet|Returns 400: "Invalid request parameters"|P1|✅ Pass|
|FE-97|GET /api/seats/status|Get lock statuses for an event|eventId provided|Returns `{ lockedSeats: \\\[...] }` with seatLabel + lockedBy|P1|✅ Pass|
|FE-98|POST /api/resale-approve|Approve resale via API|Valid tokenId|Calls contract `approveResale()`|P1|✅ Pass|
|FE-99|POST /api/resale-reject|Reject resale via API|Valid tokenId|Calls contract `rejectResale()`|P1|✅ Pass|
|FE-100|POST /api/resale-request|Submit resale request|Valid tokenId and price|Creates resale request|P1|✅ Pass|
|FE-101|Seat Map Accessibility - Keyboard Navigation|Attempt to navigate seat selection using Tab key|SeatMap loaded|Focus indicators visible, focus order matches layout|P1|❌ Fail|
|FE-102|RainbowKit Disconnect Sync|Disconnect wallet from MetaMask extension directly|Wallet connected|UI automatically updates and redirects to homepage|P1|❌ Fail|
|FE-103|IPFS Timeout Fallback UI|Pinata gateway times out during image upload|Create Event page open|Fallback gateway used or friendly timeout alert displayed|P2|❌ Fail|

\---

## Module 3: Bot Detection / AI Services

### 3.1 Detection Service (`POST /v1/detect`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-1|[IMP] Detect - Allow (Low Risk)|Send behavioral data with human-like patterns|Valid API key, service healthy|`decision: "allow"`, riskScore < 50, verification token issued|P0|✅ Pass|
|AI-2|[IMP] Detect - Challenge (Medium Risk)|Send behavioral data with suspicious patterns|Valid API key|`decision: "challenge"`, 50 <= riskScore <= 80, challenge\_id returned|P0|✅ Pass|
|AI-3|[IMP] Detect - Block (High Risk)|Send behavioral data with bot-like patterns|Valid API key|`decision: "block"`, riskScore > 80, event logged|P0|✅ Pass|
|AI-4|Detect - Missing API Key|Send request without X-API-Key header|No API key|401/403 Unauthorized|P0|✅ Pass|
|AI-5|Detect - Invalid API Key|Send request with wrong API key|Invalid key|401/403 Unauthorized|P0|✅ Pass|
|AI-6|Detect - Rate Limited|Send > 100 requests/second from same key|Same API key, burst > 200|429 Too Many Requests|P0|✅ Pass|
|AI-7|Detect - IP Injection|Send request with X-Forwarded-For header|Proxy scenario|`ipAddress` field populated from X-Forwarded-For|P1|✅ Pass|
|AI-8|Detect - Correlation ID|Send with X-Correlation-ID header|N/A|Same ID returned in response header|P1|✅ Pass|
|AI-9|Detect - Correlation ID Auto|Send without X-Correlation-ID|N/A|New UUID generated and returned in response header|P1|✅ Pass|
|AI-10|Detect - ML Fallback|ML inference service down|Inference service unreachable|Falls back to rule-based scoring, response still returned|P0|✅ Pass|
|AI-11|Detect - DB Write|Successful detection|DB connected|BehavioralData and RiskScore persisted to PostgreSQL|P1|✅ Pass|
|AI-12|Detect - Bulk Purchase Multiplier|Send request with `isBulkPurchase: true`|Valid request|Risk score multiplied by 1.5x|P1|✅ Pass|
|AI-13|Detect - Prometheus Metrics|Any detection request|Metrics enabled|Latency observed, decision recorded, error count if applicable|P2|✅ Pass|

### 3.2 Token Validation \& Consumption

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-14|[IMP] Validate Token - Valid|POST `/v1/validate-token` with valid token and matching wallet|Token exists, not expired, not consumed|`{ valid: true }`|P0|✅ Pass|
|AI-15|Validate Token - Expired|Validate token after expiry|Token `expiresAt` < now|`{ valid: false, reason: "..." }`|P0|✅ Pass|
|AI-16|Validate Token - Wrong Wallet|Validate with different wallet address|walletAddress mismatch|`{ valid: false, reason: "..." }`|P0|✅ Pass|
|AI-17|Validate Token - Already Consumed|Validate a consumed token|Token already consumed|`{ valid: false, reason: "..." }`|P0|✅ Pass|
|AI-18|Consume Token - Success|POST `/v1/consume-token` with valid token and txHash|Token exists, not consumed|`{ consumed: true }`, `consumed\\\_at` and `tx\\\_hash` persisted|P0|✅ Pass|
|AI-19|Consume Token - Not Found|Consume non-existent token|Token doesn't exist|404: "Token not found"|P1|✅ Pass|
|AI-20|[IMP] Consume Token - Already Consumed|Consume token a second time|Token already consumed|409: "Token has already been consumed"|P0|✅ Pass|
|AI-21|Token HMAC Verification|Tamper with token payload|Modified base64 token|Signature verification fails, token rejected|P0|✅ Pass|

### 3.3 Challenge Service (`POST /v1/verify-challenge`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-22|Verify Challenge - Correct|Submit correct response|Active challenge in Redis|`success: true`, risk\_score\_adjustment: -30, verification token in header|P0|✅ Pass|
|AI-23|Verify Challenge - Wrong|Submit incorrect response|Active challenge|`success: false`, risk\_score\_adjustment: +10, remaining\_attempts decremented|P0|✅ Pass|
|AI-24|Verify Challenge - Expired|Submit for expired challenge|Challenge TTL passed|410 Gone: "CHALLENGE\_EXPIRED"|P0|✅ Pass|
|AI-25|Verify Challenge - Not Found|Submit for non-existent challenge\_id|No such challenge|404: "CHALLENGE\_NOT\_FOUND"|P0|✅ Pass|
|AI-26|Verify Challenge - 3 Failures|Fail challenge 3 times|Max attempts exceeded|15-minute cooldown (`blocked\\\_until` set), `block:{user\\\_hash}` key in Redis|P0|✅ Pass|
|AI-27|Challenge Token Generation|Successful challenge verification|wallet\_address in Redis state|HMAC-SHA256 token generated, persisted to DB, returned in X-Verification-Token header|P0|✅ Pass|
|AI-28|Challenge Context Missing|Challenge completes but wallet\_address absent|Redis state missing wallet|422: "CHALLENGE\_CONTEXT\_MISSING"|P1|✅ Pass|
|AI-29|Challenge DB Persistence|Any challenge attempt|DB connected|`challenge\\\_state` table updated: attempt count incremented, status set|P1|✅ Pass|

### 3.4 Health Endpoints

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-30|Detection Health - All Healthy|GET `/v1/health` on detection service|DB, Redis, ML all up|`{ status: "healthy", services: { database: "healthy", cache: "healthy", ml\\\_inference: "healthy" } }`|P0|✅ Pass|
|AI-31|Detection Health - Degraded|GET `/v1/health` when ML is down|ML inference unreachable|`{ status: "degraded", services: { ..., ml\\\_inference: "unhealthy" } }`|P1|✅ Pass|
|AI-32|Challenge Health|GET `/v1/health` on challenge service|DB, Redis up|`{ status: "healthy", services: { database: "healthy", cache: "healthy" } }`|P1|✅ Pass|
|AI-33|AI Insights Health|GET `/health` on AI insights service|Models loaded|`{ status: "ok", forecast: "...", rag: "..." }`|P1|✅ Pass|

### 3.5 Resale Pattern Analysis (`POST /v1/resale-check`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-34|Resale Check - Normal User|Check wallet with few resale requests|Low resale frequency|`{ flagged: false, trusted: false/true, requestsInWindow: N }`|P0|✅ Pass|
|AI-35|Resale Check - Suspicious|Check wallet with high resale frequency|Many requests in window|`{ flagged: true, requiresAdditionalVerification: true }`|P0|✅ Pass|
|AI-36|Resale Check - Trusted User|Check wallet with 30-day clean history|Consistent low-risk history|`{ trusted: true, flagged: false }`|P1|✅ Pass|
|AI-37|Wallet Address Hashing|Any resale check|Valid wallet|Wallet address hashed via `hash\\\_wallet\\\_address()` before storage (privacy)|P1|✅ Pass|

### 3.6 AI Insights Service

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-38|Resale Price Forecast|POST `/v1/forecast/resale-price`|Valid eventId, originalPrice > 0, API key|Returns suggested price band (min, suggested, max)|P0|✅ Pass|
|AI-39|Demand Forecast|POST `/v1/forecast/demand`|Valid eventId, horizonDays 1-30|Returns demand trend over specified horizon|P1|✅ Pass|
|AI-40|RAG Assistant - Valid Question|POST `/v1/ask` with question|RAG index loaded|Returns relevant answer with sources|P0|✅ Pass|
|AI-41|RAG Assistant - Out of Scope|POST `/v1/ask` with unrelated question|RAG index loaded|Returns best-effort or fallback answer|P1|✅ Pass|
|AI-42|AI Service - Missing API Key|Any authenticated endpoint without key|No X-API-Key|401/403 Unauthorized|P0|✅ Pass|
|AI-43|Forecast Engine - Degraded|Model file missing or corrupt|Model not loadable|Falls back to deterministic heuristics, service stays up|P1|✅ Pass|
|AI-44|AI Correlation ID|Send with/without X-Correlation-ID|N/A|Correlation ID propagated or generated|P2|✅ Pass|

### 3.7 Risk Scoring Engine

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-45|ML Behavioral Score|Submit behavioral features|ML service healthy|ML probability converted to 0-100 score, factor logged|P0|✅ Pass|
|AI-46|Reputation Adjustment|User with 30-day history|History in PostgreSQL|Reputation calculated: good history reduces score, bad increases by up to +/-20 points|P0|✅ Pass|
|AI-47|Score Clamping|Combined score exceeds 100 or below 0|Extreme values|Score clamped to \[0, 100]|P1|✅ Pass|
|AI-48|Decision Thresholds|Score at boundary values|Various scores|< 50 = allow, 50-80 = challenge, > 80 = block|P0|✅ Pass|
|AI-49|Reputation Caching|Same user scored twice|First call cached|Second call uses Redis cache within TTL|P2|✅ Pass|
|AI-50|Trusted Status Calculation|User with min sessions and low avg score|30+ days of clean history|`trusted\\\_status = True` set in reputation table|P1|✅ Pass|

### 3.8 Fallback Mode

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-51|[IMP] Fallback Activation|Detection health check fails|Health check returns unhealthy|`fallback:active` Redis key set, detection bypassed|P0|✅ Pass|
|AI-52|[IMP] Fallback Purchase Limit|Purchase in fallback mode|Fallback active|Max 2 tickets per wallet per event enforced|P0|✅ Pass|
|AI-53|Fallback Recovery|Health check passes again|Service recovered|`fallback:active` key expires, normal ops resume within 60s|P0|✅ Pass|
|AI-54|Fallback Polling|Controller running|FALLBACK\_CONTROLLER\_ENABLED=true|Health polled every 10 seconds|P2|✅ Pass|

### 3.9 Client-Side AI Mode

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-55|Bot Detector Analysis|User with rapid purchases in short window|Multiple purchases recorded|BotDetector returns elevated score|P1|✅ Pass|
|AI-56|Scalping Detector|User buying many tickets for same event|High event-specific count|ScalpingDetector returns elevated score|P1|✅ Pass|
|AI-57|Risk Agent Evaluation|Combined bot + scalping scores|Both scores available|RiskEvaluationAgent produces trustScore and dominantRisk|P1|✅ Pass|
|AI-58|Policy Agent Decision|Risk evaluation complete|Trust score available|PolicyEnforcementAgent returns ALLOW/WARNING/BLOCK with message|P1|✅ Pass|
|AI-59|Purchase History Persistence|Record purchases|localStorage available|History saved/loaded from `ai\\\_mode\\\_purchase\\\_history` localStorage key|P2|✅ Pass|
|AI-60|AI Logger|Any AI-logged action|Logger initialized|Logs written to data store via `aiLogger.log()`|P2|✅ Pass|

### 3.10 Bot Detection SDK (Client-Side)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-61|Behavioral Tracker Boot|Wallet connected|`useBotDetection` hook enabled|Tracker starts recording mouse/keystroke dynamics at >= 20 Hz|P0|✅ Pass|
|AI-62|Guard Purchase - Allow|`guardPurchase()` returns allow|Backend responds with allow|`{ decision: 'allow', verificationToken, proceed: true }`|P0|✅ Pass|
|AI-63|Guard Purchase - Challenge|`guardPurchase()` returns challenge|Backend responds with challenge|`pendingChallenge` state set, `{ proceed: false }` returned|P0|✅ Pass|
|AI-64|Guard Purchase - Block|`guardPurchase()` returns block|Backend responds with block|Toast error shown, `{ proceed: false }` returned|P0|✅ Pass|
|AI-65|Verify Challenge Success|User passes challenge modal|Correct response submitted|`verifyChallenge()` returns true, `primedTokenRef` set, next guard short-circuits|P0|✅ Pass|
|AI-66|Verify Challenge Failure|User fails challenge|Wrong response|`verifyChallenge()` returns false, toast error, modal closed|P1|✅ Pass|
|AI-67|Primed Token Short-Circuit|`runGuard()` after successful challenge|`primedTokenRef` has token|Guard returns immediately with allow + token, no re-detection call|P0|✅ Pass|
|AI-68|Consume Token|After successful on-chain tx|Verification token available|`consumeToken(token, txHash)` called, POST /v1/consume-token made|P1|✅ Pass|
|AI-69|Degraded Mode|Backend unreachable|Network error|Guard returns `{ decision: 'allow', degraded: true, proceed: true }`|P0|✅ Pass|

### 3.11 Infrastructure / Load Tests

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-70|Normal Load (k6)|Run `loadtest/k6/normal.js`|Detection service deployed|Service handles expected RPS without errors|P1|❌ Fail|
|AI-71|Peak Load (k6)|Run `loadtest/k6/peak.js`|Detection service deployed|Service handles peak RPS, latency within SLA|P1|❌ Fail|
|AI-72|Spike Load (k6)|Run `loadtest/k6/spike.js`|Detection service deployed|Service recovers from sudden spike, no crash|P2|❌ Fail|
|AI-73|Sustained Load (k6)|Run `loadtest/k6/sustained.js`|Detection service deployed|Service stable under sustained load, no memory leaks|P2|❌ Fail|

### 3.12 Data Privacy \& Security

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-74|Behavioral Data Anonymization|Detection request processed|Privacy module loaded|`anonymize\\\_behavioral\\\_payload()` strips PII before storage|P0|✅ Pass|
|AI-75|API Key Hashing in Audit|Any authenticated request|Audit module loaded|API key hashed via `hash\\\_api\\\_key()` before audit logging|P1|✅ Pass|
|AI-76|Token Signing Key Enforcement|Non-development environment|ENVIRONMENT != "development"|Raises RuntimeError if `TOKEN\\\_SIGNING\\\_KEY` not set|P0|✅ Pass|
|AI-77|Data Retention|Retention cronjob runs|Retention policy configured|Old behavioral data purged per retention policy|P2|❌ Fail|
|AI-78|Data Archival|Archival cronjob runs|Archival policy configured|Data archived to designated storage (MinIO/S3)|P2|❌ Fail|

### 3.13 ML Training Pipeline

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-79|Assemble Dataset|Run `assemble\\\_dataset.py`|Raw data available|Training dataset assembled in correct format|P2|✅ Pass|
|AI-80|Train Model|Run `train\\\_model.py`|Training data assembled|XGBoost model trained, metrics logged|P2|✅ Pass|
|AI-81|Verify Accuracy|Run `verify\\\_accuracy.py`|Trained model available|Accuracy metrics reported, pass/fail threshold checked|P2|✅ Pass|
|AI-82|Deploy Model|Run `deploy\\\_model.py`|Trained model validated|Model deployed to MinIO/S3, inference service picks up new version|P2|❌ Fail|
|AI-83|A/B Router|Inference request with A/B enabled|Multiple model versions|Request routed to correct model version per A/B config|P2|❌ Fail|
|AI-84|ML Model Drifting Detection|Check ML inference logs for feature drift over 30 days|ML service running|Drift detection alert triggered|P2|❌ Fail|
|AI-85|PostgreSQL Connection Pooling Exhaustion|Simulate 500 concurrent detection queries under connection pool limits|DB connected|Gracefully handle pooling with retry/backoff, no dropped connections|P1|❌ Fail|
|AI-86|IP Spoofing Protection|Send detection request with spoofed X-Forwarded-For header containing multiple proxies|API key valid|Real client IP accurately resolved and verified|P1|❌ Fail|

\---

## Module 4: Integration / End-to-End Tests

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|E2E-1|Full Ticket Purchase Flow|Connect wallet -> Browse events -> Select event -> Buy ticket -> View in My Tickets|All services running|Complete flow works: cUSD approved, NFT minted, ticket visible with QR code|P0|✅ Pass|
|E2E-2|Full Seat-Map Purchase Flow|Select seats -> Lock on Redis -> Lock on-chain -> Buy with seat labels -> View tickets|All services, Redis running|Seats locked, purchased with correct category prices, NFTs minted|P0|✅ Pass|
|E2E-3|[IMP] Full Resale Flow|Buy ticket -> KYC verify -> Set resale price -> Organizer approves -> Finalize listing -> Buyer purchases from market|All services running|End-to-end resale with royalty (5%) + platform fee (2%) distribution|P0|✅ Pass|
|E2E-4|Bot Detection Integration|User browses -> Buys ticket -> Bot detection guard runs -> Allow/Challenge/Block|Detection + Challenge services up|Guard properly intercepts, challenges shown, tokens consumed|P0|✅ Pass|
|E2E-5|AI Insights Integration|User on resell page -> AI price suggestion loads -> User applies suggestion|AI Insights service up|Frontend proxy calls backend, suggestion displayed, user can apply price|P1|✅ Pass|
|E2E-6|RAG Assistant Integration|User asks question via Assistant component -> Answer returned|AI Insights service up|Question proxied through `/api/ai/assistant`, answer rendered|P1|✅ Pass|
|E2E-7|Fallback Mode E2E|Detection service goes down -> Purchase continues in fallback -> Service recovers|Detection service toggleable|Fallback activates (2-ticket limit), normal ops resume after recovery|P0|✅ Pass|
|E2E-8|Ownership History E2E|Buy ticket -> Resell -> New owner views history|Resale completed|History shows original owner + new owner in timeline|P1|✅ Pass|
|E2E-9|Event Lifecycle|Create event -> Buy tickets -> Event date passes -> Rate + Comment|Time passes event date|Rating and comment submission only after event, "Ended" overlay shown|P1|✅ Pass|
|E2E-10|[IMP] Multi-User Seat Contention|Two users try to lock/buy the same seat simultaneously|Two wallets, same event|Only one succeeds (on-chain or Redis prevents double-sell), other gets error|P0|✅ Pass|
|E2E-11|cUSD Insufficient Balance|User with 0 cUSD tries to buy paid ticket|Zero cUSD balance|Clear error message shown before any contract call|P0|✅ Pass|
|E2E-12|Cross-Module AI Block|High-risk user triggers both client-side AI Mode + server-side bot detection|Both AI layers active|Either client AI blocks or server detection blocks, never allows suspicious purchase|P0|✅ Pass|
|E2E-13|Cross-Browser Rendering (Safari Mobile)|Render landing and seat map pages on iOS Safari|Wallet connected|No layout shifting or button overlap|P1|❌ Fail|
|E2E-14|Multi-Node Redis Sync Delay|Simulate seat lock on primary Redis node, read from replica node with 2s delay|Redis cluster setup|Consistent lock state returned across all nodes|P2|❌ Fail|
|E2E-15|High Concurrency Ticket Checkout|Simulate 100 users attempting to buy last 5 tickets at once|5 tickets available|Exactly 5 tickets sold, 95 transactions safely reverted|P0|❌ Fail|

\---

## Summary

|Module|Test Cases|P0|P1|P2|✅ Pass|❌ Fail|
|-|-|-|-|-|-|-|
|**Blockchain (Smart Contracts)**|81|34|35|12|78|3|
|**Frontend (Next.js)**|103|52|44|7|100|3|
|**Bot Detection / AI**|86|41|29|16|75|11|
|**E2E Integration**|15|9|5|1|12|3|
|**TOTAL**|**285**|**136**|**113**|**36**|**265**|**20**|



