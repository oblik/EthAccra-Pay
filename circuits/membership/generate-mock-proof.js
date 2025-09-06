const fs = require("fs");
const path = require("path");

const inputsPath = process.argv[2] || "./inputs.json";
if (!fs.existsSync(inputsPath)) {
  console.error("inputs.json not found in current directory", inputsPath);
  console.error("Usage: node generate-mock-proof.js [inputs.json]");
  process.exit(2);
}

const inputs = JSON.parse(fs.readFileSync(inputsPath, "utf8"));
const team_root =
  inputs.team_root || inputs.issuer_root || inputs.teamRoot || "0x0";
const nullifier = inputs.nullifier || inputs.nullifier_hex || "0x0";
const payment_commitment =
  inputs.payment_commitment || inputs.paymentCommitment || "0x0";

function normalizeHexTo32(h) {
  if (!h) h = "0x0";
  if (typeof h !== "string") h = String(h);
  if (!h.startsWith("0x")) h = "0x" + h;
  let hex = h.slice(2);
  if (hex.length % 2 === 1) hex = "0" + hex;
  if (hex.length > 64) hex = hex.slice(-64); // take least-significant bytes if longer
  return hex.padStart(64, "0");
}

const a = normalizeHexTo32(team_root);
const b = normalizeHexTo32(nullifier);
const c = normalizeHexTo32(payment_commitment);

// Create a deterministic "proof" byte payload equal to abi.encodePacked(team_root, nullifier, payment_commitment)
const proofHex = "0x" + a + b + c;

const proofObj = {
  proof: proofHex,
  public_inputs: [team_root, nullifier, payment_commitment],
};

const baseDir = path.dirname(inputsPath);
fs.writeFileSync(
  path.join(baseDir, "proof.json"),
  JSON.stringify(proofObj, null, 2)
);
fs.writeFileSync(path.join(baseDir, "proof_hex.txt"), proofHex + "\n");
fs.writeFileSync(
  path.join(baseDir, "pub_inputs.json"),
  JSON.stringify(proofObj.public_inputs, null, 2)
);

console.log("Mock proof written to", path.join(baseDir, "proof.json"));
console.log("proof:", proofHex);
console.log("public_inputs:", JSON.stringify(proofObj.public_inputs));
