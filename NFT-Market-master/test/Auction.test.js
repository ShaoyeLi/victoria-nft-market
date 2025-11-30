const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction", function () {
  let deployer, seller, bidder1, bidder2;
  let chkd, nft, auction;

  beforeEach(async function () {
    [deployer, seller, bidder1, bidder2] = await ethers.getSigners();

    const CHKD = await ethers.getContractFactory("cHKD", deployer);
    chkd = await CHKD.deploy();
    await chkd.waitForDeployment();

    const MyNFT = await ethers.getContractFactory("MyNFT", deployer);
    nft = await MyNFT.deploy();
    await nft.waitForDeployment();

    const Auction = await ethers.getContractFactory("Auction", deployer);
    auction = await Auction.deploy(await chkd.getAddress(), await nft.getAddress());
    await auction.waitForDeployment();

    // mint some cHKD to bidders
    const amount = ethers.parseUnits("10000", 6);
    await (await chkd.mint(bidder1.address, amount)).wait();
    await (await chkd.mint(bidder2.address, amount)).wait();

    // mint one NFT to seller
    await (await nft.safeMint(seller.address, "http://localhost:3000/metadata/demo.json")).wait();
  });

  it("seller can start auction and only owner can do so", async function () {
    // seller starts auction
    const tokenId = 0n;
    const startPrice = ethers.parseUnits("100", 6);
    const duration = 3600n;

    await nft.connect(seller).approve(await auction.getAddress(), tokenId);
    await expect(
      auction.connect(seller).startAuction(tokenId, startPrice, duration)
    ).to.emit(auction, "AuctionStarted");

    // non-owner cannot start auction
    await expect(
      auction.connect(bidder1).startAuction(tokenId, startPrice, duration)
    ).to.be.revertedWith("Auction: caller is not NFT owner");
  });

  it("allows bidding and tracks highest bid correctly", async function () {
    const tokenId = 0n;
    const startPrice = ethers.parseUnits("100", 6);
    const duration = 3600n;

    await nft.connect(seller).approve(await auction.getAddress(), tokenId);
    await auction.connect(seller).startAuction(tokenId, startPrice, duration);

    const bid1 = ethers.parseUnits("150", 6);
    await chkd.connect(bidder1).approve(await auction.getAddress(), bid1);
    await auction.connect(bidder1).bid(tokenId, bid1);

    const bid2 = ethers.parseUnits("200", 6);
    await chkd.connect(bidder2).approve(await auction.getAddress(), bid2);
    await auction.connect(bidder2).bid(tokenId, bid2);

    const info = await auction.auctionOfId(tokenId);
    expect(info.highestBidder).to.equal(bidder2.address);
    expect(info.highestBid).to.equal(bid2);
  });

  it("seller can cancel auction only when no bids", async function () {
    const tokenId = 0n;
    const startPrice = ethers.parseUnits("100", 6);
    const duration = 3600n;

    await nft.connect(seller).approve(await auction.getAddress(), tokenId);
    await auction.connect(seller).startAuction(tokenId, startPrice, duration);

    // cancel with no bids
    await expect(
      auction.connect(seller).cancelAuction(tokenId)
    ).to.emit(auction, "AuctionCancelled");

    // restart auction and place a bid
    await nft.connect(seller).approve(await auction.getAddress(), tokenId);
    await auction.connect(seller).startAuction(tokenId, startPrice, duration);

    const bid = ethers.parseUnits("150", 6);
    await chkd.connect(bidder1).approve(await auction.getAddress(), bid);
    await auction.connect(bidder1).bid(tokenId, bid);

    await expect(
      auction.connect(seller).cancelAuction(tokenId)
    ).to.be.revertedWith("Auction: cannot cancel with bids");
  });

  it("only seller can settle, and can settle at any time", async function () {
    const tokenId = 0n;
    const startPrice = ethers.parseUnits("100", 6);
    const duration = 3600n;

    await nft.connect(seller).approve(await auction.getAddress(), tokenId);
    await auction.connect(seller).startAuction(tokenId, startPrice, duration);

    const bid = ethers.parseUnits("200", 6);
    await chkd.connect(bidder1).approve(await auction.getAddress(), bid);
    await auction.connect(bidder1).bid(tokenId, bid);

    // non-seller cannot settle
    await expect(
      auction.connect(bidder1).settle(tokenId)
    ).to.be.revertedWith("Auction: caller is not seller");

    // seller can settle immediately (before endTime) for testing convenience
    const sellerBalanceBefore = await chkd.balanceOf(seller.address);
    await expect(
      auction.connect(seller).settle(tokenId)
    ).to.emit(auction, "AuctionSettled");

    const sellerBalanceAfter = await chkd.balanceOf(seller.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(bid);

    // NFT ownership transferred to bidder1
    const newOwner = await nft.ownerOf(tokenId);
    expect(newOwner).to.equal(bidder1.address);
  });
});

