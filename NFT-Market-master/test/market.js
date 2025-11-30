const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market", function () {
  let deployer, seller, buyer;
  let chkd, nft, market;

  beforeEach(async () => {
    [deployer, seller, buyer] = await ethers.getSigners();

    const CHKD = await ethers.getContractFactory("cHKD", deployer);
    chkd = await CHKD.deploy();
    await chkd.waitForDeployment();

    const MyNFT = await ethers.getContractFactory("MyNFT", deployer);
    nft = await MyNFT.deploy();
    await nft.waitForDeployment();

    const Market = await ethers.getContractFactory("Market", deployer);
    market = await Market.deploy(await chkd.getAddress(), await nft.getAddress());
    await market.waitForDeployment();

    // 准备：seller 拥有一个 NFT，buyer 拥有一些 cHKD
    await (await nft.safeMint(seller.address, "http://localhost:3000/metadata/demo.json")).wait();

    const buyerAmount = ethers.parseUnits("1000", 6);
    await (await chkd.mint(buyer.address, buyerAmount)).wait();
  });

  it("stores correct ERC20 and ERC721 addresses", async function () {
    expect(await market.erc20()).to.equal(await chkd.getAddress());
    expect(await market.erc721()).to.equal(await nft.getAddress());
  });

  it("seller can list NFT and non-owner cannot", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("100", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await expect(
      market.connect(seller).list(tokenId, price)
    ).to.emit(market, "NewOrder");

    const order = await market.orderOfId(tokenId);
    expect(order.seller).to.equal(seller.address);
    expect(order.price).to.equal(price);
    expect(await market.isListed(tokenId)).to.equal(true);

    // 非 owner 不能上架
    await expect(
      market.connect(buyer).list(tokenId, price)
    ).to.be.revertedWith("Market: Sender is not the owner");
  });

  it("reverts when listing with zero price", async function () {
    const tokenId = 0n;
    const zeroPrice = 0n;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await expect(
      market.connect(seller).list(tokenId, zeroPrice)
    ).to.be.revertedWith("Market: Price must be greater than zero");
  });

  it("buyer can buy a listed NFT", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("200", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).list(tokenId, price);

    const sellerBalanceBefore = await chkd.balanceOf(seller.address);
    const buyerBalanceBefore = await chkd.balanceOf(buyer.address);

    await chkd.connect(buyer).approve(await market.getAddress(), price);

    await expect(
      market.connect(buyer).buy(tokenId)
    ).to.emit(market, "Deal");

    // NFT 所有权转移
    expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

    const sellerBalanceAfter = await chkd.balanceOf(seller.address);
    const buyerBalanceAfter = await chkd.balanceOf(buyer.address);

    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(price);
    expect(buyerBalanceBefore - buyerBalanceAfter).to.equal(price);

    // 订单应被移除
    expect(await market.isListed(tokenId)).to.equal(false);
    expect(await market.getOrderLength()).to.equal(0);
  });

  it("reverts when buying without sufficient allowance", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("200", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).list(tokenId, price);

    // 不设置或设置不足的 allowance
    const insufficient = ethers.parseUnits("50", 6);
    await chkd.connect(buyer).approve(await market.getAddress(), insufficient);

    await expect(
      market.connect(buyer).buy(tokenId)
    ).to.be.reverted;
  });

  it("reverts when buying an already sold NFT", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("200", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).list(tokenId, price);

    await chkd.connect(buyer).approve(await market.getAddress(), price);
    await market.connect(buyer).buy(tokenId);

    // 再次购买应失败，因为已不在列表
    await expect(
      market.connect(buyer).buy(tokenId)
    ).to.be.revertedWith("Market: Token ID is not listed");
  });

  it("seller can cancel listing but others cannot", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("150", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).list(tokenId, price);

    // 非 seller 取消失败
    await expect(
      market.connect(buyer).cancelOrder(tokenId)
    ).to.be.revertedWith("Market: Sender is not seller");

    await expect(
      market.connect(seller).cancelOrder(tokenId)
    ).to.emit(market, "CancelOrder");

    expect(await market.isListed(tokenId)).to.equal(false);
  });

  it("seller can change price of listed NFT", async function () {
    const tokenId = 0n;
    const price = ethers.parseUnits("100", 6);
    const newPrice = ethers.parseUnits("180", 6);

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).list(tokenId, price);

    await expect(
      market.connect(seller).changePrice(tokenId, newPrice)
    ).to.emit(market, "ChangePrice");

    const order = await market.orderOfId(tokenId);
    expect(order.price).to.equal(newPrice);
  });
});
