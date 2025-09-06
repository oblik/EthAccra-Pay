const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const zerionAddress = "0x52d5a63d279c0594DfC250C218C880fd77660D03";

  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );
  console.log("Funding Zerion wallet:", zerionAddress);

  const tx = await deployer.sendTransaction({
    to: zerionAddress,
    value: ethers.parseEther("0.1"), // Send 0.1 ETH for testing
  });

  await tx.wait();
  console.log("Transaction hash:", tx.hash);
  console.log(
    "Zerion wallet balance:",
    ethers.formatEther(await ethers.provider.getBalance(zerionAddress))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
