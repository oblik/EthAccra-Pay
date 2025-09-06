const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [account] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(account.address);
  console.log(
    "Test account balance on",
    hre.network.name,
    ":",
    ethers.formatEther(balance),
    "ETH"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
