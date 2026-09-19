// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRulesUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILayeronConfigGM {
    function usdc() external view returns (address);
    function gmFee() external view returns (uint256);
    function devWallet() external view returns (address);
    function rewardWallet() external view returns (address);
    function gmPaused() external view returns (bool);
    function feeSplit(uint256 fee) external view returns (uint256 devAmount, uint256 rewardAmount);
}
interface ILayeronReputationGM { function recordQualifyingGm(address user, uint256 utcDay) external returns (uint256); }

/// @title LayeronGM
/// @notice One GM per wallet per UTC day on THIS chain. Pulls the USDC fee and routes it directly
///         to the dev + reward wallets (NO custody), then asks the reputation ledger to award XP.
/// @dev    UUPS + two-step admin. UPGRADER_ROLE = LayeronTimelock. ReentrancyGuard + SafeERC20 + CEI.
contract LayeronGM is
    Initializable, AccessControlDefaultAdminRulesUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    uint256 public constant SECONDS_PER_DAY = 86_400;

    address public config;
    address public reputation;

    mapping(address => uint256) public lastGmDay;
    mapping(address => uint256) public gmCount;
    uint256 public totalGms;
    uint256 public totalUsdcCollected;

    event Gm(address indexed user, uint256 indexed utcDay, uint256 chainId, uint256 fee, uint256 devAmount, uint256 rewardAmount, uint256 xpAwarded);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin, address upgrader, uint48 adminDelay, address config_, address reputation_) public initializer {
        __AccessControlDefaultAdminRules_init(adminDelay, admin);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        require(config_ != address(0) && reputation_ != address(0) && upgrader != address(0), "zero");
        _grantRole(UPGRADER_ROLE, upgrader);
        config = config_;
        reputation = reputation_;
    }

    /// @notice Canonical UTC day from block time (00:00:00 UTC boundary).
    function currentUtcDay() public view returns (uint256) { return block.timestamp / SECONDS_PER_DAY; }

    function canGm(address user) external view returns (bool) {
        return !ILayeronConfigGM(config).gmPaused() && lastGmDay[user] < currentUtcDay();
    }

    function gm() external nonReentrant {
        ILayeronConfigGM c = ILayeronConfigGM(config);
        require(!c.gmPaused(), "gm paused");
        uint256 today = block.timestamp / SECONDS_PER_DAY;
        require(lastGmDay[msg.sender] < today, "already gm today");

        uint256 fee = c.gmFee();
        (uint256 devAmount, uint256 rewardAmount) = c.feeSplit(fee);
        IERC20 usdc = IERC20(c.usdc());

        // effects before interactions (CEI)
        lastGmDay[msg.sender] = today;
        gmCount[msg.sender] += 1;
        totalGms += 1;
        totalUsdcCollected += fee;

        // interactions: route fee straight to the wallets (no custody)
        if (devAmount > 0)    usdc.safeTransferFrom(msg.sender, c.devWallet(), devAmount);
        if (rewardAmount > 0) usdc.safeTransferFrom(msg.sender, c.rewardWallet(), rewardAmount);

        uint256 xpAwarded = ILayeronReputationGM(reputation).recordQualifyingGm(msg.sender, today);
        emit Gm(msg.sender, today, block.chainid, fee, devAmount, rewardAmount, xpAwarded);
    }

    function setReputation(address r) external onlyRole(DEFAULT_ADMIN_ROLE) { require(r != address(0), "zero"); reputation = r; }
    function setConfig(address c) external onlyRole(DEFAULT_ADMIN_ROLE) { require(c != address(0), "zero"); config = c; }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
    uint256[40] private __gap;
}
