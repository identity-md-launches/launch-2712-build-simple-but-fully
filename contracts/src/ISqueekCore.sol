// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The read-only slice of SqueekCore (Sepolia 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f)
///         that SqueekYield uses. Layout taken from the verified implementation ABI.
interface ISqueekCore {
    struct CoreState {
        uint64 settledThroughRound;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint64 blockHeight;
        uint96 blockProgress;
        uint32 workPerThousandBlocks;
        uint256 authorizationNonce;
        bool paused;
    }

    function state() external view returns (CoreState memory);
}
