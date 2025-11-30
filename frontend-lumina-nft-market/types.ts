export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: { trait_type: string; value: string }[];
}

export interface NFTItem {
  tokenId: string; // Stored as string to avoid BigInt serialization issues in some contexts
  uri: string;
  owner: string;
  metadata?: NFTMetadata;
}

export interface MarketOrder {
  seller: string;
  tokenId: string;
  price: string; // Formatted cHKD
  priceRaw: bigint;
  metadata?: NFTMetadata;
}

export interface AuctionItem {
  seller: string;
  tokenId: string;
  startPrice: string;
  highestBid: string;
  highestBidder: string;
  endTime: number;
  isActive: boolean;
  metadata?: NFTMetadata;
}

export enum ViewMode {
  MARKET = 'MARKET',
  AUCTION = 'AUCTION',
  DASHBOARD = 'DASHBOARD',
  BANK = 'BANK'
}

export interface TransactionState {
  loading: boolean;
  error: string | null;
  success: string | null;
}