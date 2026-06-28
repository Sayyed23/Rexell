import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Ticketing Module", function () {
  let mockCUSD: any;
  let identity: any;
  let rexell: any;
  let owner: any;
  let organizer: any;
  let buyer1: any;
  let buyer2: any;
  let oracle1: any;
  let oracle2: any;
  let oracle3: any;
  let oracles: any[];
  let nextNonce = 0;

  beforeEach(async function () {
    const signers = await hre.ethers.getSigners();
    owner = signers[0];
    organizer = signers[1];
    buyer1 = signers[2];
    buyer2 = signers[3];
    oracle1 = signers[4];
    oracle2 = signers[5];
    oracle3 = signers[6];

    oracles = [oracle1, oracle2, oracle3].sort((a, b) => {
      const aAddr = a.address.toLowerCase();
      const bAddr = b.address.toLowerCase();
      return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
    });

    const MockCUSD = await hre.ethers.getContractFactory("MockCUSD");
    mockCUSD = await MockCUSD.deploy();
    await mockCUSD.waitForDeployment();

    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    identity = await SoulboundIdentity.deploy(await mockCUSD.getAddress(), owner.address);
    await identity.waitForDeployment();

    const Rexell = await hre.ethers.getContractFactory("Rexell");
    rexell = await Rexell.deploy(await mockCUSD.getAddress(), await identity.getAddress());
    await rexell.waitForDeployment();

    await rexell.connect(owner).setOracleSigner(oracles[0].address, true);
    await rexell.connect(owner).setOracleSigner(oracles[1].address, true);
    await rexell.connect(owner).setOracleSigner(oracles[2].address, true);

    const amount = hre.ethers.parseEther("1000");
    await mockCUSD.transfer(buyer1.address, amount);
    await mockCUSD.transfer(buyer2.address, amount);
    await mockCUSD.connect(buyer1).approve(await rexell.getAddress(), amount);
    await mockCUSD.connect(buyer2).approve(await rexell.getAddress(), amount);
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

  describe("Anti-Scalping 4-Seat Purchase Cap", function () {
    it("Should prevent buying more than 4 tickets in a single bulk purchase", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Mega Concert", "Arena", "Music",
        eventDate, "20:00",
        hre.ethers.parseEther("5"), "QmHash", 100, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 90);
      await hre.ethers.provider.send("evm_increaseTime", [86400 * 15]);
      await hre.ethers.provider.send("evm_mine", []);
      const uris = ["uri1", "uri2", "uri3", "uri4", "uri5"];

      await expect(
        rexell.connect(buyer1).buyTickets(0, uris, 5, await getAttestation(buyer1.address, 90))
      ).to.be.revertedWith("Purchase exceeds 4 tickets limit per user");
    });

    it("Should prevent cumulative purchases exceeding 4 tickets per user", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Mega Concert", "Arena", "Music",
        eventDate, "20:00",
        hre.ethers.parseEther("5"), "QmHash", 100, "Desc"
      );

      await identity.connect(owner).mintIdentity(buyer1.address, 90);
      await hre.ethers.provider.send("evm_increaseTime", [86400 * 15]);
      await hre.ethers.provider.send("evm_mine", []);

      // Buy 3 tickets first
      await rexell.connect(buyer1).buyTickets(0, ["uri1", "uri2", "uri3"], 3, await getAttestation(buyer1.address, 90));

      // Try to buy 2 more tickets (total = 5)
      await expect(
        rexell.connect(buyer1).buyTickets(0, ["uri4", "uri5"], 2, await getAttestation(buyer1.address, 90))
      ).to.be.revertedWith("Purchase exceeds 4 tickets limit per user");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner or organizer to cancel a ticket", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("1"), "QmHash", 10, "Desc"
      );

      await rexell.connect(buyer1).buyTicket(0, "uri1", await getAttestation(buyer1.address, 10));

      await expect(rexell.connect(buyer1).cancelTicket(0))
        .to.emit(rexell, "TicketCancelled")
        .withArgs(0, buyer1.address);
      
      expect(await rexell.isTicketCancelled(0)).to.be.true;
    });

    it("Should prevent organizer from purchasing tickets to their own event", async function () {
      const eventDate = await getFutureEventDate();
      await rexell.connect(organizer).createEvent(
        "Organizer Concert", "Venue", "Music",
        eventDate, "19:00",
        hre.ethers.parseEther("1"), "QmHash", 10, "Desc"
      );

      await expect(
        rexell.connect(organizer).buyTicket(0, "uri1", await getAttestation(organizer.address, 90))
      ).to.be.revertedWith("Organizer cannot buy tickets for their own event");
    });
  });
});
