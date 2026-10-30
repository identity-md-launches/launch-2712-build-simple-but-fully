// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ISqueekCore} from "../src/ISqueekCore.sol";
import {SqueekYield} from "../src/SqueekYield.sol";

/// forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --account <keystore-name>
contract Deploy is Script {
    ISqueekCore constant SQUEEK_CORE = ISqueekCore(0x74665dAecA35A2303e767E76a2FF1FB6F93e119f);

    function run() external returns (SqueekYield pool) {
        vm.startBroadcast();
        pool = new SqueekYield(SQUEEK_CORE);
        vm.stopBroadcast();
        console.log("SqueekYield", address(pool));
        console.log("SEED token ", address(pool.token()));
    }
}
