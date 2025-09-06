import React, { useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";

const ABI = [
  "event CompanyRegistered(bytes32 indexed node, bytes32 teamRoot, uint256 maxPerPaymentWei)",
  "event Paid(bytes32 indexed companyNode, bytes32 paymentCommitment, address token, uint256 amount, uint256 timestamp)",
  "function registerCompany(bytes32 node, bytes32 teamRoot, uint256 maxPerPaymentWei) external",
  "function payETHWithProof(bytes32 companyNode, bytes calldata membershipProof, bytes32[] calldata membershipPublic, bytes32 paymentCommitment) external payable",
  "function payERC20WithProof(address token, bytes32 companyNode, uint256 amount, bytes calldata membershipProof, bytes32[] calldata membershipPublic, bytes32 paymentCommitment) external",
  "function payETH(bytes32 companyNode, bytes32 paymentCommitment) external payable",
];

function namehash(name) {
  let node = "0x" + "00".repeat(32);
  if (name) {
    const labels = name.split(".");
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
      node = ethers.keccak256(ethers.concat([node, labelHash]));
    }
  }
  return node;
}

function parsePublicInputs(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("Public inputs must be an array");
    return arr.map((v) => {
      if (typeof v !== "string")
        throw new Error("Public input entries must be hex strings");
      let s = v.startsWith("0x") ? v.slice(2) : v;
      if (s.length > 64) s = s.slice(-64);
      while (s.length < 64) s = "0" + s;
      return "0x" + s;
    });
  } catch (e) {
    throw new Error("Failed to parse public inputs JSON: " + e.message);
  }
}

