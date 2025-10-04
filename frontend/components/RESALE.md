# Resale Functionality

This document explains the resale functionality implemented in the Rexell platform to prevent ticket scalping.

## Overview

The resale system includes the following components:

1. **Resale Verification** - Users must request verification before reselling tickets
2. **Organizer Approval** - Event organizers must approve resale requests
3. **Resale Execution** - Approved tickets can be resold at a specified price

## Smart Contract Functions

### `requestResaleVerification(uint256 tokenId, uint256 price)`
- Users call this function to request resale verification for a ticket
- Requires the user to be the owner of the ticket
- Requires a valid resale price

### `approveResale(uint256 tokenId)`
- Organizers call this function to approve a resale request
- Only the contract owner can call this function (in this implementation)

### `rejectResale(uint256 tokenId)`
- Organizers call this function to reject a resale request
- Only the contract owner can call this function (in this implementation)

### `resellTicket(uint256 tokenId, uint256 price, string memory nftUri)`
- Users call this function to resell an approved ticket
- Requires the resale to be approved
- Transfers the ticket to the contract

## Frontend Components

### ResaleVerificationNew
- Component for users to request resale verification
- Collects resale price from user
- Submits resale request to the smart contract

### ResaleTicket
- Component for users to execute the resale of an approved ticket
- Validates that the resale is approved before allowing resale
- Collects NFT URI for the new ticket

### ResaleApprovalDashboard
- Dashboard for organizers to manage resale requests
- Shows pending, approved, and rejected requests
- Allows organizers to approve or reject requests

## User Flow

1. **User requests resale verification**
   - Navigate to ticket details page
   - Click "Request Resale Verification"
   - Enter resale price
   - Submit request

2. **Organizer reviews request**
   - Navigate to Resale Approval Dashboard
   - Review pending requests
   - Approve or reject requests

3. **User completes resale**
   - Once approved, user can resell the ticket
   - Enter NFT URI for the new ticket
   - Complete the resale process

## Anti-Scalping Measures

1. **Verification Requirement** - All resales must be verified
2. **Organizer Approval** - Event organizers must approve resales
3. **Price Control** - Resale prices are visible to organizers
4. **Limited Resales** - Each ticket can only be resold once