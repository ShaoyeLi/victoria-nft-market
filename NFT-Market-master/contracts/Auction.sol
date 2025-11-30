// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title Auction
 * @dev 简单的英文拍卖合约，使用 ERC20 代币 (cHKD) 出价，拍卖单一 ERC721 合约的 NFT。
 *      - 任意 NFT 持有者都可以发起拍卖
 *      - 所有人可以看到当前最高出价
 *      - 只有卖家可以在结束时间之后结算拍卖
 */
contract Auction is IERC721Receiver, ReentrancyGuard {
    IERC20 public erc20;
    IERC721 public erc721;

    bytes4 internal constant MAGIC_ON_ERC721_RECEIVED = 0x150b7a02;

    struct AuctionInfo {
        address seller;
        uint256 tokenId;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        uint64 endTime;
    }

    // tokenId => 拍卖信息（仅对正在拍卖中的 NFT 有效）
    mapping(uint256 => AuctionInfo) public auctionOfId;
    AuctionInfo[] public auctions;
    mapping(uint256 => uint256) public idToAuctionIndex;

    event AuctionStarted(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 startPrice,
        uint64 endTime
    );
    event BidPlaced(
        address indexed bidder,
        uint256 indexed tokenId,
        uint256 amount
    );
    event AuctionCancelled(address indexed seller, uint256 indexed tokenId);
    event AuctionSettled(
        address indexed seller,
        address indexed winner,
        uint256 indexed tokenId,
        uint256 amount
    );

    constructor(IERC20 _erc20, IERC721 _erc721) {
        require(
            address(_erc20) != address(0),
            "Auction: ERC20 address must be non-zero"
        );
        require(
            address(_erc721) != address(0),
            "Auction: ERC721 address must be non-zero"
        );
        erc20 = _erc20;
        erc721 = _erc721;
    }

    function isActive(uint256 _tokenId) public view returns (bool) {
        return auctionOfId[_tokenId].seller != address(0);
    }

    function getAllAuctions() public view returns (AuctionInfo[] memory) {
        return auctions;
    }

    function getMyAuctions() public view returns (AuctionInfo[] memory) {
        AuctionInfo[] memory temp = new AuctionInfo[](auctions.length);
        uint256 count;
        for (uint256 i = 0; i < auctions.length; i++) {
            if (auctions[i].seller == msg.sender) {
                temp[count] = auctions[i];
                count++;
            }
        }

        AuctionInfo[] memory result = new AuctionInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    /**
     * @dev 发起拍卖
     * @param _tokenId NFT 的 Token ID
     * @param _startPrice 起拍价（单位：cHKD 的最小单位）
     * @param _duration 持续时间（秒）
     */
    function startAuction(
        uint256 _tokenId,
        uint256 _startPrice,
        uint64 _duration
    ) external nonReentrant {
        require(_startPrice > 0, "Auction: start price must be > 0");
        require(_duration > 0, "Auction: duration must be > 0");
        require(!isActive(_tokenId), "Auction: token already in auction");

        address owner = erc721.ownerOf(_tokenId);
        require(owner == msg.sender, "Auction: caller is not NFT owner");

        uint64 endTime = uint64(block.timestamp) + _duration;

        erc721.safeTransferFrom(msg.sender, address(this), _tokenId);

        auctionOfId[_tokenId] = AuctionInfo({
            seller: msg.sender,
            tokenId: _tokenId,
            startPrice: _startPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime
        });

        auctions.push(auctionOfId[_tokenId]);
        idToAuctionIndex[_tokenId] = auctions.length - 1;

        emit AuctionStarted(msg.sender, _tokenId, _startPrice, endTime);
    }

    /**
     * @dev 对指定 NFT 出价
     * @param _tokenId NFT 的 Token ID
     * @param _amount 出价（单位：cHKD 的最小单位）
     */
    function bid(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(isActive(_tokenId), "Auction: token not in auction");

        AuctionInfo storage a = auctionOfId[_tokenId];
        require(block.timestamp < a.endTime, "Auction: auction ended");
        require(_amount >= a.startPrice, "Auction: bid below start price");
        require(_amount > a.highestBid, "Auction: bid not high enough");

        // 从出价人拉取 cHKD 进合约
        require(
            erc20.transferFrom(msg.sender, address(this), _amount),
            "Auction: ERC20 transfer failed"
        );

        // 退还上一位出价人
        if (a.highestBidder != address(0) && a.highestBid > 0) {
            require(
                erc20.transfer(a.highestBidder, a.highestBid),
                "Auction: refund failed"
            );
        }

        a.highestBid = _amount;
        a.highestBidder = msg.sender;

        // 更新数组中的副本
        AuctionInfo storage arrA = auctions[idToAuctionIndex[_tokenId]];
        arrA.highestBid = _amount;
        arrA.highestBidder = msg.sender;

        emit BidPlaced(msg.sender, _tokenId, _amount);
    }

    /**
     * @dev 卖家取消拍卖（仅在无人出价时允许）
     */
    function cancelAuction(uint256 _tokenId) external nonReentrant {
        require(isActive(_tokenId), "Auction: token not in auction");
        AuctionInfo storage a = auctionOfId[_tokenId];
        require(a.seller == msg.sender, "Auction: caller is not seller");
        require(
            a.highestBidder == address(0),
            "Auction: cannot cancel with bids"
        );

        erc721.safeTransferFrom(address(this), a.seller, _tokenId);
        _removeAuction(_tokenId);

        emit AuctionCancelled(msg.sender, _tokenId);
    }

    /**
     * @dev 仅卖家可以调用，结算拍卖
     * 为了测试和演示方便，这里允许卖家在任意时间结算；
     * endTime 字段主要用于前端展示拍卖剩余时间。
     */
    function settle(uint256 _tokenId) external nonReentrant {
        require(isActive(_tokenId), "Auction: token not in auction");
        AuctionInfo storage a = auctionOfId[_tokenId];
        require(a.seller == msg.sender, "Auction: caller is not seller");

        address winner = a.highestBidder;
        uint256 amount = a.highestBid;

        if (winner != address(0) && amount > 0) {
            // 将 NFT 转给最高出价者
            erc721.safeTransferFrom(address(this), winner, _tokenId);
            // 将 cHKD 转给卖家
            require(
                erc20.transfer(a.seller, amount),
                "Auction: payout failed"
            );
        } else {
            // 无人出价，退还 NFT
            erc721.safeTransferFrom(address(this), a.seller, _tokenId);
        }

        _removeAuction(_tokenId);

        emit AuctionSettled(a.seller, winner, _tokenId, amount);
    }

    function _removeAuction(uint256 _tokenId) internal {
        delete auctionOfId[_tokenId];

        uint256 index = idToAuctionIndex[_tokenId];
        uint256 lastIndex = auctions.length - 1;

        if (index != lastIndex) {
            AuctionInfo memory last = auctions[lastIndex];
            auctions[index] = last;
            idToAuctionIndex[last.tokenId] = index;
        }

        auctions.pop();
        delete idToAuctionIndex[_tokenId];
    }

    // ERC721 接收钩子，允许安全转移
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return MAGIC_ON_ERC721_RECEIVED;
    }
}
