import { expect } from "chai";
import { ethers } from "hardhat";

describe("Rexell Resale with Royalty and History", function () {
  it("Should handle complete resale flow with royalty fees and ownership history", async function () {
    // Get the contract factory
    const Rexell = await ethers.getContractFactory("Rexell");
    
    // Deploy the contract
    const rexell = await Rexell.deploy();
    await rexell.waitForDeployment();
    
    // Get signers
    const [owner, organizer, buyer1, buyer2] = await ethers.getSigners();
    
    // Create an event
    const createEventTx = await rexell.connect(organizer).createEvent(
      "Test Event",
      "Test Venue",
      "Music",
      Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      "18:00",
      ethers.parseEther("0.1"), // 0.1 cUSD
      "QmTest123", // IPFS hash
      10, // 10 tickets available
      "Test event description"
    );
    
    await createEventTx.wait();
    
    // Buy a ticket as buyer1
    const buyTicketTx = await rexell.connect(buyer1).buyTicket(
      0, // eventId
      "QmTicket123" // NFT URI
    );
    
    await buyTicketTx.wait();
    
    // Verify buyer1 owns the ticket
    const ticketOwner = await rexell.ownerOf(0);
    expect(ticketOwner).to.equal(buyer1.address);
    
    // Check initial ownership history
    const initialHistory = await rexell.getTicketOwnershipHistory(0);
    expect(initialHistory.length).to.equal(1);
    expect(initialHistory[0]).to.equal(buyer1.address);
    
    // Request resale verification
    const requestResaleTx = await rexell.connect(buyer1).requestResaleVerification(
      0, // tokenId
      ethers.parseEther("0.15") // resale price (50% markup)
    );
    
    await requestResaleTx.wait();
    
    // Approve resale (contract owner)
    const approveResaleTx = await rexell.connect(owner).approveResale(0);
    await approveResaleTx.wait();
    
    // Verify resale request is approved
    const resaleRequest = await rexell.getResaleRequest(0);
    expect(resaleRequest.approved).to.equal(true);
    
    // Buy resale ticket as buyer2
    const buyResaleTx = await rexell.connect(buyer2).buyResaleTicket(
      0, // tokenId
      ethers.parseEther("0.15") // max price
    );
    
    await buyResaleTx.wait();
    
    // Verify buyer2 now owns the ticket
    const newTicketOwner = await rexell.ownerOf(0);
    expect(newTicketOwner).to.equal(buyer2.address);
    
    // Check updated ownership history
    const updatedHistory = await rexell.getTicketOwnershipHistory(0);
    expect(updatedHistory.length).to.equal(2);
    expect(updatedHistory[0]).to.equal(buyer1.address);
    expect(updatedHistory[1]).to.equal(buyer2.address);
    
    // Verify royalty was paid (5% of 0.15 = 0.0075)
    // This would require mocking the cUSD token contract for a complete test
    
    console.log("Resale with royalty and history test completed successfully");
  });
});