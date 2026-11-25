// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DepositVault} from "../src/DepositVault.sol";
import {MockUSDG} from "../src/MockUSDG.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envAddress(string calldata name) external view returns (address);
    function addr(uint256 privateKey) external pure returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// One safe real interaction after deploy: the deployer acts as a tenant, mints
/// 30 MockUSDG, and locks it as a deposit with a 60 second demo window.
/// Only valid while the vault uses MockUSDG (real USDG has no public mint).
///   DEPLOYED_CONTRACT=0x... PRIVATE_KEY=... forge script script/Smoke.s.sol --rpc-url $RPC_URL --broadcast
contract Smoke {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    address constant DEMO_LANDLORD = address(uint160(uint256(keccak256("cautio.demo.landlord"))));
    address constant DEMO_ARBITER = address(uint160(uint256(keccak256("cautio.demo.arbiter"))));

    function run() external returns (uint256 leaseId) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        DepositVault vault = DepositVault(vm.envAddress("DEPLOYED_CONTRACT"));
        MockUSDG usdg = MockUSDG(address(vault.token()));
        uint128 deposit = 30e6;

        vm.startBroadcast(pk);
        usdg.mint(vm.addr(pk), deposit);
        usdg.approve(address(vault), deposit);
        leaseId = vault.openLease(DEMO_LANDLORD, DEMO_ARBITER, deposit, 60);
        vm.stopBroadcast();
    }
}
