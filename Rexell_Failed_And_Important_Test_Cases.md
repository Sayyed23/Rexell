# Rexell - Important and Failed Test Cases Report

> Filtered report containing only **Important ([IMP])** and **Failed (❌ Fail)** test cases.

---

## Module 1: Blockchain / Smart Contracts

### 1.2 Rexell.sol - Ticket Purchase (Primary Market)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-7|[IMP] Buy Single Ticket (Paid)|Call `buyTicket()` for a paid event|cUSD approved, tickets available|NFT minted, cUSD transferred to organizer, `ticketsAvailable` decremented|P0|✅ Pass|
|BC-10|[IMP] Buy Ticket - Payment Fails|Call `buyTicket()` without cUSD approval|Paid event|Revert: "Payment failed"|P0|✅ Pass|
|BC-11|[IMP] Buy Multiple Tickets (GA)|Call `buyTickets(eventId, nftUris, quantity)` with quantity > 1|Enough tickets available, cUSD approved|Multiple NFTs minted, total cost transferred, `ticketsAvailable -= quantity`|P0|✅ Pass|

### 1.3 Rexell.sol - Seat Map (Dynamic Pricing)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-17|[IMP] Buy Already Sold Seat|Attempt to buy a seat that is already owned|Seat already sold|Revert: "Seat already sold"|P0|✅ Pass|
|BC-18|[IMP] Buy Seat Locked By Another|Attempt to buy a seat locked by another user (lock not expired)|Seat locked by different address|Revert: "Seat locked by another user"|P0|✅ Pass|

### 1.4 Rexell.sol - Resale Market

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-28|[IMP] Resale - Price Exceeds Max|Set resale price > `maxResaleMultiplier` \* original price|maxResaleMultiplier = 200%|Revert: "Price exceeds maximum allowed resale price"|P0|✅ Pass|
|BC-29|[IMP] Resale - Cutoff Passed|Request resale within `resaleCutoffHours` (48h) before event|Event within 48 hours|Revert: "Resale period has ended"|P0|✅ Pass|
|BC-30|[IMP] Resale - No SoulboundIdentity|Seller without valid SoulboundIdentity (score < 70)|SoulboundIdentity contract set|Revert: "Seller not verified via Soulbound Identity"|P0|✅ Pass|
|BC-41|[IMP] Buy Resale - Payment Splits|Verify royalty (5%), platform fee (2%), seller amount (93%)|Successful resale purchase|cUSD split correctly: organizer gets royalty, platform gets fee, seller gets remainder|P0|✅ Pass|

### 1.7 SoulboundIdentity.sol

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-67|[IMP] Mint Identity|Owner calls `mintIdentity(user, 85)`|User has no identity, score <= 100|SBT minted, mappings updated, `IdentityMinted` emitted|P0|✅ Pass|
|BC-72|[IMP] Has Valid Identity - Score >= 70|Call `hasValidIdentity(user)` with score 85|User has identity with score 85|Returns `true`|P0|✅ Pass|
|BC-73|[IMP] Has Valid Identity - Score < 70|Call `hasValidIdentity(user)` with score 50|User has identity with score 50|Returns `false`|P0|✅ Pass|

### 1.8 MockCUSD.sol

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|BC-79|Create Event - Gas Limit Exceeded|Call `createEvent()` with extremely long string fields|Wallet connected, Celo network|Revert: "Gas limit exceeded" or out of gas exception|P2|❌ Fail|
|BC-80|Identity Score Verification - Overflow|Call `mintIdentity()` with score > max uint256|Wallet connected|Revert: "SafeCast or arithmetic overflow"|P1|❌ Fail|
|BC-81|Withdraw - Reentrancy on Custom ERC20|Deploy malicious custom ERC20 contract and attempt withdrawal reentrancy|Contract has cUSD balance|Revert: "ReentrancyGuard: reentrant call"|P0|❌ Fail|

---

## Module 2: Frontend (Next.js)

### 2.2 Wallet Connection

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-5|[IMP] Wallet Not Connected Guards|Visit protected pages without wallet|No wallet connected|"Connect your wallet" message shown on events, my-tickets, market, resale-approval pages|P0|✅ Pass|

### 2.4 Create Event Page (`/create-event`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-19|[IMP] Past Date Validation|Select a past date + time|N/A|Toast error: "Please select a future date and time", `timeError` shown|P0|✅ Pass|

### 2.5 Event Details Page (`/event-details/\\\[index]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-31|[IMP] cUSD Approval Flow|Buy paid ticket requiring approval|Allowance < totalCost|First calls `approve()`, waits for receipt, then calls `buyTickets()`|P0|✅ Pass|

### 2.8 Resell Page (`/resell/\\\[tokenId]`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-58|[IMP] KYC Verification Required|Visit resell page without SoulboundIdentity|User not verified|"Verification Required to Sell" message, KYCFlow component shown|P0|✅ Pass|
|FE-59|[IMP] KYC Flow Complete|Complete KYC (upload ID, face scan, processing)|Wallet connected|Progress bar 0-100%, `mintIdentity()` called, success toast, "Verified Seller" badge|P0|✅ Pass|

