import { ethers } from 'ethers';
import { ADDRESSES, CUSDT_ABI, MY_NFT_ABI, MARKET_ABI, AUCTION_ABI } from '../constants';

export class BlockchainService {
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
  chkd: ethers.Contract;
  nft: ethers.Contract;
  market: ethers.Contract;
  auction: ethers.Contract;

  constructor(provider: ethers.BrowserProvider, signer: ethers.JsonRpcSigner) {
    this.provider = provider;
    this.signer = signer;
    this.chkd = new ethers.Contract(ADDRESSES.CHKD, CUSDT_ABI, signer);
    this.nft = new ethers.Contract(ADDRESSES.NFT, MY_NFT_ABI, signer);
    this.market = new ethers.Contract(ADDRESSES.MARKET, MARKET_ABI, signer);
    this.auction = new ethers.Contract(ADDRESSES.AUCTION, AUCTION_ABI, signer);
  }

  async getAdminAddress(): Promise<string> {
    // 使用 cHKD 合约的 owner 作为管理员地址
    return await this.chkd.owner();
  }

  async getBalance(address: string): Promise<string> {
    const bal = await this.chkd.balanceOf(address);
    return ethers.formatUnits(bal, 6);
  }

  async fetchMetadata(uri: string) {
    try {
      // Handle local demo URL specifically or fetch normally
      const res = await fetch(uri);
      if (!res.ok) throw new Error('Failed to fetch metadata');
      return await res.json();
    } catch (e) {
      console.warn("Metadata fetch failed", e);
      return {
        name: "Unknown Asset",
        description: "Metadata could not be loaded.",
        image: "https://picsum.photos/400/400?grayscale"
      };
    }
  }

  async getMyNFTs(address: string) {
    const totalBalance = await this.nft.balanceOf(address);
    const nfts = [];
    // ERC721Enumerable logic: iterate by index
    for (let i = 0; i < Number(totalBalance); i++) {
      try {
        const tokenId = await this.nft.tokenOfOwnerByIndex(address, i);
        const uri = await this.nft.tokenURI(tokenId);
        const metadata = await this.fetchMetadata(uri);
        nfts.push({ tokenId: tokenId.toString(), uri, owner: address, metadata });
      } catch (e) {
        console.error(e);
      }
    }
    return nfts;
  }

  async getMarketListings() {
    const rawOrders = await this.market.getAllNFTs();
    // Filter out zero-address sellers (deleted orders)
    const activeOrders = rawOrders.filter((o: any) => o.seller !== ethers.ZeroAddress);
    
    return Promise.all(activeOrders.map(async (o: any) => {
      const uri = await this.nft.tokenURI(o.tokenId);
      const metadata = await this.fetchMetadata(uri);
      return {
        seller: o.seller,
        tokenId: o.tokenId.toString(),
        price: ethers.formatUnits(o.price, 6),
        priceRaw: o.price,
        metadata
      };
    }));
  }

  async getAuctions() {
    const rawAuctions = await this.auction.getAllAuctions();
    const activeAuctions = rawAuctions.filter((a: any) => a.seller !== ethers.ZeroAddress);

    return Promise.all(activeAuctions.map(async (a: any) => {
      const uri = await this.nft.tokenURI(a.tokenId);
      const metadata = await this.fetchMetadata(uri);
      return {
        seller: a.seller,
        tokenId: a.tokenId.toString(),
        startPrice: ethers.formatUnits(a.startPrice, 6),
        highestBid: ethers.formatUnits(a.highestBid, 6),
        highestBidder: a.highestBidder,
        endTime: Number(a.endTime),
        isActive: true,
        metadata
      };
    }));
  }

  // --- Transactions ---

  async faucet() {
    const tx = await this.chkd.claimFaucet();
    return tx.wait();
  }

  async buyCHKD(ethAmount: string) {
    const val = ethers.parseEther(ethAmount);
    const tx = await this.chkd.buyWithETH({ value: val });
    return tx.wait();
  }

  async mint(uri: string) {
    const tx = await this.nft.publicMint(uri);
    return tx.wait();
  }

  async listNFT(tokenId: string, price: string) {
    // 1. Approve Market
    const approveTx = await this.nft.approve(ADDRESSES.MARKET, tokenId);
    await approveTx.wait();
    
    // 2. List
    const priceWei = ethers.parseUnits(price, 6);
    const tx = await this.market.list(tokenId, priceWei);
    return tx.wait();
  }

  async buyNFT(tokenId: string, priceRaw: bigint) {
    // 1. Approve cHKD
    const approveTx = await this.chkd.approve(ADDRESSES.MARKET, priceRaw);
    await approveTx.wait();

    // 2. Buy
    const tx = await this.market.buy(tokenId);
    return tx.wait();
  }

  async cancelOrder(tokenId: string) {
    const tx = await this.market.cancelOrder(tokenId);
    return tx.wait();
  }

  async startAuction(tokenId: string, startPrice: string, durationSeconds: number) {
    // 1. Approve Auction
    const approveTx = await this.nft.approve(ADDRESSES.AUCTION, tokenId);
    await approveTx.wait();

    // 2. Start
    const priceWei = ethers.parseUnits(startPrice, 6);
    const tx = await this.auction.startAuction(tokenId, priceWei, durationSeconds);
    return tx.wait();
  }

  async bid(tokenId: string, amount: string) {
    const amountWei = ethers.parseUnits(amount, 6);
    
    // 1. Approve cHKD
    const approveTx = await this.chkd.approve(ADDRESSES.AUCTION, amountWei);
    await approveTx.wait();

    // 2. Bid
    const tx = await this.auction.bid(tokenId, amountWei);
    return tx.wait();
  }

  async settleAuction(tokenId: string) {
    const tx = await this.auction.settle(tokenId);
    return tx.wait();
  }

  async cancelAuction(tokenId: string) {
    const tx = await this.auction.cancelAuction(tokenId);
    return tx.wait();
  }
}
