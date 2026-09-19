// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {LayeronGM} from "../LayeronGM.sol";
/// @dev Upgrade target that appends a new storage var — used to verify storage preservation.
contract LayeronGMV2 is LayeronGM {
    uint256 public newFlag;
    function setNewFlag(uint256 v) external onlyRole(DEFAULT_ADMIN_ROLE) { newFlag = v; }
    function version() external pure returns (string memory) { return "v2"; }
}
