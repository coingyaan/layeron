import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const FEE = 10_000n, DAY = 86_400, ADMIN_DELAY = 2, TL_DELAY = 2, ZERO = ethers.ZeroHash;

async function fx(devBps = 3000, rewardBps = 7000, token = "MockUSDC") {
  const [admin, dev, reward, user, other] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory(token)).deploy();
  const timelock = await (await ethers.getContractFactory("LayeronTimelock"))
    .deploy(TL_DELAY, [admin.address], [admin.address], admin.address);
  const tl = await timelock.getAddress();
  const config = await upgrades.deployProxy(await ethers.getContractFactory("LayeronConfig"),
    [admin.address, tl, ADMIN_DELAY, await usdc.getAddress(), FEE, dev.address, reward.address, devBps, rewardBps, 10], { kind: "uups" });
  const rep = await upgrades.deployProxy(await ethers.getContractFactory("LayeronReputation"),
    [admin.address, tl, ADMIN_DELAY, await config.getAddress()], { kind: "uups" });
  const gm = await upgrades.deployProxy(await ethers.getContractFactory("LayeronGM"),
    [admin.address, tl, ADMIN_DELAY, await config.getAddress(), await rep.getAddress()], { kind: "uups" });
  await rep.connect(admin).grantRole(await rep.GM_ROLE(), await gm.getAddress());
  await usdc.mint(user.address, 1_000_000n);
  await usdc.connect(user).approve(await gm.getAddress(), 1_000_000n);
  return { admin, dev, reward, user, other, usdc, timelock, config, rep, gm };
}

