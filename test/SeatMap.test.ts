import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Seat Map and Locking", function () {
  async function deployContractsFixture() {
    const [owner, organizer, buyer1, buyer2] = await hre.ethers.getSigners();

    // Deploy Mock cUSD
    const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
    const mockCUSD = await MockCUSD.deploy() as any;
    await mockCUSD.waitForDeployment();

    // Deploy Rexell contract
    const Rexell = await hre.ethers.getContractFactory("Rexell");
    // Rexell constructor takes cUSD token address and SoulboundIdentity address (pass 0x0)
    const rexell = await Rexell.deploy(
      await mockCUSD.getAddress(),
      "0x0000000000000000000000000000000000000000"
    ) as any;
    await rexell.waitForDeployment();

    // Distribute some cUSD to buyers and approve Rexell
    const amount = hre.ethers.parseEther("100");
    await mockCUSD.transfer(buyer1.address, amount);
    await mockCUSD.transfer(buyer2.address, amount);

    await mockCUSD.connect(buyer1).approve(await rexell.getAddress(), amount);
    await mockCUSD.connect(buyer2).approve(await rexell.getAddress(), amount);

    return { rexell, mockCUSD, owner, organizer, buyer1, buyer2 };
  }

  it("Should allow dynamic category price definition and seat layout purchase", async function () {
    const { rexell, mockCUSD, organizer, buyer1 } = await deployContractsFixture();

    // Create an event
    const price = hre.ethers.parseEther("1"); // base price 1 cUSD
    const createEventTx = await rexell.connect(organizer).createEvent(
      "Music Festival",
      "Stadium",
      "Music",
      Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      "19:00",
      price,
      "QmHash",
      100, // available tickets
      "Event description"
    );
    await createEventTx.wait();

    // Set dynamic prices for categories: VIP = 5 cUSD, Premium = 3 cUSD
    const vipPrice = hre.ethers.parseEther("5");
    const premiumPrice = hre.ethers.parseEther("3");
    
    await rexell.connect(organizer).setSeatCategoryPrice(0, "VIP", vipPrice);
    await rexell.connect(organizer).setSeatCategoryPrice(0, "Premium", premiumPrice);

    // Verify set prices
    expect(await rexell.seatCategoryPrices(0, "VIP")).to.equal(vipPrice);
    expect(await rexell.seatCategoryPrices(0, "Premium")).to.equal(premiumPrice);
    expect(await rexell.seatCategoryPrices(0, "Executive")).to.equal(0n); // Unset category returns 0

    // Buy ticket with selected seats: VIP seat L-1 and Premium seat K-12
    const nftUris = ["QmTicketVip", "QmTicketPremium"];
    const seatLabels = ["L-1", "K-12"];
    const categories = ["VIP", "Premium"];

    // Buyer starting balance
    const startBalanceOrganizer = await mockCUSD.balanceOf(organizer.address);

    const buyTx = await rexell.connect(buyer1)["buyTickets(uint256,string[],string[],string[])"](
      0,
      nftUris,
      seatLabels,
      categories
    );
    await buyTx.wait();

    // Verify seat ownership
    expect(await rexell.seatOwners(0, "L-1")).to.equal(buyer1.address);
    expect(await rexell.seatOwners(0, "K-12")).to.equal(buyer1.address);

    // Verify organizer received correct custom pricing (5 + 3 = 8 cUSD)
    const endBalanceOrganizer = await mockCUSD.balanceOf(organizer.address);
    expect(endBalanceOrganizer - startBalanceOrganizer).to.equal(hre.ethers.parseEther("8"));

    // Verify sold seats index
    const soldSeats = await rexell.getSoldSeats(0);
    expect(soldSeats.length).to.equal(2);
    expect(soldSeats[0]).to.equal("L-1");
    expect(soldSeats[1]).to.equal("K-12");

    // Verify user seats index
    const userSeats = await rexell.getUserSeats(0, buyer1.address);
    expect(userSeats.length).to.equal(2);
    expect(userSeats[0]).to.equal("L-1");
    expect(userSeats[1]).to.equal("K-12");
  });

  it("Should prevent race conditions via on-chain lockSeats and enforce validation in buyTickets", async function () {
    const { rexell, organizer, buyer1, buyer2 } = await deployContractsFixture();

    // Create event
    const price = hre.ethers.parseEther("1");
    await rexell.connect(organizer).createEvent(
      "Test Event 2",
      "Venue 2",
      "Theatre",
      Math.floor(Date.now() / 1000) + 86400,
      "20:00",
      price,
      "QmHash2",
      10,
      "Desc"
    );

    // Buyer1 locks seat "K-10" on-chain
    await rexell.connect(buyer1).lockSeats(0, ["K-10"]);

    // Verify seat lock is active for buyer1
    const lockInfo = await rexell.seatLocks(0, "K-10");
    expect(lockInfo.lockedBy).to.equal(buyer1.address);
    expect(lockInfo.lockedUntil > 0n).to.be.true;

    // Buyer2 attempts to lock the same seat - should revert
    try {
      await rexell.connect(buyer2).lockSeats(0, ["K-10"]);
      expect.fail("Should have reverted");
    } catch (e: any) {
      expect(e.message).to.include("Seat locked by another user");
    }

    // Buyer2 attempts to buy the locked seat directly - should revert
    try {
      await rexell.connect(buyer2)["buyTickets(uint256,string[],string[],string[])"](
        0,
        ["QmUr2"],
        ["K-10"],
        ["Premium"]
      );
      expect.fail("Should have reverted");
    } catch (e: any) {
      expect(e.message).to.include("Seat locked by another user");
    }

    // Buyer1 purchases the locked seat - should succeed and clear the lock
    await rexell.connect(buyer1)["buyTickets(uint256,string[],string[],string[])"](
      0,
      ["QmUri1"],
      ["K-10"],
      ["Premium"]
    );

    // Verify lock is cleared and seat is sold to buyer1
    const clearedLock = await rexell.seatLocks(0, "K-10");
    expect(clearedLock.lockedBy).to.equal(hre.ethers.ZeroAddress);
    expect(await rexell.seatOwners(0, "K-10")).to.equal(buyer1.address);
  });
});
