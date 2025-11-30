# Victoria NFT Market – 项目总览

> 基于自定义稳定币 cHKD 的本地 NFT 市场与拍卖系统  
> 包含：智能合约（Hardhat）、前端 DApp（React + Vite）、本地预言机、示例元数据

---

## 1. 整体架构

**目标：** 提供一个完整的、可本地演示的 NFT 生态：

- 自定义稳定币 `cHKD`（模拟港币，6 位小数），支持 Faucet 和按预言机价格用 ETH 兑换
- NFT 合约 `MyNFT`，支持公开铸造，通过 `tokenURI` 绑定链下元数据
- 固定价格市场 `Market`：上架、购买、改价、下架 NFT
- 拍卖合约 `Auction`：英文拍卖（多轮出价、退款、结算），使用 cHKD 作为出价代币
- 前端 DApp：Dashboard + Market + Auctions + Bank 四大视图，将上述功能可视化

整体堆栈：

- Solidity 0.8.20 + Hardhat
- OpenZeppelin 合约库
- React + TypeScript + Vite
- ethers.js v6 + MetaMask

目录结构（根目录）：

- `NFT-Market-master/`：Hardhat 项目，包含所有合约、部署脚本、测试
- `frontend-lumina-nft-market/`：前端 DApp

---

## 2. 合约与后端（NFT-Market-master）

### 2.1 目录结构

- `contracts/`
  - `cHKD.sol`：ERC20 稳定币（6 位小数，模拟港币），Faucet + 预言机兑换
  - `MyNFT.sol`：ERC721 NFT 合约，支持公开铸造 + `tokenURI`
  - `Market.sol`：固定价格 NFT 市场
  - `Auction.sol`：英文拍卖合约（使用 cHKD 出价）
  - `MockPriceFeed.sol`：本地 ETH/HKD 预言机 mock（模拟 Chainlink 接口）
  - `interfaces/AggregatorV3Interface.sol`：预言机接口（兼容 Chainlink V3）
- `scripts/deploy.js`：一键部署脚本（部署合约 + 配置预言机 + 准备示例数据）
- `test/`：cHKD / MyNFT / Market / Auction 的测试用例
- `hardhat.config.js`：Hardhat 配置（localhost + sepolia）
- `app.js`：Express 示例服务（目前用于演示，可扩展为后台 API）

### 2.2 cHKD.sol – 稳定币与预言机兑换

**特性：**

- 继承：`ERC20`, `ERC20Burnable`, `Ownable`
- 名称/符号：`HKD Coin` / `cHKD`
- 小数位：`decimals() = 6`（1 cHKD = 10^6 最小单位）

**核心状态：**

- Faucet：
  - `FAUCET_AMOUNT = 1000 * 10^6`（每次领取 1000 cHKD）
  - `FAUCET_COOLDOWN = 1 days`（每地址 24 小时一次）
  - `mapping(address => uint256) lastFaucetTime`
- 预言机：
  - `AggregatorV3Interface public ethHkdPriceFeed`：ETH/HKD 价格源地址

**主要接口：**

- `function claimFaucet() external returns (bool)`  
  领取 Faucet：检查冷却时间和合约余额，从合约地址向调用者转出 `FAUCET_AMOUNT`。

- `function setEthHkdPriceFeed(address _feed) external onlyOwner`  
  设置 ETH/HKD 预言机地址（部署脚本中调用）。

- `function buyWithETH() external payable returns (uint256)`  
  用 ETH 按预言机价格兑换 cHKD：
  1. 调用预言机 `latestRoundData()` 和 `decimals()` 拿到 1 ETH = X HKD * 10^`feedDecimals`
  2. 使用公式：
     ```text
     amountOut = msg.value * price * 10^tokenDecimals / (10^18 * 10^feedDecimals)
     ```
  3. 通过 `_mint(msg.sender, amountOut)` 向调用者铸造 cHKD

### 2.3 MockPriceFeed.sol 与 AggregatorV3Interface.sol

**AggregatorV3Interface.sol：**

- 仅为接口描述，不部署到链上  
- 定义：
  - `latestRoundData() external view returns (...)`
  - `decimals() external view returns (uint8)`

**MockPriceFeed.sol：**

- 本地预言机实现，构造时写死价格，用于演示：
  - 构造参数：
    - `initialPrice`：如 `parseUnits("10000", 2)` 表示 1 ETH = 10000.00 HKD
    - `decimals`：如 `2`
- `latestRoundData()` 返回 `answer = initialPrice`
- `decimals()` 返回构造时设置的精度

### 2.4 MyNFT.sol – NFT 合约

**基类：** `ERC721`, `ERC721Enumerable`, `ERC721URIStorage`, `Ownable`

