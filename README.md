# Victoria NFT Market – Overview

> Live demo (frontend on Vercel)  
> 👉 https://victoria-nft-market.vercel.app/  
>
> How to access:  
> - Use a desktop browser with the MetaMask extension  
> - Switch MetaMask network to **Sepolia** (ChainId = 11155111)  
> - Click “Connect MetaMask” in the header  
>
> Quick demo flow (for reviewers/teachers):  
> 1. Open the **Bank** tab  
>    - Click “Daily Faucet” to claim 1,000 cHKD  
>    - In “Oracle Swap”, input `0.1` ETH and swap to get cHKD at the oracle price  
> 2. Open **Dashboard**  
>    - Use the default metadata URL and click “Mint NFT” to create a demo NFT  
>    - See the new NFT card under “My Assets” (image + attributes)  
> 3. Open **Market**  
>    - From Dashboard, list one NFT with a fixed price  
>    - Switch to another wallet, go to Market, click `Buy` to purchase that NFT with cHKD  
> 4. Open **Auctions**  
>    - With any NFT‑owner wallet, start an auction from Dashboard  
>    - Use another wallet to place a bid, then let the seller settle and observe NFT / cHKD transfers  
>
> Current Sepolia contract addresses:  
>   - `cHKD`  – `0x4ee7805D139c5D0e002a127c5EdC199f624e53e0`  
>   - `MyNFT` – `0xb91696c41e39C063987267BdD788FA83831EBD19`  
>   - `Market` – `0x5540BEf94300f50D787806750764d35ACcfB0FE9`  
>   - `Auction` – `0xe8F9921f69A31fCE64115C97447d43762d9939a7`  
>
> For a full Chinese description, see `README.ch.md`.

---

## 1. Architecture

This project implements a small NFT marketplace and auction system on top of a custom stablecoin:

- **cHKD** – ERC20 “stablecoin” with 6 decimals, faucet, and oracle‑based ETH→cHKD swap  
- **MyNFT** – ERC721 NFT contract with public minting and `tokenURI` metadata  
- **Market** – fixed‑price NFT marketplace paid in cHKD  
- **Auction** – English auctions using cHKD bids  
- **Frontend DApp** – React + Vite SPA with four views:
  - Dashboard – my NFTs, mint, list/auction actions  
  - Market – fixed‑price listings  
  - Auctions – live auctions  
  - Bank – Faucet + ETH→cHKD swap

Tech stack:

- Solidity 0.8.20 + Hardhat + OpenZeppelin  
- React + TypeScript + Vite  
- ethers.js v6 + MetaMask

Repo layout:

- `NFT-Market-master/` – Hardhat contracts project (Solidity, scripts, tests)  
- `frontend-lumina-nft-market/` – frontend DApp

---

## 2. Contracts (NFT-Market-master)

### 2.1 cHKD.sol – stablecoin + oracle swap

- Inherits: `ERC20`, `ERC20Burnable`, `Ownable`  
- 6 decimals (1 cHKD = 10^6 units)  
- Faucet:
  - `FAUCET_AMOUNT = 1000 * 10^6`  
  - `FAUCET_COOLDOWN = 1 days`  
  - `claimFaucet()` enforces cooldown and sends tokens from the contract’s own balance

Oracle swap:

- `AggregatorV3Interface public ethHkdPriceFeed` stores the oracle address  
- `setEthHkdPriceFeed(address)` (only owner) configures the oracle  
- `buyWithETH()`:
  - Reads `answer` and `decimals` from `ethHkdPriceFeed` (Chainlink‑style feed)  
  - Treats `answer / 10^feedDecimals` as “1 ETH = X (fiat)”  
  - Computes the number of cHKD to mint:
    ```text
    amountOut = msg.value * price * 10^tokenDecimals / (10^18 * 10^feedDecimals)
    ```
  - Mints `amountOut` cHKD to the caller

> On localhost, the script uses a MockPriceFeed with a fixed price (1 ETH ≈ 10,000);  
> On Sepolia, it uses the Chainlink ETH/USD feed at `0x694AA1769357215DE4FAC081bf1f309aDC325306`.

### 2.2 MyNFT.sol – NFT contract

- Inherits: `ERC721`, `ERC721Enumerable`, `ERC721URIStorage`, `Ownable`  
- State:
  - `_nextTokenId` – incremental token ID  
  - `publicMintEnabled` – toggle for public minting  
  - `market` – Market contract address

Key functions:

- `safeMint(address to, string uri)` (only owner) – used in scripts for demo NFTs  
- `publicMint(string uri)` – mints to `msg.sender` and sets `tokenURI` (requires `publicMintEnabled`)  
- `setPublicMintEnabled(bool)` / `setMarket(address)`

### 2.3 Market.sol – fixed‑price marketplace

- Uses `IERC20 erc20` (cHKD) and `IERC721 erc721` (MyNFT)  
- Data:
  - `Order { address seller; uint256 tokenId; uint256 price; }`  
  - `orderOfId[tokenId]`, `orders[]`, `idToOrderIndex[tokenId]`

Flow:

- `list(tokenId, price)`:
  - Requires caller is NFT owner, price > 0, token not already listed  
  - Frontend calls `nft.approve(MARKET, tokenId)` first  
  - Market takes the NFT via `safeTransferFrom` and records the order in `onERC721Received`
- `buy(tokenId)`:
  - Frontend first calls `chkd.approve(MARKET, price)`  
  - Market transfers cHKD buyer→seller and NFT contract→buyer, then removes the order  
- `cancelOrder`, `changePrice`, `getAllNFTs`

### 2.4 Auction.sol – English auction

