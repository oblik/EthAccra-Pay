// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface ENSRegistry {
    function resolver(bytes32 node) external view returns (address);
}

interface PublicResolverLike {
    function addr(bytes32 node) external view returns (address payable);
}

interface NoirVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract PaymentGateway {
    event CompanyRegistered(bytes32 indexed node, bytes32 teamRoot, uint256 maxPerPaymentWei);
    event Paid(bytes32 indexed companyNode, bytes32 paymentCommitment, address token, uint256 amount, uint256 timestamp);
    event IssuerSet(bytes32 indexed companyNode, address issuer);
    event CompanyRootUpdated(bytes32 indexed companyNode, bytes32 newRoot);
    event NullifierRevoked(bytes32 indexed companyNode, bytes32 nullifier);

    struct Company {
        bytes32 teamRoot;
        uint256 maxPerPaymentWei;
        bool exists;
        address issuer;
    }

    mapping(bytes32 => Company) public companies;
    // Prevent proof replay by storing used nullifiers
    mapping(bytes32 => bool) public nullifierUsed;
    // Revoked nullifiers per company (issuer/owner can revoke)
    mapping(bytes32 => mapping(bytes32 => bool)) public revokedNullifier;

    ENSRegistry public registry;
    address public publicResolver;
    NoirVerifier public verifier;
    address public owner;
    bool public useSimpleENS;
    address public simpleENSAddress;

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address registry_, address publicResolver_, address verifier_, bool _useSimpleENS, address _simpleENS) {
        registry = ENSRegistry(registry_);
        publicResolver = publicResolver_;
        verifier = NoirVerifier(verifier_);
        owner = msg.sender;
        useSimpleENS = _useSimpleENS;
        simpleENSAddress = _simpleENS;
    }

    function setVerifier(address v) external onlyOwner {
        verifier = NoirVerifier(v);
    }

    function registerCompany(bytes32 node, bytes32 teamRoot, uint256 maxPerPaymentWei) external onlyOwner {
        companies[node] = Company({ teamRoot: teamRoot, maxPerPaymentWei: maxPerPaymentWei, exists: true, issuer: address(0) });
        emit CompanyRegistered(node, teamRoot, maxPerPaymentWei);
    }

    // Owner may set an issuer for a company. Issuer can update roots and revoke nullifiers.
    function setCompanyIssuer(bytes32 companyNode, address issuer_) external onlyOwner {
        require(companies[companyNode].exists, "Company not found");
        companies[companyNode].issuer = issuer_;
        emit IssuerSet(companyNode, issuer_);
    }

    // Owner or issuer can update the team's Merkle root (e.g., rotate issuer root)
    function updateTeamRoot(bytes32 companyNode, bytes32 newRoot) external {
        require(companies[companyNode].exists, "Company not found");
        require(msg.sender == owner || msg.sender == companies[companyNode].issuer, "not authorized");
        companies[companyNode].teamRoot = newRoot;
        emit CompanyRootUpdated(companyNode, newRoot);
    }

    // Owner or issuer can revoke a nullifier (invalidate a credential/nullifier)
    function revokeNullifier(bytes32 companyNode, bytes32 nullifier) external {
        require(companies[companyNode].exists, "Company not found");
        require(msg.sender == owner || msg.sender == companies[companyNode].issuer, "not authorized");
        revokedNullifier[companyNode][nullifier] = true;
        emit NullifierRevoked(companyNode, nullifier);
    }

    function setSimpleENS(bool useSimple, address simpleENS) external onlyOwner {
        useSimpleENS = useSimple;
        simpleENSAddress = simpleENS;
    }

    function _resolve(bytes32 node) internal view returns (address payable) {
        if (useSimpleENS) {
            (bool ok, bytes memory data) = simpleENSAddress.staticcall(abi.encodeWithSignature("getAddr(bytes32)", node));
            require(ok, "simple ENS call failed");
            address resolved = abi.decode(data, (address));
            require(resolved != address(0), "no addr in simple ens");
            return payable(resolved);
        }

        address resolver = registry.resolver(node);
        if (resolver == address(0)) resolver = publicResolver;
        require(resolver != address(0), "No resolver");
        address payable a = PublicResolverLike(resolver).addr(node);
        require(a != address(0), "No addr");
        return a;
    }

    function payETHWithProof(
        bytes32 companyNode,
        bytes calldata membershipProof,
        bytes32[] calldata membershipPublic,
        bytes32 paymentCommitment
    ) external payable {
        Company memory c = companies[companyNode];
        require(c.exists, "Company not found");
        require(msg.value > 0, "No ETH sent");
        require(membershipPublic.length >= 3, "bad public inputs");
        require(membershipPublic[0] == c.teamRoot, "root mismatch");
        require(membershipPublic[2] == paymentCommitment, "commit mismatch");

        bytes32 nullifier = membershipPublic[1];
        require(!revokedNullifier[companyNode][nullifier], "nullifier revoked");
        require(!nullifierUsed[nullifier], "nullifier used");
        require(verifier.verify(membershipProof, membershipPublic), "bad proof");
        nullifierUsed[nullifier] = true;

        address payable payout = _resolve(companyNode);
        (bool ok, ) = payout.call{value: msg.value}("");
        require(ok, "transfer failed");

        emit Paid(companyNode, paymentCommitment, address(0), msg.value, block.timestamp);
    }

    function payERC20WithProof(
        address token,
        bytes32 companyNode,
        uint256 amount,
        bytes calldata membershipProof,
        bytes32[] calldata membershipPublic,
        bytes32 paymentCommitment
    ) external {
        Company memory c = companies[companyNode];
        require(c.exists, "Company not found");
        require(amount > 0, "No tokens specified");
        require(membershipPublic.length >= 3, "bad public inputs");
        require(membershipPublic[0] == c.teamRoot, "root mismatch");
        require(membershipPublic[2] == paymentCommitment, "commit mismatch");

        bytes32 nullifier = membershipPublic[1];
        require(!revokedNullifier[companyNode][nullifier], "nullifier revoked");
        require(!nullifierUsed[nullifier], "nullifier used");
        require(verifier.verify(membershipProof, membershipPublic), "bad proof");
        nullifierUsed[nullifier] = true;

        address payable payout = _resolve(companyNode);
        require(IERC20(token).transferFrom(msg.sender, payout, amount), "ERC20 transfer failed");

        emit Paid(companyNode, paymentCommitment, token, amount, block.timestamp);
    }

    function payETH(bytes32 companyNode, bytes32 paymentCommitment) external payable {
        Company memory c = companies[companyNode];
        require(c.exists, "Company not found");
        require(msg.value > 0, "No ETH sent");
        address payable payout = _resolve(companyNode);
        (bool ok, ) = payout.call{value: msg.value}("");
        require(ok, "transfer failed");
        emit Paid(companyNode, paymentCommitment, address(0), msg.value, block.timestamp);
    }
}
