# 📋 REXELL — Functional Requirements Specification

> **Project**: Rexell — Web3 Event Ticketing Platform  
> **Version**: 1.0  
> **Date**: February 11, 2026  
> **Blockchain**: Celo (EVM-compatible)

---

## Table of Contents

- [1. User Authentication & Identity](#1-user-authentication--identity)
- [2. Event Management](#2-event-management)
- [3. NFT Ticketing System](#3-nft-ticketing-system)
- [4. Blockchain Integration](#4-blockchain-integration)
- [5. AI/ML Anti-Scalping Engine](#5-aiml-anti-scalping-engine)
- [6. Resale & Royalty System](#6-resale--royalty-system)
- [7. Community & Engagement](#7-community--engagement)
- [8. Data Encryption & Security](#8-data-encryption--security)
- [9. Data Storage](#9-data-storage)
- [10. Error Handling & Logging](#10-error-handling--logging)
- [11. Non-Functional Requirements](#11-non-functional-requirements)

---

## 1. User Authentication & Identity

### FR-1.1 — Wallet-Based Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1.1 | Users shall authenticate by connecting their **MetaMask** wallet via **RainbowKit** | High |
| FR-1.1.2 | The system shall support wallet connection on **Celo Mainnet** (Chain ID: 42220) and **Celo Sepolia Testnet** (Chain ID: 11142220) | High |
| FR-1.1.3 | The system shall display the user's connected wallet address and current network | Medium |
| FR-1.1.4 | Users shall be able to disconnect their wallet and switch accounts | Medium |

### FR-1.2 — Soulbound Identity (SBT) Verification

| ID | Requirement | Priority |
|---|---|---|
| FR-1.2.1 | Users shall be able to mint a **non-transferable Soulbound Identity NFT** (ERC-721) linked to their wallet address | High |
| FR-1.2.2 | Each Soulbound NFT shall carry a **KYC verification score** ranging from 0 to 100 | High |
| FR-1.2.3 | Users with a verification score **≥ 70** shall be considered trusted/verified users | High |
| FR-1.2.4 | The system shall enforce **one-person-one-identity** — only one Soulbound NFT per wallet address | High |
| FR-1.2.5 | The contract owner shall be able to update verification scores and burn identity NFTs | Medium |
| FR-1.2.6 | Identity details (wallet, tokenId, score, KYC timestamp) shall be queryable on-chain | Medium |

---

## 2. Event Management

### FR-2.1 — Event Creation

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1.1 | Authenticated users (event organizers) shall be able to create events with: **name**, **venue**, **category**, **date/time**, **ticket price** (in cUSD), **total ticket supply**, and **event image** | High |
| FR-2.1.2 | Event images shall be uploaded to **Pinata IPFS** and stored as content-addressable URIs | High |
| FR-2.1.3 | Each event shall be recorded on the **Celo blockchain** via the `createEvent()` smart contract function | High |
| FR-2.1.4 | The system shall assign a unique **event ID** to each event upon creation | High |

### FR-2.2 — Event Browsing & Discovery

| ID | Requirement | Priority |
|---|---|---|
| FR-2.2.1 | Users shall be able to browse all available events in a list/grid view | High |
| FR-2.2.2 | Users shall be able to view detailed event information including name, venue, date, price, tickets remaining, average rating, and comments | High |
| FR-2.2.3 | Event organizers shall have a dedicated **"My Events"** page to manage their created events | Medium |

---

## 3. NFT Ticketing System

### FR-3.1 — Ticket Purchase

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1.1 | Users shall purchase tickets by paying in **cUSD** (Celo Dollar stablecoin, ERC-20) | High |
| FR-3.1.2 | The purchase flow shall require **ERC-20 approval** (cUSD `approve()`) followed by the `buyTicket()` contract call | High |
| FR-3.1.3 | Users shall be able to purchase **multiple tickets** in a single transaction via `buyTickets()` | Medium |
| FR-3.1.4 | Upon successful payment, the system shall **mint a unique ERC-721 NFT** to the buyer's wallet with a metadata URI pointing to IPFS | High |
| FR-3.1.5 | The system shall prevent ticket purchases once the event's **total supply** is exhausted | High |

### FR-3.2 — Ticket Management

| ID | Requirement | Priority |
|---|---|---|
| FR-3.2.1 | Users shall view all their owned tickets on a **"My Tickets"** page | High |
| FR-3.2.2 | Each ticket shall display a **QR code** containing ticket metadata (event ID, token ID, owner address) | High |
| FR-3.2.3 | Users shall be able to **download/export** their ticket as an image (PNG) | Medium |
| FR-3.2.4 | Users shall view their complete **purchase history** with timestamps and transaction details | Medium |
| FR-3.2.5 | Ticket holders shall be able to **cancel** their ticket via `cancelTicket()` | Low |

---

## 4. Blockchain Integration

### FR-4.1 — Smart Contract Interactions

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1.1 | All tickets shall be represented as **ERC-721 NFTs** on the Celo blockchain using the `Rexell.sol` contract (inheriting `ERC721URIStorage`, `Ownable`, `ReentrancyGuard`) | High |
| FR-4.1.2 | The system shall ensure **immutable ownership records** — every ticket transfer is permanently recorded on-chain | High |
| FR-4.1.3 | The system shall prevent **counterfeit tickets** by validating NFT ownership against the deployed contract address | High |
| FR-4.1.4 | All monetary transactions shall use the **cUSD stablecoin** (pegged to $1 USD) for price stability | High |
| FR-4.1.5 | The system shall enforce **resale price caps** via smart contract logic to prevent scalping at the contract level | High |

### FR-4.2 — On-Chain Data

| ID | Requirement | Priority |
|---|---|---|
| FR-4.2.1 | Event details (name, venue, category, date, price, organizer, ticket count) shall be stored on-chain | High |
| FR-4.2.2 | Full **ownership history** for each ticket shall be tracked and queryable on-chain | High |
| FR-4.2.3 | All ratings, comments, resale requests, and approval states shall be stored on-chain | Medium |

---

## 5. AI/ML Anti-Scalping Engine

### FR-5.1 — Bot Detection

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1.1 | The system shall analyze **purchase timing patterns** to detect automated bot activity (rapid-fire purchase detection, time-gap analysis) | High |
| FR-5.1.2 | The Bot Detector shall produce a **bot probability score** (0.0 – 1.0) for each purchase attempt | High |

### FR-5.2 — Scalping Detection

| ID | Requirement | Priority |
|---|---|---|
| FR-5.2.1 | The system shall flag users attempting to buy **duplicate tickets** for the same event | High |
| FR-5.2.2 | The system shall detect **bulk purchasing patterns** across multiple events | High |
| FR-5.2.3 | The Scalping Detector shall produce a **scalping risk score** (0.0 – 1.0) for each purchase attempt | High |

### FR-5.3 — Risk Evaluation & Policy Enforcement (Agentic Pipeline)

| ID | Requirement | Priority |
|---|---|---|
| FR-5.3.1 | The **Risk Evaluation Agent** shall combine bot and scalping scores into a **unified trust score** and identify the dominant risk factor | High |
| FR-5.3.2 | The **Policy Enforcement Agent** shall make a final decision per purchase: **ALLOW**, **WARNING**, or **BLOCK** | High |
| FR-5.3.3 | On **ALLOW** — the purchase shall proceed normally | High |
| FR-5.3.4 | On **WARNING** — the user shall see an alert with risk details and the option to proceed or cancel | High |
| FR-5.3.5 | On **BLOCK** — the purchase shall be denied with an explanation message | High |
| FR-5.3.6 | All AI decisions shall be **logged** with timestamps for auditability | Medium |

### FR-5.4 — ML Training Pipeline

| ID | Requirement | Priority |
|---|---|---|
| FR-5.4.1 | The system shall support generating **synthetic training data** for bot/scalping detection models | Medium |
| FR-5.4.2 | A **CNN model** (TensorFlow) shall be trainable on the master ticketing dataset (`blockchain_ticketing_master.csv`, 2.3 MB) | Medium |
| FR-5.4.3 | Trained models shall be exportable for integration into the detection pipeline | Medium |

---

## 6. Resale & Royalty System

### FR-6.1 — Resale Request Flow

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1.1 | Ticket holders shall be able to **request resale** with a specified resale price via `requestResale()` | High |
| FR-6.1.2 | Resale requests shall go through a **verification process** — the ticket holder must pass the resale verification check | High |
| FR-6.1.3 | Each ticket shall be resellable **only once** to limit scalping | High |

### FR-6.2 — Organizer Approval

| ID | Requirement | Priority |
|---|---|---|
| FR-6.2.1 | Event organizers shall have a **Resale Approval Dashboard** to review pending resale requests | High |
| FR-6.2.2 | Organizers shall be able to **approve** (`approveResale()`) or **reject** (`rejectResale()`) resale requests | High |
| FR-6.2.3 | Resale prices shall be visible to organizers for price control purposes | Medium |

### FR-6.3 — Resale Execution & Royalties

| ID | Requirement | Priority |
|---|---|---|
| FR-6.3.1 | Upon approval, the resale shall be executable via `executeResale()` | High |
| FR-6.3.2 | A **5% royalty** shall be automatically deducted from the resale price and sent to the event organizer | High |
| FR-6.3.3 | The NFT ticket shall be **transferred** from seller to buyer upon successful resale execution | High |
| FR-6.3.4 | The system shall maintain a **Resale Marketplace** page listing all approved tickets available for resale | Medium |

---

## 7. Community & Engagement

### FR-7.1 — Event Rating System

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1.1 | Only **ticket holders** who attended the event shall be able to submit ratings | High |
| FR-7.1.2 | Ratings shall be enabled **only after the event date has passed** | High |
| FR-7.1.3 | Ratings shall be submitted on-chain via `submitRating()` | High |
| FR-7.1.4 | A **star-based rating UI** (1–5 stars) shall be displayed on event detail pages | Medium |

### FR-7.2 — Comment / Interaction System

| ID | Requirement | Priority |
|---|---|---|
| FR-7.2.1 | Ticket holders shall be able to **post comments** on events they attended via `addComment()` | High |
| FR-7.2.2 | Comments shall be stored **on-chain** and displayed on the event detail page | Medium |
| FR-7.2.3 | The interact section shall serve as a **feedback channel** for attendees and organizers | Medium |

---

## 8. Data Encryption & Security

### FR-8.1 — Smart Contract Security

| ID | Requirement | Priority |
|---|---|---|
| FR-8.1.1 | All payment-handling functions shall be protected with the **ReentrancyGuard** modifier to prevent reentrancy attacks | High |
| FR-8.1.2 | Administrative functions shall be restricted to the contract **owner** via the `Ownable` access pattern | High |
| FR-8.1.3 | The system shall use **OpenZeppelin audited libraries** (v4.9.6) for all standard contract patterns (ERC-721, ERC-20, Ownable) | High |

### FR-8.2 — Key & Configuration Security

| ID | Requirement | Priority |
|---|---|---|
| FR-8.2.1 | Private keys and API secrets (Pinata JWT, deployer key) shall be stored in **`.env`** files excluded from version control via `.gitignore` | High |
| FR-8.2.2 | IPFS gateway URLs and public contract addresses shall be exposed via **`NEXT_PUBLIC_*`** environment variables only | Medium |

### FR-8.3 — Data Integrity

| ID | Requirement | Priority |
|---|---|---|
| FR-8.3.1 | All ticket and event data shall be **immutable** once recorded on the blockchain | High |
| FR-8.3.2 | NFT metadata shall be stored on **IPFS** (content-addressed), ensuring tamper-proof ticket artwork and event images | High |
| FR-8.3.3 | Soulbound Identity NFTs shall be **non-transferable**, preventing identity sharing or selling | High |

---

## 9. Data Storage

### FR-9.1 — On-Chain Storage (Celo Blockchain)

| ID | Requirement | Priority |
|---|---|---|
| FR-9.1.1 | Store **event records** (name, venue, category, date, price, organizer, supply) on-chain | High |
| FR-9.1.2 | Store **ticket ownership** and transfer history as ERC-721 token records on-chain | High |
| FR-9.1.3 | Store **ratings and comments** on-chain for transparency and immutability | Medium |
| FR-9.1.4 | Store **resale request states** (pending, approved, rejected, executed) on-chain | Medium |
| FR-9.1.5 | Store **Soulbound Identity** data (KYC scores, timestamps) on-chain | High |

### FR-9.2 — Off-Chain Storage (IPFS via Pinata)

| ID | Requirement | Priority |
|---|---|---|
| FR-9.2.1 | Store **event images** on IPFS via Pinata with content-addressable hashes | High |
| FR-9.2.2 | Store **NFT metadata JSON** (name, description, image URI, attributes) on IPFS | High |
| FR-9.2.3 | Use a **dedicated Pinata gateway** (`mypinata.cloud`) for reliable IPFS content retrieval | Medium |

### FR-9.3 — Client-Side Storage

| ID | Requirement | Priority |
|---|---|---|
| FR-9.3.1 | Store **AI purchase history** (per-wallet purchase timestamps and event IDs) in browser LocalStorage | Medium |
| FR-9.3.2 | Store **AI decision logs** (risk scores, decisions) in browser LocalStorage for client-side auditing | Low |

---

## 10. Error Handling & Logging

### FR-10.1 — Transaction Error Handling

| ID | Requirement | Priority |
|---|---|---|
| FR-10.1.1 | The system shall display **user-friendly error messages** when blockchain transactions fail (insufficient funds, rejected by wallet, gas estimation failure) | High |
| FR-10.1.2 | The system shall use **toast notifications** (Sonner) to alert users of transaction success, pending, and failure states | High |
| FR-10.1.3 | Smart contract **require statements** shall provide descriptive revert reasons | Medium |

### FR-10.2 — AI Decision Logging

| ID | Requirement | Priority |
|---|---|---|
| FR-10.2.1 | All AI risk assessments shall be logged with: **timestamp**, **wallet address**, **event ID**, **bot score**, **scalping score**, **trust score**, and **final decision** | High |
| FR-10.2.2 | Logs shall be stored as **immutable audit trails** to prevent tampering | Medium |
| FR-10.2.3 | Logs shall **not expose** sensitive personal information or private keys | High |

### FR-10.3 — System Monitoring

| ID | Requirement | Priority |
|---|---|---|
| FR-10.3.1 | The system shall integrate **Vercel Analytics** for frontend usage monitoring | Low |
| FR-10.3.2 | Smart contract events shall emit **indexed logs** for blockchain transaction, encryption, and AI-detection activities queryable via Celoscan | Medium |

---

## 11. Non-Functional Requirements

### NFR-11.1 — Performance

| ID | Requirement | Priority |
|---|---|---|
| NFR-11.1.1 | Smart contracts shall be compiled with **Solidity optimizer** (`runs: 200`, `viaIR: true`) to minimize gas costs | Medium |
| NFR-11.1.2 | Frontend pages shall render within **3 seconds** on standard connections using Next.js SSR/SSG | Medium |
| NFR-11.1.3 | AI risk assessment pipeline shall complete within **500ms** per purchase attempt | Medium |

### NFR-11.2 — Usability

| ID | Requirement | Priority |
|---|---|---|
| NFR-11.2.1 | The application shall support **dark and light themes** with user toggle | Medium |
| NFR-11.2.2 | The UI shall be **responsive** and accessible across desktop browsers | Medium |
| NFR-11.2.3 | Wallet connection shall be simplified via **RainbowKit** with clear visual cues | High |

### NFR-11.3 — Reliability

| ID | Requirement | Priority |
|---|---|---|
| NFR-11.3.1 | The system shall use a **dedicated IPFS gateway** with fallback to `ipfs.io` in case of Pinata downtime | Medium |
| NFR-11.3.2 | Smart contracts shall include **transaction retry logic** for Celo network congestion scenarios | Low |

### NFR-11.4 — Deployment

| ID | Requirement | Priority |
|---|---|---|
| NFR-11.4.1 | Frontend shall be deployed on **Vercel** with automatic builds from Git | Medium |
| NFR-11.4.2 | Smart contracts shall be **verified on Celoscan** for public source code transparency | Medium |
| NFR-11.4.3 | ABIs shall be automatically synced from compiled contracts to frontend via the `update_abi` script | Low |

---

## System Goal

> Combine **blockchain immutability** and **AI-driven fraud detection** to deliver a **secure, transparent, and scalping-resistant** event ticketing platform — where every ticket is a verifiable NFT, every transaction is auditable, and every user is identity-verified through Soulbound tokens.

---

<p align="center"><i>💠 Rexell — Functional Requirements v1.0</i></p>