**状态：**

- `uint256 private _nextTokenId`：自增 tokenId
- `bool public publicMintEnabled`：公开铸造开关
- `address public market`：Market 合约地址

**主要接口：**

- `function safeMint(address to, string memory uri) public onlyOwner`  
  Owner 铸造 NFT，设置 `tokenURI = uri`（部署脚本用于创建示例 NFT）。

- `function publicMint(string memory uri) public returns (uint256)`  
  公开铸造接口：
  - 要求 `publicMintEnabled == true`
  - 使用 `_nextTokenId++` 生成新的 tokenId
  - 将 NFT 铸造给 `msg.sender`，并设置 `tokenURI`

- `function setPublicMintEnabled(bool enabled) public onlyOwner`  
  切换公开铸造开关。

- `function setMarket(address _market) public onlyOwner`  
  配置 Market 合约地址。

### 2.5 Market.sol – 固定价格市场

**依赖：**

- `IERC20 public erc20`：cHKD 地址
- `IERC721 public erc721`：MyNFT 地址

**数据结构：**

- `struct Order { address seller; uint256 tokenId; uint256 price; }`
- `mapping(uint256 => Order) public orderOfId;`
- `Order[] public orders;`
- `mapping(uint256 => uint256) public idToOrderIndex;`（用于 O(1) 删除）

**核心流程：**

- 上架 `list(uint256 tokenId, uint256 price)`：
  - 检查 price > 0，token 未上架，调用者为 NFT owner
  - 前端需先执行 `nft.approve(MARKET, tokenId)`
  - 合约调用 `safeTransferFrom(msg.sender, address(this), tokenId, abi.encode(price))`
  - 在 `onERC721Received` 中解析价格并记录订单

- 购买 `buy(uint256 tokenId)`：
  - 前端先 `chkd.approve(MARKET, price)`
  - `erc20.transferFrom(buyer, seller, price)` 完成付款
  - `erc721.safeTransferFrom(address(this), buyer, tokenId)` 将 NFT 转给买家
  - 删除订单结构

- 其他：
  - `cancelOrder(tokenId)`：只有 seller 可以取消，上架时托管的 NFT 退回给 seller
  - `changePrice(tokenId, price)`：修改订单价格
  - `getAllNFTs()`：返回所有订单（前端用于 Market 列表）

### 2.6 Auction.sol – 拍卖市场

**依赖：**

- `IERC20 public erc20`：cHKD
- `IERC721 public erc721`：MyNFT
- `ReentrancyGuard`：防重入

**数据结构：**

- `struct AuctionInfo { address seller; uint256 tokenId; uint256 startPrice; uint256 highestBid; address highestBidder; uint64 endTime; }`
- `mapping(uint256 => AuctionInfo) public auctionOfId;`
- `AuctionInfo[] public auctions;`
- `mapping(uint256 => uint256) public idToAuctionIndex;`

**核心流程：**

- 发起拍卖 `startAuction(tokenId, startPrice, duration)`：
  - 检查 caller 是 NFT owner、起拍价 > 0、duration > 0
  - 前端需先 `nft.approve(AUCTION, tokenId)`
  - 合约托管 NFT 到自身地址，并记录拍卖信息（包含结束时间）

- 出价 `bid(tokenId, amount)`：
  - 检查拍卖存在、未结束、出价不低于起拍价且高于当前最高出价
  - 前端先 `chkd.approve(AUCTION, amount)`
  - 合约 `erc20.transferFrom(bidder, address(this), amount)` 扣款
  - 若已有最高出价者，则退还其 `highestBid`
  - 更新 `highestBid` 和 `highestBidder`

- 结算 `settle(tokenId)`：
  - 仅 seller 可调用
  - 若有有效最高出价：
    - 将 NFT 转给 `highestBidder`
    - 将 cHKD 转给 seller
  - 若无人出价，NFT 退还给 seller
  - 删除拍卖记录

---

## 3. 部署脚本（scripts/deploy.js）

部署脚本完成以下工作：

1. 获取部署账户：`[admin] = await hre.ethers.getSigners()`，该地址同时作为 cHKD 和 MyNFT 的 `owner`（管理员）。
2. 部署 cHKD，并根据网络配置预言机：
   - 本地网络（`chainId === 31337`）：
     ```js
     const initialPrice = hre.ethers.parseUnits("10000", 2); // 10000.00
     const mockFeed = await MockPriceFeed.deploy(initialPrice, 2);
     await chkd.setEthHkdPriceFeed(await mockFeed.getAddress());
     ```
     即：本地使用 `MockPriceFeed` 写死 1 ETH ≈ 10000“HKD” 的汇率，仅用于演示。
   - Sepolia 测试网（`chainId === 11155111`）：
     ```js
     const priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
     await chkd.setEthHkdPriceFeed(priceFeedAddress);
     ```
     即：在 Sepolia 上，`buyWithETH()` 会调用 **Chainlink ETH/USD 预言机**，按实时 ETH/USD 价格计算兑换数量（命名仍沿用 `ethHkdPriceFeed`，实际数值为美元价）。
