const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const argv = process.argv.slice(2);
const beneficiariesPath =
  argv[0] || path.join(process.cwd(), "beneficiaries.json");

if (!fs.existsSync(beneficiariesPath)) {
  console.error("beneficiaries.json not found at", beneficiariesPath);
  console.error(
    'Create a file with an array of beneficiaries, e.g. [{"id":"alice","ens":"alice.refugeeaid.eth"}]'
  );
  process.exit(2);
}

const raw = fs.readFileSync(beneficiariesPath, "utf8");
let beneficiaries;
try {
  beneficiaries = JSON.parse(raw);
  if (!Array.isArray(beneficiaries)) throw new Error("expected array");
} catch (e) {
  console.error("Failed to parse beneficiaries.json:", e.message);
  process.exit(2);
}

// Build leaves: keccak256 of ENS name (lowercased) optionally plus metadata
const leaves = beneficiaries.map((b) => {
  const ens = (b.ens || b.address || b.id || "").toLowerCase();
  const meta = b.meta ? JSON.stringify(b.meta) : "";
  return keccak256(ens + "|" + meta);
});

const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = tree.getHexRoot();

const outDir = path.join(process.cwd(), "issuer-output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const proofsDir = path.join(outDir, "proofs");
if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir);

// Write root
fs.writeFileSync(
  path.join(outDir, "issuer_root.json"),
  JSON.stringify({ root }, null, 2)
);

// Emit per-user proofs
beneficiaries.forEach((b, i) => {
  const ens = (b.ens || b.address || b.id || "").toLowerCase();
  const meta = b.meta || null;
  const leafBuf = leaves[i];
  const leafHex = "0x" + leafBuf.toString("hex");

  // hex proof array
  const hexProof = tree.getHexProof(leafBuf);

  // also compute proof indices (0/1 for sibling ordering) from proof objects
  const proofObjects = tree.getProof(leafBuf);
  const proofPositions = proofObjects.map((p) =>
    p.position === "left" ? 0 : 1
  );

  const out = {
    id: b.id || ens || `user_${i}`,
    ens,
    meta,
    leaf: leafHex,
    proof: hexProof,
    proofPositions,
    root,
  };

  const filename = path.join(proofsDir, `${out.id}.json`);
  fs.writeFileSync(filename, JSON.stringify(out, null, 2));
});

console.log("Issuer output written to", outDir);
console.log("Root:", root);
console.log("Per-user proofs in", proofsDir);
console.log(
  "Sample file:",
  path.join(
    proofsDir,
    `${beneficiaries[0].id || beneficiaries[0].ens || "user_0"}.json`
  )
);
