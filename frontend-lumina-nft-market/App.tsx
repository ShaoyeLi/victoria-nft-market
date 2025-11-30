import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { BlockchainService } from './services/blockchain';
import { ADDRESSES } from './constants';
import { ViewMode, NFTItem, MarketOrder, AuctionItem, TransactionState } from './types';
import { AssetCard } from './components/AssetCard';
import { 
  Wallet, 
  Coins, 
  LayoutDashboard, 
  Store, 
  Gavel, 
  RefreshCw, 
  Loader2, 
  PlusCircle,
  ExternalLink,
  Landmark,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

declare global {
  interface Window {
    ethereum: any;
  }
}

export default function App() {
  // --- State ---
  const [service, setService] = useState<BlockchainService | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  
  // Data State
  const [myNFTs, setMyNFTs] = useState<NFTItem[]>([]);
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  
  // Interaction State
  const [txState, setTxState] = useState<TransactionState>({ loading: false, error: null, success: null });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Form State
  const [mintUri, setMintUri] = useState('http://localhost:3000/metadata/demo.json');
  const [listPrice, setListPrice] = useState('100');
  const [auctionStartPrice, setAuctionStartPrice] = useState('100');
  const [auctionDuration, setAuctionDuration] = useState('3600');
  const [bidAmount, setBidAmount] = useState('');
  const [ethToSwap, setEthToSwap] = useState('0.1');

  // --- Effects ---

  // Connect Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setTxState({ ...txState, error: 'MetaMask is not installed' });
      return;
    }
    try {
      setTxState({ loading: true, error: null, success: null });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      const network = await provider.getNetwork();
      if (network.chainId !== 31337n && network.chainId !== 11155111n) {
        throw new Error("Please connect to Localhost (31337) or Sepolia");
      }

      const signer = await provider.getSigner();
      const blockchainService = new BlockchainService(provider, signer);
      const owner = await blockchainService.getAdminAddress();
      
      setService(blockchainService);
      setAccount(accounts[0]);
      setAdminAddress(owner.toLowerCase());
      setTxState({ loading: false, error: null, success: 'Wallet connected successfully' });
    } catch (err: any) {
      setTxState({ loading: false, error: err.message, success: null });
    }
  };

  // Refresh Data
  const fetchData = useCallback(async () => {
    if (!service || !account) return;
    try {
      // Parallel Fetch
      const [bal, nfts, orders, aucs] = await Promise.all([
        service.getBalance(account),
        service.getMyNFTs(account),
        service.getMarketListings(),
        service.getAuctions()
      ]);

      setBalance(bal);
      setMyNFTs(nfts);
      setMarketOrders(orders);
      setAuctions(aucs);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  }, [service, account]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData, refreshTrigger]);

  // --- Wrappers for Actions ---

  const handleTx = async (action: () => Promise<any>, successMsg: string) => {
    if (!service) return;
    try {
      setTxState({ loading: true, error: null, success: null });
      await action();
      setTxState({ loading: false, error: null, success: successMsg });
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      let msg = err.reason || err.message || "Transaction failed";
      if (msg.includes("user rejected")) msg = "User rejected transaction";
      setTxState({ loading: false, error: msg, success: null });
    }
  };

  // --- Render Helpers ---

  const getRole = () => {
    if (!account) return 'User';
    if (adminAddress && account.toLowerCase() === adminAddress) return 'Admin';
    return 'User';
  };

  const NavButton = ({ mode, icon: Icon, label }: { mode: ViewMode, icon: any, label: string }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        viewMode === mode 
          ? 'bg-primary-50 text-primary-700' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-6 p-10 bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Victoria NFT Market</h1>
          <p className="text-slate-500">Connect your wallet to access the premium localized NFT marketplace.</p>
          
          {txState.error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
              <AlertCircle size={16} />
              {txState.error}
            </div>
          )}

          <button
            onClick={connectWallet}
            disabled={txState.loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
          >
            {txState.loading ? <Loader2 className="animate-spin" /> : <Wallet size={20} />}
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-500">
              Victoria
            </h1>
            <nav className="hidden md:flex space-x-1">
              <NavButton mode={ViewMode.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
              <NavButton mode={ViewMode.MARKET} icon={Store} label="Market" />
              <NavButton mode={ViewMode.AUCTION} icon={Gavel} label="Auctions" />
              <NavButton mode={ViewMode.BANK} icon={Landmark} label="Bank" />
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600 font-mono">
                {parseFloat(balance).toFixed(2)} cHKD
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500 hidden sm:block">
                {getRole()}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                {account.substring(2, 4).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full space-y-2">
        {txState.error && (
           <div className="bg-white border-l-4 border-rose-500 shadow-lg rounded-lg p-4 flex items-start gap-3 animate-slide-in">
             <AlertCircle className="text-rose-500 shrink-0" size={20} />
             <div>
               <h4 className="font-medium text-slate-900">Error</h4>
               <p className="text-sm text-slate-500">{txState.error}</p>
             </div>
           </div>
        )}
        {txState.success && (
           <div className="bg-white border-l-4 border-emerald-500 shadow-lg rounded-lg p-4 flex items-start gap-3 animate-slide-in">
             <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
             <div>
               <h4 className="font-medium text-slate-900">Success</h4>
               <p className="text-sm text-slate-500">{txState.success}</p>
             </div>
           </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Loading Overlay */}
        {txState.loading && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-3">
              <Loader2 className="animate-spin text-primary-600" size={32} />
              <p className="font-medium text-slate-600">Processing Transaction...</p>
            </div>
          </div>
        )}

        {/* --- DASHBOARD VIEW --- */}
        {viewMode === ViewMode.DASHBOARD && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">My Assets</h2>
              <button 
                onClick={() => fetchData()}
                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all"
              >
                <RefreshCw size={20} />
              </button>
            </div>

            {/* Mint Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-end md:items-center">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Mint New Asset</label>
                <input 
                  type="text" 
                  value={mintUri}
                  onChange={(e) => setMintUri(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
                  placeholder="https://..."
                />
              </div>
              <button 
                onClick={() => handleTx(() => service!.mint(mintUri), "NFT Minted Successfully")}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <PlusCircle size={16} /> Mint NFT
              </button>
            </div>

            {/* My NFTs Grid */}
            {myNFTs.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400">You don't own any assets yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {myNFTs.map(nft => {
                  const isListed = marketOrders.find(o => o.tokenId === nft.tokenId && o.seller.toLowerCase() === account.toLowerCase());
                  const isAuctioned = auctions.find(a => a.tokenId === nft.tokenId && a.isActive);

                  return (
                    <AssetCard key={nft.tokenId} tokenId={nft.tokenId} metadata={nft.metadata} badge={isListed ? 'Listed' : isAuctioned ? 'Auction' : undefined}>
                       {!isListed && !isAuctioned && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                           {/* Quick List */}
                           <div className="col-span-2 flex space-x-2">
                              <input 
                                type="text"
                                placeholder="Price"
                                className="w-1/3 px-2 py-1 text-xs border rounded"
                                onChange={(e) => setListPrice(e.target.value)}
                              />
                              <button 
                                onClick={() => handleTx(() => service!.listNFT(nft.tokenId, listPrice), `Listed #${nft.tokenId}`)}
                                className="flex-1 bg-white border border-primary-600 text-primary-600 text-xs rounded font-medium hover:bg-primary-50"
                              >
                                List Fixed
                              </button>
                           </div>
                           <button 
                             onClick={() => handleTx(() => service!.startAuction(nft.tokenId, auctionStartPrice, parseInt(auctionDuration)), `Auction started #${nft.tokenId}`)}
                             className="col-span-2 bg-slate-900 text-white text-xs py-1.5 rounded font-medium hover:bg-slate-800"
                           >
                             Start Auction
                           </button>
                        </div>
                       )}
                       {isListed && (
                         <button 
                           onClick={() => handleTx(() => service!.cancelOrder(nft.tokenId), "Order Cancelled")}
                           className="w-full bg-rose-50 text-rose-600 text-xs py-2 rounded font-medium hover:bg-rose-100"
                         >
                           Cancel Listing
                         </button>
                       )}
                    </AssetCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- MARKET VIEW --- */}
        {viewMode === ViewMode.MARKET && (
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <Store className="text-primary-600" />
               <h2 className="text-2xl font-bold text-slate-800">Marketplace</h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {marketOrders.map(order => (
                  <AssetCard 
                    key={order.tokenId} 
                    tokenId={order.tokenId} 
                    metadata={order.metadata} 
                    price={order.price} 
                    priceLabel="Fixed Price"
                    owner={order.seller}
                  >
                    {order.seller.toLowerCase() === account.toLowerCase() ? (
                      <button 
                        onClick={() => handleTx(() => service!.cancelOrder(order.tokenId), "Listing Cancelled")}
                        className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
                      >
                        Cancel Listing
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleTx(() => service!.buyNFT(order.tokenId, order.priceRaw), `Purchased #${order.tokenId}`)}
                        className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-500/20"
                      >
                        Buy Now
                      </button>
                    )}
                  </AssetCard>
                ))}
             </div>
             {marketOrders.length === 0 && (
               <p className="text-center text-slate-400 py-10">No active listings.</p>
             )}
          </div>
        )}

        {/* --- AUCTION VIEW --- */}
        {viewMode === ViewMode.AUCTION && (
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <Gavel className="text-primary-600" />
               <h2 className="text-2xl font-bold text-slate-800">Live Auctions</h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {auctions.map(auc => {
                   const isSeller = auc.seller.toLowerCase() === account.toLowerCase();
                   const isEnded = Date.now() > auc.endTime * 1000;

                   return (
                    <AssetCard 
                      key={auc.tokenId} 
                      tokenId={auc.tokenId} 
                      metadata={auc.metadata} 
                      price={auc.highestBid !== '0.0' ? auc.highestBid : auc.startPrice}
                      priceLabel={auc.highestBid !== '0.0' ? 'Highest Bid' : 'Starting Price'}
                      owner={auc.seller}
                      endTime={auc.endTime}
                    >
                      {!isEnded && !isSeller && (
                        <div className="flex gap-2">
                           <input 
                             type="number" 
                             placeholder="Amount"
                             className="w-1/2 px-2 py-1 text-sm border rounded"
                             onChange={(e) => setBidAmount(e.target.value)}
                           />
                           <button 
                             onClick={() => handleTx(() => service!.bid(auc.tokenId, bidAmount), "Bid Placed")}
                             className="flex-1 bg-primary-600 text-white text-sm rounded font-medium hover:bg-primary-700"
                           >
                             Bid
                           </button>
                        </div>
                      )}

                      {isSeller && (
                         <div className="flex gap-2">
                           {/* Only allow cancel if no bids (simplified) or ended */}
                           {!isEnded && auc.highestBid === '0.0' && (
                              <button 
                                onClick={() => handleTx(() => service!.cancelAuction(auc.tokenId), "Auction Cancelled")}
                                className="flex-1 bg-rose-100 text-rose-600 text-sm py-2 rounded font-medium hover:bg-rose-200"
                              >
                                Cancel
                              </button>
                           )}
                           <button 
                             onClick={() => handleTx(() => service!.settleAuction(auc.tokenId), "Auction Settled")}
                             className="flex-1 bg-emerald-100 text-emerald-600 text-sm py-2 rounded font-medium hover:bg-emerald-200"
                           >
                             Settle
                           </button>
                         </div>
                      )}
                    </AssetCard>
                  );
                })}
             </div>
             {auctions.length === 0 && (
               <p className="text-center text-slate-400 py-10">No active auctions.</p>
             )}
          </div>
        )}

        {/* --- BANK VIEW --- */}
        {viewMode === ViewMode.BANK && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Victoria Bank</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Faucet Card */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Coins size={100} className="text-primary-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Daily Faucet</h3>
                <p className="text-slate-500 mb-6">Claim 1,000 cHKD test tokens once every 24 hours to participate in the marketplace.</p>
                <button 
                  onClick={() => handleTx(() => service!.faucet(), "Faucet Claimed")}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all"
                >
                   Claim 1,000 cHKD
                </button>
              </div>

              {/* Swap Card */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ExternalLink size={100} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Oracle Swap</h3>
                <p className="text-slate-500 mb-6">Swap Localhost ETH for cHKD using the Mock Oracle price feed (1 ETH ≈ 10,000 HKD).</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ETH Amount</label>
                    <input 
                      type="number" 
                      value={ethToSwap}
                      onChange={(e) => setEthToSwap(e.target.value)}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => handleTx(() => service!.buyCHKD(ethToSwap), `Swapped ${ethToSwap} ETH`)}
                    className="w-full bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:bg-primary-700 transition-all"
                  >
                     Swap for cHKD
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