3. 部署 MyNFT，并启用公开铸造：
   ```js
   const mynft = await MyNFT.deploy();
   await mynft.setPublicMintEnabled(true);
   ```
4. 部署 Market 和 Auction，并在 MyNFT 中设置 Market 地址：
   ```js
   const market = await Market.deploy(chkdAddress, nftAddress);
   const auction = await Auction.deploy(chkdAddress, nftAddress);
   await mynft.setMarket(marketAddress);
   ```
5. 输出合约地址与管理员地址，**不再预铸任何 cHKD 或 NFT**。测试/演示时，所有普通用户通过：
   - `cHKD.claimFaucet()` 领取测试币；
   - `MyNFT.publicMint(uri)` 铸造 NFT。

---

## 4. 前端 DApp（frontend-lumina-nft-market）

### 4.1 技术栈与入口

- React + TypeScript
- Vite 开发服务器（默认端口通常为 3000）
- ethers.js v6

关键文件：

- `index.tsx`：前端入口（渲染 `<App />`）
- `App.tsx`：主界面组件，负责视图切换、状态管理、交易调用
- `services/blockchain.ts`：封装与合约的全部交互（`BlockchainService`）
- `constants.ts`：合约地址常量 + ABI
- `components/AssetCard.tsx`：NFT 展示卡片
- `public/metadata/demo.json`：本地 NFT 元数据示例

### 4.2 BlockchainService – 合约交互封装

`services/blockchain.ts` 中定义：

- 构造函数：
  - 使用 `ADDRESSES` 和 ABI 创建：
    - `chkd`（cHKD 合约实例）
    - `nft`（MyNFT）
    - `market`（Market）
    - `auction`（Auction）

- 只读函数：
  - `getBalance(address)`：cHKD 余额
  - `getMyNFTs(address)`：遍历持有 NFT，调用 `tokenURI` 并 `fetchMetadata`
  - `getMarketListings()`：拉取所有订单 + metadata
  - `getAuctions()`：拉取所有拍卖 + metadata

- 交易函数：
  - `faucet()`：调用 `cHKD.claimFaucet()`
  - `buyCHKD(ethAmount)`：调用 `cHKD.buyWithETH({ value })`
  - `mint(uri)`：调用 `nft.publicMint(uri)`
  - `listNFT(tokenId, price)`：`approve` → `market.list`
  - `buyNFT(tokenId, priceRaw)`：`approve` → `market.buy`
  - `startAuction` / `bid` / `settleAuction` / `cancelAuction`

### 4.3 App.tsx – 视图与状态

`App.tsx` 负责：

- 连接钱包：
  - 使用 `ethers.BrowserProvider(window.ethereum)` 与 MetaMask 交互
  - 限制网络为 Hardhat Localhost (31337) 或 Sepolia
- 全局状态：
  - 当前账号 `account`
  - cHKD 余额 `balance`
  - 我的 NFT `myNFTs`
  - 市场订单 `marketOrders`
  - 拍卖列表 `auctions`
  - 当前视图 `viewMode`（Dashboard / Market / Auctions / Bank）
  - 交易状态提示 `txState`
  - 表单：`mintUri` / `listPrice` / `auctionStartPrice` / `auctionDuration` / `bidAmount` / `ethToSwap`

视图：

- Dashboard：
  - 展示当前地址持有的 NFT
  - “Mint New Asset” 字段默认值为 `http://localhost:3000/metadata/demo.json`
  - 每个 NFT 可以快速上架固定价或发起拍卖

- Market：
  - 显示所有固定价订单（图片、名称、卖家、价格）
  - 点击 `Buy` 调用 `buyNFT`

- Auctions：
  - 显示所有拍卖（起拍价、最高价、倒计时）
  - 买家可出价，卖家可取消或结算

- Bank：
  - Faucet：调用 `faucet()` 领取 1000 cHKD
  - Oracle Swap：输入 ETH 数量，调用 `buyCHKD()`，使用 Mock 预言机价格兑换 cHKD

### 4.4 元数据与图片

- 元数据示例：`public/metadata/demo.json`
  - 包含 `name`、`description`、`image`、`attributes` 等字段
  - `image` 指向 `public/metadata/images/IMG_4462.jpg`
- 铸造时只需将 `mintUri` 设置为 `http://localhost:3000/metadata/demo.json`，即可得到展示该图片的 NFT。