### 2.14 Frontend API Routes

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|FE-101|Seat Map Accessibility - Keyboard Navigation|Attempt to navigate seat selection using Tab key|SeatMap loaded|Focus indicators visible, focus order matches layout|P1|❌ Fail|
|FE-102|RainbowKit Disconnect Sync|Disconnect wallet from MetaMask extension directly|Wallet connected|UI automatically updates and redirects to homepage|P1|❌ Fail|
|FE-103|IPFS Timeout Fallback UI|Pinata gateway times out during image upload|Create Event page open|Fallback gateway used or friendly timeout alert displayed|P2|❌ Fail|

---

## Module 3: Bot Detection / AI Services

### 3.1 Detection Service (`POST /v1/detect`)

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-1|[IMP] Detect - Allow (Low Risk)|Send behavioral data with human-like patterns|Valid API key, service healthy|`decision: "allow"`, riskScore < 50, verification token issued|P0|✅ Pass|
|AI-2|[IMP] Detect - Challenge (Medium Risk)|Send behavioral data with suspicious patterns|Valid API key|`decision: "challenge"`, 50 <= riskScore <= 80, challenge\_id returned|P0|✅ Pass|
|AI-3|[IMP] Detect - Block (High Risk)|Send behavioral data with bot-like patterns|Valid API key|`decision: "block"`, riskScore > 80, event logged|P0|✅ Pass|

### 3.2 Token Validation \& Consumption

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-14|[IMP] Validate Token - Valid|POST `/v1/validate-token` with valid token and matching wallet|Token exists, not expired, not consumed|`{ valid: true }`|P0|✅ Pass|
|AI-20|[IMP] Consume Token - Already Consumed|Consume token a second time|Token already consumed|409: "Token has already been consumed"|P0|✅ Pass|

### 3.8 Fallback Mode

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-51|[IMP] Fallback Activation|Detection health check fails|Health check returns unhealthy|`fallback:active` Redis key set, detection bypassed|P0|✅ Pass|
|AI-52|[IMP] Fallback Purchase Limit|Purchase in fallback mode|Fallback active|Max 2 tickets per wallet per event enforced|P0|✅ Pass|

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
|AI-77|Data Retention|Retention cronjob runs|Retention policy configured|Old behavioral data purged per retention policy|P2|❌ Fail|
|AI-78|Data Archival|Archival cronjob runs|Archival policy configured|Data archived to designated storage (MinIO/S3)|P2|❌ Fail|

### 3.13 ML Training Pipeline

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|AI-82|Deploy Model|Run `deploy\\\_model.py`|Trained model validated|Model deployed to MinIO/S3, inference service picks up new version|P2|❌ Fail|
|AI-83|A/B Router|Inference request with A/B enabled|Multiple model versions|Request routed to correct model version per A/B config|P2|❌ Fail|
|AI-84|ML Model Drifting Detection|Check ML inference logs for feature drift over 30 days|ML service running|Drift detection alert triggered|P2|❌ Fail|
|AI-85|PostgreSQL Connection Pooling Exhaustion|Simulate 500 concurrent detection queries under connection pool limits|DB connected|Gracefully handle pooling with retry/backoff, no dropped connections|P1|❌ Fail|
|AI-86|IP Spoofing Protection|Send detection request with spoofed X-Forwarded-For header containing multiple proxies|API key valid|Real client IP accurately resolved and verified|P1|❌ Fail|

---

## Module 4: Integration / End-to-End Tests

|#|Test Case|Description|Preconditions|Expected Result|Priority|Status|
|-|-|-|-|-|-|-|
|E2E-3|[IMP] Full Resale Flow|Buy ticket -> KYC verify -> Set resale price -> Organizer approves -> Finalize listing -> Buyer purchases from market|All services running|End-to-end resale with royalty (5%) + platform fee (2%) distribution|P0|✅ Pass|
|E2E-10|[IMP] Multi-User Seat Contention|Two users try to lock/buy the same seat simultaneously|Two wallets, same event|Only one succeeds (on-chain or Redis prevents double-sell), other gets error|P0|✅ Pass|
|E2E-13|Cross-Browser Rendering (Safari Mobile)|Render landing and seat map pages on iOS Safari|Wallet connected|No layout shifting or button overlap|P1|❌ Fail|
|E2E-14|Multi-Node Redis Sync Delay|Simulate seat lock on primary Redis node, read from replica node with 2s delay|Redis cluster setup|Consistent lock state returned across all nodes|P2|❌ Fail|
|E2E-15|High Concurrency Ticket Checkout|Simulate 100 users attempting to buy last 5 tickets at once|5 tickets available|Exactly 5 tickets sold, 95 transactions safely reverted|P0|❌ Fail|

---

## Summary of Filtered Cases

|Module|Total Cases|Important Only|Failed Only|Both (Imp & Fail)|
|-|-|-|-|-|
|Module 1: Blockchain / Smart Contracts|15|12|3|0|
|Module 2: Frontend (Next.js)|8|5|3|0|
|Module 3: Bot Detection / AI Services|18|7|11|0|
|Module 4: Integration / End-to-End Tests|5|2|3|0|