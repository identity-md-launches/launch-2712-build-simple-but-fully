// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ISqueekCore} from "../src/ISqueekCore.sol";
import {SqueekYield} from "../src/SqueekYield.sol";
import {SeedToken} from "../src/SeedToken.sol";

contract MockCore is ISqueekCore {
    uint64 public work;
    bool public broken;
    bool public isPaused;

    function setWork(uint64 w) external { work = w; }
    function setBroken(bool b) external { broken = b; }
    function setPaused(bool p) external { isPaused = p; }

    function state() external view returns (CoreState memory s) {
        require(!broken, "down");
        s.cumulativeWork = work;
        s.paused = isPaused;
    }
}

contract SqueekYieldTest is Test {
    MockCore core;
    SqueekYield pool;
    SeedToken seed;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.warp(1_800_000_000);
        core = new MockCore();
        core.setWork(1_000);
        pool = new SqueekYield(core);
        seed = pool.token();
        for (uint256 i; i < 2; i++) {
            address u = i == 0 ? alice : bob;
            vm.startPrank(u);
            seed.faucet();
            seed.approve(address(pool), type(uint256).max);
            vm.stopPrank();
        }
    }

    function test_FaucetAndCooldown() public {
        assertEq(seed.balanceOf(alice), 1_000e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SeedToken.FaucetCooldown.selector, block.timestamp + 1 hours));
        seed.faucet();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        seed.faucet();
        assertEq(seed.balanceOf(alice), 2_000e18);
    }

    function test_DepositWithdraw() public {
        vm.prank(alice);
        pool.deposit(400e18);
        assertEq(pool.staked(alice), 400e18);
        assertEq(pool.totalStaked(), 400e18);
        assertEq(seed.balanceOf(alice), 600e18);

        vm.prank(alice);
        pool.withdraw(150e18);
        assertEq(pool.staked(alice), 250e18);
        assertEq(seed.balanceOf(alice), 750e18);

        vm.prank(alice);
        vm.expectRevert(SqueekYield.InsufficientStake.selector);
        pool.withdraw(251e18);

        vm.prank(alice);
        vm.expectRevert(SqueekYield.ZeroAmount.selector);
        pool.deposit(0);
    }

    function test_BaseRateWhileIdle() public {
        vm.prank(alice);
        pool.deposit(1_000e18);
        vm.warp(block.timestamp + 365 days);
        // 5% a year with no hamster work, within rounding of the per-second rate.
        assertApproxEqRel(pool.pendingRewards(alice), 50e18, 1e12);
        assertEq(pool.currentApyBps(), 499); // 0.05e18 / 365 days truncates just under 5.00%
    }

    function test_WorkRaisesRewardsAndApy() public {
        vm.prank(alice);
        pool.deposit(1_000e18);
        vm.warp(block.timestamp + 1 hours);
        uint256 idle = pool.pendingRewards(alice);
        uint256 idleApy = pool.currentApyBps();

        core.setWork(1_000 + 5_000);
        uint256 busy = pool.pendingRewards(alice);
        // 5,000 work * 1e-7 SEED per staked SEED * 1,000 SEED = 0.5 SEED on top of the base rate
        assertEq(busy - idle, 0.5e18);
        assertGt(pool.currentApyBps(), idleApy);
    }

    function test_ClaimMintsRewards() public {
        vm.prank(alice);
        pool.deposit(1_000e18);
        core.setWork(3_000);
        vm.warp(block.timestamp + 1 days);
        uint256 expected = pool.pendingRewards(alice);
        vm.prank(alice);
        uint256 got = pool.claim();
        assertEq(got, expected);
        assertEq(seed.balanceOf(alice), got);
        assertEq(pool.pendingRewards(alice), 0);
    }

    function test_RewardsAreIndependentOfOtherStakers() public {
        vm.prank(alice);
        pool.deposit(100e18);
        vm.prank(bob);
        pool.deposit(900e18);
        core.setWork(11_000);
        vm.warp(block.timestamp + 1 hours);
        assertEq(pool.pendingRewards(bob), pool.pendingRewards(alice) * 9);
    }

    function test_BrokenOrPausedCoreNeverBlocksWithdraw() public {
        vm.prank(alice);
        pool.deposit(500e18);
        core.setBroken(true);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        pool.withdraw(500e18);
        assertEq(seed.balanceOf(alice), 1_000e18);
        assertGt(pool.pendingRewards(alice), 0);

        core.setBroken(false);
        core.setPaused(true);
        core.setWork(50_000);
        vm.prank(bob);
        pool.deposit(10e18);
        assertEq(pool.lastWork(), 1_000);
    }

    function test_WorkJumpIsCapped() public {
        vm.prank(alice);
        pool.deposit(1e18);
        vm.warp(block.timestamp + 10 minutes);
        core.setWork(type(uint64).max);
        // at most two rounds of work (10,000 each) can count for a 600 s gap
        uint256 maxReward = (uint256(2 * 10_000) * 1e11) + pool.BASE_RATE_PER_SECOND() * 600;
        assertLe(pool.pendingRewards(alice), maxReward);
    }

    function test_OnlyPoolMints() public {
        vm.expectRevert(SeedToken.NotMinter.selector);
        seed.mint(alice, 1);
    }

    function test_Overview() public {
        vm.prank(alice);
        pool.deposit(10e18);
        (uint256 apy, uint256 work, uint256 total, uint256 st,, uint256 bal, uint256 allow) = pool.overview(alice);
        assertEq(apy, 499);
        assertEq(work, 1_000);
        assertEq(total, 10e18);
        assertEq(st, 10e18);
        assertEq(bal, 990e18);
        assertEq(allow, type(uint256).max);
    }
}
