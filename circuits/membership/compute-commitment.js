// javascript
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
    // accept "0x..." or decimal string/number
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

const ensName = process.argv[2] || "company.eth";
const amountEth = process.argv[3] || "0.01";
const nonce = process.argv[4] || "0x5";

(async () => {
    const node = namehash(ensName);
    const amountWei = ethers.parseEther(amountEth);
    const nonce32 = normalizeToBytes32(nonce);
    const commitment = ethers.keccak256(
        ethers.solidityPacked(
            ["bytes32", "uint256", "bytes32"],
            [node, amountWei, nonce32]
        )
    );
    console.log("namehash:", node);
    console.log("amountWei:", amountWei.toString());
    console.log("nonce (bytes32):", nonce32);
    console.log("payment_commitment:", commitment);
})();