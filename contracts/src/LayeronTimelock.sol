// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title LayeronTimelock
/// @notice Owns UPGRADER_ROLE on the Layeron contracts. Upgrades must be scheduled here and can
///         only execute after `minDelay`. It controls UPGRADES ONLY — it holds no CONFIG/PAUSER role.
/// @dev    Roles (from TimelockController): PROPOSER (schedule), EXECUTOR (execute after delay),
///         CANCELLER (cancel a pending op), DEFAULT_ADMIN (manage the timelock's own roles).
///         v1: proposer/executor/canceller/admin = your deployment wallet. Move all of these to a
///         Gnosis Safe later by granting the Safe these roles and renouncing your own — no redeploy.
contract LayeronTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin) {}
}