---

## 5. 本地运行步骤

### 5.1 安装依赖

```bash
# 合约项目
cd NFT-Market-master
npm install

# 前端项目
cd ../frontend-lumina-nft-market
npm install
```

### 5.2 启动本地链并部署

```bash
# 终端 1：本地链
cd NFT-Market-master
npx hardhat node

# 终端 2：部署合约
cd NFT-Market-master
npx hardhat run scripts/deploy.js --network localhost
```

### 5.3 启动前端

```bash
cd ../frontend-lumina-nft-market
npm run dev
```

浏览器打开终端输出的本地地址（通常是 `http://localhost:3000`）。

---

## 6. 快速演示流程（供新同学/答辩使用）

1. 连接钱包（MetaMask 连接本地 Hardhat 网络）。
2. 在 Bank 页：
   - 使用 Faucet 领取 1000 cHKD
   - 使用 Oracle Swap 用 0.1 ETH 换取 cHKD，展示预言机价格生效
3. 在 Dashboard：
   - 使用默认 URI `http://localhost:3000/metadata/demo.json` 铸造 NFT
   - 展示 NFT 图片与元数据（说明 tokenURI 只存 URL）
4. 将 NFT 上架到 Market：
   - 设置固定价格，展示买家用 cHKD 购买后，NFT 所属地址与 cHKD 余额变化
5. 将另一个 NFT 发起拍卖：
   - 多个账号出价，展示出价更新和退款逻辑
   - 卖家结算拍卖，NFT 和 cHKD 完成最终结算

---

## 7. 如何开始修改/升级

### 7.1 修改预言机逻辑

- 更换汇率：修改 `scripts/deploy.js` 中 `initialPrice`，重新部署本地环境。
- 接入真实 Chainlink：在 sepolia 网络分支中设置真实预言机地址，并在前端 `ADDRESSES` 中更新合约地址。

### 7.2 扩展 NFT 元数据与展示

- 在 `public/metadata/` 添加更多 JSON 和图片
- 扩展 `NFTMetadata` 类型和 `AssetCard`，展示更多属性（例如稀有度、分类标签）

### 7.3 多币种支持

- 在 `Market.sol` / `Auction.sol` 中增加对多 `IERC20` 的支持（在订单/拍卖结构中增加支付代币字段）
- 前端增加代币选择器，并在 `BlockchainService` 中维护多个 token 合约实例

### 7.4 安全与权限增强

- 为 `Auction.settle` 增加 `endTime` 检查，严格要求结束前不可结算
- 引入角色控制（例如增加 Admin 合约，用于管理白名单、手续费等）
- 后端（`app.js`）可以扩展为 REST API，用于记录链上事件、统计数据、提供搜索功能

---

## 8. 推荐阅读顺序（给新接手的人）

1. 阅读本 `README.md`，了解整体架构
2. 进入 `NFT-Market-master/contracts/` 依次阅读：
   - `cHKD.sol` → `MyNFT.sol` → `Market.sol` → `Auction.sol`
3. 查看 `scripts/deploy.js`，理解一键部署和预言机配置
4. 打开前端项目：
   - `frontend-lumina-nft-market/constants.ts`
   - `frontend-lumina-nft-market/services/blockchain.ts`
   - `frontend-lumina-nft-market/App.tsx`
5. 按“本地运行步骤”启动项目，边看代码边操作 UI

照此流程，新同学一般在 1–2 小时内就能理解项目结构，并开始进行需求修改或功能扩展。 

---

## 9. 当前 Sepolia 部署信息（示例）

> 说明：以下为最近一次部署到 Sepolia 测试网的地址，仅供前端配置与调试使用。如重新部署，请以最新脚本输出为准，更新本节和 `frontend-lumina-nft-market/constants.ts`。

- **网络**：Sepolia (`chainId = 11155111`)
- **部署账户（Admin/Owner）**：`0xbf65460E1EA8269Ab61B7946b2B04D5A334E0642`
- **合约地址**（2025-xx-xx 部署）：
  - `cHKD`：`0x4ee7805D139c5D0e002a127c5EdC199f624e53e0`
  - `MyNFT`：`0xb91696c41e39C063987267BdD788FA83831EBD19`
  - `Market`：`0x5540BEf94300f50D787806750764d35ACcfB0FE9`
  - `Auction`：`0xe8F9921f69A31fCE64115C97447d43762d9939a7`
- **预言机（ETH/USD，Chainlink Sepolia）**：
  - `ethHkdPriceFeed` 实际指向：`0x694AA1769357215DE4FAC081bf1f309aDC325306`
  - `cHKD.buyWithETH()` 会读取该预言机的实时 ETH/USD 价格计算兑换数量。
