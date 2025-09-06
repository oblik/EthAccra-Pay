const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const gatewayAddr = process.env.GATEWAY_ADDRESS;
  const companyNode = process.env.COMPANY_NODE;
  if (!gatewayAddr || !companyNode) {
    console.error(
      "Missing environment variables. Set GATEWAY_ADDRESS and COMPANY_NODE."
    );
    console.error(
      "Example: GATEWAY_ADDRESS=0x... COMPANY_NODE=0x... npx hardhat run scripts/test-pay.js --network localhost"
    );
    process.exit(1);
  }

  const [payer] = await ethers.getSigners();
  console.log("Using payer:", payer.address);

  const gateway = await ethers.getContractAt("PaymentGateway", gatewayAddr);

  // read registered company info
  const comp = await gateway.companies(companyNode);
  const teamRoot = comp.teamRoot;
  console.log("Company teamRoot:", teamRoot);

  const amountEth = process.env.AMOUNT_ETH || "0.01";
  const amountWei = ethers.parseEther(amountEth);

  // choose or read nonce/nullifier/proof
  const nonce = process.env.NONCE || ethers.hexlify(ethers.randomBytes(32));
  const nullifier =
    process.env.NULLIFIER ||
    ethers.keccak256(ethers.toUtf8Bytes(ethers.hexlify(ethers.randomBytes(8))));
  const paymentCommitment = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "bytes32"],
      [companyNode, amountWei, nonce]
    )
  );
  const proof = process.env.PROOF || "0x"; // mock verifier ignores proof, but we supply something valid-looking

  console.log("paymentCommitment:", paymentCommitment);
  console.log("nonce:", nonce);
  console.log("nullifier:", nullifier);

  const membershipPublic = [teamRoot, nullifier, paymentCommitment];

  console.log("Sending payETHWithProof with value", amountEth, "ETH...");

  const tx = await gateway
    .connect(payer)
    .payETHWithProof(companyNode, proof, membershipPublic, paymentCommitment, {
      value: amountWei,
    });
  const rcpt = await tx.wait();
  console.log("Paid ETH! Tx:", rcpt.transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
