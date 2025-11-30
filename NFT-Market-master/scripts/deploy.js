const hre = require("hardhat");
// const fs = require("fs");
// const path = require("path");
//
// NOTE: 原项目前端在 frontend/src/App.js，这里有自动写入地址的逻辑。
// 当前使用的前端为 frontend-lumina-nft-market，此功能暂不需要，统一注释掉。
//
// function updateFrontendConfig(
//   chkdAddress,
//   nftAddress,
//   marketAddress,
//   auctionAddress,
//   adminAddress,
//   sellerAddress
// ) {
//   const appPath = path.join(
//     __dirname,
//     "..",
//     "..",
//     "frontend",
//     "src",
//     "App.js"
//   );
//
//   try {
//     let content = fs.readFileSync(appPath, "utf8");
//
//     const replacements = [
//       { key: "CHKD_ADDRESS", value: chkdAddress },
//       { key: "NFT_ADDRESS", value: nftAddress },
//       { key: "MARKET_ADDRESS", value: marketAddress },
//       { key: "AUCTION_ADDRESS", value: auctionAddress },
//       { key: "ADMIN_ADDRESS", value: adminAddress },
//       { key: "SELLER_ADDRESS", value: sellerAddress },
//     ];
//
//     replacements.forEach(({ key, value }) => {
//       const re = new RegExp(`const ${key} = '.*?';`);
//       if (re.test(content)) {
//         content = content.replace(re, `const ${key} = '${value}';`);
//       } else {
//         console.warn(`[WARN] 未在 App.js 中找到 ${key} 常量，跳过更新`);
//       }
//     });
//
//     fs.writeFileSync(appPath, content, "utf8");
//     console.log("\n✨ 已自动更新前端 src/App.js 中的合约地址\n");
//   } catch (e) {
//     console.log("\n⚠️ 自动更新前端地址失败，请手动更新:", e.message);
//   }
// }

async function main() {
  console.log("========== NFT Market Deployment ==========\n");

  // 获取角色账户
  const [admin] = await hre.ethers.getSigners();
  console.log("Admin (deployer):", admin.address);

  const balance = await admin.provider.getBalance(admin.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // 获取网络信息
  const network = await admin.provider.getNetwork();
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})\n`);

  // ===== 1. 部署代币合约 (cHKD) =====
  console.log("1️⃣  Deploying cHKD token...");
  const cHKD = await hre.ethers.getContractFactory("cHKD");
  const chkd = await cHKD.deploy();
  await chkd.waitForDeployment();
  const chkdAddress = await chkd.getAddress();
  console.log("✅ cHKD deployed to:", chkdAddress);
  console.log("   - 初始供应: 1,000,000 cHKD");
  console.log("   - 小数位: 6 (对标港币)");
  console.log("   - Faucet每次领取: 1,000 cHKD");
  console.log("   - Faucet冷却时间: 24小时\n");

  // 为当前网络配置预言机
  let priceFeedAddress = null;
  if (network.chainId === 31337n) {
    console.log("   Deploying MockPriceFeed for local testing...");
    const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");
    // 假设 1 ETH = 10000 HKD，预言机精度 2 位小数
    const initialPrice = hre.ethers.parseUnits("10000", 2); // 10000.00
    const mockFeed = await MockPriceFeed.deploy(initialPrice, 2);
    await mockFeed.waitForDeployment();
    priceFeedAddress = await mockFeed.getAddress();
    console.log("   ✓ MockPriceFeed deployed to:", priceFeedAddress);
  } else if (network.chainId === 11155111n) {
    // Sepolia：使用 Chainlink ETH/USD 预言机地址作为示例
    priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
    console.log("   Using Sepolia ETH/USD feed at:", priceFeedAddress);
  }

  if (priceFeedAddress) {
    const tx = await chkd.setEthHkdPriceFeed(priceFeedAddress);
    await tx.wait();
    console.log("   ✓ Price feed configured:", priceFeedAddress, "\n");
  } else {
    console.log("   ⚠️ 未配置预言机地址，请稍后手动调用 setEthHkdPriceFeed\n");
  }

  // ===== 2. 部署NFT合约 =====
  console.log("2️⃣  Deploying MyNFT...");
  const MyNFT = await hre.ethers.getContractFactory("MyNFT");
  const mynft = await MyNFT.deploy();
  await mynft.waitForDeployment();
  const nftAddress = await mynft.getAddress();
  console.log("✅ MyNFT deployed to:", nftAddress);
  console.log("   - 名称: MyNFT");
  console.log("   - 符号: NFT\n");

  // 启用公开铸造，方便任意用户通过前端 mint
  const enablePublicMintTx = await mynft.setPublicMintEnabled(true);
  await enablePublicMintTx.wait();
  console.log("   ✓ Public mint enabled in MyNFT\n");

  // ===== 3. 部署Market合约 =====
  console.log("3️⃣  Deploying Market...");
  const Market = await hre.ethers.getContractFactory("Market");
  const market = await Market.deploy(chkdAddress, nftAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("✅ Market deployed to:", marketAddress, "\n");

  // ===== 4. 部署 Auction 合约 =====
  console.log("4️⃣  Deploying Auction...");
  const Auction = await hre.ethers.getContractFactory("Auction");
  const auction = await Auction.deploy(chkdAddress, nftAddress);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("✅ Auction deployed to:", auctionAddress, "\n");

  // ===== 5. 配置合约 =====
  console.log("5️⃣  Configuring contracts...");

  // 在NFT中设置Market地址
  const setMarketTx = await mynft.setMarket(marketAddress);
  await setMarketTx.wait();
  console.log("   ✓ Market address set in MyNFT");

  // 本地测试可以直接用 Faucet 和公开铸造，无需额外为角色预铸代币 / NFT。
  // 如需为部署账户预铸一些 cHKD 或 NFT，可在此处按需添加：
  //
  // const amountAdmin = hre.ethers.parseUnits("10000", 6);
  // await (await chkd.mint(admin.address, amountAdmin)).wait();
  // console.log("   ✓ Admin received 10,000 cHKD\n");
  //
  // const demoUri = "http://localhost:3000/metadata/demo.json";
  // await (await mynft.safeMint(admin.address, demoUri)).wait();
  // console.log("   ✓ Demo NFT minted to admin with URI:", demoUri, "\n");

  // ===== 6. 打印摘要 =====
  console.log("========== 部署完成 ==========");
  console.log("\n📋 合约地址信息:");
  console.log("   cHKD Token:", chkdAddress);
  console.log("   MyNFT:      ", nftAddress);
  console.log("   Market:     ", marketAddress);
  console.log("   Auction:    ", auctionAddress);
  console.log("\n👤 角色地址信息 (用于本地演示):");
  console.log("   Admin / Owner:", admin.address);
  console.log("   其他用户:      任何地址都可使用 Faucet 和 public mint 参与\n");

  // 自动写入旧版前端地址的逻辑已注释，如需恢复可取消上方 updateFrontendConfig 注释。
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
