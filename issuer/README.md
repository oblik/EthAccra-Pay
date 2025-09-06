Issuer microservice (demo)

Usage

1) Create `issuer/beneficiaries.json` with an array of beneficiaries. Example:

[
  { "id": "alice", "ens": "alice.refugeeaid.eth" },
  { "id": "bob", "ens": "bob.refugeeaid.eth" }
]

2) Install dependencies:

npm install

3) Run the issuer (it writes `issuer/issuer-output/issuer_root.json` and per-user proofs in `issuer/issuer-output/proofs`):

node issuer.js

How the outputs map to the repo

- `issuer_root.json` contains `{ root: "0x..." }` which represents the issuer's Merkle root. Place this file or its root value in a public location (or commit to IPFS) so frontends can fetch and verify proofs.
- Each `issuer-output/proofs/<id>.json` includes:
  - `leaf`: hex-encoded leaf for the beneficiary
  - `proof`: array of sibling hex hashes (merkletreejs format)
  - `proofPositions`: simple positions array indicating left/right ordering
  - `root`: the root which should match `issuer_root.json`

Demo integration notes

- Use the per-user `leaf` as the credential leaf when constructing the private inputs for the Noir prover.
- The proof (Merkle path) will be used as the private witness in the circuit so the prover can show membership against `root` (which will become a public input).
