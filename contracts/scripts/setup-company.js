const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();

  const gatewayAddress = "0x9025798d5Fa4B679aA9bf059DdD806BBd7D5e97b";
  const ensAddress = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

  const gateway = await ethers.getContractAt("PaymentGateway", gatewayAddress);
  const ens = await ethers.getContractAt("SimpleENS", ensAddress);

  const node = ethers.keccak256(ethers.toUtf8Bytes("company.eth"));
  const teamRoot = ethers.keccak256(ethers.toUtf8Bytes("demo-team"));

  console.log("Registering company...");
  const tx1 = await gateway.registerCompany(
    node,
    teamRoot,
    ethers.parseEther("1000")
  );
  await tx1.wait();
  console.log("Company registered");

  console.log("Setting ENS address...");
  const tx2 = await ens.setAddr(node, deployer.address);
  await tx2.wait();
  console.log("ENS address set");

  console.log("Setup complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
