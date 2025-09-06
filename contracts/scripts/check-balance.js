const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const zerionAddress = "0x52d5a63d279c0594DfC250C218C880fd77660D03";
  const balance = await ethers.provider.getBalance(zerionAddress);
  console.log("Zerion wallet balance:", ethers.formatEther(balance), "ETH");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
