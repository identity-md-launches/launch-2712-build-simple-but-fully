// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore} from "./ISqueekCore.sol";
import {SeedToken} from "./SeedToken.sol";

/// @title SqueekYield
/// @notice Stake SEED, earn SEED. Every staked token earns a 5% base rate per year plus a fixed
///         amount for every unit of hamster work SqueekCore settles on-chain, so the APY rises
///         while the hamster runs and falls back to the base rate while it rests.
/// @dev Rewards are per staked token (not shared out of a fixed budget), so a staker's rate does not
///      depend on how much others stake. Rewards are minted by this contract, which owns SEED's
///      minter role, so the pool can never run dry. A failing or paused SqueekCore read counts as
///      zero work: deposits, withdrawals and claims never depend on the core.
contract SqueekYield {
    /// @notice 5% a year, as reward wei per staked 1e18 wei per second.
    uint256 public constant BASE_RATE_PER_SECOND = uint256(0.05e18) / 365 days;
    /// @notice Reward wei per staked 1e18 wei for each settled unit of hamster work (1e-7 SEED).
    uint256 public constant REWARD_PER_WORK = 1e11;
    /// @notice Shortest window the APY estimate averages hamster work over.
    uint256 public constant APY_WINDOW = 1 hours;
    /// @notice SqueekCore's own per-round work ceiling (10,000 per 600 s round), used as a sanity cap.
    uint256 public constant MAX_WORK_PER_ROUND = 10_000;
    uint256 public constant ROUND_SECONDS = 600;

    ISqueekCore public immutable core;
    SeedToken public immutable token;

    uint256 public totalStaked;
    /// @notice Accumulated reward wei per 1e18 staked wei.
    uint256 public rewardIndex;
    uint64 public lastAccrued;
    uint64 public lastWork;

    /// @dev Two work snapshots at least APY_WINDOW apart; the APY reads work since the older one.
    uint64 public snapTime;
    uint64 public snapWork;
    uint64 public prevSnapTime;
    uint64 public prevSnapWork;

    mapping(address => uint256) public staked;
    mapping(address => uint256) public userIndex;
    mapping(address => uint256) public owed;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event Accrued(uint256 rewardIndex, uint256 workDelta);

    error ZeroAmount();
    error InsufficientStake();

    constructor(ISqueekCore core_) {
        core = core_;
        token = new SeedToken();
        uint64 work = _coreWork();
        lastAccrued = uint64(block.timestamp);
        lastWork = work;
        snapTime = prevSnapTime = uint64(block.timestamp);
        snapWork = prevSnapWork = work;
    }

    // ---------------------------------------------------------------- actions

    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _accrue();
        _settle(msg.sender);
        staked[msg.sender] += amount;
        totalStaked += amount;
        token.transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (staked[msg.sender] < amount) revert InsufficientStake();
        _accrue();
        _settle(msg.sender);
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        token.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claim() external returns (uint256 amount) {
        _accrue();
        _settle(msg.sender);
        amount = owed[msg.sender];
        if (amount == 0) revert ZeroAmount();
        owed[msg.sender] = 0;
        token.mint(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Folds the latest settled hamster work into the reward index. Anyone may call it.
    function poke() external {
        _accrue();
    }

    // ---------------------------------------------------------------- views

    /// @notice Rewards `user` could claim right now, including work SqueekCore settled since the
    ///         last transaction.
    function pendingRewards(address user) external view returns (uint256) {
        (uint256 index,,) = _previewIndex();
        return owed[user] + (staked[user] * (index - userIndex[user])) / 1e18;
    }

    /// @notice Current APY in basis points: the base rate plus hamster work since the older snapshot,
    ///         annualised. 500 means 5.00%.
    function currentApyBps() public view returns (uint256) {
        uint64 work = _coreWork();
        uint256 dt = block.timestamp - prevSnapTime;
        uint256 dWork = work > prevSnapWork ? work - prevSnapWork : 0;
        uint256 apyWad = BASE_RATE_PER_SECOND * 365 days;
        if (dt > 0) apyWad += (REWARD_PER_WORK * _cap(dWork, dt) * 365 days) / dt;
        return apyWad / 1e14;
    }

    /// @notice One call for the frontend: core work, APY and the user's position.
    function overview(address user)
        external
        view
        returns (
            uint256 apyBps,
            uint256 coreWork,
            uint256 total,
            uint256 userStaked,
            uint256 userPending,
            uint256 userBalance,
            uint256 userAllowance
        )
    {
        (uint256 index,,) = _previewIndex();
        apyBps = currentApyBps();
        coreWork = _coreWork();
        total = totalStaked;
        userStaked = staked[user];
        userPending = owed[user] + (userStaked * (index - userIndex[user])) / 1e18;
        userBalance = token.balanceOf(user);
        userAllowance = token.allowance(user, address(this));
    }

    // ---------------------------------------------------------------- internals

    function _accrue() internal {
        (uint256 index, uint64 work, uint256 dWork) = _previewIndex();
        rewardIndex = index;
        lastAccrued = uint64(block.timestamp);
        lastWork = work;
        if (block.timestamp >= snapTime + APY_WINDOW) {
            prevSnapTime = snapTime;
            prevSnapWork = snapWork;
            snapTime = uint64(block.timestamp);
            snapWork = work;
        }
        emit Accrued(index, dWork);
    }

    function _previewIndex() internal view returns (uint256 index, uint64 work, uint256 dWork) {
        uint256 dt = block.timestamp - lastAccrued;
        work = _coreWork();
        // A core that reports less work than before (reset or upgrade) restarts the count from there.
        dWork = work > lastWork ? _cap(work - lastWork, dt) : 0;
        index = rewardIndex + BASE_RATE_PER_SECOND * dt + REWARD_PER_WORK * dWork;
    }

    function _settle(address user) internal {
        uint256 index = rewardIndex;
        owed[user] += (staked[user] * (index - userIndex[user])) / 1e18;
        userIndex[user] = index;
    }

    function _cap(uint256 dWork, uint256 dt) internal pure returns (uint256) {
        uint256 maxWork = (dt / ROUND_SECONDS + 1) * MAX_WORK_PER_ROUND;
        return dWork > maxWork ? maxWork : dWork;
    }

    function _coreWork() internal view returns (uint64) {
        try core.state() returns (ISqueekCore.CoreState memory s) {
            return s.paused ? lastWork : s.cumulativeWork;
        } catch {
            return lastWork;
        }
    }
}
