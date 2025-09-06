/* Poseidon Merkle membership skeleton
   Public inputs: team_root, nullifier, payment_commitment (Field)
   Private inputs: leaf, path_elements[16], path_indices[16], nonce

   NOTE: This recomputes a Merkle root by iterating the path_elements/path_indices.
   The file currently contains a safe fallback hash (`hash_two`) so `nargo check`
   and local development can continue. For production you MUST replace `hash_two`
   with a Poseidon two-input hash from your Noir stdlib or vendored implementation.

   Example (non-executable placeholder):

   // If your nargo exposes Poseidon, you might call it like this:
   // use core::hashes::poseidon::poseidon;
   // fn hash_two(a: Field, b: Field) -> Field {
   //     // compute Poseidon on the two-field array
   //     poseidon([a, b])
   // }

   The exact import path and function name depend on the Noir version you use.
   See `circuits/membership/NARGO_PROVE_GUIDE.md` for recommended commands to
   obtain a nargo binary with Poseidon and how to generate a Solidity verifier.
*/

// TEMPORARY placeholder two-input hash. REPLACE with Poseidon from your Noir stdlib.
fn hash_two(a: Field, b: Field) -> Field {
    // deterministic simple combination for local testing only
    a + b * Field::from(7u128)
}

fn main(
    team_root: pub Field,
    nullifier: pub Field,
    payment_commitment: pub Field,
    leaf: Field,
    path_elements: [Field; 16],
    path_indices: [Field; 16],
    nonce: Field,
) {
    // Recompute the Merkle root by walking the path from leaf up to root
    let mut computed_root = leaf;

    // fixed-iteration loop for constrained circuits
    for i in 0..16 {
        let idx = path_indices[i];
        let sibling = path_elements[i];
        if idx == Field::from(0u128) {
            // current node is left child
            computed_root = hash_two(computed_root, sibling);
        } else {
            // current node is right child
            computed_root = hash_two(sibling, computed_root);
        cd /Users/emmanuelagyei/Desktop/ethaccra-pay-full
        npx hardhat compile
        npx hardhat run --network localhost scripts/deploy-local.js        }
    }

    // root must match the public team root
    assert(computed_root == team_root);

    // Derive a nullifier from leaf and nonce (placeholder). Replace with your real nullifier derivation.
    let computed_null = hash_two(leaf, nonce);
    assert(computed_null == nullifier);

    // payment_commitment is accepted as a public input (not recomputed here).
    let _ = payment_commitment; // mark used to avoid warnings
}

// Placeholder hash_two remains for local testing.
// Replace with the real Poseidon implementation for production use.
