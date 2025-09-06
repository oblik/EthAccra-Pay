const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const zerionAddress = "0x33239bf40657DDf6a171b0390bC40D049876F76C";
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const balance = await provider.getBalance(zerionAddress);
  console.log(
    "Zerion wallet balance on Base Sepolia:",
    ethers.formatEther(balance),
    "ETH"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
