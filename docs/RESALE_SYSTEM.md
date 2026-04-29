# Resale Verification System

This document describes the resale verification system implemented for the Rexell ticketing platform.

## Overview

The resale verification system allows users to request permission to resell their tickets, with event organizers having the ability to approve or reject these requests. This helps prevent scalping and ensures fair pricing.

## Flow

### 1. User Requests Resale Verification

- User clicks "Request Resale Verification" on their ticket page
- User enters desired resale price in cUSD
- System calls `requestResaleVerification(tokenId, price)` on the smart contract
- Request is stored in the contract with status "pending"

### 2. Owner Reviews Request

- Event organizer visits `/owner/resale-requests` page
- Can see all pending resale requests for their events
- Can approve or reject each request
- System calls `approveResale(tokenId)` or `rejectResale(tokenId)`

### 3. User Can Resell (if approved)

- Once approved, user sees "Resale Approved" status
- User can proceed to list ticket for resale
- System calls `resellTicket(tokenId, price, nftUri)` to list the ticket
- Ticket becomes available in the market

### 4. Market Trading

- Approved resale tickets appear in `/market` page
- Other users can view and purchase these tickets
- Payment and transfer are handled by the smart contract

## Components

### ResaleVerificationNew.tsx
- Handles the initial resale verification request
- Shows different UI states: none, pending, approved, rejected
- Auto-refreshes status every 10 seconds
- Allows users to submit new requests if rejected

### ResaleTicket.tsx
- Displays approved resale tickets
- Allows users to list their approved tickets for resale
- Shows ticket details and pricing information

### Owner Dashboard (`/owner/resale-requests`)
- Lists all resale requests for the organizer's events
- Provides approve/reject functionality
- Shows request details and status

### Market Page (`/market`)
- Displays all available resale tickets
- Allows users to browse and purchase tickets
- Shows ticket images and pricing

## Smart Contract Functions

### Request Functions
- `requestResaleVerification(uint256 tokenId, uint256 price)` - Submit resale request
- `cancelResaleRequest(uint256 tokenId)` - Cancel pending request

### Owner Functions
- `approveResale(uint256 tokenId)` - Approve resale request
- `rejectResale(uint256 tokenId)` - Reject resale request

### View Functions
- `getResaleRequest(uint256 tokenId)` - Get request details
- `getUserResaleRequests(address user)` - Get user's requests

### Resale Functions
- `resellTicket(uint256 tokenId, uint256 price, string nftUri)` - List ticket for resale

## Status States

1. **None** - No request submitted
2. **Pending** - Request submitted, awaiting organizer review
3. **Approved** - Request approved, can proceed to resale
4. **Rejected** - Request rejected, can submit new request

## Security Features

- Only ticket owners can request resale verification
- Only event organizers can approve/reject requests
- Prevents duplicate requests for the same ticket
- Validates ownership before allowing resale operations

## UI/UX Features

- Real-time status updates
- Clear visual indicators for each status
- Responsive design for mobile and desktop
- Loading states and error handling
- Toast notifications for user feedback
