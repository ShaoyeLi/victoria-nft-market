// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title NFTMarket contract that allows atomic swaps of ERC20 and ERC721
 * 修复版本：修复了 list 函数中 safeTransferFrom 的 data 参数问题
 */
contract Market is IERC721Receiver {
    IERC20 public erc20;
    IERC721 public erc721;

    bytes4 internal constant MAGIC_ON_ERC721_RECEIVED = 0x150b7a02;

    struct Order {
        address seller;
        uint256 tokenId;
        uint256 price;
    }

    mapping(uint256 => Order) public orderOfId;
    Order[] public orders;
    mapping(uint256 => uint256) public idToOrderIndex;

    event Deal(address indexed buyer, address indexed seller, uint256 indexed tokenId, uint256 price);
    event NewOrder(address indexed seller, uint256 indexed tokenId, uint256 price);
    event CancelOrder(address indexed seller, uint256 indexed tokenId);
    event ChangePrice(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 previousPrice,
        uint256 price
    );

    constructor(IERC20 _erc20, IERC721 _erc721) {
        require(
            address(_erc20) != address(0),
            "Market: IERC20 contract address must be non-null"
        );
        require(
            address(_erc721) != address(0),
            "Market: IERC721 contract address must be non-null"
        );
        erc20 = _erc20;
        erc721 = _erc721;
    }

    /**
     * @dev 公开的List函数 - 用户可以直接调用来上架NFT
     * @param _tokenId NFT的Token ID
     * @param _price 价格
     * 
     * 使用方式：
     * 1. 先调用 NFT.approve(MARKET_ADDRESS, tokenId)
     * 2. 再调用 market.list(tokenId, price)
     */
    function list(uint256 _tokenId, uint256 _price) external {
        require(_price > 0, "Market: Price must be greater than zero");
        require(!isListed(_tokenId), "Market: Token already listed");
        
        // 检查调用者是否是NFT的所有者
        address owner = erc721.ownerOf(_tokenId);
        require(owner == msg.sender, "Market: Sender is not the owner");
        
        // ✅ 修复：在 safeTransferFrom 中传递包含价格的 data
        // 这样 onERC721Received 就能获取价格信息
        bytes memory data = abi.encode(_price);
        erc721.safeTransferFrom(msg.sender, address(this), _tokenId, data);
    }

    function buy(uint256 _tokenId) external {
        require(isListed(_tokenId), "Market: Token ID is not listed");

        address seller = orderOfId[_tokenId].seller;
        address buyer = msg.sender;
        uint256 price = orderOfId[_tokenId].price;

        require(
            erc20.transferFrom(buyer, seller, price),
            "Market: ERC20 transfer not successful"
        );
        erc721.safeTransferFrom(address(this), buyer, _tokenId);
        removeListing(_tokenId);

        emit Deal(buyer, seller, _tokenId, price);
    }

    function cancelOrder(uint256 _tokenId) external {
        require(isListed(_tokenId), "Market: Token ID is not listed");

        address seller = orderOfId[_tokenId].seller;
        require(seller == msg.sender, "Market: Sender is not seller");

        erc721.safeTransferFrom(address(this), seller, _tokenId);
        removeListing(_tokenId);

        emit CancelOrder(seller, _tokenId);
    }

    function changePrice(uint256 _tokenId, uint256 _price) external {
        require(isListed(_tokenId), "Market: Token ID is not listed");
        require(_price > 0, "Market: Price must be greater than zero");
        
        address seller = orderOfId[_tokenId].seller;
        require(seller == msg.sender, "Market: Sender is not seller");

        uint256 previousPrice = orderOfId[_tokenId].price;
        orderOfId[_tokenId].price = _price;
        Order storage order = orders[idToOrderIndex[_tokenId]];
        order.price = _price;

        emit ChangePrice(seller, _tokenId, previousPrice, _price);
    }

    function getAllNFTs() public view returns (Order[] memory) {
        return orders;
    }

    function getMyNFTs() public view returns (Order[] memory) {
        Order[] memory myOrders = new Order[](orders.length);
        uint256 myOrdersCount = 0;

        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].seller == msg.sender) {
                myOrders[myOrdersCount] = orders[i];
                myOrdersCount++;
            }
        }

        Order[] memory myOrdersTrimmed = new Order[](myOrdersCount);
        for (uint256 i = 0; i < myOrdersCount; i++) {
            myOrdersTrimmed[i] = myOrders[i];
        }

        return myOrdersTrimmed;
    }

    function isListed(uint256 _tokenId) public view returns (bool) {
        return orderOfId[_tokenId].seller != address(0);
    }

    function getOrderLength() public view returns (uint256) {
        return orders.length;
    }

    /**
     * @dev ERC721 receiver hook - 保持向后兼容
     * 支持两种上架方式：
     * 1. 调用 list() 函数（推荐）
     * 2. 直接通过 safeTransferFrom 发送（需要传递 price 作为 data）
     * 
     * 参数说明：
     * - _operator: 调用 safeTransferFrom 的地址（可能是 Market 合约或用户）
     * - _seller: NFT 转移的来源地址（通常是所有者）
     * - _tokenId: Token ID
     * - _data: 编码的价格
     */
    function onERC721Received(
        address _operator,
        address _seller,
        uint256 _tokenId,
        bytes calldata _data
    ) public override returns (bytes4) {
        // ✅ 修复：允许 Market 合约调用（通过 list() 方式）或用户直接调用
        require(
            _operator == address(this) || _operator == _seller,
            "Market: Invalid operator"
        );
        require(_data.length >= 32, "Market: Price data required");
        
        uint256 _price = toUint256(_data, 0);
        require(_price > 0, "Market: Price must be greater than zero");
        
        placeOrder(_seller, _tokenId, _price);

        return MAGIC_ON_ERC721_RECEIVED;
    }

    // https://stackoverflow.com/questions/63252057/how-to-use-bytestouint-function-in-solidity-the-one-with-assembly
    function toUint256(
        bytes memory _bytes,
        uint256 _start
    ) public pure returns (uint256) {
        require(_start + 32 >= _start, "Market: toUint256_overflow");
        require(_bytes.length >= _start + 32, "Market: toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    function placeOrder(
        address _seller,
        uint256 _tokenId,
        uint256 _price
    ) internal {
        require(_price > 0, "Market: Price must be greater than zero");
        require(!isListed(_tokenId), "Market: Token already listed");

        orderOfId[_tokenId].seller = _seller;
        orderOfId[_tokenId].price = _price;
        orderOfId[_tokenId].tokenId = _tokenId;

        orders.push(orderOfId[_tokenId]);
        idToOrderIndex[_tokenId] = orders.length - 1;

        emit NewOrder(_seller, _tokenId, _price);
    }

    function removeListing(uint256 _tokenId) internal {
        delete orderOfId[_tokenId];

        uint256 orderToRemoveIndex = idToOrderIndex[_tokenId];
        uint256 lastOrderIndex = orders.length - 1;

        if (lastOrderIndex != orderToRemoveIndex) {
            Order memory lastOrder = orders[lastOrderIndex];
            orders[orderToRemoveIndex] = lastOrder;
            idToOrderIndex[lastOrder.tokenId] = orderToRemoveIndex;
        }

        orders.pop();
    }
}