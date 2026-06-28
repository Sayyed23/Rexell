import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Resale & Ticketing 4-Way Gating", function () {
  let mockCUSD: any;
  let identity: any;
  let rexell: any;
  let owner: any;
  let organizer: any;
  let user1: any;
  let user2: any;
  let oracle1: any;
  let oracle2: any;
  let oracle3: any;
  let oracles: any[];
  let nextNonce = 0;

  beforeEach(async function () {
    const signers = await hre.ethers.getSigners();
    owner = signers[0];
    organizer = signers[1];
    user1 = signers[2];
    user2 = signers[3];
    oracle1 = signers[4];
    oracle2 = signers[5];
    oracle3 = signers[6];

    // Sort oracle addresses as expected by the contract
    oracles = [oracle1, oracle2, oracle3].sort((a, b) => {
      const aAddr = a.address.toLowerCase();
      const bAddr = b.address.toLowerCase();
      return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
    });

    // Deploy Mock cUSD
    const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
    mockCUSD = await MockCUSD.deploy();
    await mockCUSD.waitForDeployment();

    // Deploy SoulboundIdentity
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    identity = await SoulboundIdentity.deploy(await mockCUSD.getAddress(), owner.address);
    await identity.waitForDeployment();

    // Deploy Rexell
    const Rexell = await hre.ethers.getContractFactory("Rexell");
    rexell = await Rexell.deploy(await mockCUSD.getAddress(), await identity.getAddress());
    await rexell.waitForDeployment();

    // Register oracle signers
    await rexell.connect(owner).setOracleSigner(oracles[0].address, true);
    await rexell.connect(owner).setOracleSigner(oracles[1].address, true);
    await rexell.connect(owner).setOracleSigner(oracles[2].address, true);

    // Fund users
    const fundAmount = hre.ethers.parseEther("1000");
    await mockCUSD.transfer(user1.address, fundAmount);
    await mockCUSD.transfer(user2.address, fundAmount);

    // Approve cUSD
    await mockCUSD.connect(user1).approve(await rexell.getAddress(), fundAmount);
    await mockCUSD.connect(user2).approve(await rexell.getAddress(), fundAmount);
  });

  async function getAttestation(userAddress: string, score: number) {
    const blockNum = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(blockNum);
    const blockTime = block ? block.timestamp : Math.floor(Date.now() / 1000);
    const expiresAt = blockTime + 3600;
    const nonce = nextNonce++;

    const domain = {
      name: "Rexell",
      version: "1",
      chainId: 31337,
      verifyingContract: await rexell.getAddress()
    };

    const types = {
      IdentityAttestation: [
        { name: "user", type: "address" },
        { name: "score", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };

    const value = {
      user: userAddress,
      score: score,
      expiresAt: expiresAt,
      nonce: nonce
    };

    const signatures = [];
    for (const oracle of oracles) {
      const sig = await oracle.signTypedData(domain, types, value);
      signatures.push(sig);
    }

    return {
      user: userAddress,
      score: score,
      expiresAt: expiresAt,
      nonce: nonce,
      signatures: signatures
    };
  }

  async function getFutureEventDate() {
    const blockNum = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(blockNum);
    const blockTime = block ? block.timestamp : Math.floor(Date.now() / 1000);
    return blockTime + 86400 * 5;
  }

  describe("Tier 0 Purchase (1-2 tickets)", function () {
    it("Should allow purchasing 1-2 tickets without Soulbound Identity", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      const att1 = await getAttestation(user1.address, 10); // score < 70
      await expect(rexell.connect(user1).buyTicket(0, "QmTicket1", att1))
        .to.not.be.reverted;

      const att2 = await getAttestation(user1.address, 10);
      await expect(rexell.connect(user1).buyTicket(0, "QmTicket2", att2))
        .to.not.be.reverted;
    });
  });

  describe("Tier 1 Bulk Purchase (3+ tickets)", function () {
    it("Should revert bulk purchase (3+ tickets) if score < 70", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Buy 2 tickets first (succeeds)
      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 10));
      await rexell.connect(user1).buyTicket(0, "QmTicket2", await getAttestation(user1.address, 10));

      // Attempt to buy 3rd ticket (should revert as score < 70 and no Soulbound identity)
      await expect(
        rexell.connect(user1).buyTicket(0, "QmTicket3", await getAttestation(user1.address, 10))
      ).to.be.revertedWith("Score below threshold for bulk purchase");
    });

    it("Should revert bulk purchase if has Soulbound Identity but it is less than 14 days old", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Mint Identity for user1 (gives score 80 >= 70, but activationTime is now)
      await identity.connect(owner).mintIdentity(user1.address, 80);

      // Buy 2 tickets first (succeeds)
      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 80));
      await rexell.connect(user1).buyTicket(0, "QmTicket2", await getAttestation(user1.address, 80));

      // Attempt to buy 3rd ticket (should revert because age is < 14 days)
      await expect(
        rexell.connect(user1).buyTicket(0, "QmTicket3", await getAttestation(user1.address, 80))
      ).to.be.revertedWith("Identity must be at least 14 days old");
    });

    it("Should allow bulk purchase if user has Soulbound Identity >= 14 days old and score >= 70", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Mint Identity
      await identity.connect(owner).mintIdentity(user1.address, 80);

      // Fast forward time by 15 days
      await hre.ethers.provider.send("evm_increaseTime", [86400 * 15]);
      await hre.ethers.provider.send("evm_mine", []);

      // Buy 2 tickets
      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 80));
      await rexell.connect(user1).buyTicket(0, "QmTicket2", await getAttestation(user1.address, 80));

      // Buy 3rd ticket (succeeds)
      await expect(
        rexell.connect(user1).buyTicket(0, "QmTicket3", await getAttestation(user1.address, 80))
      ).to.not.be.reverted;
    });
  });

  describe("Tier 0 Resale (Price <= face value)", function () {
    it("Should allow resale request at or below face value without Soulbound Identity or high score", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      // Buy ticket
      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 10));

      // Request resale at face value (10 cUSD) with low score attestation
      const att = await getAttestation(user1.address, 10);
      await expect(
        rexell.connect(user1).requestResaleVerification(0, hre.ethers.parseEther("10"), att)
      ).to.not.be.reverted;
    });
  });

  describe("Tier 1 Resale Markup (Price > face value)", function () {
    it("Should revert resale request at a markup if score < 70", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 10));

      // Request resale at markup (15 cUSD > 10 cUSD) with low score attestation
      const att = await getAttestation(user1.address, 10);
      await expect(
        rexell.connect(user1).requestResaleVerification(0, hre.ethers.parseEther("15"), att)
      ).to.be.revertedWith("Score below threshold");
    });

    it("Should allow markup resale request if user has Soulbound Identity >= 14 days old and score >= 70", async function () {
      // Mint Identity first
      await identity.connect(owner).mintIdentity(user1.address, 80);

      // Fast forward time by 15 days
      await hre.ethers.provider.send("evm_increaseTime", [86400 * 15]);
      await hre.ethers.provider.send("evm_mine", []);

      // Now create event (relative to the advanced block timestamp)
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("10"), "QmHash", 50, "Desc"
      );

      await rexell.connect(user1).buyTicket(0, "QmTicket1", await getAttestation(user1.address, 80));

      // Request resale at markup
      const att = await getAttestation(user1.address, 80);
      await expect(
        rexell.connect(user1).requestResaleVerification(0, hre.ethers.parseEther("15"), att)
      ).to.not.be.reverted;
    });
  });
});
