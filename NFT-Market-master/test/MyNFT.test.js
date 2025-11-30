const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT (ERC721)", function () {
  let deployer, user;
  let nft;

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    const MyNFT = await ethers.getContractFactory("MyNFT", deployer);
    nft = await MyNFT.deploy();
    await nft.waitForDeployment();
  });

  it("has correct name and symbol", async function () {
    expect(await nft.name()).to.equal("MyNFT");
    expect(await nft.symbol()).to.equal("NFT");
  });

  it("only owner can safeMint", async function () {
    const uri = "http://localhost:3000/metadata/demo.json";

    await expect(
      nft.safeMint(user.address, uri)
    ).to.emit(nft, "Transfer");

    await expect(
      nft.connect(user).safeMint(user.address, uri)
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
  });

  it("sets and returns correct tokenURI", async function () {
    const uri = "http://localhost:3000/metadata/demo.json";
    await (await nft.safeMint(user.address, uri)).wait();

    const tokenId = 0n;
    expect(await nft.tokenURI(tokenId)).to.equal(uri);
  });

  it("supports publicMint when enabled", async function () {
    const uri = "http://localhost:3000/metadata/demo.json";

    // 默认 publicMint 禁用
    await expect(
      nft.connect(user).publicMint(uri)
    ).to.be.revertedWith("MyNFT: Public mint is disabled");

    await (await nft.setPublicMintEnabled(true)).wait();
    const tx = await nft.connect(user).publicMint(uri);
    const receipt = await tx.wait();

    // 检查余额和 tokenURI
    const balance = await nft.balanceOf(user.address);
    expect(balance).to.equal(1n);

    const tokenId = 0n;
    expect(await nft.tokenURI(tokenId)).to.equal(uri);
  });
});

