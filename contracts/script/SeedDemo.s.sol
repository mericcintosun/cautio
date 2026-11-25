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

/// Builds the on-chain demo desk for three role wallets (tenant Larissa, landlord Otávio,
/// arbiter Camila). The chain is append-only, so every run opens two fresh anchor leases;
/// lib/adapter/real.ts shows only the newest lease matching each fingerprint:
///   rua-harmonia-302    deposit 3000e6, itemCount 2, claimedTotal 1300e6, ends in phase Itemized
///   alameda-santos-1140 deposit 3600e6, itemCount 0, window 60, ends in phase MoveOut
/// Sixty seconds after this script lands, the Alameda lease is open to resolveTimeout.
/// Only valid while the vault uses MockUSDG (real USDG has no public mint).
///   cd contracts && forge script script/SeedDemo.s.sol --rpc-url $RPC_URL --broadcast
/// Env: PRIVATE_KEY (farm wallet, pays gas top-ups), DEPLOYED_CONTRACT,
///      DEMO_TENANT_KEY, DEMO_LANDLORD_KEY, DEMO_ARBITER_KEY.
/// The two lease ids are the script's return values, printed by forge.
contract SeedDemo {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint256 constant TOP_UP = 0.002 ether;
    uint256 constant TOP_UP_BELOW = 0.001 ether;
    uint256 constant MINT = 10_000e6; // MockUSDG.MAX_MINT

    uint128 constant HARMONIA_DEPOSIT = 3000e6;
    uint128 constant SANTOS_DEPOSIT = 3600e6;
    uint64 constant HARMONIA_WINDOW = 30 days;
    uint64 constant SANTOS_WINDOW = 60;

    function run() external returns (uint256 harmoniaId, uint256 santosId) {
        uint256 farmPk = vm.envUint("PRIVATE_KEY");
        DepositVault vault = DepositVault(vm.envAddress("DEPLOYED_CONTRACT"));
        uint256 tenantPk = vm.envUint("DEMO_TENANT_KEY");
        uint256 landlordPk = vm.envUint("DEMO_LANDLORD_KEY");
        uint256 arbiterPk = vm.envUint("DEMO_ARBITER_KEY");

        address tenant = vm.addr(tenantPk);
        address landlord = vm.addr(landlordPk);
        address arbiter = vm.addr(arbiterPk);
        MockUSDG usdg = MockUSDG(address(vault.token()));

        // 1. Gas for the three role wallets, only where it is running low.
        vm.startBroadcast(farmPk);
        _topUp(tenant);
        _topUp(landlord);
        _topUp(arbiter);
        vm.stopBroadcast();

        // 2. Tenant funds both deposits plus demo step 1 (3,000) from one MAX_MINT.
        // 3. Tenant locks both anchor deposits.
        vm.startBroadcast(tenantPk);
        usdg.mint(tenant, MINT);
        usdg.approve(address(vault), uint256(HARMONIA_DEPOSIT) + uint256(SANTOS_DEPOSIT));
        harmoniaId = vault.openLease(landlord, arbiter, HARMONIA_DEPOSIT, HARMONIA_WINDOW);
        santosId = vault.openLease(landlord, arbiter, SANTOS_DEPOSIT, SANTOS_WINDOW);
        vm.stopBroadcast();

        // Rua Harmonia: the landlord lists the window (400) and the paint (900) and submits.
        // Alameda Santos: the landlord announces move-out and then lists nothing.
        vm.startBroadcast(landlordPk);
        vault.startMoveOut(harmoniaId);
        vault.addItem(harmoniaId, 400e6, keccak256("cautio.window.in"), keccak256("cautio.window.out"));
        vault.addItem(harmoniaId, 900e6, keccak256("cautio.paint.in"), keccak256("cautio.paint.out"));
        vault.submitItems(harmoniaId);
        vault.startMoveOut(santosId);
        vm.stopBroadcast();
    }

    function _topUp(address to) private {
        if (to.balance >= TOP_UP_BELOW) return;
        (bool ok,) = payable(to).call{value: TOP_UP}("");
        require(ok, "top-up failed");
    }
}
