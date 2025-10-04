import { expect } from "chai";
import { ethers } from "hardhat";

describe("Rexell", function () {
  it("Should allow buying multiple tickets", async function () {
    // Get the contract factory
    const Rexell = await ethers.getContractFactory("Rexell");
    
    // Deploy the contract
    const rexell = await Rexell.deploy();
    await rexell.waitForDeployment();
    
    // Create an event
    const createEventTx = await rexell.createEvent(
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
    
    // Get the event
    const event = await rexell.getEvent(0);
    expect(event[8]).to.equal(10n); // Check tickets available
    
    // Generate test NFT URIs
    const nftUris = ["QmTest1", "QmTest2", "QmTest3"];
    
    // Try to buy multiple tickets
    const buyTicketsTx = await rexell.buyTickets(0, nftUris, 3);
    await buyTicketsTx.wait();
    
    // Check that tickets were deducted
    const updatedEvent = await rexell.getEvent(0);
    expect(updatedEvent[8]).to.equal(7n); // 10 - 3 = 7 tickets left
  });
});