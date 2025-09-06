Adoption notes: replace placeholder hash with Poseidon and wire issuer root

This file documents the minimal steps to make the circuit production-ready and wire the issuer's Merkle root as a public input.

1. Replace placeholder hash in `circuits/membership/src/main.nr` with the Poseidon hash provided in the Noir stdlib or vendor a Poseidon implementation.

2. Update the circuit public inputs so one input is the issuer root (e.g., `team_root` or `issuer_root`). The circuit should verify the Merkle path against this root.

3. Produce a real proof using `nargo prove --prover Prover.toml` and generate a Solidity verifier via `nargo codegen-verifier`. Copy the generated `Verifier.sol` into `contracts/contracts/Verifier.sol`.

4. Update deployment scripts to publish the `issuer_root.json` (e.g., to IPFS or a public CDN) and ensure the frontend fetches it to verify proofs client-side where needed.

Notes on Poseidon

- If your local `nargo` does not expose Poseidon, vendor a Poseidon implementation compatible with your Noir version or use a released `nargo` that includes the standard library with Poseidon.

- Test the circuit with the mock proof flow first (existing `generate-mock-proof.js`) and then re-run with real proofs once your `nargo` works.
