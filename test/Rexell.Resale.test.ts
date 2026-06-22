import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Resale Marketplace Module", function () {
  async function deployResaleFixture() {
    const [owner, organizer, seller, buyer, platformFeeRecipient, untrusted] = await hre.ethers.getSigners();

    // Deploy Mock cUSD
    const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
    const mockCUSD = await MockCUSD.deploy() as any;
    await mockCUSD.waitForDeployment();

    // Deploy SoulboundIdentity
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    const identity = await SoulboundIdentity.deploy() as any;
    await identity.waitForDeployment();

    // Deploy Rexell
    const Rexell = await hre.ethers.getContractFactory("Rexell");
    const rexell = await Rexell.deploy(
      await mockCUSD.getAddress(),
      await identity.getAddress()
    ) as any;
    await rexell.waitForDeployment();

    // Set platform fee recipient to our dedicated address
    await rexell.connect(owner).setPlatformFeeRecipient(platformFeeRecipient.address);

    // Distribute cUSD to buyer and seller
    const amount = hre.ethers.parseEther("100");
    await mockCUSD.transfer(seller.address, amount);
    await mockCUSD.transfer(buyer.address, amount);

    // Approve cUSD usage
    await mockCUSD.connect(seller).approve(await rexell.getAddress(), amount);
    await mockCUSD.connect(buyer).approve(await rexell.getAddress(), amount);

    // Setup KYC identities (KYC score = 80 for seller and buyer, 40 for untrusted)
    await identity.connect(owner).mintIdentity(seller.address, 80);
    await identity.connect(owner).mintIdentity(buyer.address, 85);
    await identity.connect(owner).mintIdentity(untrusted.address, 40);

    return { rexell, mockCUSD, identity, owner, organizer, seller, buyer, platformFeeRecipient, untrusted };
  }

  describe("Resale Requests and Guardrails", function () {
    it("Should allow valid ticket owners to request resale verification with correct constraints", async function () {
      const { rexell, organizer, seller } = await deployResaleFixture();

      // Organizer creates event with base price 10 cUSD
      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5; // 5 days from now
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Seller buys a ticket
      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");

      // Verify ownership history initialized
      const history = await rexell.getTicketOwnershipHistory(0);
      expect(history.length).to.equal(1);
      expect(history[0]).to.equal(seller.address);

      // Request resale: price 15 cUSD (within 200% price limit of 20 cUSD)
      const listPrice = hre.ethers.parseEther("15");
      await expect(rexell.connect(seller).requestResaleVerification(0, listPrice))
        .to.emit(rexell, "ResaleRequested")
        .withArgs(0, seller.address, listPrice);

      const request = await rexell.getResaleRequest(0);
      expect(request.tokenId).to.equal(0n);
      expect(request.owner).to.equal(seller.address);
      expect(request.price).to.equal(listPrice);
      expect(request.approved).to.be.false;
      expect(request.rejected).to.be.false;
    });

    it("Should reject resale requests exceeding the 200% price multiplier cap", async function () {
      const { rexell, organizer, seller } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");

      // Request resale at 21 cUSD (exceeds 200% max of 20 cUSD)
      const badPrice = hre.ethers.parseEther("21");
      await expect(
        rexell.connect(seller).requestResaleVerification(0, badPrice)
      ).to.be.revertedWith("Price exceeds maximum allowed resale price");
    });

    it("Should reject resale requests within the 48-hour pre-event cutoff freeze window", async function () {
      const { rexell, organizer, seller } = await deployResaleFixture();

      // Create event starting in 24 hours (less than 48 hours cutoff window)
      const nearEventDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
      await rexell.connect(organizer).createEvent(
        "Festival Near", "Stadium", "Music",
        nearEventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");

      // Request resale - should revert
      await expect(
        rexell.connect(seller).requestResaleVerification(0, hre.ethers.parseEther("15"))
      ).to.be.revertedWith("Resale period has ended");
    });

    it("Should reject resale requests from sellers without verified KYC (score < 70)", async function () {
      const { rexell, organizer, untrusted } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Distribute cUSD and approve for untrusted user
      const amount = hre.ethers.parseEther("10");
      const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
      const mockCUSD = await MockCUSD.attach(await rexell.cUSDToken()) as any;
      await mockCUSD.transfer(untrusted.address, amount);
      await mockCUSD.connect(untrusted).approve(await rexell.getAddress(), amount);

      // Buy ticket (fails because untrusted's KYC is 40 < 70)
      await expect(
        rexell.connect(untrusted).buyTicket(0, "QmTicketUrl")
      ).to.be.revertedWith("Buyer not verified via Soulbound Identity");
    });
  });

  describe("Resale Approval System", function () {
    it("Should allow only organizer or contract owner to approve resale requests", async function () {
      const { rexell, owner, organizer, seller, buyer } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");
      await rexell.connect(seller).requestResaleVerification(0, hre.ethers.parseEther("15"));

      // Random buyer tries to approve - should fail
      await expect(
        rexell.connect(buyer).approveResale(0)
      ).to.be.revertedWith("Only event organizer or contract owner can approve");

      // Organizer approves - should succeed
      await expect(rexell.connect(organizer).approveResale(0))
        .to.emit(rexell, "ResaleApproved")
        .withArgs(0, seller.address);

      const request = await rexell.getResaleRequest(0);
      expect(request.approved).to.be.true;
    });

    it("Should allow only organizer or contract owner to reject resale requests", async function () {
      const { rexell, organizer, seller, buyer } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");
      await rexell.connect(seller).requestResaleVerification(0, hre.ethers.parseEther("15"));

      // Buyer tries to reject - should fail
      await expect(
        rexell.connect(buyer).rejectResale(0)
      ).to.be.revertedWith("Only event organizer or contract owner can reject");

      // Organizer rejects - should succeed
      await expect(rexell.connect(organizer).rejectResale(0))
        .to.emit(rexell, "ResaleRejected")
        .withArgs(0, seller.address);

      const request = await rexell.getResaleRequest(0);
      expect(request.rejected).to.be.true;
    });
  });

  describe("Resale Purchases & Royalty Mathematics", function () {
    it("Should split secondary resale payments: 5% royalty, 2% platform fee, 93% seller", async function () {
      const { rexell, mockCUSD, organizer, seller, buyer, platformFeeRecipient } = await deployResaleFixture();

      // Create event
      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Primary sale
      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");
      
      // Resale request at 20 cUSD
      const resalePrice = hre.ethers.parseEther("20");
      await rexell.connect(seller).requestResaleVerification(0, resalePrice);
      await rexell.connect(organizer).approveResale(0);

      // Verify contract holds approved ticket when resold
      await rexell.connect(seller).resellTicket(0, resalePrice, "QmTicketUrl");
      expect(await rexell.ownerOf(0)).to.equal(await rexell.getAddress());

      // Track starting balances
      const startBalOrganizer = await mockCUSD.balanceOf(organizer.address);
      const startBalPlatform = await mockCUSD.balanceOf(platformFeeRecipient.address);
      const startBalSeller = await mockCUSD.balanceOf(seller.address);
      const startBalBuyer = await mockCUSD.balanceOf(buyer.address);

      // Buyer purchases the resale ticket
      const buyResaleTx = await rexell.connect(buyer).buyResaleTicket(0, resalePrice);
      await buyResaleTx.wait();

      // Math:
      // Total price = 20 cUSD
      // Royalty = 5% of 20 = 1.0 cUSD
      // Platform Fee = 2% of 20 = 0.4 cUSD
      // Seller Amount = 93% of 20 = 18.6 cUSD
      const expRoyalty = hre.ethers.parseEther("1.0");
      const expPlatform = hre.ethers.parseEther("0.4");
      const expSellerShare = hre.ethers.parseEther("18.6");

      // Verify payouts
      expect(await mockCUSD.balanceOf(organizer.address) - startBalOrganizer).to.equal(expRoyalty);
      expect(await mockCUSD.balanceOf(platformFeeRecipient.address) - startBalPlatform).to.equal(expPlatform);
      expect(await mockCUSD.balanceOf(seller.address) - startBalSeller).to.equal(expSellerShare);
      expect(startBalBuyer - await mockCUSD.balanceOf(buyer.address)).to.equal(resalePrice);

      // Verify ownership update
      expect(await rexell.ownerOf(0)).to.equal(buyer.address);

      // Verify ownership history list
      const history = await rexell.getTicketOwnershipHistory(0);
      expect(history.length).to.equal(2);
      expect(history[0]).to.equal(seller.address);
      expect(history[1]).to.equal(buyer.address);
    });

    it("Should prevent buyer from purchasing their own resale ticket", async function () {
      const { rexell, organizer, seller } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");
      await rexell.connect(seller).requestResaleVerification(0, hre.ethers.parseEther("15"));
      await rexell.connect(organizer).approveResale(0);
      await rexell.connect(seller).resellTicket(0, hre.ethers.parseEther("15"), "QmTicketUrl");

      // Seller tries to buy their own ticket - should revert
      await expect(
        rexell.connect(seller).buyResaleTicket(0, hre.ethers.parseEther("15"))
      ).to.be.revertedWith("Cannot buy your own ticket");
    });

    it("Should prevent organizer from purchasing a resale ticket to their own event", async function () {
      const { rexell, identity, owner, organizer, seller } = await deployResaleFixture();

      const eventDate = Math.floor(Date.now() / 1000) + 86400 * 5;
      await rexell.connect(organizer).createEvent(
        "Festival", "Stadium", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Organizer has valid KYC
      await identity.connect(owner).mintIdentity(organizer.address, 95);

      await rexell.connect(seller).buyTicket(0, "QmTicketUrl");
      await rexell.connect(seller).requestResaleVerification(0, hre.ethers.parseEther("15"));
      await rexell.connect(organizer).approveResale(0);
      await rexell.connect(seller).resellTicket(0, hre.ethers.parseEther("15"), "QmTicketUrl");

      // Organizer tries to buy resale ticket - should revert
      await expect(
        rexell.connect(organizer).buyResaleTicket(0, hre.ethers.parseEther("15"))
      ).to.be.revertedWith("Organizer cannot buy resale tickets for their own event");
    });
  });

  describe("Access Control for System Configs", function () {
    it("Should allow only contract owner to modify config options", async function () {
      const { rexell, organizer, buyer } = await deployResaleFixture();

      // Non-owner try to change royalty - should fail
      await expect(
        rexell.connect(organizer).setRoyaltyPercent(10)
      ).to.be.revertedWith("Only owner can call this function");

      // Owner changes royalty - should succeed
      await rexell.setRoyaltyPercent(10);
      expect(await rexell.royaltyPercent()).to.equal(10n);

      // Verify platform fee constraint <= 10%
      await expect(rexell.setPlatformFeePercent(11)).to.be.revertedWith("Platform fee cannot exceed 10%");
    });
  });
});
