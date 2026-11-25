// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DepositVault, IUSDG} from "../src/DepositVault.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface Console {
    function log(string calldata label, address value) external view;
}

/// Deploys DepositVault against an existing USDG token (real Paxos USDG where it is
/// live, for example Arbitrum One). Reads PRIVATE_KEY and USDG_ADDRESS.
/// Smoke.s.sol mints, so it only works against MockUSDG, not against this deployment.
///   PRIVATE_KEY=... USDG_ADDRESS=0x... forge script script/DeployWithUsdg.s.sol --rpc-url $RPC_URL --broadcast
contract DeployWithUsdg {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    Console constant console = Console(0x000000000000000000636F6e736F6c652e6c6f67);

    function run() external returns (DepositVault vault) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address usdg = vm.envAddress("USDG_ADDRESS");

        vm.startBroadcast(pk);
        vault = new DepositVault(IUSDG(usdg));
        vm.stopBroadcast();

        console.log("USDG token:", usdg);
        console.log("DepositVault deployed at:", address(vault));
    }
}
