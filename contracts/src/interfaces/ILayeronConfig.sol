// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ILayeronConfig {
    function usdc() external view returns (address);
    function gmFee() external view returns (uint256);
    function devWallet() external view returns (address);
    function rewardWallet() external view returns (address);
    function devBps() external view returns (uint16);
    function rewardBps() external view returns (uint16);
    function xpPerGm() external view returns (uint256);
    function gmPaused() external view returns (bool);
    function feeSplit(uint256 fee) external view returns (uint256 devAmount, uint256 rewardAmount);
    function MIN_FEE() external view returns (uint256);
    function MAX_FEE() external view returns (uint256);
    function MAX_XP_PER_GM() external view returns (uint256);
}
