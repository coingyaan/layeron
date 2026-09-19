// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRulesUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title LayeronConfig
/// @notice Central, upgradeable configuration for Layeron. Holds every value that is meant to
///         change WITHOUT redeploying logic: GM fee, fee allocation, dev/reward wallets, XP amount,
///         pause state, and the informational chain registry.
/// @dev    Security model:
///         - DEFAULT_ADMIN_ROLE uses a two-step, delayed transfer (AccessControlDefaultAdminRules).
///         - CONFIG_ROLE  = protocol parameter changes.
///         - PAUSER_ROLE  = pause/unpause GM.
///         - UPGRADER_ROLE = held by LayeronTimelock (upgrades only).
///         Settlement token (USDC) is FIXED at initialization: it is set once and has NO setter.
contract LayeronConfig is Initializable, AccessControlDefaultAdminRulesUpgradeable, UUPSUpgradeable {
    bytes32 public constant CONFIG_ROLE   = keccak256("CONFIG_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MIN_FEE        = 10_000;      // 0.01 USDC (6 decimals)
    uint256 public constant MAX_FEE        = 1_000_000;   // 1.00 USDC
    uint256 public constant MAX_XP_PER_GM  = 100;         // hard ceiling on XP per GM
    uint16  public constant BPS_DENOMINATOR = 10_000;

    /// @notice USDC settlement token. Fixed at init. No setter — Arc USDC is a protocol dependency.
    address public usdc;
    uint256 public gmFee;
    address public devWallet;
    address public rewardWallet;
    uint16  public devBps;
    uint16  public rewardBps;
    uint256 public xpPerGm;
    bool    public gmPaused;

    struct ChainInfo { string name; uint256 chainId; address usdc; address gmContract; string explorerUrl; bool enabled; }
    uint256[] public chainIds;
    mapping(uint256 => ChainInfo) public chains;

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event DevWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event RewardWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event AllocationUpdated(uint16 devBps, uint16 rewardBps);
    event XPUpdated(uint256 oldXp, uint256 newXp);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event ChainUpdated(uint256 indexed chainId, bool enabled);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address admin,          // DEFAULT_ADMIN + CONFIG + PAUSER (your wallet in v1)
        address upgrader,       // UPGRADER_ROLE (the LayeronTimelock)
        uint48  adminDelay,     // delay for the two-step DEFAULT_ADMIN transfer
        address usdc_,
        uint256 gmFee_,
        address devWallet_,
        address rewardWallet_,
        uint16  devBps_,
        uint16  rewardBps_,
        uint256 xpPerGm_
    ) public initializer {
        __AccessControlDefaultAdminRules_init(adminDelay, admin);
        __UUPSUpgradeable_init();

        require(usdc_ != address(0), "usdc=0");
        require(upgrader != address(0), "upgrader=0");
        require(devWallet_ != address(0) && rewardWallet_ != address(0), "wallet=0");
        require(gmFee_ >= MIN_FEE && gmFee_ <= MAX_FEE, "fee out of range");
        require(uint256(devBps_) + rewardBps_ == BPS_DENOMINATOR, "bps != 10000");
        require(xpPerGm_ <= MAX_XP_PER_GM, "xp > max");

        _grantRole(CONFIG_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, upgrader);

        usdc = usdc_;
        gmFee = gmFee_;
        devWallet = devWallet_;
        rewardWallet = rewardWallet_;
        devBps = devBps_;
        rewardBps = rewardBps_;
        xpPerGm = xpPerGm_;
    }

    // ----- CONFIG_ROLE setters (bounded + audited) -----
    function setGmFee(uint256 newFee) external onlyRole(CONFIG_ROLE) {
        require(newFee >= MIN_FEE && newFee <= MAX_FEE, "fee out of range");
        emit FeeUpdated(gmFee, newFee); gmFee = newFee;
    }
    function setDevWallet(address w) external onlyRole(CONFIG_ROLE) {
        require(w != address(0), "wallet=0"); emit DevWalletUpdated(devWallet, w); devWallet = w;
    }
    function setRewardWallet(address w) external onlyRole(CONFIG_ROLE) {
        require(w != address(0), "wallet=0"); emit RewardWalletUpdated(rewardWallet, w); rewardWallet = w;
    }
    function setAllocation(uint16 devBps_, uint16 rewardBps_) external onlyRole(CONFIG_ROLE) {
        require(uint256(devBps_) + rewardBps_ == BPS_DENOMINATOR, "bps != 10000");
        devBps = devBps_; rewardBps = rewardBps_; emit AllocationUpdated(devBps_, rewardBps_);
    }
    function setXpPerGm(uint256 x) external onlyRole(CONFIG_ROLE) {
        require(x <= MAX_XP_PER_GM, "xp > max");   // 0..100
        emit XPUpdated(xpPerGm, x); xpPerGm = x;
    }
    // NOTE: no setUsdc — the settlement token is fixed at initialization.

    // ----- PAUSER_ROLE -----
    function pauseGm() external onlyRole(PAUSER_ROLE)   { gmPaused = true;  emit Paused(msg.sender); }
    function unpauseGm() external onlyRole(PAUSER_ROLE) { gmPaused = false; emit Unpaused(msg.sender); }

    // ----- informational chain registry (does NOT gate GM; see docs) -----
    function upsertChain(ChainInfo calldata info) external onlyRole(CONFIG_ROLE) {
        if (chains[info.chainId].chainId == 0) chainIds.push(info.chainId);
        chains[info.chainId] = info; emit ChainUpdated(info.chainId, info.enabled);
    }
    function allChainIds() external view returns (uint256[] memory) { return chainIds; }

    function feeSplit(uint256 fee) external view returns (uint256 devAmount, uint256 rewardAmount) {
        devAmount = (fee * devBps) / BPS_DENOMINATOR; rewardAmount = fee - devAmount;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

    uint256[40] private __gap;
}
