// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockUSDG
/// @notice Testnet stand-in for Paxos USDG with the same surface DepositVault uses:
/// ERC-20 with 6 decimals plus `isFrozen`. Transfers from or to a frozen account
/// revert, matching USDG's compliance freeze. Anyone may mint up to 10,000 per call
/// so demo wallets can fund a deposit. Swap for the real USDG address when one is
/// confirmed on the target chain; DepositVault takes the token in its constructor.
contract MockUSDG {
    string public constant name = "Mock Global Dollar";
    string public constant symbol = "USDG";
    uint8 public constant decimals = 6;
    uint256 public constant MINT_CAP = 10_000e6;

    address public immutable freezer;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isFrozen;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FreezeChanged(address indexed account, bool frozen);

    constructor() {
        freezer = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(amount <= MINT_CAP, "cap");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function setFrozen(address account, bool frozen) external {
        require(msg.sender == freezer, "not freezer");
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
