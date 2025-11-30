// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

/**
 * @title cHKD - 港币锚定的测试代币
 * @dev 1 cHKD = 1 HKD，使用6位小数
 */
contract cHKD is ERC20, ERC20Burnable, Ownable {
    // Faucet配置
    uint256 public constant FAUCET_AMOUNT = 1000 * 10 ** 6; // 每次领取1000 cHKD
    uint256 public constant FAUCET_COOLDOWN = 1 days; // 冷却时间
    mapping(address => uint256) public lastFaucetTime;

    // 预言机：1 ETH 兑换多少 HKD（例如来自 Chainlink）
    AggregatorV3Interface public ethHkdPriceFeed;

    event FaucetClaimed(address indexed user, uint256 amount);
    event PriceFeedUpdated(address indexed newFeed);
    event BoughtWithETH(address indexed buyer, uint256 ethIn, uint256 chkdOut);

    constructor() ERC20("HKD Coin", "cHKD") Ownable(msg.sender) {
        // 初始铸造100万个代币到合约，供Faucet使用
        _mint(address(this), 1000000 * 10 ** 6);
    }

    /**
     * @dev 6位小数（对标港币）
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Owner 设置 ETH/HKD 预言机地址（例如 Chainlink ETH/HKD 价格预言机）
     */
    function setEthHkdPriceFeed(address _feed) external onlyOwner {
        require(_feed != address(0), "cHKD: invalid feed address");
        ethHkdPriceFeed = AggregatorV3Interface(_feed);
        emit PriceFeedUpdated(_feed);
    }

    /**
     * @dev 公开的Faucet函数，任何人可以领取测试代币
     */
    function claimFaucet() public returns (bool) {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "cHKD: Faucet cooldown not reached"
        );
        require(
            balanceOf(address(this)) >= FAUCET_AMOUNT,
            "cHKD: Insufficient faucet balance"
        );

        lastFaucetTime[msg.sender] = block.timestamp;
        _transfer(address(this), msg.sender, FAUCET_AMOUNT);

        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
        return true;
    }

    /**
     * @dev 使用 ETH 按照预言机价格购买 cHKD
     * 预期 priceFeed 返回值为：1 ETH = X HKD，带有 feedDecimals 位小数
     */
    function buyWithETH() public payable returns (uint256) {
        require(msg.value > 0, "cHKD: ETH amount is zero");
        require(address(ethHkdPriceFeed) != address(0), "cHKD: price feed not set");

        (
            ,
            int256 answer,
            ,
            ,

        ) = ethHkdPriceFeed.latestRoundData();
        require(answer > 0, "cHKD: invalid oracle price");

        uint8 feedDecimals = ethHkdPriceFeed.decimals();
        uint256 price = uint256(answer); // 1 ETH = price * 10^feedDecimals HKD

        // msg.value: wei (1 ETH = 1e18 wei)
        // price: HKD * 10^feedDecimals
        // 我们希望得到 cHKD 最小单位数量（10^decimals()）
        uint256 chkdDecimals = decimals();

        uint256 numerator = msg.value * price * (10 ** chkdDecimals);
        uint256 denominator = (10 ** 18) * (10 ** feedDecimals);
        uint256 amountOut = numerator / denominator;
        require(amountOut > 0, "cHKD: amount too small");

        _mint(msg.sender, amountOut);
        emit BoughtWithETH(msg.sender, msg.value, amountOut);

        return amountOut;
    }

    /**
     * @dev Owner可以为Faucet补充代币
     */
    function refillFaucet(uint256 amount) public onlyOwner {
        _mint(address(this), amount);
    }

    /**
     * @dev Owner可以直接铸造代币
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
