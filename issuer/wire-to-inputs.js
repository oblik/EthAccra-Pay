const fs = require("fs");
const path = require("path");
const compute = require(path.join(
  "..",
  "circuits",
  "membership",
  "compute-commitment"
));

// compute-commitment.js exports nothing; instead we will spawn it. Simpler approach: require ethers here.
const { ethers } = require("ethers");

function namehash(name) {
  let node = "0x" + "00".repeat(32);
  if (!name) return node;
  const labels = name.split(".");
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
    node = ethers.keccak256(ethers.concat([node, labelHash]));
  }
  return node;
}

function normalizeToBytes32(input) {
  let hex;
  if (typeof input === "string" && input.startsWith("0x")) {
    hex = input.slice(2);
  } else {
    hex = BigInt(input).toString(16);
  }
  if (hex.length % 2 === 1) hex = "0" + hex;
  if (hex.length > 64) throw new Error("input too long for bytes32");
  return "0x" + hex.padStart(64, "0");
}

const [idOrEns, amountEth = "0.01", nonce = "0x5"] = process.argv.slice(2);
if (!idOrEns) {
  console.error("Usage: node wire-to-inputs.js <id|ens> [amountEth] [nonce]");
  process.exit(2);
}

const proofsDir = path.join(process.cwd(), "issuer", "issuer-output", "proofs");
const proofsFiles = fs.readdirSync(proofsDir);

let selectedFile =
  proofsFiles.find((f) => f.startsWith(idOrEns)) ||
  proofsFiles.find((f) => f.includes(idOrEns));
if (!selectedFile) {
  // try treating arg as ENS
  selectedFile = proofsFiles.find((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(proofsDir, f), "utf8"));
    return data.ens === idOrEns.toLowerCase();
  });
}
if (!selectedFile) {
  console.error("Could not find proof for", idOrEns);
  process.exit(2);
}

const proofJson = JSON.parse(
  fs.readFileSync(path.join(proofsDir, selectedFile), "utf8")
);
const ens = proofJson.ens;
const leaf = proofJson.leaf;
const root = proofJson.root;

const node = namehash(ens);
const companyNode = namehash("company.eth");
const amountWei = ethers.parseEther(amountEth);
const nonce32 = normalizeToBytes32(nonce);
// Compute nullifier as in the circuit: hash_two(leaf, nonce) = leaf + nonce * 7
const leafBig = BigInt(leaf);
const nonceBig = BigInt(nonce32);
const nullifierBig = leafBig + nonceBig * 7n;
const nullifier = "0x" + nullifierBig.toString(16).padStart(64, "0");
const payment_commitment = ethers.keccak256(
  ethers.solidityPacked(
    ["bytes32", "uint256", "bytes32"],
    [companyNode, amountWei, nonce32]
  )
);

const inputs = {
  team_root: root,
  nullifier,
  payment_commitment,
  leaf,
  nonce: nonce32,
  path_elements: proofJson.proof,
  path_indices: proofJson.proofPositions,
};

const outPath = path.join(
  process.cwd(),
  "circuits",
  "membership",
  "inputs.json"
);
fs.writeFileSync(outPath, JSON.stringify(inputs, null, 2));
console.log("Wrote", outPath);
console.log(JSON.stringify(inputs, null, 2));
