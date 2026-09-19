// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRulesUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IXpConfig { function xpPerGm() external view returns (uint256); }

/// @title LayeronReputation
/// @notice Authoritative XP + streak store. APPEND-ONLY: only the GM contract (GM_ROLE) may write,
///         and only via recordQualifyingGm. There is deliberately NO admin function to set or edit
///         a user's XP, streak, longest streak, lastXpDay, qualifyingGms or any historical record.
/// @dev    XP rule: at most one XP-earning GM per wallet per UTC day (lastXpDay guard).
contract LayeronReputation is Initializable, AccessControlDefaultAdminRulesUpgradeable, UUPSUpgradeable {
    bytes32 public constant GM_ROLE       = keccak256("GM_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address public config;

    struct Rep { uint64 xp; uint32 streak; uint32 longestStreak; uint32 lastXpDay; uint32 qualifyingGms; }
    mapping(address => Rep) private _rep;

    uint256 public totalXpIssued;
    uint256 public totalUsers;

    event XPAwarded(address indexed user, uint256 amount, uint256 utcDay, uint32 streak, uint32 longestStreak);
    event ConfigUpdated(address indexed oldConfig, address indexed newConfig);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin, address upgrader, uint48 adminDelay, address config_) public initializer {
        __AccessControlDefaultAdminRules_init(adminDelay, admin);
        __UUPSUpgradeable_init();
        require(config_ != address(0) && upgrader != address(0), "zero");
        _grantRole(UPGRADER_ROLE, upgrader);
        config = config_;
    }

    /// @notice Award XP + advance streak for the FIRST qualifying GM of the given UTC day only.
    /// @dev    Called by LayeronGM (GM_ROLE) after the fee settles. Same-day repeats return 0.
    function recordQualifyingGm(address user, uint256 utcDay)
        external onlyRole(GM_ROLE) returns (uint256 xpAwarded)
    {
        Rep storage r = _rep[user];
        if (r.lastXpDay >= utcDay) return 0;                 // already earned XP this UTC day
        if (uint256(r.lastXpDay) + 1 == utcDay) r.streak += 1; else r.streak = 1;
        if (r.streak > r.longestStreak) r.longestStreak = r.streak;
        r.lastXpDay = uint32(utcDay);
        uint256 amt = IXpConfig(config).xpPerGm();
        r.xp += uint64(amt);
        r.qualifyingGms += 1;
        if (r.qualifyingGms == 1) totalUsers += 1;
        totalXpIssued += amt;
        emit XPAwarded(user, amt, utcDay, r.streak, r.longestStreak);
        return amt;
    }

    function repOf(address u) external view
        returns (uint256 xp, uint256 streak, uint256 longestStreak, uint256 lastXpDay, uint256 qualifyingGms)
    { Rep memory r = _rep[u]; return (r.xp, r.streak, r.longestStreak, r.lastXpDay, r.qualifyingGms); }

    // wiring only; cannot touch user history
    function setConfig(address c) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(c != address(0), "zero"); emit ConfigUpdated(config, c); config = c;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
    uint256[40] private __gap;
}