describe("Layeron hardening", () => {
  it("XP bounds: 0/10/100 ok, >100 and unauthorized revert", async () => {
    const { admin, user, config } = await fx();
    expect(await config.MAX_XP_PER_GM()).to.equal(100n);
    await config.connect(admin).setXpPerGm(0);
    await config.connect(admin).setXpPerGm(10);
    await config.connect(admin).setXpPerGm(100);
    await expect(config.connect(admin).setXpPerGm(101)).to.be.revertedWith("xp > max");
    await expect(config.connect(user).setXpPerGm(10)).to.be.reverted;
  });
  it("fees: 30/70 split, bounds, allocation sum, unauthorized", async () => {
    const { admin, dev, reward, user, usdc, config, gm } = await fx();
    await gm.connect(user).gm();
    expect(await usdc.balanceOf(dev.address)).to.equal(3000n);
    expect(await usdc.balanceOf(reward.address)).to.equal(7000n);
    await config.connect(admin).setAllocation(5000, 5000);
    await expect(config.connect(admin).setAllocation(4000, 5000)).to.be.revertedWith("bps != 10000");
    await expect(config.connect(user).setAllocation(3000, 7000)).to.be.reverted;
    await expect(config.connect(admin).setGmFee(9_999)).to.be.revertedWith("fee out of range");
    await expect(config.connect(admin).setGmFee(1_000_001)).to.be.revertedWith("fee out of range");
    await config.connect(admin).setGmFee(1_000_000);
  });
  it("USDC immutable (no setUsdc) and no rescue/withdraw", async () => {
    const { config, gm } = await fx();
    expect((config as any).setUsdc).to.equal(undefined);
    expect((gm as any).rescueERC20).to.equal(undefined);
    expect((gm as any).withdraw).to.equal(undefined);
  });
  it("one GM per UTC day; XP once; streak inc/reset; UTC boundary", async () => {
    const { user, rep, gm } = await fx();
    await gm.connect(user).gm();
    await expect(gm.connect(user).gm()).to.be.revertedWith("already gm today");
    expect((await rep.repOf(user.address)).xp).to.equal(10n);
    await time.increase(DAY); await gm.connect(user).gm();
    expect((await rep.repOf(user.address)).streak).to.equal(2n);
    expect((await rep.repOf(user.address)).xp).to.equal(20n);
    await time.increase(DAY * 2); await gm.connect(user).gm();      // missed a day
    expect((await rep.repOf(user.address)).streak).to.equal(1n);
  });
  it("UTC boundary 23:59:59 -> 00:00:00 both earn XP", async () => {
    const { user, rep, gm } = await fx();
    const now = await time.latest();
    const boundary = (Math.floor(now / DAY) + 1) * DAY;
    await time.setNextBlockTimestamp(boundary - 1); await gm.connect(user).gm();
    await time.setNextBlockTimestamp(boundary + 1); await gm.connect(user).gm();
    expect((await rep.repOf(user.address)).xp).to.equal(20n);
    expect((await rep.repOf(user.address)).streak).to.equal(2n);
  });
  it("pause/unpause gate GM; unauthorized pause reverts", async () => {
    const { admin, user, config, gm } = await fx();
    await config.connect(admin).pauseGm();
    await expect(gm.connect(user).gm()).to.be.revertedWith("gm paused");
    await expect(config.connect(user).pauseGm()).to.be.reverted;
    await config.connect(admin).unpauseGm();
    await gm.connect(user).gm();
  });
  it("reentrancy blocked", async () => {
    const { user, usdc, gm } = await fx(3000, 7000, "ReentrantUSDC");
    await (usdc as any).setTarget(await gm.getAddress());
    await expect(gm.connect(user).gm()).to.be.reverted;
  });
  it("history immutable: only GM_ROLE writes, no user-state setters", async () => {
    const { user, rep } = await fx();
    await expect(rep.connect(user).recordQualifyingGm(user.address, 20000)).to.be.reverted;
    const names = rep.interface.fragments.map((f: any) => f.name).filter(Boolean);
    for (const n of ["setXp", "setStreak", "setRep", "setUserState"]) expect(names).to.not.include(n);
  });
  it("upgrade governance: only timelock upgrades; schedule->delay->execute; storage preserved", async () => {
    const { admin, user, timelock, gm } = await fx();
    expect(await gm.hasRole(await gm.UPGRADER_ROLE(), await timelock.getAddress())).to.equal(true);
    expect(await gm.hasRole(await gm.UPGRADER_ROLE(), admin.address)).to.equal(false);
    const v2 = await (await ethers.getContractFactory("LayeronGMV2")).deploy();
    await expect(gm.connect(admin).upgradeToAndCall(await v2.getAddress(), "0x")).to.be.reverted;
    await gm.connect(user).gm(); const before = await gm.gmCount(user.address);
    const data = gm.interface.encodeFunctionData("upgradeToAndCall", [await v2.getAddress(), "0x"]);
    const target = await gm.getAddress(), salt = ethers.id("u1");
    await timelock.connect(admin).schedule(target, 0, data, ZERO, salt, TL_DELAY);
    await expect(timelock.connect(admin).execute(target, 0, data, ZERO, salt)).to.be.reverted; // before delay
    await time.increase(TL_DELAY + 1);
    await timelock.connect(admin).execute(target, 0, data, ZERO, salt);
    const up = await ethers.getContractAt("LayeronGMV2", target);
    expect(await up.version()).to.equal("v2");
    expect(await up.gmCount(user.address)).to.equal(before);
  });
  it("two-step DEFAULT_ADMIN transfer + role recovery", async () => {
    const { admin, user, other, config } = await fx();
    expect(await config.defaultAdmin()).to.equal(admin.address);
    await expect(config.connect(user).beginDefaultAdminTransfer(other.address)).to.be.reverted;
    await config.connect(admin).beginDefaultAdminTransfer(other.address);
    expect((await config.pendingDefaultAdmin())[0]).to.equal(other.address);
    await expect(config.connect(other).acceptDefaultAdminTransfer()).to.be.reverted; // before delay
    await time.increase(ADMIN_DELAY + 1);
    await config.connect(other).acceptDefaultAdminTransfer();
    expect(await config.defaultAdmin()).to.equal(other.address);
    // CONFIG/PAUSER recovery via grant/revoke
    await config.connect(other).grantRole(await config.CONFIG_ROLE(), user.address);
    expect(await config.hasRole(await config.CONFIG_ROLE(), user.address)).to.equal(true);
    await config.connect(other).revokeRole(await config.CONFIG_ROLE(), user.address);
  });
  it("cross-chain XP: independent reputations each award (gap); shared reputation enforces global rule", async () => {
    const a = await fx(); const b = await fx();
    await a.gm.connect(a.user).gm();
    await b.usdc.mint(a.user.address, 1_000_000n);
    await b.usdc.connect(a.user).approve(await b.gm.getAddress(), 1_000_000n);
    await b.gm.connect(a.user).gm();
    expect((await a.rep.repOf(a.user.address)).xp).to.equal(10n);
    expect((await b.rep.repOf(a.user.address)).xp).to.equal(10n); // NOT global across separate deployments
  });
});
