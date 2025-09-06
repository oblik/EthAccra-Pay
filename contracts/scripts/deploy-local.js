const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

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

async function main() {
  const [deployer] = await ethers.getSigners();
  const payout = ethers.Wallet.createRandom();

  console.log("Deployer:", deployer.address);
  console.log("Demo payout:", payout.address);

  const ENS = await ethers.getContractFactory("SimpleENS");
  const ens = await ENS.deploy();
  await ens.waitForDeployment();
  console.log("SimpleENS:", await ens.getAddress());

  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log("Verifier (placeholder):", await verifier.getAddress());

  const PG = await ethers.getContractFactory("PaymentGateway");
  const gateway = await PG.deploy(
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    await verifier.getAddress(),
    true,
    await ens.getAddress()
  );
  await gateway.waitForDeployment();
  console.log("PaymentGateway:", await gateway.getAddress());

  const node = namehash("company.eth");
  // Read teamRoot from issuer output
  const issuerRootPath = path.join(
    __dirname,
    "../..",
    "issuer",
    "issuer-output",
    "issuer_root.json"
  );
  const issuerData = JSON.parse(fs.readFileSync(issuerRootPath, "utf8"));
  const teamRoot = issuerData.root;
  await gateway.registerCompany(node, teamRoot, ethers.parseEther("1000"));
  console.log("Registered company:", node);

  await ens.setAddr(node, payout.address);
  console.log("Set company.eth ->", payout.address);

  console.log("\nCopy these to the frontend:");
  console.log("GATEWAY_ADDRESS=", await gateway.getAddress());
  console.log("SIMPLE_ENS_ADDRESS=", await ens.getAddress());
  console.log("COMPANY_NODE=", node);
  console.log("TEAM_ROOT=", teamRoot);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
