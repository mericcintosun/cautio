// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockUSDG
/// @notice Testnet stand-in for Paxos USDG with the same surface DepositVault uses:
/// ERC-20 with 6 decimals plus `isFrozen`. Transfers from or to a frozen account
/// revert, matching USDG's compliance freeze. Swap for the real USDG address when one
/// is confirmed on the target chain; DepositVault takes the token in its constructor.
contract MockUSDG {
    string public constant name = "Mock Global Dollar";
    string public constant symbol = "USDG";
    uint8 public constant decimals = 6;

    /// @notice Per-call mint cap of 10,000 USDG. `mint` is an open testnet faucet so any
    /// demo wallet can fund a deposit; the cap keeps one call from minting a supply
    /// large enough to overflow balances or make the demo numbers meaningless.
    uint256 public constant MAX_MINT = 10_000e6;

    /// @notice The deployer. Only the owner may freeze or unfreeze an account, as only
    /// Paxos can on the real token.
    address public immutable owner;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isFrozen;

    error NotOwner();
    error MintCapExceeded();

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed holder, address indexed spender, uint256 value);
    event FreezeChanged(address indexed account, bool frozen);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Open testnet faucet, at most MAX_MINT per call.
    function mint(address to, uint256 amount) external {
        if (amount > MAX_MINT) revert MintCapExceeded();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function setFrozen(address account, bool frozen) external {
        if (msg.sender != owner) revert NotOwner();
        isFrozen[account] = frozen;
        emit FreezeChanged(account, frozen);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(!isFrozen[from] && !isFrozen[to], "frozen");
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
