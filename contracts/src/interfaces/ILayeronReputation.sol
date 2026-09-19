// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ILayeronReputation {
    function recordQualifyingGm(address user, uint256 utcDay) external returns (uint256);
    function repOf(address u) external view returns (uint256 xp, uint256 streak, uint256 longestStreak, uint256 lastXpDay, uint256 qualifyingGms);
    function totalXpIssued() external view returns (uint256);
    function totalUsers() external view returns (uint256);
}
