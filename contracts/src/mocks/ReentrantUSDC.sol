// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
interface IGm { function gm() external; }
/// @dev Attempts to reenter LayeronGM.gm() during transferFrom to prove ReentrancyGuard holds.
contract ReentrantUSDC is ERC20 {
    address public target; bool private attacking;
    constructor() ERC20("Reentrant USDC","rUSDC") {}
    function decimals() public pure override returns (uint8){ return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
    function setTarget(address t) external { target = t; }
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (target != address(0) && !attacking) { attacking = true; IGm(target).gm(); }
        return super.transferFrom(from, to, amount);
    }
}
