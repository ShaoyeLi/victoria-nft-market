const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("cHKD (ERC20 Stablecoin)", function () {
  let deployer, user, other;
  let chkd, mockFeed;

  beforeEach(async function () {
    [deployer, user, other] = await ethers.getSigners();

    const CHKD = await ethers.getContractFactory("cHKD", deployer);
    chkd = await CHKD.deploy();
    await chkd.waitForDeployment();

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed", deployer);
    // 1 ETH = 10,000 HKD, feed decimals = 2
    const initialPrice = ethers.parseUnits("10000", 2);
    mockFeed = await MockPriceFeed.deploy(initialPrice, 2);
    await mockFeed.waitForDeployment();

    await (await chkd.setEthHkdPriceFeed(await mockFeed.getAddress())).wait();
  });

  it("has correct metadata and decimals", async function () {
    expect(await chkd.name()).to.equal("HKD Coin");
    expect(await chkd.symbol()).to.equal("cHKD");
    expect(await chkd.decimals()).to.equal(6);
  });

  it("only owner can mint", async function () {
    const amount = ethers.parseUnits("1000", 6);
    await expect(chkd.mint(user.address, amount))
      .to.emit(chkd, "Transfer")
      .withArgs(ethers.ZeroAddress, user.address, amount);

    await expect(
      chkd.connect(user).mint(user.address, amount)
    ).to.be.revertedWithCustomError(chkd, "OwnableUnauthorizedAccount");
  });

  it("allows claiming faucet with cooldown and sufficient balance", async function () {
    const faucetAmount = await chkd.FAUCET_AMOUNT();
    const faucetBalanceBefore = await chkd.balanceOf(await chkd.getAddress());

    await expect(chkd.connect(user).claimFaucet())
      .to.emit(chkd, "FaucetClaimed")
      .withArgs(user.address, faucetAmount);

    const userBal = await chkd.balanceOf(user.address);
    expect(userBal).to.equal(faucetAmount);

    const faucetBalanceAfter = await chkd.balanceOf(await chkd.getAddress());
    expect(faucetBalanceBefore - faucetBalanceAfter).to.equal(faucetAmount);

    // 再次领取应因冷却时间未到而失败
    await expect(
      chkd.connect(user).claimFaucet()
    ).to.be.revertedWith("cHKD: Faucet cooldown not reached");
  });

  it("allows transfers and approvals like standard ERC20", async function () {
    const amount = ethers.parseUnits("500", 6);
    await (await chkd.mint(user.address, amount)).wait();

    // 直接转账
    await expect(
      chkd.connect(user).transfer(other.address, amount)
    ).to.emit(chkd, "Transfer");

    // 授权 + transferFrom
    const amount2 = ethers.parseUnits("100", 6);
    await (await chkd.mint(user.address, amount2)).wait();

    await (await chkd.connect(user).approve(other.address, amount2)).wait();
    await expect(
      chkd.connect(other).transferFrom(user.address, other.address, amount2)
    ).to.emit(chkd, "Transfer");
  });

  it("mints correct amount when buying with ETH via oracle", async function () {
    const decimals = await chkd.decimals(); // 6
    const feedDecimals = await mockFeed.decimals(); // 2

    const ethIn = ethers.parseEther("1"); // 1 ETH
    const tx = await chkd.connect(user).buyWithETH({ value: ethIn });
    await tx.wait();

    const userBal = await chkd.balanceOf(user.address);

    // 理论值：amountOut = ethIn * price * 10^decimals / (10^18 * 10^feedDecimals)
    const price = await mockFeed.latestRoundData().then(([, answer]) => answer);
    const numerator = ethIn * price * BigInt(10) ** BigInt(decimals);
    const denominator = (BigInt(10) ** 18n) * (BigInt(10) ** BigInt(feedDecimals));
    const expected = numerator / denominator;

    expect(userBal).to.equal(expected);
  });
});

