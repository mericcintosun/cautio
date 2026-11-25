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
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter) external;
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

    address constant STRANGER = address(0x5757);

    MockUSDG usdg;
    DepositVault vault;

    event Settled(uint256 indexed id, uint256 toLandlord, uint256 toTenant);

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

    // Helpers

    /// Tenant mints in MAX_MINT chunks (the faucet cap), approves and opens a lease.
    function _open(uint128 deposit) internal returns (uint256 id) {
        vm.startPrank(TENANT);
        uint256 left = deposit;
        while (left > 0) {
            uint256 chunk = left > usdg.MAX_MINT() ? usdg.MAX_MINT() : left;
            usdg.mint(TENANT, chunk);
            left -= chunk;
        }
        usdg.approve(address(vault), deposit);
        id = vault.openLease(LANDLORD, ARBITER, deposit, WINDOW);
        vm.stopPrank();
    }

    /// Demo lease up to both offers revealed: window 400 accepted, paint 900 disputed,
    /// landlord 900, tenant 300.
    function _toRevealed() internal returns (uint256 id) {
        id = _open(DEPOSIT);
        vm.prank(TENANT);
        vault.startMoveOut(id);
        vm.startPrank(LANDLORD);
        vault.addItem(id, WINDOW_PRICE, sha256("window/in"), sha256("window/out"));
        vault.addItem(id, PAINT_PRICE, sha256("paint/in"), sha256("paint/out"));
        vault.submitItems(id);
        vm.stopPrank();
        vm.prank(TENANT);
        vault.respond(id, 2);
        vm.prank(LANDLORD);
        vault.commitOffer(id, keccak256(abi.encode(id, LANDLORD, LANDLORD_OFFER, LANDLORD_SALT)));
        vm.prank(TENANT);
        vault.commitOffer(id, keccak256(abi.encode(id, TENANT, TENANT_OFFER, TENANT_SALT)));
        vm.prank(LANDLORD);
        vault.revealOffer(id, LANDLORD_OFFER, LANDLORD_SALT);
        vm.prank(TENANT);
        vault.revealOffer(id, TENANT_OFFER, TENANT_SALT);
    }

    // Events

    function test_settleEmitsSettled() public {
        uint256 id = _toRevealed();
        vm.prank(ARBITER);
        vault.pickOffer(id, true);

        vm.expectEmit(true, true, true, true, address(vault));
        emit Settled(id, 700e6, 2_300e6);
        vault.settle(id);
    }

    // Reverts

    function test_revert_pickOfferByStranger() public {
        uint256 id = _toRevealed();
        vm.expectRevert(DepositVault.NotAllowed.selector);
        vm.prank(STRANGER);
        vault.pickOffer(id, true);
    }

    function test_revert_revealWrongSalt() public {
        uint256 id = _open(DEPOSIT);
        vm.prank(TENANT);
        vault.startMoveOut(id);
        vm.startPrank(LANDLORD);
        vault.addItem(id, PAINT_PRICE, sha256("paint/in"), sha256("paint/out"));
        vault.submitItems(id);
        vm.stopPrank();
        vm.prank(TENANT);
        vault.respond(id, 1);
        vm.prank(LANDLORD);
        vault.commitOffer(id, keccak256(abi.encode(id, LANDLORD, LANDLORD_OFFER, LANDLORD_SALT)));
        vm.prank(TENANT);
        vault.commitOffer(id, keccak256(abi.encode(id, TENANT, TENANT_OFFER, TENANT_SALT)));

        vm.expectRevert(DepositVault.BadReveal.selector);
        vm.prank(TENANT);
        vault.revealOffer(id, TENANT_OFFER, keccak256("not the salt"));
    }

    function test_revert_setFrozenByStranger() public {
        vm.expectRevert(MockUSDG.NotOwner.selector);
        vm.prank(STRANGER);
        usdg.setFrozen(TENANT, true);
    }

    // Timeouts and frozen recipients

    function test_landlordSilenceFullRefund() public {
        uint256 id = _open(DEPOSIT);
        vm.prank(TENANT);
        vault.startMoveOut(id);

        // The landlord lists nothing inside the window.
        vm.warp(block.timestamp + WINDOW + 1);
        vault.resolveTimeout(id);
        vault.settle(id);

        require(usdg.balanceOf(TENANT) == DEPOSIT, "tenant gets the full deposit");
        require(usdg.balanceOf(LANDLORD) == 0, "landlord gets nothing");
        require(usdg.balanceOf(address(vault)) == 0, "vault emptied");
    }

    function test_frozenTenantPaymentHeldThenWithdraw() public {
        uint256 id = _toRevealed();
        vm.prank(ARBITER);
        vault.pickOffer(id, true);

        // This test contract deployed MockUSDG, so it is the owner.
        usdg.setFrozen(TENANT, true);
        vault.settle(id);

        require(usdg.balanceOf(LANDLORD) == 700e6, "landlord still paid");
        require(usdg.balanceOf(TENANT) == 0, "frozen tenant not paid");
        require(vault.owed(TENANT) == 2_300e6, "tenant share held");
        require(usdg.balanceOf(address(vault)) == 2_300e6, "vault keeps the held share");

        usdg.setFrozen(TENANT, false);
        vm.prank(TENANT);
        vault.withdraw();

        require(usdg.balanceOf(TENANT) == 2_300e6, "tenant withdrew");
        require(vault.owed(TENANT) == 0, "owed cleared");
        require(usdg.balanceOf(address(vault)) == 0, "vault emptied");
    }

    // Fuzz

    /// Whatever the deposit, claim and offers, settle pays out exactly the deposit.
    function testFuzz_settleConservesDeposit(uint128 deposit, uint128 claim, uint128 tenantOffer, bool pickTenant) public {
        uint128 dep = uint128(1e6 + (uint256(deposit) % (1e12 - 1e6 + 1)));
        uint128 claimed = uint128(1 + (uint256(claim) % dep));
        uint128 tOffer = uint128(uint256(tenantOffer) % (uint256(claimed) + 1));
        uint128 lOffer = claimed;

        uint256 id = _open(dep);
        vm.prank(TENANT);
        vault.startMoveOut(id);
        vm.startPrank(LANDLORD);
        vault.addItem(id, claimed, sha256("fuzz/in"), sha256("fuzz/out"));
        vault.submitItems(id);
        vm.stopPrank();
        vm.prank(TENANT);
        vault.respond(id, 1);

        vm.prank(LANDLORD);
        vault.commitOffer(id, keccak256(abi.encode(id, LANDLORD, lOffer, LANDLORD_SALT)));
        vm.prank(TENANT);
        vault.commitOffer(id, keccak256(abi.encode(id, TENANT, tOffer, TENANT_SALT)));
        vm.prank(LANDLORD);
        vault.revealOffer(id, lOffer, LANDLORD_SALT);
        vm.prank(TENANT);
        vault.revealOffer(id, tOffer, TENANT_SALT);

        vm.prank(ARBITER);
        vault.pickOffer(id, pickTenant);
        vault.settle(id);

        uint256 toLandlord = usdg.balanceOf(LANDLORD);
        uint256 toTenant = usdg.balanceOf(TENANT);
        require(toLandlord + toTenant == dep, "receipts sum to the deposit");
        require(toLandlord == (pickTenant ? tOffer : lOffer), "landlord gets the picked offer");
        require(usdg.balanceOf(address(vault)) == 0, "vault emptied");
    }
}
