import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Rexell Seat Map and Locking", function () {
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

  it("Should allow dynamic category price definition and seat layout purchase", async function () {
    const eventDate = await getFutureEventDate();
    const price = hre.ethers.parseEther("1");
    const createEventTx = await rexell.connect(organizer).createEvent(
      "Music Festival",
      "Stadium",
      "Music",
      eventDate,
      "19:00",
      price,
      "QmHash",
      100,
      "Event description"
    );
    await createEventTx.wait();

    const vipPrice = hre.ethers.parseEther("5");
    const premiumPrice = hre.ethers.parseEther("3");
    
    await rexell.connect(organizer).setSeatCategoryPrice(0, "VIP", vipPrice);
    await rexell.connect(organizer).setSeatCategoryPrice(0, "Premium", premiumPrice);

    expect(await rexell.seatCategoryPrices(0, "VIP")).to.equal(vipPrice);
    expect(await rexell.seatCategoryPrices(0, "Premium")).to.equal(premiumPrice);

    const nftUris = ["QmTicketVip", "QmTicketPremium"];
    const seatLabels = ["L-1", "K-12"];
    const categories = ["VIP", "Premium"];

    const att = await getAttestation(buyer1.address, 10);
    const buyTx = await rexell.connect(buyer1)["buyTickets(uint256,string[],string[],string[],(address,uint256,uint256,uint256,bytes[]))"](
      0,
      nftUris,
      seatLabels,
      categories,
      att
    );
    await buyTx.wait();

    expect(await rexell.seatOwners(0, "L-1")).to.equal(buyer1.address);
    expect(await rexell.seatOwners(0, "K-12")).to.equal(buyer1.address);

    const escrowBal = await rexell.eventEscrow(0);
    expect(escrowBal).to.equal(hre.ethers.parseEther("8"));
  });

  it("Should prevent race conditions via on-chain lockSeats and enforce validation in buyTickets", async function () {
    const eventDate = await getFutureEventDate();
    const price = hre.ethers.parseEther("1");
    await rexell.connect(organizer).createEvent(
      "Test Event 2",
      "Venue 2",
      "Theatre",
      eventDate,
      "20:00",
      price,
      "QmHash2",
      10,
      "Desc"
    );

    await rexell.connect(buyer1).lockSeats(0, ["K-10"]);

    const lockInfo = await rexell.seatLocks(0, "K-10");
    expect(lockInfo.lockedBy).to.equal(buyer1.address);

    try {
      await rexell.connect(buyer2).lockSeats(0, ["K-10"]);
      expect.fail("Should have reverted");
    } catch (e: any) {
      expect(e.message).to.include("Seat locked by another user");
    }

    try {
      const att2 = await getAttestation(buyer2.address, 10);
      await rexell.connect(buyer2)["buyTickets(uint256,string[],string[],string[],(address,uint256,uint256,uint256,bytes[]))"](
        0,
        ["QmUr2"],
        ["K-10"],
        ["Premium"],
        att2
      );
      expect.fail("Should have reverted");
    } catch (e: any) {
      expect(e.message).to.include("Seat locked by another user");
    }

    const att1 = await getAttestation(buyer1.address, 10);
    await rexell.connect(buyer1)["buyTickets(uint256,string[],string[],string[],(address,uint256,uint256,uint256,bytes[]))"](
      0,
      ["QmUri1"],
      ["K-10"],
      ["Premium"],
      att1
    );

    const clearedLock = await rexell.seatLocks(0, "K-10");
    expect(clearedLock.lockedBy).to.equal(hre.ethers.ZeroAddress);
    expect(await rexell.seatOwners(0, "K-10")).to.equal(buyer1.address);
  });
});
