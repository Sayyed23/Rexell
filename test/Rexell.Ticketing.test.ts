import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Ticketing Module", function () {
  async function deployTicketingFixture() {
    const [owner, organizer, buyer1, buyer2] = await hre.ethers.getSigners();

    // Deploy Mock cUSD
    const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
    const mockCUSD = await MockCUSD.deploy() as any;
    await mockCUSD.waitForDeployment();

    // Deploy SoulboundIdentity
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    const identity = await SoulboundIdentity.deploy(
      await mockCUSD.getAddress(),
      owner.address
    ) as any;
    await identity.waitForDeployment();

    // Deploy Rexell
    const Rexell = await hre.ethers.getContractFactory("Rexell");
    const rexell = await Rexell.deploy(
      await mockCUSD.getAddress(),
      await identity.getAddress()
    ) as any;
    await rexell.waitForDeployment();

    // Distribute cUSD to buyers and approve Rexell
    const amount = hre.ethers.parseEther("100");
    await mockCUSD.transfer(buyer1.address, amount);
    await mockCUSD.transfer(buyer2.address, amount);
    await mockCUSD.connect(buyer1).approve(await rexell.getAddress(), amount);
    await mockCUSD.connect(buyer2).approve(await rexell.getAddress(), amount);

    return { rexell, mockCUSD, identity, owner, organizer, buyer1, buyer2 };
  }

  describe("KYC Gate on Ticket Purchase", function () {
    it("Should prevent purchase if buyer has no Soulbound Identity", async function () {
      const { rexell, organizer, buyer1 } = await deployTicketingFixture();

      // Create an event
      await rexell.connect(organizer).createEvent(
        "Standard Concert", "Stadium", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Attempt to purchase ticket without KYC
      await expect(
        rexell.connect(buyer1).buyTicket(0, "QmTicket1")
      ).to.be.revertedWith("Buyer not verified via Soulbound Identity");
    });

    it("Should prevent purchase if buyer's KYC score is less than 70", async function () {
      const { rexell, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      // Create an event
      await rexell.connect(organizer).createEvent(
        "Standard Concert", "Stadium", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Mint identity with low score (65)
      await identity.connect(owner).mintIdentity(buyer1.address, 65);

      // Attempt to purchase
      await expect(
        rexell.connect(buyer1).buyTicket(0, "QmTicket1")
      ).to.be.revertedWith("Buyer not verified via Soulbound Identity");
    });

    it("Should allow purchase if buyer's KYC score is >= 70", async function () {
      const { rexell, mockCUSD, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      // Create event
      await rexell.connect(organizer).createEvent(
        "Standard Concert", "Stadium", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Mint identity with score 75
      await identity.connect(owner).mintIdentity(buyer1.address, 75);

      // Successful purchase
      const buyTx = await rexell.connect(buyer1).buyTicket(0, "QmTicket1");
      await buyTx.wait();

      expect(await rexell.ownerOf(0)).to.equal(buyer1.address);
      expect(await mockCUSD.balanceOf(organizer.address)).to.equal(hre.ethers.parseEther("10"));
    });
  });

  describe("Anti-Scalping 4-Seat Purchase Cap", function () {
    beforeEach(async function () {
      // This will run before every test in this block
    });

    it("Should prevent buying more than 4 tickets in a single bulk purchase", async function () {
      const { rexell, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Mega Concert", "Arena", "Music",
        Math.floor(Date.now() / 1000) + 86400, "20:00",
        hre.ethers.parseEther("5"), "QmHash", 100, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 90);

      const uris = ["uri1", "uri2", "uri3", "uri4", "uri5"];

      // Try to buy 5 tickets
      await expect(
        rexell.connect(buyer1).buyTickets(0, uris, 5)
      ).to.be.revertedWith("Purchase exceeds 4 tickets limit per user");
    });

    it("Should prevent cumulative purchases exceeding 4 tickets per user", async function () {
      const { rexell, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Mega Concert", "Arena", "Music",
        Math.floor(Date.now() / 1000) + 86400, "20:00",
        hre.ethers.parseEther("5"), "QmHash", 100, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 90);

      // Buy 3 tickets first
      await rexell.connect(buyer1).buyTickets(0, ["uri1", "uri2", "uri3"], 3);

      // Try to buy 2 more tickets (total = 5)
      await expect(
        rexell.connect(buyer1).buyTickets(0, ["uri4", "uri5"], 2)
      ).to.be.revertedWith("Purchase exceeds 4 tickets limit per user");

      // Try to buy 1 more ticket (total = 4) - should succeed
      await expect(
        rexell.connect(buyer1).buyTicket(0, "uri4")
      ).to.not.be.reverted;
    });

    it("Should enforce the 4-seat cap in seat-map purchases", async function () {
      const { rexell, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Mega Concert", "Arena", "Music",
        Math.floor(Date.now() / 1000) + 86400, "20:00",
        hre.ethers.parseEther("5"), "QmHash", 100, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 90);

      // Attempt to buy 5 seat-map tickets
      const uris = ["uri1", "uri2", "uri3", "uri4", "uri5"];
      const seats = ["A-1", "A-2", "A-3", "A-4", "A-5"];
      const cats = ["VIP", "VIP", "VIP", "VIP", "VIP"];

      await expect(
        rexell.connect(buyer1)["buyTickets(uint256,string[],string[],string[])"](0, uris, seats, cats)
      ).to.be.revertedWith("Purchase exceeds 4 tickets limit per user");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner or organizer to cancel a ticket", async function () {
      const { rexell, identity, owner, organizer, buyer1 } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("1"), "QmHash", 10, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 80);
      await rexell.connect(buyer1).buyTicket(0, "uri1");

      // Buyer can cancel their own ticket
      await expect(rexell.connect(buyer1).cancelTicket(0))
        .to.emit(rexell, "TicketCancelled")
        .withArgs(0, buyer1.address);
      
      expect(await rexell.isTicketCancelled(0)).to.be.true;
    });

    it("Should prevent unauthorized users from cancelling tickets", async function () {
      const { rexell, identity, owner, organizer, buyer1, buyer2 } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("1"), "QmHash", 10, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 80);
      await rexell.connect(buyer1).buyTicket(0, "uri1");

      // buyer2 tries to cancel buyer1's ticket - should fail
      await expect(
        rexell.connect(buyer2).cancelTicket(0)
      ).to.be.revertedWith("Not authorized to cancel ticket");
    });

    it("Should prevent organizer from purchasing tickets to their own event", async function () {
      const { rexell, identity, owner, organizer } = await deployTicketingFixture();

      await rexell.connect(organizer).createEvent(
        "Organizer Concert", "Venue", "Music",
        Math.floor(Date.now() / 1000) + 86400, "19:00",
        hre.ethers.parseEther("1"), "QmHash", 10, "Desc"
      );

      await identity.connect(owner).mintIdentity(organizer.address, 90);

      // Try single buy
      await expect(
        rexell.connect(organizer).buyTicket(0, "uri1")
      ).to.be.revertedWith("Organizer cannot buy tickets for their own event");

      // Try bulk buy
      await expect(
        rexell.connect(organizer).buyTickets(0, ["uri1", "uri2"], 2)
      ).to.be.revertedWith("Organizer cannot buy tickets for their own event");

      // Try seat-map buy
      await expect(
        rexell.connect(organizer)["buyTickets(uint256,string[],string[],string[])"](
          0, ["uri1"], ["A-1"], ["VIP"]
        )
      ).to.be.revertedWith("Organizer cannot buy tickets for their own event");
    });
  });
});