export default function App() {
  // Initialize critical configuration from Vite env vars so the UI can be prefilled
  // Vite exposes env vars as import.meta.env.VITE_*
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [gatewayAddress, setGatewayAddress] = useState(
    import.meta.env.VITE_GATEWAY_ADDRESS || ""
  );
  const [useSimpleENS, setUseSimpleENS] = useState(
    typeof import.meta.env.VITE_USE_SIMPLE_ENS !== "undefined"
      ? import.meta.env.VITE_USE_SIMPLE_ENS === "true"
      : true
  );
  const [simpleENSAddress, setSimpleENSAddress] = useState(
    import.meta.env.VITE_SIMPLE_ENS_ADDRESS || ""
  );
  const [ensName, setEnsName] = useState(
    import.meta.env.VITE_COMPANY_NAME || "refugeeaid.eth"
  );
  const [amount, setAmount] = useState("0.01");
  const [tokenAddress, setTokenAddress] = useState(
    "0x2717ee739eD596Df58D89A967ae14A8F30EbE9d6"
  );
  const [nonceHex, setNonceHex] = useState("");
  const [proofHex, setProofHex] = useState("");
  const [pubInputsText, setPubInputsText] = useState(
    '["0x...","0x...","0x..."]'
  );
  const [logs, setLogs] = useState([]);
  const [beneficiaryId, setBeneficiaryId] = useState("alice");
  const [merkleProof, setMerkleProof] = useState(
    '["0x128bca4b15020dbec0d48e793771e104bd7d988a029c24c7e3a72696d6091c8e"]'
  );
  const [merkleProofPositions, setMerkleProofPositions] = useState("[1]");

  const gateway = useMemo(() => {
    if (!signer || !gatewayAddress) return null;
    return new Contract(gatewayAddress, ABI, signer);
  }, [signer, gatewayAddress]);

  async function connect() {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet");
        return;
      }

      console.log("Connecting to wallet...");
      const prov = new BrowserProvider(window.ethereum);

      // Request account access
      await prov.send("eth_requestAccounts", []);
      const s = await prov.getSigner();
      const addr = await s.getAddress();

      // Check if we're on Base Sepolia (chain ID 84532)
      const network = await prov.getNetwork();
      console.log("Connected to network:", network);

      if (network.chainId !== 84532n) {
        try {
          // Try to switch to Base Sepolia
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }], // Base Sepolia chain ID
          });
        } catch (switchError) {
          // If network doesn't exist, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x14a34',
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org']
              }]
            });
          }
        }
      }

      setProvider(prov);
      setSigner(s);
      setAccount(addr);
      pushLog("Connected to wallet: " + addr);
      console.log("Wallet connected successfully:", addr);
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Failed to connect wallet: " + error.message);
    }
  }

  function pushLog(m) {
    setLogs((x) => [m, ...x].slice(0, 40));
  }

  async function registerDemo(gatewayAddr, simpleEnsAddr) {
    if (!gatewayAddr || !simpleEnsAddr) return alert("Set addresses");
    const node = namehash(ensName);
    const teamRoot = ethers.keccak256(ethers.toUtf8Bytes("demo-team"));
    const max = ethers.parseEther("1000");
    const g = new Contract(gatewayAddr, ABI, signer);
    const tx = await g.registerCompany(node, teamRoot, max);
    await tx.wait();
    if (simpleEnsAddr) {
      const ENS_ABI = [
        "function setAddr(bytes32 node, address resolved) external",
      ];
      const ens = new Contract(simpleEnsAddr, ENS_ABI, signer);
      const set = await ens.setAddr(node, account);
      await set.wait();
    }
    pushLog("Registered demo company and set ENS");
  }

  async function payETH() {
    if (!gateway) return alert("Set gateway address");

    // Auto-generate proof if not already generated
    if (
      !proofHex ||
      !pubInputsText ||
      pubInputsText === '["0x...","0x...","0x..."]'
    ) {
      try {
        await generateProofFromMerkle(
          beneficiaryId,
          merkleProof,
          merkleProofPositions
        );
      } catch (error) {
        return alert("Failed to generate proof: " + error.message);
      }
    }

    const node = namehash(ensName);
    const amountWei = ethers.parseEther(amount);
    const usedNonce =
      nonceHex && nonceHex.length
        ? nonceHex
        : ethers.hexlify(ethers.randomBytes(32));
    const commitment = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256", "bytes32"],
        [node, amountWei, usedNonce]
      )
    );
    let pub;
    try {
      pub = parsePublicInputs(pubInputsText);
    } catch (e) {
      return alert(e.message);
    }
    if (pub[2] !== commitment)
      return alert("Commitment mismatch. Regenerate proof.");
    const tx = await gateway.payETHWithProof(node, proofHex, pub, commitment, {
      value: amountWei,
    });
    const rcpt = await tx.wait();
    pushLog("Paid ETH! Tx: " + rcpt.transactionHash);
  }

  async function payERC20() {
    if (!gateway) return alert("Set gateway address");
    if (!tokenAddress) return alert("Set ERC20 token address");

    // Auto-generate proof if not already generated
    if (
      !proofHex ||
      !pubInputsText ||
      pubInputsText === '["0x...","0x...","0x..."]'
    ) {
      try {
        await generateProofFromMerkle(
          beneficiaryId,
          merkleProof,
          merkleProofPositions
        );
      } catch (error) {
        return alert("Failed to generate proof: " + error.message);
      }
    }

    const node = namehash(ensName);
    const amountWei = ethers.parseUnits(amount, 18);
    const usedNonce =
      nonceHex && nonceHex.length
        ? nonceHex
        : ethers.hexlify(ethers.randomBytes(32));
    const commitment = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256", "bytes32"],
        [node, amountWei, usedNonce]
      )
    );
    let pub;
    try {
      pub = parsePublicInputs(pubInputsText);
    } catch (e) {
      return alert(e.message);
    }
    if (pub[2] !== commitment)
      return alert("Commitment mismatch. Regenerate proof.");
    const ERC20 = [
      "function approve(address spender, uint256 amount) external returns (bool)",
    ];
    const token = new Contract(tokenAddress, ERC20, signer);
    const approve = await token.approve(gatewayAddress, amountWei);
    await approve.wait();
    const tx = await gateway.payERC20WithProof(
      tokenAddress,
      node,
      amountWei,
      proofHex,
      pub,
      commitment
    );
    const rcpt = await tx.wait();
    pushLog("Paid ERC20! Tx: " + rcpt.transactionHash);
  }

  async function generateProofFromMerkle(
    beneficiaryId,
    merkleProof,
    positions
  ) {
    try {
      // Load beneficiary data from issuer output
      const response = await fetch(
        `/issuer/issuer-output/proofs/${beneficiaryId}.json`
      );
      const beneficiaryData = await response.json();

      // Use provided Merkle proof or fall back to beneficiary data
      const proofElements = merkleProof
        ? JSON.parse(merkleProof)
        : beneficiaryData.proof;
      const proofPositions = positions
        ? JSON.parse(positions)
        : beneficiaryData.proofPositions;

      // Generate commitment
      const node = namehash(ensName);
      const amountWei = ethers.parseEther(amount);
      const usedNonce =
        nonceHex && nonceHex.length
          ? nonceHex
          : ethers.hexlify(ethers.randomBytes(32));
      const commitment = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "bytes32"],
          [node, amountWei, usedNonce]
        )
      );

      // Create inputs for Noir circuit
      const inputs = {
        team_root: beneficiaryData.root,
        nullifier: beneficiaryData.leaf, // Using leaf as nullifier for simplicity
        payment_commitment: commitment.slice(2), // Remove 0x prefix
        leaf: beneficiaryData.leaf,
        nonce: usedNonce.slice(2), // Remove 0x prefix
        path_elements: proofElements,
        path_indices: proofPositions,
      };

      // For demo purposes, generate mock proof
      const mockProof = {
        proof:
          "0x" +
          inputs.team_root.slice(2).padStart(64, "0") +
          inputs.nullifier.slice(2).padStart(64, "0") +
          inputs.payment_commitment.padStart(64, "0"),
        public_inputs: [
          "0x" + inputs.team_root.slice(2),
          "0x" + inputs.nullifier.slice(2),
          commitment,
        ],
      };

      setProofHex(mockProof.proof);
      setPubInputsText(JSON.stringify(mockProof.public_inputs));
      setNonceHex(usedNonce);

      pushLog("Generated proof from Merkle data");
      return mockProof;
    } catch (error) {
      pushLog("Error generating proof: " + error.message);
      throw error;
    }
  }

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: 900,
        margin: "30px auto",
        padding: "20px",
        background:
          "url('/background.svg') no-repeat center center fixed, linear-gradient(135deg, rgba(245, 247, 250, 0.9) 0%, rgba(195, 207, 226, 0.9) 100%)",
        backgroundSize: "cover",
        borderRadius: "10px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
        color: "#333",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          color: "#2c3e50",
          textAlign: "center",
          marginBottom: "20px",
          fontSize: "2.5em",
          textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        Refugee Aid Payment Gateway — ZK-Protected Aid Distribution
      </h1>
      <p
        style={{
          textAlign: "center",
          fontSize: "1.1em",
          color: "#34495e",
          marginBottom: "20px",
        }}
      >
        Status: {account ? `Connected ${account}` : "Not connected"}
      </p>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={connect}
          style={{
            background: "linear-gradient(45deg, #3498db, #2980b9)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            fontSize: "1em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Connect Wallet
        </button>
      </div>

      <h2
        style={{
          color: "#27ae60",
          borderBottom: "2px solid #27ae60",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Configuration
      </h2>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Gateway address:
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={gatewayAddress}
          onChange={(e) => setGatewayAddress(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Use local SimpleENS:
        </label>
        <input
          type="checkbox"
          checked={useSimpleENS}
          onChange={(e) => setUseSimpleENS(e.target.checked)}
          style={{ transform: "scale(1.2)" }}
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          SimpleENS address:
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={simpleENSAddress}
          onChange={(e) => setSimpleENSAddress(e.target.value)}
          placeholder="0x... (for local)"
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          ENS name:
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={ensName}
          onChange={(e) => setEnsName(e.target.value)}
        />
      </div>

      <h2
        style={{
          color: "#e74c3c",
          borderBottom: "2px solid #e74c3c",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Aid Organization Setup (Demo)
      </h2>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={() => registerDemo(gatewayAddress, simpleENSAddress)}
          style={{
            background: "linear-gradient(45deg, #e74c3c, #c0392b)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            fontSize: "1em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Register Aid Organization
        </button>
      </div>

      <h2
        style={{
          color: "#9b59b6",
          borderBottom: "2px solid #9b59b6",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        ZK Membership Proof
      </h2>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Proof hex:
        </label>
        <textarea
          rows={3}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
            fontFamily: "monospace",
          }}
          value={proofHex}
          onChange={(e) => setProofHex(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Public inputs JSON:
        </label>
        <textarea
          rows={3}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
            fontFamily: "monospace",
          }}
          value={pubInputsText}
          onChange={(e) => setPubInputsText(e.target.value)}
        />
      </div>

      <h2
        style={{
          color: "#f39c12",
          borderBottom: "2px solid #f39c12",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Distribute Aid (ETH)
      </h2>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Amount (ETH):
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Nonce (hex, optional):
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={nonceHex}
          onChange={(e) => setNonceHex(e.target.value)}
          placeholder="0x... (paste nonce from Prover)"
        />
      </div>
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <button
          onClick={() => setNonceHex(ethers.hexlify(ethers.randomBytes(32)))}
          style={{
            background: "linear-gradient(45deg, #f39c12, #e67e22)",
            color: "white",
            border: "none",
            padding: "10px 20px",
            fontSize: "0.9em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Generate random nonce
        </button>
      </div>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={payETH}
          style={{
            background: "linear-gradient(45deg, #27ae60, #2ecc71)",
            color: "white",
            border: "none",
            padding: "15px 30px",
            fontSize: "1.1em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Prove & Pay (ETH)
        </button>
      </div>

      <h2
        style={{
          color: "#8e44ad",
          borderBottom: "2px solid #8e44ad",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Distribute Aid (ERC20 Tokens)
      </h2>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          ERC20 Token Address:
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Amount (tokens, 18 decimals):
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Nonce (hex, optional):
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={nonceHex}
          onChange={(e) => setNonceHex(e.target.value)}
          placeholder="0x... (paste nonce from Prover)"
        />
      </div>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={payERC20}
          style={{
            background: "linear-gradient(45deg, #8e44ad, #9b59b6)",
            color: "white",
            border: "none",
            padding: "15px 30px",
            fontSize: "1.1em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Prove & Pay (ERC20)
        </button>
      </div>

      <h2
        style={{
          color: "#16a085",
          borderBottom: "2px solid #16a085",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Transaction Logs
      </h2>
      <div
        style={{
          background: "#34495e",
          color: "#ecf0f1",
          padding: "15px",
          minHeight: "140px",
          borderRadius: "5px",
          fontFamily: "monospace",
          overflowY: "auto",
        }}
      >
        {logs.map((l, i) => (
          <div key={i} style={{ marginBottom: "5px" }}>
            • {l}
          </div>
        ))}
      </div>
      <p
        style={{
          color: "#7f8c8d",
          fontSize: "0.9em",
          marginTop: "20px",
          textAlign: "center",
        }}
      >
        Secure aid distribution: Generate a real ZK proof with{" "}
        <code>nargo prove</code> to verify refugee membership privately. The
        contract ensures aid reaches verified recipients without revealing
        identities.
      </p>

      <h2
        style={{
          color: "#9b59b6",
          borderBottom: "2px solid #9b59b6",
          paddingBottom: "5px",
          marginBottom: "20px",
        }}
      >
        Beneficiary Information
      </h2>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Beneficiary ID:
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={beneficiaryId}
          onChange={(e) => setBeneficiaryId(e.target.value)}
          placeholder="alice"
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Merkle Proof (JSON array):
        </label>
        <textarea
          rows={2}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
            fontFamily: "monospace",
          }}
          value={merkleProof}
          onChange={(e) => setMerkleProof(e.target.value)}
          placeholder='["0x..."]'
        />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}
        >
          Proof Positions (JSON array):
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #bdc3c7",
            borderRadius: "5px",
            fontSize: "1em",
            background: "#ecf0f1",
          }}
          value={merkleProofPositions}
          onChange={(e) => setMerkleProofPositions(e.target.value)}
          placeholder="[1]"
        />
      </div>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={() =>
            generateProofFromMerkle(
              beneficiaryId,
              merkleProof,
              merkleProofPositions
            )
          }
          style={{
            background: "linear-gradient(45deg, #9b59b6, #8e44ad)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            fontSize: "1em",
            borderRadius: "5px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          Generate ZK Proof from Merkle Data
        </button>
      </div>
    </div>
  );
}
