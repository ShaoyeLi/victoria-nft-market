// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    // Mint配置
    bool public publicMintEnabled = false;
    address public market;

    event PublicMintEnabled(bool enabled);
    event MarketUpdated(address indexed newMarket);

    constructor() ERC721("MyNFT", "NFT") Ownable(msg.sender) {}

    /**
     * @dev Owner铸造NFT
     */
    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @dev 公开铸造（可选）- 需要启用
     */
    function publicMint(string memory uri) public returns (uint256) {
        require(publicMintEnabled, "MyNFT: Public mint is disabled");
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    /**
     * @dev Owner设置是否允许公开铸造
     */
    function setPublicMintEnabled(bool enabled) public onlyOwner {
        publicMintEnabled = enabled;
        emit PublicMintEnabled(enabled);
    }

    /**
     * @dev 设置Market合约地址
     */
    function setMarket(address _market) public onlyOwner {
        require(_market != address(0), "MyNFT: Invalid market address");
        market = _market;
        emit MarketUpdated(_market);
    }

    // 重写必需的函数

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}