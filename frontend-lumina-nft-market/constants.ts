export const ADDRESSES = {
  // 当前配置为 Sepolia 测试网最近一次部署的地址
  CHKD: '0x4ee7805D139c5D0e002a127c5EdC199f624e53e0',
  NFT: '0xb91696c41e39C063987267BdD788FA83831EBD19',
  MARKET: '0x5540BEf94300f50D787806750764d35ACcfB0FE9',
  AUCTION: '0xe8F9921f69A31fCE64115C97447d43762d9939a7',
  // Admin 地址将在前端运行时通过合约 owner() 自动读取，无需手动填写。
};

export const CUSDT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function owner() view returns (address)",
  "function claimFaucet() returns (bool)",
  "function buyWithETH() payable returns (uint256)"
];

export const MY_NFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function safeMint(address to, string uri)",
  "function publicMint(string uri) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

export const MARKET_ABI = [
  "function list(uint256 tokenId, uint256 price)",
  "function buy(uint256 tokenId)",
  "function cancelOrder(uint256 tokenId)",
  "function changePrice(uint256 tokenId, uint256 price)",
  "function getAllNFTs() view returns (tuple(address seller, uint256 tokenId, uint256 price)[])",
  "function getMyNFTs() view returns (tuple(address seller, uint256 tokenId, uint256 price)[])",
  "function isListed(uint256 tokenId) view returns (bool)",
  "function orderOfId(uint256 tokenId) view returns (address seller, uint256 tokenId, uint256 price)"
];

export const AUCTION_ABI = [
  "function startAuction(uint256 _tokenId, uint256 _startPrice, uint64 _duration)",
  "function bid(uint256 _tokenId, uint256 _amount)",
  "function cancelAuction(uint256 _tokenId)",
  "function settle(uint256 _tokenId)",
  "function getAllAuctions() view returns (tuple(address seller, uint256 tokenId, uint256 startPrice, uint256 highestBid, address highestBidder, uint64 endTime)[])",
  "function getMyAuctions() view returns (tuple(address seller, uint256 tokenId, uint256 startPrice, uint256 highestBid, address highestBidder, uint64 endTime)[])",
  "function isActive(uint256 _tokenId) view returns (bool)"
];
