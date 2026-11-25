// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DepositVault, IUSDG} from "../src/DepositVault.sol";
import {MockUSDG} from "../src/MockUSDG.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface Console {
    function log(string calldata label, address value) external view;
}

/// Deploys MockUSDG and a DepositVault that uses it. No official USDG exists on
/// Arbitrum Sepolia, so this script always deploys the mock. To point a vault at an
/// existing token instead, use script/DeployWithUsdg.s.sol.
/// Reads only PRIVATE_KEY.
///   PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract Deploy {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    Console constant console = Console(0x000000000000000000636F6e736F6c652e6c6f67);

    function run() external returns (DepositVault vault) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        MockUSDG usdg = new MockUSDG();
        vault = new DepositVault(IUSDG(address(usdg)));
        vm.stopBroadcast();

        console.log("USDG token:", address(usdg));
        console.log("DepositVault deployed at:", address(vault));
    }
}
