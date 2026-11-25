// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal view of Paxos USDG: a standard ERC-20 plus the freeze query that
/// Paxos exposes for compliance holds.
interface IUSDG {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function isFrozen(address account) external view returns (bool);
}

/// @title DepositVault
/// @notice Holds a rental security deposit in USDG that neither tenant nor landlord
/// can move alone. At move-out the landlord lists deductions item by item (amount plus
/// SHA-256 of the move-in and move-out photos). The tenant accepts or disputes each one.
/// For the disputed total both sides commit a sealed final offer, reveal it, and a
/// pre-named arbiter must pick one of the two numbers (final-offer arbitration: no
/// averaging). Every waiting phase has a deadline; silence resolves against the
/// silent party, and a landlord who lists nothing in time releases the full deposit.
contract DepositVault {
    enum Phase {
        None,
        Active,
        MoveOut,
        Itemized,
        Sealed,
        Revealed,
        Ruled,
        Settled
    }

    struct Lease {
        address tenant;
        address landlord;
        address arbiter;
        uint128 deposit;
        uint128 claimedTotal;
        uint128 acceptedTotal;
        uint128 disputedTotal;
        uint128 landlordAward;
        uint64 window;
        uint64 deadline;
        Phase phase;
        uint8 itemCount;
    }

    struct Item {
        uint128 amount;
        bytes32 entryPhoto;
        bytes32 exitPhoto;
        bool disputed;
    }

    struct SealedOffer {
        bytes32 commit;
        uint128 amount;
        bool revealed;
    }

    uint8 public constant MAX_ITEMS = 16;
    uint64 public constant MIN_WINDOW = 60;
    uint64 public constant MAX_WINDOW = 30 days;

    IUSDG public immutable token;
    /// The deployer. Its only power is setPaused.
    address public immutable owner;
    bool public paused;
    uint256 public leaseCount;

    mapping(uint256 => Lease) public leases;
    mapping(uint256 => mapping(uint256 => Item)) public items;
    mapping(uint256 => mapping(address => SealedOffer)) public offers;
    /// Payouts that could not be pushed (frozen or rejecting recipient), claimable later.
    mapping(address => uint256) public owed;

    uint256 private _lock = 1;

    error InvalidParty();
    error InvalidAmount();
    error InvalidWindow();
    error WrongPhase(Phase expected, Phase actual);
    error NotAllowed();
    error DeadlinePassed();
    error DeadlineNotReached();
    error TooManyItems();
    error AlreadyDone();
    error BadReveal();
    error TransferFailed();
    error Frozen();
    error Paused();

    event LeaseOpened(uint256 indexed id, address indexed tenant, address indexed landlord, address arbiter, uint256 deposit, uint64 window);
    event MoveOutStarted(uint256 indexed id, uint64 deadline);
    event ItemAdded(uint256 indexed id, uint256 index, uint256 amount, bytes32 entryPhoto, bytes32 exitPhoto);
    event ItemsSubmitted(uint256 indexed id, uint256 claimedTotal, uint64 deadline);
    event ItemsAnswered(uint256 indexed id, uint256 acceptedTotal, uint256 disputedTotal);
    event OfferSealed(uint256 indexed id, address indexed party, bytes32 commit);
    event OfferRevealed(uint256 indexed id, address indexed party, uint256 amount);
    event OfferPicked(uint256 indexed id, address indexed arbiter, bool tenantOffer, uint256 amount);
    event TimeoutResolved(uint256 indexed id, Phase phase);
    event Ruled(uint256 indexed id, uint256 landlordAward);
    event Settled(uint256 indexed id, address indexed landlord, address indexed tenant, uint256 toLandlord, uint256 toTenant);
    event PaymentHeld(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event PausedSet(bool paused);

    modifier nonReentrant() {
        if (_lock != 1) revert NotAllowed();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier inPhase(uint256 id, Phase expected) {
        Phase actual = leases[id].phase;
        if (actual != expected) revert WrongPhase(expected, actual);
        _;
    }

    modifier beforeDeadline(uint256 id) {
        if (block.timestamp > leases[id].deadline) revert DeadlinePassed();
        _;
    }

    constructor(IUSDG usdg) {
        if (address(usdg) == address(0)) revert InvalidParty();
        token = usdg;
        owner = msg.sender;
    }

    /// @notice Pause stops new deposits only. It never blocks moves, timeouts, settle or withdraw,
    /// so a paused vault still returns every locked deposit.
    function setPaused(bool value) external {
        if (msg.sender != owner) revert NotAllowed();
        paused = value;
        emit PausedSet(value);
    }

    // Lease lifecycle

    /// Tenant locks the deposit. `window` is the response time for every later step:
    /// 30 days in production, a few minutes in demo timeout mode.
    function openLease(address landlord, address arbiter, uint128 deposit, uint64 window)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (paused) revert Paused();
        if (
            landlord == address(0) || arbiter == address(0) || landlord == msg.sender || arbiter == msg.sender
                || arbiter == landlord
        ) revert InvalidParty();
        if (deposit == 0) revert InvalidAmount();
        if (window < MIN_WINDOW || window > MAX_WINDOW) revert InvalidWindow();

        id = ++leaseCount;
        Lease storage l = leases[id];
        l.tenant = msg.sender;
        l.landlord = landlord;
        l.arbiter = arbiter;
        l.deposit = deposit;
        l.window = window;
        l.phase = Phase.Active;
        emit LeaseOpened(id, msg.sender, landlord, arbiter, deposit, window);

        _pullIn(msg.sender, deposit);
    }

    /// Either side announces the move-out; the landlord's itemizing clock starts.
    /// Open to either party (tenant or landlord), checked below; no one else.
    function startMoveOut(uint256 id) external inPhase(id, Phase.Active) {
        Lease storage l = leases[id];
        if (msg.sender != l.tenant && msg.sender != l.landlord) revert NotAllowed();
        l.phase = Phase.MoveOut;
        l.deadline = uint64(block.timestamp) + l.window;
        emit MoveOutStarted(id, l.deadline);
    }

    function addItem(uint256 id, uint128 amount, bytes32 entryPhoto, bytes32 exitPhoto)
        external
        inPhase(id, Phase.MoveOut)
        beforeDeadline(id)
    {
        Lease storage l = leases[id];
        if (msg.sender != l.landlord) revert NotAllowed();
        if (l.itemCount >= MAX_ITEMS) revert TooManyItems();
        if (amount == 0 || uint256(l.claimedTotal) + amount > l.deposit) revert InvalidAmount();

        uint256 index = l.itemCount;
        items[id][index] = Item({amount: amount, entryPhoto: entryPhoto, exitPhoto: exitPhoto, disputed: false});
        l.itemCount += 1;
        l.claimedTotal += amount;
        emit ItemAdded(id, index, amount, entryPhoto, exitPhoto);
    }

    function submitItems(uint256 id) external inPhase(id, Phase.MoveOut) beforeDeadline(id) {
        Lease storage l = leases[id];
        if (msg.sender != l.landlord) revert NotAllowed();
        if (l.itemCount == 0) revert InvalidAmount();
        l.phase = Phase.Itemized;
        l.deadline = uint64(block.timestamp) + l.window;
        emit ItemsSubmitted(id, l.claimedTotal, l.deadline);
    }

    /// Tenant answers every item at once. Bit i of `disputeMask` set = item i disputed.
    function respond(uint256 id, uint256 disputeMask) external inPhase(id, Phase.Itemized) beforeDeadline(id) {
        Lease storage l = leases[id];
        if (msg.sender != l.tenant) revert NotAllowed();

        uint128 accepted;
        uint128 disputed;
        for (uint256 i; i < l.itemCount; ++i) {
            Item storage it = items[id][i];
            if (disputeMask & (1 << i) != 0) {
                it.disputed = true;
                disputed += it.amount;
            } else {
                accepted += it.amount;
            }
        }
        l.acceptedTotal = accepted;
        l.disputedTotal = disputed;
        emit ItemsAnswered(id, accepted, disputed);

        if (disputed == 0) {
            _rule(id, accepted);
        } else {
            l.phase = Phase.Sealed;
            l.deadline = uint64(block.timestamp) + l.window;
        }
    }

    // Final-offer arbitration

    /// commit = keccak256(abi.encode(id, sender, amount, salt)). Binding the id and the
    /// sender stops one side from copying the other's commitment.
    function commitOffer(uint256 id, bytes32 commit) external inPhase(id, Phase.Sealed) beforeDeadline(id) {
        Lease storage l = leases[id];
        if (msg.sender != l.tenant && msg.sender != l.landlord) revert NotAllowed();
        if (commit == bytes32(0)) revert BadReveal();
        SealedOffer storage o = offers[id][msg.sender];
        if (o.commit != bytes32(0)) revert AlreadyDone();
        o.commit = commit;
        emit OfferSealed(id, msg.sender, commit);

        if (offers[id][l.tenant].commit != bytes32(0) && offers[id][l.landlord].commit != bytes32(0)) {
            l.phase = Phase.Revealed;
            l.deadline = uint64(block.timestamp) + l.window;
        }
    }

    function revealOffer(uint256 id, uint128 amount, bytes32 salt)
        external
        inPhase(id, Phase.Revealed)
        beforeDeadline(id)
    {
        Lease storage l = leases[id];
        if (msg.sender != l.tenant && msg.sender != l.landlord) revert NotAllowed();
        if (amount > l.disputedTotal) revert InvalidAmount();
        SealedOffer storage o = offers[id][msg.sender];
        if (o.revealed) revert AlreadyDone();
        if (keccak256(abi.encode(id, msg.sender, amount, salt)) != o.commit) revert BadReveal();
        o.amount = amount;
        o.revealed = true;
        emit OfferRevealed(id, msg.sender, amount);
    }

    /// The arbiter can only choose one of the two revealed numbers.
    function pickOffer(uint256 id, bool tenantOffer) external inPhase(id, Phase.Revealed) {
        Lease storage l = leases[id];
        if (msg.sender != l.arbiter) revert NotAllowed();
        SealedOffer storage t = offers[id][l.tenant];
        SealedOffer storage d = offers[id][l.landlord];
        if (!t.revealed || !d.revealed) revert WrongPhase(Phase.Revealed, l.phase);
        uint128 chosen = tenantOffer ? t.amount : d.amount;
        emit OfferPicked(id, msg.sender, tenantOffer, chosen);
        _rule(id, l.acceptedTotal + chosen);
    }

    /// Anyone may call once a deadline passes. Silence loses:
    /// MoveOut: nothing listed, full refund. Itemized: tenant silent, every item stands.
    /// Sealed: the side that committed wins the disputed amount.
    /// Revealed: the side that revealed wins; if both revealed and the arbiter is silent,
    /// the tenant's offer stands (the landlord carries the burden of proof).
    function resolveTimeout(uint256 id) external {
        Lease storage l = leases[id];
        if (l.deadline == 0 || block.timestamp <= l.deadline) revert DeadlineNotReached();
        Phase p = l.phase;
        uint128 award;

        if (p == Phase.MoveOut) {
            award = 0;
        } else if (p == Phase.Itemized) {
            award = l.claimedTotal;
        } else if (p == Phase.Sealed) {
            bool landlordIn = offers[id][l.landlord].commit != bytes32(0);
            bool tenantIn = offers[id][l.tenant].commit != bytes32(0);
            award = (landlordIn && !tenantIn) ? l.acceptedTotal + l.disputedTotal : l.acceptedTotal;
        } else if (p == Phase.Revealed) {
            SealedOffer storage t = offers[id][l.tenant];
            SealedOffer storage d = offers[id][l.landlord];
            if (t.revealed) {
                award = l.acceptedTotal + t.amount;
            } else if (d.revealed) {
                award = l.acceptedTotal + d.amount;
            } else {
                award = l.acceptedTotal;
            }
        } else {
            revert WrongPhase(Phase.MoveOut, p);
        }

        emit TimeoutResolved(id, p);
        _rule(id, award);
    }

    // Payout

    /// One call pays the landlord's award and returns the rest to the tenant.
    /// Anyone may call: the payout goes only to the lease's fixed landlord and tenant.
    function settle(uint256 id) external nonReentrant inPhase(id, Phase.Ruled) {
        Lease storage l = leases[id];
        uint256 toLandlord = l.landlordAward;
        uint256 toTenant = uint256(l.deposit) - toLandlord;
        l.phase = Phase.Settled;
        emit Settled(id, l.landlord, l.tenant, toLandlord, toTenant);

        _payOut(l.landlord, toLandlord);
        _payOut(l.tenant, toTenant);
    }

    /// Pull a payment that was held because the recipient was frozen or rejected it.
    /// Open to anyone, but it pays only the caller's own held balance (owed[msg.sender]).
    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert InvalidAmount();
        if (_isFrozen(msg.sender)) revert Frozen();
        owed[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        if (!_tryTransfer(msg.sender, amount)) revert TransferFailed();
    }

    // Internals

    function _rule(uint256 id, uint128 landlordAward) private {
        Lease storage l = leases[id];
        l.landlordAward = landlordAward;
        l.phase = Phase.Ruled;
        emit Ruled(id, landlordAward);
    }

    function _payOut(address to, uint256 amount) private {
        if (amount == 0) return;
        if (_isFrozen(to) || !_tryTransfer(to, amount)) {
            owed[to] += amount;
            emit PaymentHeld(to, amount);
        }
    }

    /// Pulls exactly `amount` from `from` (always msg.sender at the call site). The balance
    /// is measured around the transfer, so a token that skims a fee cannot leave the vault
    /// crediting more than it holds.
    function _pullIn(address from, uint256 amount) private {
        uint256 beforeBal = token.balanceOf(address(this));
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IUSDG.transferFrom, (from, address(this), amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
        uint256 afterBal = token.balanceOf(address(this));
        if (afterBal < beforeBal || afterBal - beforeBal != amount) revert TransferFailed();
    }

    function _tryTransfer(address to, uint256 amount) private returns (bool) {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IUSDG.transfer, (to, amount)));
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _isFrozen(address account) private view returns (bool) {
        (bool ok, bytes memory data) = address(token).staticcall(abi.encodeCall(IUSDG.isFrozen, (account)));
        return ok && data.length >= 32 && abi.decode(data, (bool));
    }
}
