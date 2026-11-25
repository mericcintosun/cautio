// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DepositVault, IUSDG} from "../src/DepositVault.sol";
import {MockUSDG} from "../src/MockUSDG.sol";

/// Foundry cheatcodes, declared locally because forge-std is not installed
/// (same pattern as script/Smoke.s.sol).
interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
}

/// Walks DEMO.md steps 2 and 3 on chain: Rua Harmonia 302, window 400 accepted,
/// paint 900 disputed, sealed offers 900 (landlord) and 300 (tenant), the arbiter
/// picks the tenant's 300, settle pays 700 to the landlord and 2,300 to the tenant.
contract DepositVaultTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    bool public IS_TEST = true;

    address constant TENANT = address(0xA11CE); // Larissa
    address constant LANDLORD = address(0xB0B); // Otávio
    address constant ARBITER = address(0xCA111A); // Camila

    uint128 constant DEPOSIT = 3_000e6;
    uint128 constant WINDOW_PRICE = 400e6;
    uint128 constant PAINT_PRICE = 900e6;
    uint128 constant LANDLORD_OFFER = 900e6;
    uint128 constant TENANT_OFFER = 300e6;
    uint64 constant WINDOW = 30 days;

    bytes32 constant LANDLORD_SALT = keccak256("cautio.test.salt.landlord");
    bytes32 constant TENANT_SALT = keccak256("cautio.test.salt.tenant");

    MockUSDG usdg;
    DepositVault vault;

    function setUp() public {
        vm.warp(1_764_072_000); // 25 Nov 2025 12:00 UTC, any fixed instant works
        usdg = new MockUSDG();
        vault = new DepositVault(IUSDG(address(usdg)));
    }

    function test_disputedPaintTenantOfferPicked() public {
        // 1. Tenant mints, approves and locks 3,000 USDG.
        vm.startPrank(TENANT);
        usdg.mint(TENANT, DEPOSIT);
        usdg.approve(address(vault), DEPOSIT);
        uint256 id = vault.openLease(LANDLORD, ARBITER, DEPOSIT, WINDOW);
        vm.stopPrank();
        require(usdg.balanceOf(address(vault)) == DEPOSIT, "vault holds deposit");

        // 2. Tenant announces the move-out (tenant or landlord may call).
        vm.prank(TENANT);
        vault.startMoveOut(id);

        // 3. Landlord lists window 400 and paint 900 with photo hash pairs, then submits.
        vm.startPrank(LANDLORD);
        vault.addItem(id, WINDOW_PRICE, sha256("rua-harmonia-302/window/move-in.jpg"), sha256("rua-harmonia-302/window/move-out.jpg"));
        vault.addItem(id, PAINT_PRICE, sha256("rua-harmonia-302/paint/move-in.jpg"), sha256("rua-harmonia-302/paint/move-out.jpg"));
        vault.submitItems(id);
        vm.stopPrank();

        // 4. Tenant accepts the window (item 0) and disputes the paint (item 1): mask 0b10.
        vm.prank(TENANT);
        vault.respond(id, 2);

        // 5. Both sides seal, exactly as revealOffer checks: keccak256(abi.encode(id, sender, amount, salt)).
        vm.prank(LANDLORD);
        vault.commitOffer(id, keccak256(abi.encode(id, LANDLORD, LANDLORD_OFFER, LANDLORD_SALT)));
        vm.prank(TENANT);
        vault.commitOffer(id, keccak256(abi.encode(id, TENANT, TENANT_OFFER, TENANT_SALT)));

        // 6. Both open.
        vm.prank(LANDLORD);
        vault.revealOffer(id, LANDLORD_OFFER, LANDLORD_SALT);
        vm.prank(TENANT);
        vault.revealOffer(id, TENANT_OFFER, TENANT_SALT);

        // 7. The arbiter picks the tenant's number; anyone may settle.
        vm.prank(ARBITER);
        vault.pickOffer(id, true);
        vault.settle(id);

        // 8. One settle paid 400 + 300 = 700 to the landlord and 2,300 back to the tenant.
        require(usdg.balanceOf(LANDLORD) == 700e6, "landlord gets 700");
        require(usdg.balanceOf(TENANT) == 2_300e6, "tenant gets 2,300");
        require(usdg.balanceOf(address(vault)) == 0, "vault emptied");
    }
}
