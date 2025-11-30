// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/AggregatorV3Interface.sol";

/**
 * @title MockPriceFeed
 * @dev 简单的预言机模拟合约，实现 Chainlink AggregatorV3 接口，用于本地/测试环境
 */
contract MockPriceFeed is AggregatorV3Interface {
    int256 private _answer;
    uint8 private _decimals;

    constructor(int256 initialAnswer, uint8 decimals_) {
        _answer = initialAnswer;
        _decimals = decimals_;
    }

    function setAnswer(int256 newAnswer) external {
        _answer = newAnswer;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, _answer, 0, block.timestamp, 0);
    }
}

