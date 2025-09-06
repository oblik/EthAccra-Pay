# EthAccra Pay — Full Package (ETH + ERC20 + ENS + Noir ZK workflow)

This package provides a complete, ship-ready scaffold for your EthAccra project.
It includes:

- PaymentGateway smart contract (ETH + ERC20 support) with ZK verifier hook.
- ENS support: resolves via on-chain ENS Registry & Resolver (Sepolia) OR a local SimpleENS for local demos.
- Frontend (Vite + React) that lets users: connect wallet, register a demo company (local), create payment commitments, paste/upload Noir proofs & public inputs, and pay in ETH or ERC20.
- Hardhat scripts for local testing and Sepolia deployment.

IMPORTANT: This repo includes a **Verifier placeholder** file. You must generate a real Solidity verifier using Noir (`nargo codegen-verifier`) from the provided circuit and place the generated `Verifier.sol` into `contracts/contracts/Verifier.sol`. The README below shows exact steps.

Quick flow summary:

1. Build Noir circuit (provided template): `nargo check`, `nargo prove`, `nargo codegen-verifier`
2. Copy generated Verifier.sol into `contracts/contracts/Verifier.sol`
3. Deploy contracts to localhost or Sepolia (scripts included)
4. Run the frontend, connect wallet, paste proof/public inputs, and pay

## Refugee Aid use-case (ENS + ZKPs)

This repository can be pitched and repurposed as a privacy-preserving aid-disbursement platform for refugees and the unbanked. High-level summary:

- ENS acts as the human-friendly, persistent identity layer (e.g. `alice.refugeeaid.eth`).
- Noir circuits produce ZK proofs that assert credential membership and single-use of entitlements (nullifier) without revealing PII.
- `PaymentGateway` verifies proofs on-chain and forwards payments to ENS-resolved addresses while preventing double-claims.

What this repo already provides for the pitch:

- A `PaymentGateway` contract wired to accept ZK proofs and a local `SimpleENS` for demoing ENS resolution.
- A Noir circuit template in `circuits/membership` (currently using a placeholder hash) and CLI scaffolding for producing proofs and verifier code.
- A React frontend (`app/`) that computes commitments and can submit proofs/public inputs.
- A mock `Verifier.sol` so you can run a local demo while preparing real proofs/verifiers.

## Roadmap to target the Refugee Aid scenario (prioritized)

1. Short-term (demo-ready, 1–3 days):

- Provide a minimal issuer that bundles issued credentials into a Merkle root and publishes `issuer_root.json`.
- Keep the mock `Verifier.sol` so the frontend + `PaymentGateway` can be shown accepting claims and preventing double-claims (nullifiers).
- Add a demo flow in the README and deploy scripts that shows: issue credential → compute commitment → paste mock proof → pay.

2. Mid-term (secure PoC, 1–2 weeks):

- Replace the circuit placeholder hash with Poseidon and generate real proofs.
- Obtain a `nargo` binary that exposes `prove` and `codegen-verifier` (or run via the noir repo crate), run `nargo prove` and `nargo codegen-verifier`, copy the generated `Verifier.sol` into `contracts/contracts/Verifier.sol`, and re-deploy.
- Build a small issuer service (serverless or microservice) that issues credentials, provides Merkle proofs for beneficiaries, and supports key rotation / revocation roots.

3. Long-term (production-ready):

- Use an L2 or dedicated sidechain for low-cost settlement, gas-relayer for gasless claims, robust issuer governance (multisig), and audited smart contracts/circuits.
- Integrate mobile wallet UX for offline credential storage and QR-based claim flows.

## Immediate developer tasks (concrete)

- A: Add an issuer microservice that accepts a list of identities, computes a Merkle root, and emits per-user Merkle proofs (`issuer/` folder). Use this for demos and the pitch.
- B: Replace `hash_two` in `circuits/membership/src/main.nr` with a Poseidon call; run `nargo check` to validate syntax.
- C: Ensure you have a `nargo` binary with `prove` and `codegen-verifier` (either download an official release or run the noir crate via `cargo`); then run `nargo prove --prover Prover.toml` and `nargo codegen-verifier` to produce a real `Verifier.sol`.
- D: Swap the mock `Verifier.sol` in `contracts/contracts/` with the generated verifier, recompile and redeploy with `npx hardhat run --network localhost scripts/deploy-local.js`.
- E: Add a minimal frontend flow for the aid issuer to deliver Merkle proofs to a beneficiary's wallet (QR or paste) and generate the ZK proof locally.

## Files added in this repo for the pitch

- `issuer/issuer.js` — simple Node issuer that creates a Merkle root and per-user proofs for demoing credentials.
- `circuits/membership/README_ADOPTION.md` — short instructions on replacing the placeholder hash with Poseidon and producing verifier code.

## Next step

I created a small issuer scaffold and an adoption note for the circuit. If you want, I can now:

- generate the issuer files (script + package.json) so you can run a demo issuer locally, or
- edit the Noir circuit to call Poseidon (if you prefer I modify the circuit now), or
- give exact commands to fetch/build a `nargo` binary that supports `prove` and `codegen-verifier` on macOS.

Which should I do next?
