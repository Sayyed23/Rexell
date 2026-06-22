import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("SoulboundIdentity", function () {
  async function deployIdentityFixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();
    const SoulboundIdentity = await hre.ethers.getContractFactory("SoulboundIdentity");
    const identity = await SoulboundIdentity.deploy() as any;
    await identity.waitForDeployment();
    return { identity, owner, user1, user2 };
  }

  describe("Minting", function () {
    it("Should allow owner to mint identity with a valid score", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      const mintTx = await identity.connect(owner).mintIdentity(user1.address, 85);
      await mintTx.wait();

      const details = await identity.getIdentityDetails(user1.address);
      expect(details.tokenId).to.equal(1n);
      expect(details.score).to.equal(85n);
      expect(details.timestamp > 0n).to.be.true;
      
      expect(await identity.hasValidIdentity(user1.address)).to.be.true;
    });

    it("Should prevent non-owners from minting", async function () {
      const { identity, user1, user2 } = await deployIdentityFixture();
      
      await expect(
        identity.connect(user1).mintIdentity(user2.address, 90)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent duplicate identity mints for the same user", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 75);
      
      await expect(
        identity.connect(owner).mintIdentity(user1.address, 80)
      ).to.be.revertedWith("User already has an identity");
    });

    it("Should reject scores greater than 100", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      await expect(
        identity.connect(owner).mintIdentity(user1.address, 101)
      ).to.be.revertedWith("Score must be between 0 and 100");
    });
  });

  describe("Score Updates", function () {
    it("Should allow owner to update scores", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 50);
      expect(await identity.hasValidIdentity(user1.address)).to.be.false;

      const updateTx = await identity.connect(owner).updateScore(user1.address, 95);
      await updateTx.wait();

      const details = await identity.getIdentityDetails(user1.address);
      expect(details.score).to.equal(95n);
      expect(await identity.hasValidIdentity(user1.address)).to.be.true;
    });

    it("Should reject score updates by non-owners", async function () {
      const { identity, owner, user1, user2 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 80);
      
      await expect(
        identity.connect(user2).updateScore(user1.address, 90)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject score updates for users without an identity", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      await expect(
        identity.connect(owner).updateScore(user1.address, 90)
      ).to.be.revertedWith("User has no identity");
    });
  });

  describe("Burning", function () {
    it("Should allow owner to burn identity", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 80);
      expect(await identity.balanceOf(user1.address)).to.equal(1n);

      const burnTx = await identity.connect(owner).burnIdentity(user1.address);
      await burnTx.wait();

      expect(await identity.balanceOf(user1.address)).to.equal(0n);
      expect(await identity.hasValidIdentity(user1.address)).to.be.false;

      // Ensure user can mint again after burn
      await expect(identity.connect(owner).mintIdentity(user1.address, 90)).to.not.be.reverted;
    });

    it("Should reject burn requests from non-owners", async function () {
      const { identity, owner, user1, user2 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 80);
      
      await expect(
        identity.connect(user2).burnIdentity(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("KYC Gate (hasValidIdentity)", function () {
    it("Should return false for non-identity holders", async function () {
      const { identity, user1 } = await deployIdentityFixture();
      expect(await identity.hasValidIdentity(user1.address)).to.be.false;
    });

    it("Should return false for score < 70", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      await identity.connect(owner).mintIdentity(user1.address, 69);
      expect(await identity.hasValidIdentity(user1.address)).to.be.false;
    });

    it("Should return true for score >= 70", async function () {
      const { identity, owner, user1 } = await deployIdentityFixture();
      await identity.connect(owner).mintIdentity(user1.address, 70);
      expect(await identity.hasValidIdentity(user1.address)).to.be.true;
    });
  });

  describe("Soulbound Properties", function () {
    it("Should prevent users from transferring their identity NFT", async function () {
      const { identity, owner, user1, user2 } = await deployIdentityFixture();
      
      await identity.connect(owner).mintIdentity(user1.address, 85);
      
      // Standard ERC721 transfers
      await expect(
        identity.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Transfer not allowed");

      await expect(
        identity.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Transfer not allowed");
    });
  });
});
