// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ILayeronGM {
    function gm() external;
    function canGm(address user) external view returns (bool);
    function currentUtcDay() external view returns (uint256);
    function lastGmDay(address user) external view returns (uint256);
    function gmCount(address user) external view returns (uint256);
    function totalGms() external view returns (uint256);
    function totalUsdcCollected() external view returns (uint256);
}