- Uses `IERC20 erc20` (cHKD), `IERC721 erc721` (MyNFT), `ReentrancyGuard`  
- Data:
  - `AuctionInfo { seller, tokenId, startPrice, highestBid, highestBidder, endTime }`  
  - `auctionOfId[tokenId]`, `auctions[]`, `idToAuctionIndex[tokenId]`

Flow:

- `startAuction(tokenId, startPrice, duration)` – moves NFT to the contract and opens an auction  
- `bid(tokenId, amount)`:
  - Frontend calls `chkd.approve(AUCTION, amount)`  
  - Contract pulls cHKD from bidder, refunds previous highest bidder, updates state  
- `cancelAuction(tokenId)` – only seller, only if no bids  
- `settle(tokenId)` – only seller, sends NFT to winner and cHKD to seller (or returns NFT if no bids)

---

## 3. Deploy script (scripts/deploy.js)

The deploy script:

1. Uses the first signer as `admin` (owner of cHKD and MyNFT).  
2. Deploys `cHKD` and configures the oracle:
   - Localhost: deploys `MockPriceFeed` with a fixed price and sets `ethHkdPriceFeed`  
   - Sepolia: sets `ethHkdPriceFeed` to the Chainlink ETH/USD feed address  
3. Deploys `MyNFT`, enables public minting, and deploys `Market` and `Auction`.  
4. Sets the Market address in `MyNFT`.  
5. Logs addresses; **no tokens or NFTs are pre‑minted** – users rely on Faucet and public minting.

---

## 4. Frontend DApp (frontend-lumina-nft-market)

### 4.1 Tech & entry

- React + TypeScript + Vite  
- `index.tsx` → `<App />`  
- Core files:
  - `services/blockchain.ts` – `BlockchainService` wrapper  
  - `constants.ts` – contract addresses & ABIs  
  - `components/AssetCard.tsx` – NFT card UI  
  - `public/metadata/demo.json` – demo metadata JSON

### 4.2 BlockchainService

Creates contract instances for `cHKD`, `MyNFT`, `Market`, `Auction` and exposes:

- `getAdminAddress()` – reads `cHKD.owner()`  
- `getBalance(address)` – returns cHKD balance (6‑decimals formatted)  
- `getMyNFTs(address)` – enumerates owner tokens, reads `tokenURI`, fetches metadata  
- `getMarketListings()` / `getAuctions()`  
- Transactions: `faucet`, `buyCHKD`, `mint`, `listNFT`, `buyNFT`, `startAuction`, `bid`, `settleAuction`, `cancelAuction`

### 4.3 App.tsx – state & views

- Connects MetaMask via `ethers.BrowserProvider(window.ethereum)`  
- Restricts network to localhost (31337) or Sepolia (11155111)  
- Tracks:
  - Connected `account` and discovered `adminAddress`  
  - `balance`, `myNFTs`, `marketOrders`, `auctions`  
  - `viewMode` (Dashboard / Market / Auctions / Bank)  
  - `txState` (loading / error / success)  
  - Form fields (`mintUri`, `listPrice`, `auctionStartPrice`, `auctionDuration`, `bidAmount`, `ethToSwap`)

Views:

- **Dashboard** – my NFTs, mint, quick “List Fixed” / “Start Auction” actions  
- **Market** – fixed‑price listings with buy buttons  
- **Auctions** – auctions with bidding and settle/cancel buttons  
- **Bank** – Faucet + Oracle Swap

---

## 5. Verification

The Hardhat suite covers the token, NFT, fixed-price market, and auction contracts. It checks successful flows and important rejection paths such as invalid listings, authorization failures, bid replacement, cancellation rules, and settlement state changes.

```bash
cd NFT-Market-master
npm ci
npm test
```

GitHub Actions runs the same command for contract changes and pull requests. Sepolia credentials are optional for local tests and must be supplied through `.env`; no RPC key or private key is committed.

---

## 6. Running locally

```bash
# Contracts
cd NFT-Market-master
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Frontend
cd ../frontend-lumina-nft-market
npm install
npm run dev
```

Open the Vite dev URL (usually `http://localhost:3000`), connect MetaMask to the Hardhat localhost network, and follow the same flow as in the online demo.

---

## 7. Sepolia deployment (current example)

> If you re‑deploy, update this section and `frontend-lumina-nft-market/constants.ts`.

- **Network**: Sepolia (`chainId = 11155111`)  
- **Admin/Owner**: `0xbf65460E1EA8269Ab61B7946b2B04D5A334E0642`  
- **Contracts**:
  - `cHKD`  – `0x4ee7805D139c5D0e002a127c5EdC199f624e53e0`  
  - `MyNFT` – `0xb91696c41e39C063987267BdD788FA83831EBD19`  
  - `Market` – `0x5540BEf94300f50D787806750764d35ACcfB0FE9`  
  - `Auction` – `0xe8F9921f69A31fCE64115C97447d43762d9939a7`  
- **Oracle**:
  - `ethHkdPriceFeed` → `0x694AA1769357215DE4FAC081bf1f309aDC325306` (Chainlink ETH/USD feed)  
  - `cHKD.buyWithETH()` uses this feed’s live price for conversions.

---

## 8. Known limitations / TODOs

- NFT metadata storage is **not yet production‑ready**:
  - The demo uses local static files under `public/metadata/`, and the default mint URI is still tied to a demo JSON;  
  - If you deploy the frontend to a new domain without updating metadata URLs, newly minted NFTs may show as “Unknown Asset” or use fallback images.
- Recommended improvements:
  - Upload metadata JSON and images to IPFS or a stable cloud bucket (S3/OSS/etc.) and use those URLs (or `ipfs://` URIs) as `tokenURI`;  
  - Update the default mint URI and any hard‑coded demo URIs to those public URLs;  
  - Optionally enforce basic URI validation on‑chain or require a valid URL in the frontend before allowing minting.

